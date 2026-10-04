/* Boot sequence: splash -> auto-update -> onboarding (first run) -> sign-in / dashboard. */
(() => {
  'use strict';
  const { ONBOARDED_KEY, MIN_SPLASH_MS } = ASB.cfg;
  const { $, $$, sleep, show } = ASB;

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

  /* ---------- auto-update from GitHub Releases ---------- */
  const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const isNewer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

  async function checkForUpdates() {
    if (!ASB.invoke) return;
    try {
      ASB.info = await ASB.invoke('app_info');
      $('#loginVer').textContent = ASB.info.version ? 'Version ' + ASB.info.version : '';
      if (!ASB.info.repo) return;                       // local dev build: no update source

      setStatus('Checking for updates');
      const res = await Promise.race([
        fetch('https://api.github.com/repos/' + ASB.info.repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } }),
        sleep(8000).then(() => null),
      ]);
      if (!res || !res.ok) return;
      const rel = await res.json();
      const latest = String(rel.tag_name || '').replace(/^v/, '');
      if (!latest || !isNewer(latest, ASB.info.version)) return;

      const asset = ASB.info.os === 'windows' ? 'ASBDataGhana.exe' : ASB.info.os === 'macos' ? 'ASBDataGhana-mac.tar.gz' : null;
      if (!asset || !(rel.assets || []).some((a) => a.name === asset)) return;

      $('#updVersion').textContent = 'v' + latest;
      show('update');
      await ASB.invoke('apply_update', { asset });      // downloads, installs and restarts the app
      await new Promise(() => {});
    } catch (err) {
      console.warn('Update skipped:', err);
      show('splash');
    }
  }

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
    enter();
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

  /* ---------- enter the app ---------- */
  let retryTimer;
  async function enter() {
    clearTimeout(retryTimer);
    if (!ASB.session.token) return ASB.showLogin();
    show('handoff');
    try {
      await Promise.all([ASB.verifySession(), sleep(700)]);
      ASB.enterApp();
    } catch (e) {
      if (e.status === 401) return ASB.showLogin();
      if (e.offline) {
        show('offline');
        retryTimer = setTimeout(() => { if ($('#offline').classList.contains('is-active')) enter(); }, 10000);
        return;
      }
      ASB.showLogin(e.message);
    }
  }
  $('#retry').addEventListener('click', enter);

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
    if (seen) enter(); else { show('onboarding'); goTo(0); }
  })();
})();
