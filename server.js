const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const connectPg = require('connect-pg-simple');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions (expire);
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`).catch(err => console.error('DB init error:', err));

const PgStore = connectPg(session);
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'gaming-hub-secret',
  store: new PgStore({
    pool,
    createTableIfMissing: false,
    tableName: 'sessions',
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

app.set('trust proxy', 1);
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

let oidcConfig = null;
async function getOidcConfig() {
  if (oidcConfig) return oidcConfig;
  const openidClient = await import('openid-client');
  oidcConfig = await openidClient.discovery(
    new URL(process.env.ISSUER_URL || 'https://replit.com/oidc'),
    process.env.REPL_ID
  );
  return oidcConfig;
}

async function setupAuthRoutes() {
  const openidClient = await import('openid-client');
  const { Strategy } = await import('openid-client/passport');
  const config = await getOidcConfig();

  const registeredStrategies = new Set();

  const ensureStrategy = (domain) => {
    const name = `replitauth:${domain}`;
    if (!registeredStrategies.has(name)) {
      const strategy = new Strategy(
        {
          name,
          config,
          scope: 'openid email profile offline_access',
          callbackURL: `https://${domain}/api/callback`,
        },
        async (tokens, verified) => {
          const claims = tokens.claims();
          const user = {
            id: claims.sub,
            email: claims.email,
            firstName: claims.first_name,
            lastName: claims.last_name,
            profileImageUrl: claims.profile_image_url,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: claims.exp,
          };
          try {
            await pool.query(
              `INSERT INTO users (id, email, first_name, last_name, profile_image_url, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT (id) DO UPDATE SET email=$2, first_name=$3, last_name=$4, profile_image_url=$5, updated_at=NOW()`,
              [user.id, user.email, user.firstName, user.lastName, user.profileImageUrl]
            );
          } catch (e) { console.error('Upsert user error:', e); }
          verified(null, user);
        }
      );
      passport.use(strategy);
      registeredStrategies.add(name);
    }
  };

  app.get('/api/login', (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: 'login consent',
      scope: ['openid', 'email', 'profile', 'offline_access'],
    })(req, res, next);
  });

  app.get('/api/callback', (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: '/',
      failureRedirect: '/api/login',
    })(req, res, next);
  });

  app.get('/api/logout', (req, res) => {
    req.logout(() => {
      res.redirect(
        openidClient.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  app.get('/api/auth/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      profileImageUrl: req.user.profileImageUrl,
    });
  });
}

setupAuthRoutes().catch(err => console.error('Auth setup error:', err));

app.use(express.static(path.join(__dirname)));

const players = new Map();
let nextPlayerId = 1;
const COLORS = ['#00ff00', '#ff3333', '#3399ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00'];
const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
const ARENA = 800;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(data); });
}

function broadcastState() {
  const state = { type: 'state', players: {} };
  for (const [id, p] of players) {
    state.players[id] = {
      x: p.x, y: p.y, z: p.z,
      rx: p.rx, ry: p.ry, rz: p.rz, rw: p.rw,
      health: p.health, maxHealth: p.maxHealth,
      score: p.score, kills: p.kills,
      color: p.color, name: p.name,
      shooting: p.shooting, alive: p.alive, boosting: p.boosting
    };
  }
  broadcast(state);
}

wss.on('connection', (ws) => {
  const id = nextPlayerId++;
  const colorIdx = (id - 1) % COLORS.length;
  const player = {
    x: (Math.random() - 0.5) * ARENA,
    y: (Math.random() - 0.5) * ARENA,
    z: (Math.random() - 0.5) * ARENA,
    rx: 0, ry: 0, rz: 0, rw: 1,
    health: 250, maxHealth: 250,
    score: 0, kills: 0,
    color: COLORS[colorIdx], name: NAMES[colorIdx],
    shooting: false, alive: true, boosting: false,
    ws: ws
  };
  players.set(id, player);

  ws.send(JSON.stringify({ type: 'welcome', id, color: player.color, name: player.name }));
  broadcast({ type: 'chat', message: `${player.name} joined the battle!`, color: player.color });
  broadcast({ type: 'playerCount', count: players.size });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      const p = players.get(id);
      if (!p) return;

      if (msg.type === 'update') {
        p.x = msg.x; p.y = msg.y; p.z = msg.z;
        p.rx = msg.rx; p.ry = msg.ry; p.rz = msg.rz; p.rw = msg.rw;
        p.shooting = msg.shooting;
        p.alive = msg.alive;
        p.boosting = msg.boosting;
      }

      if (msg.type === 'bullet') {
        broadcast({ type: 'bullet', bullet: { ...msg.bullet, ownerId: id, ownerColor: p.color } });
      }

      if (msg.type === 'hit') {
        const target = players.get(msg.targetId);
        if (target && target.alive) {
          target.health -= msg.damage;
          broadcast({ type: 'hit', targetId: msg.targetId, damage: msg.damage, attackerId: id });
          if (target.health <= 0) {
            target.health = 0;
            target.alive = false;
            p.kills++;
            p.score += 100;
            broadcast({ type: 'kill', killerId: id, killerName: p.name, killerColor: p.color, victimId: msg.targetId, victimName: target.name, victimColor: target.color });
            setTimeout(() => {
              if (players.has(msg.targetId)) {
                target.health = 250;
                target.alive = true;
                target.x = (Math.random() - 0.5) * ARENA;
                target.y = (Math.random() - 0.5) * ARENA;
                target.z = (Math.random() - 0.5) * ARENA;
              }
            }, 3000);
          }
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    const p = players.get(id);
    if (p) broadcast({ type: 'chat', message: `${p.name} left the battle.`, color: p.color });
    players.delete(id);
    broadcast({ type: 'playerCount', count: players.size });
  });
});

setInterval(broadcastState, 1000 / 30);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
