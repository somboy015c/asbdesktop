/* Shared helpers: namespace, API client, formatting, toasts, dialogs. */
(() => {
  'use strict';
  const CFG = window.ASB_CONFIG;
  const ASB = (window.ASB = { cfg: CFG, views: {}, info: { version: '', repo: '', os: '' } });

  const tauri = window.__TAURI__ || {};
  ASB.invoke = tauri.core && tauri.core.invoke ? tauri.core.invoke.bind(tauri.core) : null;
  ASB.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  ASB.$ = (s, r = document) => r.querySelector(s);
  ASB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- formatting ---------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ASB.esc = esc;
  ASB.money = (n) => 'GH₵' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ASB.num = (n) => Number(n || 0).toLocaleString('en-GH');
  ASB.date = (iso, withTime = true) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const o = withTime ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleString('en-GB', o);
  };
  ASB.label = (s) => { const t = String(s || '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  ASB.icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  ASB.pill = (text, tone) => `<span class="pill pill-${tone}">${esc(text)}</span>`;

  const TONES = {
    order: { delivered: 'green', paid: 'green', failed: 'red', pending_payment: 'amber', processing: 'amber' },
    tx: { success: 'green', paid: 'green', failed: 'red', initialized: 'amber' },
    agent: { approved: 'green', rejected: 'red', pending: 'amber' },
    wd: { paid: 'green', rejected: 'red', pending: 'amber' },
  };
  ASB.statusPill = (kind, status) => ASB.pill(ASB.label(status), (TONES[kind] || {})[status] || 'gray');

  /* ---------- session ---------- */
  ASB.session = {
    get token() { try { return localStorage.getItem(CFG.TOKEN_KEY); } catch (_) { return null; } },
    set(token, user) { try { localStorage.setItem(CFG.TOKEN_KEY, token); localStorage.setItem(CFG.USER_KEY, JSON.stringify(user || {})); } catch (_) {} },
    clear() { try { localStorage.removeItem(CFG.TOKEN_KEY); localStorage.removeItem(CFG.USER_KEY); } catch (_) {} },
    get user() { try { return JSON.parse(localStorage.getItem(CFG.USER_KEY) || '{}'); } catch (_) { return {}; } },
  };

  /* ---------- API client ---------- */
  class ApiError extends Error {
    constructor(message, status, data) { super(message); this.status = status; this.data = data; }
    get offline() { return this.status === 0; }
  }
  ASB.ApiError = ApiError;

  async function request(method, path, { query, body, auth = true } = {}) {
    let url = CFG.API_BASE + path;
    if (query) {
      const qs = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      if (s) url += '?' + s;
    }
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && ASB.session.token) headers.Authorization = 'Bearer ' + ASB.session.token;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    let res;
    try {
      res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctl.signal });
    } catch (_) {
      throw new ApiError("Can't reach the server. Check your internet connection.", 0);
    } finally {
      clearTimeout(timer);
    }

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (res.status === 401 && auth) {
      ASB.onUnauthorized && ASB.onUnauthorized();
      throw new ApiError('Your session has expired. Please sign in again.', 401, data);
    }
    if (!res.ok) {
      let msg = (data && data.message) || 'Something went wrong (' + res.status + ').';
      if (data && data.errors) {
        const first = Object.values(data.errors)[0];
        if (first && first[0]) msg = first[0];
      }
      throw new ApiError(msg, res.status, data);
    }
    return data;
  }
  ASB.api = {
    get: (p, query) => request('GET', p, { query }),
    post: (p, body) => request('POST', p, { body: body || {} }),
    login: (email, password) => request('POST', '/auth/login', { body: { email, password }, auth: false }),
  };

  /* ---------- toasts ---------- */
  ASB.toast = (message, kind = 'ok') => {
    const root = ASB.$('#toasts');
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.innerHTML = ASB.icon(kind === 'ok' ? 'check-circle' : 'alert') + '<span>' + esc(message) + '</span>';
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
    setTimeout(close, kind === 'ok' ? 4200 : 6500);
    el.addEventListener('click', close);
  };

  /* ---------- dialogs (confirm / prompt / form) ---------- */
  ASB.dialog = ({ title, message = '', fields = [], confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) =>
    new Promise((resolve) => {
      const root = ASB.$('#modalRoot');
      const back = document.createElement('div');
      back.className = 'modal-back';
      const fieldHtml = fields.map((f, i) => {
        const id = 'dlg-f' + i;
        let input;
        if (f.type === 'select') {
          input = `<select id="${id}" name="${f.name}">${f.options.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(f.value ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        } else {
          input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} autocomplete="off" />`;
        }
        return `<label class="field"><span>${esc(f.label)}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
      }).join('');
      back.innerHTML = `
        <form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate>
          <h3>${esc(title)}</h3>
          ${message ? `<p class="modal-msg">${esc(message)}</p>` : ''}
          ${fieldHtml}
          <p class="form-error" hidden></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-text" data-x>${esc(cancelText)}</button>
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-filled'}">${esc(confirmText)}</button>
          </div>
        </form>`;
      root.appendChild(back);
      requestAnimationFrame(() => back.classList.add('in'));
      const form = back.querySelector('form');
      const err = back.querySelector('.form-error');
      const done = (val) => {
        document.removeEventListener('keydown', onKey);
        back.classList.remove('in');
        setTimeout(() => back.remove(), 220);
        resolve(val);
      };
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey);
      back.addEventListener('mousedown', (e) => { if (e.target === back) done(null); });
      back.querySelector('[data-x]').addEventListener('click', () => done(null));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const first = Array.from(form.elements).find((el) => el.willValidate && !el.checkValidity());
        if (first) { err.textContent = first.validationMessage || 'Please fill in this field.'; err.hidden = false; first.focus(); return; }
        if (!fields.length) return done(true);
        const out = {};
        fields.forEach((f) => { out[f.name] = form.elements[f.name].value; });
        done(out);
      });
      setTimeout(() => { const f = form.querySelector('input,select'); (f || form.querySelector('[type=submit]')).focus(); }, 60);
    });
  ASB.confirm = (title, message, confirmText = 'Confirm', danger = false) => ASB.dialog({ title, message, confirmText, danger });
  ASB.askReason = async (title, message) => {
    const r = await ASB.dialog({ title, message, confirmText: 'Reject', danger: true, fields: [{ name: 'reason', label: 'Reason', required: true, maxlength: 255, placeholder: 'Shown to the person' }] });
    return r ? r.reason : null;
  };

  /* ---------- small UI helpers ---------- */
  ASB.countUp = (el, to, fmt) => {
    const dur = 700, t0 = performance.now(), end = Number(to) || 0;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(end);
    };
    requestAnimationFrame(step);
  };
  ASB.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  ASB.errorState = (err, retryId = 'retry') => `
    <div class="empty-state error">${ASB.icon(err && err.offline ? 'wifi-off' : 'alert')}
      <h3>${err && err.offline ? "You're offline" : 'Something went wrong'}</h3>
      <p>${esc(err && err.message)}</p>
      <button class="btn btn-tonal" data-retry="${retryId}">${ASB.icon('retry')}<span>Try again</span></button>
    </div>`;
  ASB.skeleton = (rows = 6) => `<div class="card skel">${Array.from({ length: rows }, () => '<i></i>').join('')}</div>`;

  /* ---------- ripple ---------- */
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest && e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });
})();
