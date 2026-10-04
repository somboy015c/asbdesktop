/* Runs at document start on every page loaded in the desktop window. */
(function () {
  'use strict';
  if (window.top !== window) return;

  // Lets the site know it is running inside the desktop app.
  window.__ASB_DESKTOP__ = true;

  var isLocal = location.protocol === 'tauri:' || /(^|\.)tauri\.localhost$/.test(location.hostname);
  if (isLocal) return; // splash / onboarding have their own styling

  // Hide the "Download App" menu - pointless inside the app itself.
  // Matches the current admin layout (.download-app / #downloadAppMenu),
  // anything tagged data-desktop-download, and any link to the app files.
  var HIDE = '.download-app,#downloadAppMenu,[data-desktop-download],a[href$="ASBDataGhana.exe"],a[href$="ASBDataGhana.dmg"]';

  var CSS =
    HIDE + '{display:none!important}' +
    '::-webkit-scrollbar{width:12px;height:12px}' +
    '::-webkit-scrollbar-thumb{background:#C5D3E6;border-radius:12px;border:3px solid transparent;background-clip:content-box}' +
    '::-webkit-scrollbar-thumb:hover{background:#9FB3CF;border:3px solid transparent;background-clip:content-box}' +
    'body{-webkit-font-smoothing:antialiased}' +
    '.sidebar,.sidebar *{user-select:none}' +
    '.sidebar nav a{transition:background-color .18s ease,color .18s ease,transform .18s ease}' +
    '.sidebar nav a:hover{transform:translateX(3px)}' +
    '.btn,button{transition:transform .12s ease,background-color .18s ease,box-shadow .18s ease,border-color .18s ease}' +
    '.btn:active,button:active{transform:scale(.97)}' +
    '.card,.stat-card{transition:box-shadow .2s ease,transform .2s ease}' +
    '.stat-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(23,27,87,.10)}' +
    '@keyframes asbEnter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.main{animation:asbEnter .32s cubic-bezier(.2,.8,.2,1) both}' +
    '.stat-grid .stat-card{animation:asbEnter .42s cubic-bezier(.2,.8,.2,1) both}' +
    '.stat-grid .stat-card:nth-child(2){animation-delay:.05s}' +
    '.stat-grid .stat-card:nth-child(3){animation-delay:.10s}' +
    '.stat-grid .stat-card:nth-child(4){animation-delay:.15s}' +
    'html.asb-leaving .main{opacity:0;transform:translateY(-4px);transition:opacity .14s ease,transform .14s ease}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';

  function whenRoot(fn) {
    if (document.documentElement) return fn();
    var mo = new MutationObserver(function () {
      if (document.documentElement) { mo.disconnect(); fn(); }
    });
    mo.observe(document, { childList: true });
  }

  whenRoot(function () {
    var style = document.createElement('style');
    style.id = 'asb-desktop-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add('is-desktop-app');
  });

  // Belt and braces: also remove the nodes once the DOM exists.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll(HIDE).forEach(function (el) {
      var box = el.closest ? el.closest('.download-app') : null;
      (box || el).remove();
    });
  });

  // Native apps have no browser context menu (keep it for text fields).
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
    e.preventDefault();
  });

  // Smooth page-to-page transitions + keep external links out of the window.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || a.hasAttribute('download') || /^(javascript:)/i.test(raw)) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }

    // New-tab or off-site links: navigate "in place" and let the native side
    // hand them to the default browser (see on_navigation in lib.rs).
    if (a.target === '_blank' || url.origin !== location.origin) {
      e.preventDefault();
      window.location.assign(url.href);
      return;
    }
    if (url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    document.documentElement.classList.add('asb-leaving');
    setTimeout(function () { window.location.assign(url.href); }, 140);
  }, true);

  window.open = function (u) {
    if (u) { try { window.location.assign(new URL(u, location.href).href); } catch (_) {} }
    return null;
  };

  window.addEventListener('pageshow', function () {
    document.documentElement.classList.remove('asb-leaving');
  });
})();
