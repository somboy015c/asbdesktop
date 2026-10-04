/* Generic searchable / sortable / paged table page + the list pages. */
(() => {
  'use strict';
  const { esc, icon, $, $$, money, date, label, statusPill, pill } = ASB;

  ASB.tableHtml = (columns, rows, { actions, sortState, extra } = {}) => {
    const head = columns.map((c) => {
      if (!c.sort || !sortState) return `<th>${esc(c.label)}</th>`;
      const on = sortState.sort === c.sort;
      const ic = on ? (sortState.dir === 'asc' ? 'chev-up' : 'chev-down') : 'sort';
      return `<th class="sortable${on ? ' sorted' : ''}"><button type="button" data-sort="${c.sort}">${esc(c.label)}${icon(ic, 'sort-ic')}</button></th>`;
    }).join('') + (actions ? '<th>Actions</th>' : '');
    const body = rows.map((r, i) =>
      `<tr style="--i:${Math.min(i, 12)}">${columns.map((c) => `<td>${c.cell(r)}</td>`).join('')}${actions ? `<td><div class="actions-cell">${actions(r, extra) || ''}</div></td>` : ''}</tr>`
    ).join('');
    return `<div class="table-wrap"><table class="${actions ? 'has-actions' : ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  function pager(meta) {
    if (!meta || meta.last_page <= 1) return '';
    const p = meta.page, last = meta.last_page, set = new Set([1, last, p - 1, p, p + 1]);
    const pages = [...set].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
    let btns = '', prev = 0;
    pages.forEach((n) => {
      if (n - prev > 1) btns += '<span class="pg gap">…</span>';
      btns += `<button type="button" class="pg${n === p ? ' on' : ''}" data-page="${n}">${n}</button>`;
      prev = n;
    });
    return `<nav class="pager"><p>Showing <b>${meta.from}</b> to <b>${meta.to}</b> of <b>${ASB.num(meta.total)}</b> results</p>
      <div class="pg-list">
        <button type="button" class="pg" data-page="${p - 1}" ${p <= 1 ? 'disabled' : ''} aria-label="Previous">${icon('chev-left')}</button>${btns}
        <button type="button" class="pg" data-page="${p + 1}" ${p >= last ? 'disabled' : ''} aria-label="Next">${icon('chev-right')}</button>
      </div></nav>`;
  }

  ASB.listPage = (cfg) => async (root, params = {}) => {
    const st = { page: 1, search: '', sort: cfg.sort || 'created_at', dir: 'desc', filters: Object.assign({}, params) };
    const filters = cfg.filters || [];
    const optHtml = (opts) => opts.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');

    root.innerHTML = `
      <div class="topbar"><h2>${esc(cfg.title)}</h2></div>
      <div class="filters">
        <label class="search">${icon('search')}<input type="search" id="fSearch" placeholder="${esc(cfg.searchPlaceholder)}" maxlength="100" autocomplete="off" /></label>
        ${filters.map((f) => `<select data-filter="${f.name}" aria-label="${esc(f.label)}">${optHtml(typeof f.options === 'function' ? [{ value: '', label: f.label }] : f.options)}</select>`).join('')}
        <button type="button" class="btn btn-tonal" id="fClear" hidden>${icon('x')}<span>Clear</span></button>
      </div>
      <div id="listBody"></div>`;

    const body = $('#listBody', root);
    const clearBtn = $('#fClear', root);
    $$('[data-filter]', root).forEach((s) => { if (st.filters[s.dataset.filter]) s.value = st.filters[s.dataset.filter]; });
    let rows = [], extra = {}, seq = 0, first = true;

    const dirty = () => !!(st.search || Object.values(st.filters).some(Boolean) || st.sort !== (cfg.sort || 'created_at') || st.dir !== 'desc');

    function refreshFilters(res) {
      filters.forEach((f) => {
        if (typeof f.options !== 'function') return;
        const sel = $(`[data-filter="${f.name}"]`, root);
        const cur = st.filters[f.name] || '';
        sel.innerHTML = optHtml(f.options(res));
        sel.value = cur;
      });
    }

    async function load() {
      const my = ++seq;
      if (first) body.innerHTML = ASB.skeleton(7); else body.classList.add('busy');
      clearBtn.hidden = !dirty();
      try {
        const res = await ASB.api.get(cfg.endpoint, Object.assign({ page: st.page, sort: st.sort, dir: st.dir, search: st.search }, st.filters));
        if (my !== seq) return;
        rows = res.data; extra = res;
        if (first) refreshFilters(res);
        draw(res);
        first = false;
      } catch (e) {
        if (my !== seq) return;
        body.classList.remove('busy');
        body.innerHTML = ASB.errorState(e);
      }
    }

    function draw(res) {
      body.classList.remove('busy');
      if (!rows.length) {
        body.innerHTML = `<div class="card empty-state">${icon('inbox')}<h3>${esc(cfg.emptyTitle || 'Nothing here')}</h3><p>${dirty() ? 'Nothing matches this filter. Try clearing it.' : esc(cfg.emptyText || '')}</p></div>`;
        return;
      }
      body.innerHTML = `<div class="card flush">${ASB.tableHtml(cfg.columns, rows, { actions: cfg.actions, sortState: st, extra: res })}</div>${pager(res.meta)}`;
    }

    $('#fSearch', root).addEventListener('input', ASB.debounce((e) => { st.search = e.target.value.trim(); st.page = 1; load(); }, 350));
    root.addEventListener('change', (e) => {
      const s = e.target.closest('[data-filter]'); if (!s) return;
      st.filters[s.dataset.filter] = s.value; st.page = 1; load();
    });
    clearBtn.addEventListener('click', () => {
      st.search = ''; st.sort = cfg.sort || 'created_at'; st.dir = 'desc'; st.filters = {}; st.page = 1;
      $('#fSearch', root).value = ''; $$('[data-filter]', root).forEach((s) => (s.value = '')); load();
    });
    body.addEventListener('click', async (e) => {
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) {
        const col = sortBtn.dataset.sort;
        if (st.sort === col) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = col; st.dir = 'asc'; }
        st.page = 1; return load();
      }
      const pg = e.target.closest('[data-page]');
      if (pg && !pg.disabled) { st.page = Number(pg.dataset.page); return load(); }
      const act = e.target.closest('[data-act]');
      if (act) {
        const row = rows.find((r) => String(r.id) === act.dataset.id);
        if (!row) return;
        act.disabled = true; act.classList.add('loading');
        try { await cfg.onAction(act.dataset.act, row, { reload: load, extra }); }
        catch (err) { ASB.toast(err.message || 'Action failed', 'err'); }
        finally { act.disabled = false; act.classList.remove('loading'); }
      }
    });

    await load();
  };

  const btn = (act, id, text, cls = 'btn-filled', ic = '') => `<button type="button" class="btn btn-sm ${cls}" data-act="${act}" data-id="${id}">${ic ? icon(ic) : ''}<span>${text}</span></button>`;
  const opts = (all, list) => [{ value: '', label: all }, ...list.map(([value, l]) => ({ value, label: l }))];
  const done = async (p, reload) => { const r = await p; ASB.toast(r.message || 'Done'); reload(); };

  /* ---------- Orders ---------- */
  ASB.orderColumns = [
    { label: 'Ref', sort: 'uuid', cell: (o) => `<code>${esc(o.ref)}</code>` },
    { label: 'User', cell: (o) => `${esc(o.customer)}<small>${esc(label(o.channel))}${o.guest_email ? ' · ' + esc(o.guest_email) : ''}</small>` },
    { label: 'Bundle', cell: (o) => `<b>${esc(o.bundle)}</b><small>${esc(o.network)}</small>` },
    { label: 'Recipient', sort: 'recipient_number', cell: (o) => esc(o.recipient_number) },
    { label: 'Amount', sort: 'amount', cell: (o) => `<b>${money(o.amount)}</b>` },
    { label: 'Status', sort: 'status', cell: (o) => statusPill('order', o.status) },
    { label: 'Date', sort: 'created_at', cell: (o) => date(o.created_at) },
  ];
  ASB.views.orders = ASB.listPage({
    title: 'Orders', endpoint: '/orders', searchPlaceholder: 'Search number, ref, name or email',
    emptyTitle: 'No orders yet', emptyText: 'Orders will show up here as customers buy bundles.',
    filters: [{ name: 'status', label: 'All statuses', options: opts('All statuses', ['pending_payment', 'paid', 'processing', 'delivered', 'failed', 'refunded'].map((s) => [s, label(s)])) }],
    columns: ASB.orderColumns,
    actions: (o) => (['failed', 'paid'].includes(o.status) ? btn('retry', o.id, 'Retry', 'btn-filled', 'retry') + btn('refund', o.id, 'Refund', 'btn-danger-tonal') : ''),
    async onAction(act, o, { reload }) {
      if (act === 'retry') return done(ASB.api.post(`/orders/${o.id}/retry`), reload);
      if (act === 'refund') {
        if (!(await ASB.confirm('Mark as refunded?', 'The order is marked refunded and the amount goes back to the buyer\'s wallet.', 'Mark refunded', true))) return;
        return done(ASB.api.post(`/orders/${o.id}/refund`), reload);
      }
    },
  });

  /* ---------- Transactions ---------- */
  ASB.views.transactions = ASB.listPage({
    title: 'Transactions', endpoint: '/transactions', searchPlaceholder: 'Search reference, name or email',
    emptyTitle: 'No transactions yet', emptyText: 'Payments show up here as customers pay for orders, agents top up, or pay for a plan.',
    filters: [
      { name: 'purpose', label: 'All types', options: opts('All types', [['order_payment', 'Order payment'], ['wallet_topup', 'Wallet top-up'], ['agent_plan', 'Agent plan payment']]) },
      { name: 'status', label: 'All statuses', options: opts('All statuses', [['initialized', 'Initialized'], ['success', 'Success'], ['failed', 'Failed']]) },
    ],
    columns: [
      { label: 'Reference', sort: 'reference', cell: (t) => `<code>${esc(t.reference)}</code>` },
      { label: 'User', cell: (t) => esc(t.user || '-') },
      { label: 'Type', sort: 'purpose', cell: (t) => esc(label(t.purpose)) },
      { label: 'Amount', sort: 'amount', cell: (t) => `<b>${money(t.amount)}</b>` },
      { label: 'Status', sort: 'status', cell: (t) => statusPill('tx', t.status) },
      { label: 'Date', sort: 'created_at', cell: (t) => date(t.created_at) },
    ],
  });

  /* ---------- Withdrawals ---------- */
  ASB.views.withdrawals = ASB.listPage({
    title: 'Withdrawal Requests', endpoint: '/withdrawals', searchPlaceholder: 'Search agent, email or MoMo number',
    emptyTitle: 'No withdrawal requests', emptyText: 'Agent payout requests will show up here.',
    filters: [{ name: 'status', label: 'All statuses', options: opts('All statuses', [['pending', 'Pending'], ['paid', 'Paid'], ['rejected', 'Rejected']]) }],
    columns: [
      { label: 'Agent', cell: (w) => `${esc(w.agent)}<small>${esc(w.email)}</small>` },
      { label: 'Amount', sort: 'amount', cell: (w) => `<b>${money(w.amount)}</b>` },
      { label: 'MoMo', sort: 'momo_network', cell: (w) => `${esc(w.momo_network)} - ${esc(w.momo_number)}` },
      { label: 'Status', sort: 'status', cell: (w) => statusPill('wd', w.status) + (w.admin_note ? `<small>${esc(w.admin_note)}</small>` : '') },
      { label: 'Requested', sort: 'created_at', cell: (w) => date(w.created_at) },
    ],
    actions: (w) => (w.status === 'pending' ? btn('pay', w.id, 'Mark paid', 'btn-filled', 'check') + btn('reject', w.id, 'Reject', 'btn-danger-tonal') : ''),
    async onAction(act, w, { reload }) {
      if (act === 'pay') {
        if (!(await ASB.confirm('Mark as paid?', `Confirm you have sent ${money(w.amount)} to ${w.momo_number} via MoMo. Their wallet was already debited when they requested this.`, 'Mark paid'))) return;
        return done(ASB.api.post(`/withdrawals/${w.id}/approve`), reload);
      }
      if (act === 'reject') {
        const reason = await ASB.askReason('Reject withdrawal', 'The amount is returned to the agent\'s wallet.');
        if (reason) return done(ASB.api.post(`/withdrawals/${w.id}/reject`, { reason }), reload);
      }
    },
  });

  /* ---------- Agent applications ---------- */
  ASB.views.agents = ASB.listPage({
    title: 'Agent Applications', endpoint: '/agent-applications', searchPlaceholder: 'Search business, owner, email or domain',
    emptyTitle: 'No agent applications', emptyText: 'They\'ll show up here as people apply to become agents.',
    filters: [{ name: 'status', label: 'All statuses', options: opts('All statuses', [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]) }],
    columns: [
      { label: 'Business', sort: 'business_name', cell: (a) => `<span class="biz">${a.logo_url ? `<img src="${esc(a.logo_url)}" alt="" />` : ''}${esc(a.business_name || '-')}</span>` },
      { label: 'Owner', cell: (a) => `${esc(a.owner_name || '-')}<small>${esc(a.owner_email || '')}</small>` },
      { label: 'Plan', sort: 'plan', cell: (a) => `${esc(a.plan_name || '-')}<br>${pill(label(a.plan_payment_status), a.plan_payment_status === 'paid' ? 'green' : 'amber')}` },
      { label: 'Website URL', sort: 'subdomain', cell: (a) => a.website ? `${esc(a.website)}<br>${pill(label(a.subdomain_status), a.subdomain_status === 'live' ? 'green' : 'amber')}${a.custom_domain ? `<small>Custom: ${esc(a.custom_domain)}</small>` : ''}` : pill('Not set', 'gray') },
      { label: 'Status', sort: 'status', cell: (a) => statusPill('agent', a.status) },
      { label: 'Applied', sort: 'created_at', cell: (a) => date(a.created_at, false) },
    ],
    actions: (a, x) => {
      const wildcard = x && x.provisioning_mode === 'wildcard';
      let h = '';
      if (a.status === 'pending' && a.business_name) {
        if (!wildcard && !a.subdomain_confirmed) {
          h += `<p class="note">Ask the technical team to set up <b>${esc(a.website)}</b>.</p>` + btn('confirm', a.id, 'Confirm URL created', 'btn-tonal');
        } else {
          if (!wildcard) h += '<p class="note ok">✓ Website URL confirmed - ready to approve.</p>';
          h += btn('approve', a.id, 'Approve', 'btn-filled', 'check');
        }
        h += btn('reject', a.id, 'Reject', 'btn-danger-tonal');
      } else if (a.status === 'pending') {
        h += '<span class="note">Awaiting business profile</span>';
      }
      if (a.status === 'approved') {
        h += btn('domain', a.id, 'Website URL', 'btn-tonal', 'pencil');
        if (a.plan === 'website_app_domain') h += btn('playstore', a.id, 'Play Store link', 'btn-tonal', 'pencil');
      }
      return h;
    },
    async onAction(act, a, { reload }) {
      const p = `/agent-applications/${a.id}`;
      if (act === 'confirm') {
        if (!(await ASB.confirm('Confirm website URL created?', 'Once confirmed, the Approve button appears.', 'Yes, it is created'))) return;
        return done(ASB.api.post(`${p}/confirm-subdomain`), reload);
      }
      if (act === 'approve') {
        if (!(await ASB.confirm('Approve this agent?', `${a.business_name} goes live and the agent is notified by email.`, 'Approve'))) return;
        return done(ASB.api.post(`${p}/approve`), reload);
      }
      if (act === 'reject') {
        const reason = await ASB.askReason('Reject application', 'Reason for rejecting this application:');
        if (reason) return done(ASB.api.post(`${p}/reject`, { reason }), reload);
      }
      if (act === 'domain') {
        const r = await ASB.dialog({ title: 'Update website URL', message: a.business_name, confirmText: 'Save URL', fields: [{ name: 'custom_domain', label: 'Custom domain', value: a.custom_domain || '', placeholder: 'e.g. store.theirdomain.com', hint: 'Leave blank to remove the custom domain.' }] });
        if (r) return done(ASB.api.post(`${p}/domain`, { custom_domain: r.custom_domain.trim() }), reload);
      }
      if (act === 'playstore') {
        const r = await ASB.dialog({ title: 'Play Store link', message: a.business_name, confirmText: 'Save link', fields: [{ name: 'play_store_url', label: 'Play Store URL', type: 'url', value: a.play_store_url || '', placeholder: 'https://play.google.com/store/apps/...', hint: 'Leave blank to use the default app link instead.' }] });
        if (r) return done(ASB.api.post(`${p}/play-store-url`, { play_store_url: r.play_store_url.trim() }), reload);
      }
    },
  });

  /* ---------- Users ---------- */
  ASB.views.users = ASB.listPage({
    title: 'Users', endpoint: '/users', searchPlaceholder: 'Search name, email, phone',
    emptyTitle: 'No users yet', emptyText: 'Customers and agents will show up here as they sign up.',
    filters: [
      { name: 'role', label: 'All roles', options: opts('All roles', [['customer', 'Customer'], ['agent', 'Agent'], ['admin', 'Admin']]) },
      { name: 'store', label: 'All sites', options: (res) => [{ value: '', label: 'All sites' }, { value: 'main', label: 'Main site only' }, { value: 'stores', label: 'All agent stores' }, ...(res.stores || []).map((s) => ({ value: s.id, label: s.name }))] },
    ],
    columns: [
      { label: 'Name', sort: 'name', cell: (u) => `<b>${esc(u.name)}</b>` },
      { label: 'Email', sort: 'email', cell: (u) => esc(u.email) },
      { label: 'Phone', cell: (u) => esc(u.phone || '-') },
      { label: 'Role', sort: 'role', cell: (u) => esc(label(u.role)) },
      { label: 'Account type', cell: (u) => u.store_name ? `${pill('Agent User', 'amber')}<small>${esc(u.store_name)}</small>` : pill('ASB User', 'gray') },
      { label: 'Wallet', cell: (u) => money(u.wallet_balance) },
      { label: 'Status', sort: 'status', cell: (u) => pill(label(u.status), u.status === 'active' ? 'green' : 'red') },
      { label: 'Joined', sort: 'created_at', cell: (u) => date(u.created_at, false) },
    ],
    actions: (u) => u.role === 'admin' ? '' :
      btn('toggle', u.id, u.status === 'active' ? 'Suspend' : 'Reactivate', u.status === 'active' ? 'btn-danger-tonal' : 'btn-filled') + btn('adjust', u.id, 'Adjust balance', 'btn-tonal'),
    async onAction(act, u, { reload }) {
      if (act === 'toggle') {
        const suspend = u.status === 'active';
        if (!(await ASB.confirm(suspend ? 'Suspend this user?' : 'Reactivate this user?', `${u.name} (${u.email})`, suspend ? 'Suspend' : 'Reactivate', suspend))) return;
        return done(ASB.api.post(`/users/${u.id}/toggle-status`), reload);
      }
      if (act === 'adjust') {
        const wallets = [{ value: 'customer', label: 'Customer wallet' }];
        if (u.role === 'agent') wallets.push({ value: 'agent', label: 'Agent wallet' });
        const r = await ASB.dialog({
          title: 'Adjust balance', message: `${u.name} - current total ${money(u.wallet_balance)}`, confirmText: 'Apply',
          fields: [
            { name: 'wallet_type', label: 'Wallet', type: 'select', options: wallets },
            { name: 'direction', label: 'Action', type: 'select', options: [{ value: 'credit', label: 'Add (credit)' }, { value: 'debit', label: 'Remove (debit)' }] },
            { name: 'amount', label: 'Amount (GH₵)', type: 'number', step: '0.01', min: '0.01', required: true },
            { name: 'reason', label: 'Reason (shown to the user)', required: true, maxlength: 255 },
          ],
        });
        if (r) return done(ASB.api.post(`/users/${u.id}/adjust-balance`, { wallet_type: r.wallet_type, direction: r.direction, amount: Number(r.amount), reason: r.reason }), reload);
      }
    },
  });
})();
