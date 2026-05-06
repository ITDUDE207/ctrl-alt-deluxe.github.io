document.addEventListener('DOMContentLoaded', async () => {
  const nav = document.querySelector('.navbar-nav');
  if (!nav) return;

  const authLi = document.createElement('li');
  authLi.className = 'nav-item ms-2';
  authLi.id = 'authContainer';
  authLi.innerHTML = '<span class="nav-link" style="color:#666 !important">Loading...</span>';
  nav.appendChild(authLi);

  try {
    const res = await fetch('/api/auth/user', { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      const name = user.firstName || user.email || 'User';
      const img = user.profileImageUrl
        ? `<img src="${user.profileImageUrl}" alt="" style="width:22px;height:22px;border-radius:50%;margin-right:6px;border:1px solid #00ff00;">`
        : '';
      authLi.innerHTML = `
        <span class="nav-link d-flex align-items-center" style="color:#00ff00 !important;gap:6px;">
          ${img}<span>${name}</span>
          <a href="/api/logout" class="nav-link" style="color:#ff3333 !important;padding:2px 8px;border:1px solid #ff3333;border-radius:4px;font-size:0.8rem;margin-left:8px;">Logout</a>
        </span>`;
    } else {
      authLi.innerHTML = '<a class="nav-link" href="/api/login" style="color:#00ffff !important;border:1px solid #00ffff;border-radius:4px;padding:4px 12px;">Login</a>';
    }
  } catch (e) {
    authLi.innerHTML = '<a class="nav-link" href="/api/login" style="color:#00ffff !important;border:1px solid #00ffff;border-radius:4px;padding:4px 12px;">Login</a>';
  }
});
