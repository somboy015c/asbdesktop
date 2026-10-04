/* Screens, sidebar navigation, sign-in and session handling. */
(() => {
  'use strict';
  const { $, $$, esc, icon } = ASB;

  ASB.show = (id) => $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));

  /* ---------- navigation ---------- */
  const NAV = [
    ['dashboard', 'Dashboard', 'dashboard'], ['orders', 'Orders', 'package'], ['transactions', 'Transactions', 'receipt'],
    ['agents', 'Agent Applications', 'user-check'], ['users', 'Users', 'users'], ['bundles', 'Bundles & Pricing', 'layers'],
    ['withdrawals', 'Withdrawals', 'wallet'], ['settings', 'Settings', 'settings'],
  ];
  let current = { name: 'dashboard', params: {} }, navSeq = 0;
  const nav = $('#nav'), hl = $('#navHl'), main = $('#main');

  nav.insertAdjacentHTML('beforeend', NAV.map(([key, text, ic], i) =>
    `<button type="button" class="nav-item" data-nav="${key}" title="${esc(text)} (Ctrl+${i + 1})">${icon(ic)}<span>${esc(text)}</span><em class="badge" data-badge="${key}" hidden></em></button>`).join(''));

  function moveHighlight() {
    const a = $(`.nav-item[data-nav="${current.name}"]`, nav);
    if (!a) return;
    hl.style.transform = `translateY(${a.offsetTop}px)`;
    hl.style.height = a.offsetHeight + 'px';
    hl.style.opacity = 1;
    $$('.nav-item', nav).forEach((n) => n.classList.toggle('active', n === a));
  }
  window.addEventListener('resize', moveHighlight);

  ASB.setBadges = (b) => Object.entries(b).forEach(([k, v]) => {
    const el = $(`[data-badge="${k}"]`, nav); if (!el) return;
    el.textContent = v > 99 ? '99+' : v; el.hidden = !v;
  });

  ASB.go = async (name, params = {}) => {
    if (!ASB.views[name]) name = 'dashboard';
    current = { name, params };
    const my = ++navSeq;
    moveHighlight();
    const page = document.createElement('div');
    page.className = 'page page-enter';
    main.replaceChildren(page);
    main.scrollTop = 0;
    try { await ASB.views[name](page, params); }
    catch (e) { if (my === navSeq) page.innerHTML = `<div class="topbar"><h2>${esc((NAV.find((n) => n[0] === name) || [])[1] || '')}</h2></div>` + ASB.errorState(e); }
  };
  nav.addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) ASB.go(b.dataset.nav); });
  main.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) ASB.go(current.name, current.params); });
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !$('#app').classList.contains('is-active')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= NAV.length) { e.preventDefault(); ASB.go(NAV[n - 1][0]); }
  });

  /* ---------- session ---------- */
  ASB.enterApp = () => {
    const u = ASB.session.user;
    $('#meName').textContent = u.name || u.email || 'Admin';
    $('#meAvatar').textContent = (u.name || u.email || 'A').trim().charAt(0).toUpperCase();
    $('#appVer').textContent = ASB.info.version ? 'Version ' + ASB.info.version : '';
    ASB.show('app');
    ASB.go('dashboard');
  };

  ASB.showLogin = (message) => {
    ASB.session.clear();
    main.replaceChildren();
    ASB.setBadges({ agents: 0, orders: 0 });
    $('#loginPass').value = '';
    const err = $('#loginErr');
    err.textContent = message || ''; err.hidden = !message;
    ASB.show('login');
    setTimeout(() => $('#loginEmail').focus(), 400);
  };
  ASB.onUnauthorized = () => { if ($('#app').classList.contains('is-active')) ASB.showLogin('Your session expired. Please sign in again.'); };

  ASB.verifySession = async () => {
    const me = await ASB.api.get('/me');
    ASB.session.set(ASB.session.token, me);
    return me;
  };

  $('#logoutBtn').addEventListener('click', async () => {
    const b = $('#logoutBtn'); b.disabled = true;
    try { await Promise.race([ASB.api.post('/auth/logout'), ASB.sleep(3000)]); } catch (_) {}
    b.disabled = false;
    ASB.showLogin();
  });

  /* ---------- sign-in form ---------- */
  const form = $('#loginForm'), btn = $('#loginBtn'), err = $('#loginErr');
  $('#loginEye').addEventListener('click', () => {
    const p = $('#loginPass'), show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#loginEye').innerHTML = icon(show ? 'eye-off' : 'eye');
    $('#loginEye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim(), pass = $('#loginPass').value;
    if (!email || !pass) { err.textContent = 'Enter your email and password.'; err.hidden = false; return; }
    err.hidden = true; btn.disabled = true; btn.classList.add('loading');
    try {
      const r = await ASB.api.login(email, pass);
      ASB.session.set(r.token, r.user);
      $('#loginPass').value = '';
      ASB.enterApp();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    }
    btn.disabled = false; btn.classList.remove('loading');
  });
})();
