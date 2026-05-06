# Gaming Hub

## Overview
A retro-styled gaming hub website with multiple games and pages, featuring a green/black hacker aesthetic theme using Bootstrap 5 and Courier New monospace font.

## Architecture
- **Server**: Node.js with Express + WebSocket (`ws` package) for multiplayer + Passport OIDC for Replit Auth
- **Frontend**: Static HTML pages with inline CSS/JS, Bootstrap 5
- **Port**: 5000
- **Auth**: Replit OIDC via passport + express-session + connect-pg-simple (PostgreSQL session store)
- **Database**: PostgreSQL (sessions + users table)

## Key Files
- `server.js` - Express + WebSocket server with Replit Auth (passport, session, OIDC routes)
- `auth.js` - Client-side auth script (Login/Logout button in navbar), included in all pages
- `index.html` - Home page with game cards and navigation
- `plane-game.html` - Sky Dogfight (real-time multiplayer via WebSocket, Three.js r128)
- `car-game.html` - Sandbox Car Driving (canvas game)
- `rpg.html` - Python RPG text adventure
- `flight-sim.html` - Flight Simulator (iframe embed)
- `fox-sim.html` - Fox Simulator 3D (iframe embed)
- `micro-farm.html` - Micro Farm (iframe embed)
- `wormhole.html` - Wormhole game (iframe embed)
- `tower-defense.html` - Tower Defense game (canvas-based, 4 tower types, endless waves)
- `info.html` - RPG game map and instructions

## Dependencies
- express, ws, passport, express-session, connect-pg-simple, openid-client

## Navigation
All pages share a consistent navbar with links to every page + auth.js for Login/Logout. When adding new pages, the nav must be updated in ALL HTML files AND add `<script src="auth.js"></script>` before `</body>`.

## Sky Dogfight Features
- 3D space combat with Three.js (r128), pointer-lock mouse controls
- Multiplayer via WebSocket, left/right click = tracer bolts, Caps Lock = homing missile (requires lock-on), Shift = afterburner boost
- **Realistic flight physics**: Momentum/inertia system with acceleration curves, velocity-based movement, drag, speed bleed on sharp turns, visible ship banking/roll on turns
- **Engine exhaust trails**: Persistent particle trails behind all ships (player, remote, drones) that change with speed/boost; cyan trails during boost
- **Damage smoke**: Ships below 50% HP emit gray smoke particles that intensify as health drops
- **Tracer bolts**: Elongated glowing laser bolts with bright white cores instead of small spheres; muzzle flash on fire
- **Shockwave explosions**: Expanding ring geometry on large explosions, spinning debris particles, screen-wide flash on nearby blasts
- **Camera shake**: Intensity-scaled shake on taking damage, with exponential decay
- **Hit flash & G-force vignette**: Red screen flash on damage, tunnel-vision vignette effect during sharp turns
- **Procedural audio (Web Audio API)**: Engine drone (sawtooth oscillator + lowpass filter, pitch/gain tied to speed), boost roar (looping noise + bandpass), laser zap (noise burst + bandpass), explosion rumble (filtered noise decay), missile lock warning beep (sine pulse)
- **Smart AI drones**: 3 tactics (pursuit, flanking, head-on), evasive barrel rolls when missiles approach, disengage-and-reposition when health is low, varied aggression
- **Environmental lighting**: Distant sun with glow sphere and lens flare sprite, hemisphere light for dramatic shadows
- 8 planets with collision damage, kill feed, scoreboard, respawn system
- AI drones: scorpion-tail mesh with stinger, 100 HP, fire long lasers, replace on death, 150pts on kill
- Player: 250 HP, 0.02 regen/frame, homing missiles (damage=25, speed 9→12, lock-on tracking)
- **Mobile gyroscope controls**: DeviceOrientation API for tilt-to-steer on mobile devices, on-screen touch buttons (fire, missile, boost), iOS permission request support, auto-enables gyro on game join, recalibrates on toggle

## Game Count
Currently 8 games/apps. The count is displayed on the home page stats section.
