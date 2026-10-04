/* Boot: animated splash -> auto-update -> onboarding (first run) -> your live admin panel. */
(() => {
  'use strict';
  const { ADMIN_URL, ONBOARDED_KEY, MIN_SPLASH_MS } = window.ASB_CONFIG;
  const tauri = window.__TAURI__ || {};
  const invoke = tauri.core && tauri.core.invoke ? tauri.core.invoke.bind(tauri.core) : null;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const show = (id) => $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));

  /* ---------- splash progress ---------- */
  const bar = $('#splashBar');
  const statusEl = $('#splashStatus');
  let shown = 0, target = 0;
  const setStatus = (t) => { statusEl.textContent = t; };
  const setTarget = (v) => { target = Math.max(target, v); };
  (function tick() {
    shown += (target - shown) * 0.06;
    bar.style.transform = 'scaleX(' + (shown / 100).toFixed(4) + ')';
    requestAnimationFrame(tick);
  })();

  /* ---------- auto-update from your GitHub release ---------- */
  const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const isNewer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

  async function checkForUpdates() {
    if (!invoke) return;
    try {
      const info = await invoke('app_info');
      if (!info.repo) return;                           // local dev build: no update source
      setStatus('Checking for updates');
      const res = await Promise.race([
        fetch('https://api.github.com/repos/' + info.repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } }),
        sleep(8000).then(() => null),
      ]);
      if (!res || !res.ok) return;
      const rel = await res.json();
      const latest = String(rel.tag_name || '').replace(/^v/, '');
      if (!latest || !isNewer(latest, info.version)) return;

      const asset = info.os === 'windows' ? 'ASBDataGhana.exe' : info.os === 'macos' ? 'ASBDataGhana-mac.tar.gz' : null;
      if (!asset || !(rel.assets || []).some((a) => a.name === asset)) return;

      $('#updVersion').textContent = 'v' + latest;
      show('update');
      await invoke('apply_update', { asset });          // downloads, installs, restarts
      await new Promise(() => {});
    } catch (err) {
      console.warn('Update skipped:', err);
      show('splash');
    }
  }

  /* ---------- connectivity + hand-off to the dashboard ---------- */
  async function reachable() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 7000);
    try {
      await fetch(ADMIN_URL, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
      return true;
    } catch (_) {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  let retryTimer;
  async function launch() {
    clearTimeout(retryTimer);
    show('handoff');
    const [ok] = await Promise.all([reachable(), sleep(900)]);
    if (!ok) {
      show('offline');
      retryTimer = setTimeout(() => { if ($('#offline').classList.contains('is-active')) launch(); }, 10000);
      return;
    }
    await sleep(250);
    location.replace(ADMIN_URL);
  }
  $('#retry').addEventListener('click', launch);

  /* ---------- onboarding ---------- */
  const arts = $$('.art'), copies = $$('.copy-item'), dots = $$('.dots i');
  const back = $('#obBack'), next = $('#obNext'), nextLabel = $('#obNextLabel'), nextIcon = $('#obNextIcon use');
  const last = copies.length - 1;
  let idx = 0;

  function goTo(i) {
    idx = Math.max(0, Math.min(last, i));
    arts.forEach((a, n) => a.classList.toggle('is-active', n === idx));
    copies.forEach((c, n) => { c.classList.toggle('is-active', n === idx); c.classList.toggle('is-past', n < idx); });
    dots.forEach((d, n) => d.classList.toggle('is-active', n === idx));
    back.classList.toggle('is-hidden', idx === 0);
    nextLabel.textContent = idx === last ? 'Get started' : 'Next';
    nextIcon.setAttribute('href', idx === last ? '#i-check' : '#i-arrow-right');
  }
  function finishOnboarding() {
    try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch (_) {}
    launch();
  }
  next.addEventListener('click', () => (idx < last ? goTo(idx + 1) : finishOnboarding()));
  back.addEventListener('click', () => goTo(idx - 1));
  $('#obSkip').addEventListener('click', finishOnboarding);
  dots.forEach((d, n) => d.addEventListener('click', () => goTo(n)));
  window.addEventListener('keydown', (e) => {
    if (!$('#onboarding').classList.contains('is-active')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') next.click();
    else if (e.key === 'ArrowLeft') back.click();
  });

  /* ---------- ripple on every button ---------- */
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest && e.target.closest('.btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });

  /* ---------- boot ---------- */
  (async function boot() {
    setTarget(28);
    sleep(900).then(() => setTarget(55));
    await Promise.all([sleep(MIN_SPLASH_MS), checkForUpdates()]);
    setStatus('Ready');
    setTarget(100);
    await sleep(500);

    let seen = false;
    try { seen = !!localStorage.getItem(ONBOARDED_KEY); } catch (_) {}
    if (seen) launch(); else { show('onboarding'); goTo(0); }
  })();
})();
