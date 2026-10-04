/* Dashboard, Bundles & Pricing and Settings pages. */
(() => {
  'use strict';
  const { esc, icon, $, $$, money, num } = ASB;

  /* ---------- Dashboard ---------- */
  const CARDS = [
    ['Revenue today', 'revenue_today', 'money', 'wallet'],
    ['Orders today', 'orders_today', 'num', 'package'],
    ['Pending / processing', 'pending_orders', 'num', 'refresh', { go: ['orders', { status: 'processing' }] }],
    ['Failed orders', 'failed_orders', 'num', 'alert', { go: ['orders', { status: 'failed' }], tone: 'red' }],
    ['Customers (main site)', 'total_customers', 'num', 'users'],
    ['Agent store customers', 'total_store_customers', 'num', 'users'],
    ['Total wallet balance', 'total_wallet_balance', 'money', 'wallet'],
    ['Agents', 'total_agents', 'num', 'user-check'],
    ['Pending agent applications', 'pending_agent_applications', 'num', 'user-check', { go: ['agents', { status: 'pending' }], tone: 'amber' }],
  ];

  function niceMax(max) {
    if (max <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  const short = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n)));

  function drawChart(el, d) {
    const top = niceMax(Math.max(0, ...d.revenue));
    const grid = [1, 0.75, 0.5, 0.25, 0].map((f) => `<div class="g" style="bottom:${f * 100}%"><span>${short(top * f)}</span></div>`).join('');
    const bars = d.labels.map((l, i) => {
      const tip = `${l} · ${money(d.revenue[i])} · ${d.orders[i]} order${d.orders[i] === 1 ? '' : 's'}`;
      return `<div class="col" data-tip="${esc(tip)}"><div class="sbar" style="--h:${(d.revenue[i] / top) * 100}%;--i:${i}"></div><span>${esc(l)}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="plot">${grid}<div class="cols">${bars}</div></div>`;
  }

  ASB.views.dashboard = async (root) => {
    root.innerHTML = `<div class="topbar"><h2>Dashboard</h2></div>${ASB.skeleton(3)}`;
    const d = await ASB.api.get('/dashboard');
    const w = d.vendor_wallet;
    let banner = '';
    if (w) {
      const txt = w.state === 'frozen' ? '<b>Wallet is frozen.</b> Orders will fail until this is resolved with support.'
        : w.state === 'low' ? `<b>Wallet balance is low: ${money(w.balance)}.</b> Top up soon to avoid failed orders.`
        : w.state === 'unavailable' ? `<b>Couldn't check wallet balance</b> - ${esc(w.message || '')}`
        : `Wallet balance: <b>${money(w.balance)}</b>`;
      banner = `<div class="banner ${esc(w.state)}">${icon(w.state === 'ok' ? 'check-circle' : 'alert')}<span>${txt}</span></div>`;
    }

    const cards = CARDS.map(([lab, key, fmt, ic, o = {}]) => {
      const tone = o.tone && d.stats[key] > 0 ? ' ' + o.tone : '';
      const inner = `<span class="chip-ic">${icon(ic)}</span><div class="label">${esc(lab)}</div><div class="value" data-key="${key}" data-fmt="${fmt}">0</div>`;
      return o.go ? `<button type="button" class="stat-card clickable${tone}" data-go="${o.go[0]}" data-params='${JSON.stringify(o.go[1] || {})}'>${inner}</button>` : `<div class="stat-card${tone}">${inner}</div>`;
    }).join('');

    const recent = d.recent_orders.length
      ? ASB.tableHtml(ASB.orderColumns.filter((c) => ['Ref', 'User', 'Bundle', 'Amount', 'Status', 'Date'].includes(c.label)).map((c) => (c.label === 'User' ? Object.assign({}, c, { label: 'Customer', cell: (o) => esc(o.customer) }) : c)), d.recent_orders)
        + `<p class="more"><button type="button" class="link" data-go="orders">View all orders ${icon('chev-right')}</button></p>`
      : `<div class="empty-state slim">${icon('inbox')}<p>No orders yet - they'll show up here as customers buy bundles.</p></div>`;

    root.innerHTML = `
      <div class="topbar"><h2>Dashboard</h2></div>
      ${banner}
      <div class="stat-grid">${cards}</div>
      <div class="card">
        <div class="card-head"><h3>Sales</h3>
          <div class="seg" id="period">${['daily', 'weekly', 'monthly', 'yearly'].map((p, i) => `<button type="button" data-period="${p}"${i ? '' : ' class="on"'}>${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
        </div>
        <div class="sales-chart" id="chart"></div>
      </div>
      <div class="card flush"><div class="card-head pad"><h3>Recent orders</h3></div>${recent}</div>`;

    $$('.value', root).forEach((el) => ASB.countUp(el, d.stats[el.dataset.key], el.dataset.fmt === 'money' ? money : (n) => num(Math.round(n))));
    ASB.setBadges && ASB.setBadges({ agents: d.stats.pending_agent_applications, orders: d.stats.failed_orders });

    const chart = $('#chart', root);
    async function loadChart(period) {
      chart.classList.add('busy');
      try { drawChart(chart, await ASB.api.get('/dashboard/chart', { period })); }
      catch (e) { chart.innerHTML = `<p class="note pad">${esc(e.message)}</p>`; }
      chart.classList.remove('busy');
    }
    $('#period', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-period]'); if (!b) return;
      $$('#period button', root).forEach((x) => x.classList.toggle('on', x === b));
      loadChart(b.dataset.period);
    });
    root.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]'); if (!g) return;
      let p = {}; try { p = JSON.parse(g.dataset.params || '{}'); } catch (_) {}
      ASB.go(g.dataset.go, p);
    });
    loadChart('daily');
  };

  /* ---------- Bundles & Pricing ---------- */
  ASB.views.bundles = async (root) => {
    root.innerHTML = `<div class="topbar"><h2>Bundles &amp; Pricing</h2></div>${ASB.skeleton(5)}`;
    const d = await ASB.api.get('/bundles');

    const row = (b) => `
      <tr data-id="${b.id}">
        <td><b>${esc(b.size_label)}</b></td>
        <td>${b.vendor_bundle_id ? `<code>${esc(b.vendor_bundle_id)}</code>` : '<span class="bad" title="No vendor mapping - orders on this bundle cannot be delivered">missing</span>'}</td>
        <td>${b.validity_days ? esc(b.validity_days) + 'd' : '-'}</td>
        <td>${money(b.vendor_price)}</td>
        <td><input class="num" type="number" step="0.1" min="0" max="500" data-f="markup" value="${esc(b.markup_percent ?? '')}" placeholder="${esc(d.default_markup_percent ?? '')}" title="Blank uses the default (${esc(d.default_markup_percent ?? '')}%)" /></td>
        <td><input class="num" type="number" step="0.1" min="0" max="500" data-f="agent" value="${esc(b.agent_markup_percent ?? '')}" placeholder="${esc(d.default_agent_markup_percent ?? '')}" title="Blank uses the default (${esc(d.default_agent_markup_percent ?? '')}%)" /></td>
        <td data-c="customer"><b>${money(b.customer_price)}</b></td>
        <td data-c="agent">${money(b.agent_price)}</td>
        <td><label class="switch"><input type="checkbox" data-f="active" ${b.is_active ? 'checked' : ''} ${b.vendor_bundle_id ? '' : 'disabled'} /><span></span></label></td>
        <td>${b.vendor_bundle_id ? `<button type="button" class="btn btn-sm btn-filled" data-save="${b.id}">Save</button>` : ''}</td>
      </tr>`;

    const nets = d.networks.filter((n) => n.bundles.length);
    const body = nets.length
      ? nets.map((n) => `<div class="card flush"><div class="card-head pad"><h3>${esc(n.name)}</h3></div><div class="table-wrap"><table class="edit">
          <thead><tr><th>Size</th><th>Vendor bundle ID</th><th>Validity</th><th>KT price</th><th>Markup % <small>(blank = default)</small></th><th>Agent markup %</th><th>Customer price</th><th>Agent price</th><th>Active</th><th></th></tr></thead>
          <tbody>${n.bundles.map(row).join('')}</tbody></table></div></div>`).join('')
      : `<div class="card empty-state">${icon('inbox')}<h3>No bundles yet</h3><p>Click "Sync with KT now" to pull in KT's current catalog.</p></div>`;

    root.innerHTML = `
      <div class="topbar"><h2>Bundles &amp; Pricing</h2>
        <button type="button" class="btn btn-filled" id="syncBtn">${icon('refresh')}<span>Sync with KT now</span></button></div>
      <p class="lede">Every bundle here comes straight from KT's live catalog. The only things you control per bundle are the markup % added on top of KT's price and whether it's switched on.</p>
      ${body}`;

    $('#syncBtn', root).addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; b.classList.add('loading');
      try {
        const r = await ASB.api.post('/bundles/sync');
        ASB.toast(r.message);
        if (r.warning) ASB.toast(r.warning, 'warn');
        ASB.views.bundles(root);
      } catch (err) { ASB.toast(err.message, 'err'); b.disabled = false; b.classList.remove('loading'); }
    });

    root.addEventListener('click', async (e) => {
      const save = e.target.closest('[data-save]'); if (!save) return;
      const tr = save.closest('tr');
      const val = (f) => { const v = $(`[data-f="${f}"]`, tr).value.trim(); return v === '' ? null : Number(v); };
      save.disabled = true; save.classList.add('loading');
      try {
        const r = await ASB.api.post(`/bundles/${save.dataset.save}`, { markup_percent: val('markup'), agent_markup_percent: val('agent'), is_active: $('[data-f="active"]', tr).checked });
        $('[data-c="customer"]', tr).innerHTML = `<b>${money(r.bundle.customer_price)}</b>`;
        $('[data-c="agent"]', tr).textContent = money(r.bundle.agent_price);
        tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
        ASB.toast(r.message);
      } catch (err) { ASB.toast(err.message, 'err'); }
      save.disabled = false; save.classList.remove('loading');
    });
  };

  /* ---------- Settings ---------- */
  ASB.views.settings = async (root) => {
    root.innerHTML = `<div class="topbar"><h2>Platform Settings</h2></div>${ASB.skeleton(2)}`;
    const s = await ASB.api.get('/settings');
    root.innerHTML = `
      <div class="topbar"><h2>Platform Settings</h2></div>
      <div class="card narrow">
        <label class="setting">
          <span class="switch"><input type="checkbox" id="guest" ${s.guest_checkout_enabled ? 'checked' : ''} /><span></span></span>
          <span><b>Allow guest checkout</b>
          <small>When on, anyone can buy data on the main site or on any agent's storefront without creating an account first. They just enter their name, email and phone at checkout, and an account is created for them automatically. Customers never need a transaction PIN either way; only agents do. When off, everyone must log in or register before buying.</small></span>
        </label>
        <button type="button" class="btn btn-filled" id="saveSettings"><span>Save</span></button>
      </div>`;
    $('#saveSettings', root).addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; b.classList.add('loading');
      try { const r = await ASB.api.post('/settings', { guest_checkout_enabled: $('#guest', root).checked }); ASB.toast(r.message); }
      catch (err) { ASB.toast(err.message, 'err'); }
      b.disabled = false; b.classList.remove('loading');
    });
  };
})();
