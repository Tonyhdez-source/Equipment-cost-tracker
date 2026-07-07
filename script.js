/* =========================================================================
   Equipment Cost Tracker — script.js
   Vanilla ES6+. No build step. Data persists in localStorage.

   Structure:
     1.  Config & schema
     2.  State + persistence (auto-save, backup, restore)
     3.  Utilities
     4.  Rendering: dashboard, table, analytics
     5.  CRUD + drawer form + comments
     6.  Search, filter, sort, paginate
     7.  Bulk actions + undo
     8.  Import / export (CSV, XLSX, JSON, PDF)
     9.  Charts
     10. Events, shortcuts, boot
   ========================================================================= */

(() => {
  'use strict';

  /* ============================ 1. Config & schema ======================= */

  const STORE_KEY  = 'ect.items.v1';
  const BACKUP_KEY = 'ect.backup.v1';
  const PREF_KEY   = 'ect.prefs.v1';

  // Soft passcode gate. NOTE: this is a convenience lock, not real security —
  // the code is visible in this file. To change it, edit PASSCODE below.
  const PASSCODE   = '1997';
  const UNLOCK_KEY = 'ect.unlocked.v1';

  // Column definitions drive the table, form, import mapping and export.
  const COLUMNS = [
    { key: 'name',        label: 'Equipment Name',       type: 'text',   required: true },
    { key: 'category',    label: 'Category',             type: 'text' },
    { key: 'manufacturer',label: 'Manufacturer',         type: 'text' },
    { key: 'model',       label: 'Model',                type: 'text' },
    { key: 'serial',      label: 'Serial Number',        type: 'text' },
    { key: 'vendor',      label: 'Vendor',               type: 'text' },
    { key: 'invoice',     label: 'Invoice Number',       type: 'text' },
    { key: 'purchaseDate',label: 'Purchase Date',        type: 'date' },
    { key: 'price',       label: 'Purchase Price',       type: 'number' },
    { key: 'quantity',    label: 'Quantity',             type: 'number' },
    { key: 'condition',   label: 'Condition',            type: 'select', options: ['New','Excellent','Good','Fair','Poor','Refurbished'] },
    { key: 'warranty',    label: 'Warranty Expiration',  type: 'date' },
    { key: 'replaceDate', label: 'Expected Replacement', type: 'date' },
    { key: 'location',    label: 'Location',             type: 'text' },
    { key: 'assetTag',    label: 'Asset Tag',            type: 'text' },
    { key: 'poNumber',    label: 'PO Number',            type: 'text' },
    { key: 'receivedBy',  label: 'Received By',          type: 'text' },
    { key: 'status',      label: 'Status',               type: 'select', options: ['Active','In Service','In Repair','In Storage','Retired','Broken'] },
    { key: 'repairVendor',label: 'Last Repair Vendor',   type: 'text' },
    { key: 'repairSent',  label: 'Repair Date Sent',     type: 'date' },
    { key: 'repairReturned',label: 'Repair Date Returned',type: 'date' },
    { key: 'repairReason',label: 'Last Repair Reason',   type: 'text' },
    { key: 'notes',       label: 'Comments / Notes',     type: 'textarea' },
    { key: 'updatedAt',   label: 'Last Updated',         type: 'date', readonly: true },
  ];
  const COL = Object.fromEntries(COLUMNS.map(c => [c.key, c]));

  // Suggested equipment categories (free-text field still allows others).
  const CATEGORIES = [
    'Slit Lamps', 'Stands', 'Exam Chairs', 'Phoropters', 'Auto Refractors',
    'Autoclaves', 'Indirects', 'Lensometers', 'Lasers', 'Tonometers',
    'OCT / Imaging', 'Visual Field', 'Topographers', 'IOL / Biometry',
    'IT / Network', 'Fleet', 'Other',
  ];

  // Columns shown in the table by default (others hidden but toggleable).
  const DEFAULT_VISIBLE = ['name','category','manufacturer','model','serial','vendor','purchaseDate','price','condition','warranty','location','status','repairReason','updatedAt'];

  // Searchable text fields.
  const SEARCH_KEYS = ['name','model','category','vendor','serial','notes','location','status','purchaseDate','price','repairVendor','repairReason','receivedBy'];

  /* ============================ 2. State ================================= */

  let items    = [];      // array of equipment records
  let prefs    = {};      // { theme, visibleCols, pageSize }
  let view     = { search: '', sort: { key: 'updatedAt', dir: 'desc' }, page: 1, filters: {} };
  let selected = new Set();
  let lastDeleted = null; // for undo
  let saveTimer = null;
  const charts = {};

  const uid = () => 'eq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null) {
      // First run: seed with the real MedTrack inventory.
      items = SEED.map(r => ({ id: uid(), favorite:false, archived:false, comments:[], updatedAt: new Date().toISOString().slice(0,10), ...r }));
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } else {
      try { items = JSON.parse(raw) || []; } catch { items = []; }
    }
    try { prefs = JSON.parse(localStorage.getItem(PREF_KEY)) || {}; }
    catch { prefs = {}; }
    prefs.theme       = prefs.theme || 'dark';
    prefs.visibleCols = prefs.visibleCols || DEFAULT_VISIBLE.slice();
    prefs.pageSize    = prefs.pageSize || 25;
  }

  // Auto-save (debounced). Also rolls a single "last" auto-backup.
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), items }));
      $('#lastSaved') && ($('#lastSaved').textContent = new Date().toLocaleString());
    }, 250);
  }
  function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }

  /* ============================ 3. Utilities ============================= */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

  const money = n => (isFinite(n) && n !== '' && n !== null)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+n)
    : '—';
  const moneyExact = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(+n || 0);
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—';

  function toast(msg, type = 'success', action) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.className = 'toast__undo'; b.textContent = action.label;
      b.onclick = () => { action.fn(); el.remove(); };
      el.appendChild(b);
    } else {
      const x = document.createElement('button'); x.textContent = '✕';
      x.onclick = () => el.remove(); el.appendChild(x);
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), action ? 7000 : 3200);
  }

  function warrantyState(d) {
    if (!d) return 'none';
    const days = (new Date(d) - Date.now()) / 86400000;
    if (days < 0) return 'expired';
    if (days <= 90) return 'expiring';
    return 'active';
  }

  /* ============================ 4. Rendering ============================= */

  function renderAll() {
    renderSummary();
    renderTable();
    renderDashboardExtras();
    renderWarranty();
    renderAnalytics();
    populateFilterOptions();
  }

  /* -------- Warranty alerts -------- */
  function daysUntil(d) { return Math.floor((new Date(d + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000); }

  function renderWarranty() {
    const active = items.filter(i => !i.archived && i.warranty);
    const expired = [], soon30 = [], soon90 = [];
    active.forEach(i => {
      const d = daysUntil(i.warranty);
      if (d < 0) expired.push(i);
      else if (d <= 30) soon30.push(i);
      else if (d <= 90) soon90.push(i);
    });
    expired.sort((a,b) => a.warranty.localeCompare(b.warranty));
    soon30.sort((a,b) => a.warranty.localeCompare(b.warranty));
    soon90.sort((a,b) => a.warranty.localeCompare(b.warranty));

    // Badge (expired + expiring 30d = urgent)
    const urgent = expired.length + soon30.length;
    const badge = $('#warrantyBadge');
    if (badge) { badge.hidden = urgent === 0; badge.textContent = urgent; }

    // Summary cards
    const covered = active.length - expired.length;
    const cards = [
      { icon:'✕', label:'Expired',              value: expired.length, sub: 'no longer covered', cls:'danger' },
      { icon:'!', label:'Expiring ≤ 90 days',   value: soon30.length + soon90.length, sub: `${soon30.length} within 30d`, cls:'warn' },
      { icon:'✓', label:'Currently covered',    value: covered, sub: `of ${active.length} with a date`, cls:'ok' },
    ];
    const cc = $('#warrantyCards');
    if (cc) cc.innerHTML = cards.map(c => `
      <div class="stat">
        <div class="stat__label"><span class="stat__icon" style="${c.cls==='danger'?'background:color-mix(in srgb,var(--danger) 18%,transparent);color:var(--danger)':c.cls==='warn'?'background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)':''}">${c.icon}</span>${c.label}</div>
        <div class="stat__value">${c.value}</div>
        <div class="stat__sub">${esc(c.sub)}</div>
      </div>`).join('');

    fillWarrantyTable('expired', expired);
    fillWarrantyTable('soon30', soon30);
    fillWarrantyTable('soon90', soon90);
  }

  function fillWarrantyTable(which, list) {
    const body = $(`#${which}Body`), empty = $(`#${which}Empty`), count = $(`#${which}Count`);
    if (!body) return;
    if (count) count.textContent = list.length;
    if (empty) empty.hidden = list.length > 0;
    body.innerHTML = list.map(i => {
      const d = daysUntil(i.warranty);
      const cls = d < 0 ? 'days-left--neg' : d <= 30 ? 'days-left--warn' : '';
      const label = d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d`;
      return `<tr data-id="${i.id}">
        <td><strong>${esc(i.name)}</strong><br><span class="muted" style="font-size:12px">${esc(i.category||'—')} · ${esc(i.location||'no location')}</span></td>
        <td>${esc(i.manufacturer || i.vendor || '—')}</td>
        <td>${fmtDate(i.warranty)}<br><span class="days-left ${cls}">${label}</span></td>
        <td>${money(+i.price||0)}</td>
        <td><button class="link-btn" data-open="${i.id}">Open</button></td>
      </tr>`;
    }).join('');
    $$(`#${which}Body [data-open]`).forEach(b => b.onclick = () => openDrawer(b.dataset.open));
  }

  function renderSummary() {
    const active = items.filter(i => !i.archived);
    const total  = active.length;
    const cost   = active.reduce((s, i) => s + (+i.price || 0) * (+i.quantity || 1), 0);
    const cats   = new Set(active.map(i => i.category).filter(Boolean)).size;
    const avg    = total ? cost / active.reduce((s,i)=>s+(+i.quantity||1),0) : 0;
    const recent = active.filter(i => i.purchaseDate).sort((a,b) => b.purchaseDate.localeCompare(a.purchaseDate))[0];

    const stats = [
      { icon:'▦', label:'Total Equipment',    value: total,                sub: `${active.reduce((s,i)=>s+(+i.quantity||1),0)} units` },
      { icon:'$', label:'Total Purchase Cost',value: money(cost),          sub: 'across all items' },
      { icon:'◷', label:'Most Recent Purchase',value: recent ? fmtDate(recent.purchaseDate) : '—', sub: recent ? recent.name : '—' },
      { icon:'≈', label:'Average Cost',       value: money(avg),           sub: 'per unit' },
      { icon:'⊞', label:'Categories',         value: cats,                 sub: 'distinct' },
    ];
    $('#summaryCards').innerHTML = stats.map(s => `
      <div class="stat">
        <div class="stat__label"><span class="stat__icon">${s.icon}</span>${s.label}</div>
        <div class="stat__value">${esc(s.value)}</div>
        <div class="stat__sub">${esc(s.sub)}</div>
      </div>`).join('');
  }

  function renderDashboardExtras() {
    const newest = items.filter(i => !i.archived && i.purchaseDate)
      .sort((a,b) => b.purchaseDate.localeCompare(a.purchaseDate)).slice(0, 6);
    $('#newestList').innerHTML = newest.length ? newest.map(rowHtml).join('')
      : `<p class="muted">No dated purchases yet.</p>`;
  }

  function rowHtml(i) {
    return `<div class="mini-row">
      <div class="mini-row__main">
        <div class="mini-row__title">${esc(i.name)}</div>
        <div class="mini-row__meta">${esc(i.category || '—')} · ${fmtDate(i.purchaseDate)}</div>
      </div>
      <div class="mini-row__val">${money((+i.price||0)*(+i.quantity||1))}</div>
    </div>`;
  }

  /* -------- Table -------- */

  function visibleCols() { return COLUMNS.filter(c => prefs.visibleCols.includes(c.key)); }

  function renderTableHead() {
    const cols = visibleCols();
    $('#tableHead').innerHTML = `<tr>
      <th class="th--check"><input type="checkbox" id="checkAll" aria-label="Select all"></th>
      ${cols.map(c => {
        const sorted = view.sort.key === c.key;
        const arrow = sorted ? (view.sort.dir === 'asc' ? '▲' : '▼') : '↕';
        return `<th class="th ${sorted?'is-sorted':''}" data-sort="${c.key}">${esc(c.label)}<span class="th__sort">${arrow}</span></th>`;
      }).join('')}
      <th>Actions</th>
    </tr>`;
    $('#checkAll').onchange = e => {
      const pageIds = currentPageRows().map(r => r.id);
      if (e.target.checked) pageIds.forEach(id => selected.add(id));
      else pageIds.forEach(id => selected.delete(id));
      renderTable();
    };
    $$('#tableHead [data-sort]').forEach(th => th.onclick = () => {
      const k = th.dataset.sort;
      view.sort = { key: k, dir: view.sort.key === k && view.sort.dir === 'asc' ? 'desc' : 'asc' };
      renderTable();
    });
  }

  function filteredItems() {
    const f = view.filters;
    const q = view.search.trim().toLowerCase();
    return items.filter(i => {
      if (!f.archived && i.archived) return false;
      if (f.archived && !i.archived) return false;
      if (f.fav && !i.favorite) return false;
      if (f.category && i.category !== f.category) return false;
      if (f.vendor   && i.vendor   !== f.vendor)   return false;
      if (f.status   && i.status   !== f.status)   return false;
      if (f.condition&& i.condition!== f.condition)return false;
      if (f.location && i.location !== f.location) return false;
      if (f.year && (i.purchaseDate || '').slice(0,4) !== f.year) return false;
      if (f.min != null && (+i.price || 0) < f.min) return false;
      if (f.max != null && (+i.price || 0) > f.max) return false;
      if (f.warranty) {
        const w = warrantyState(i.warranty);
        if (f.warranty === 'none' && w !== 'none') return false;
        if (f.warranty !== 'none' && w !== f.warranty) return false;
      }
      if (q) {
        const hay = SEARCH_KEYS.map(k => i[k]).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function sortedItems() {
    const { key, dir } = view.sort;
    const col = COL[key]; const mult = dir === 'asc' ? 1 : -1;
    return filteredItems().slice().sort((a, b) => {
      let x = a[key], y = b[key];
      if (col && col.type === 'number') { x = +x || 0; y = +y || 0; return (x - y) * mult; }
      x = (x ?? '').toString().toLowerCase(); y = (y ?? '').toString().toLowerCase();
      return x < y ? -1 * mult : x > y ? 1 * mult : 0;
    });
  }

  function currentPageRows() {
    const all = sortedItems();
    const size = prefs.pageSize;
    const pages = Math.max(1, Math.ceil(all.length / size));
    if (view.page > pages) view.page = pages;
    return all.slice((view.page - 1) * size, view.page * size);
  }

  function renderTable() {
    renderTableHead();
    const all = sortedItems();
    const rows = currentPageRows();
    const cols = visibleCols();

    $('#rowCount').textContent = all.length;
    $('#filterSummary').textContent = describeFilters();

    $('#emptyState').hidden = rows.length > 0;
    $('#tableBody').innerHTML = rows.map(i => {
      const cells = cols.map(c => `<td>${cellHtml(i, c)}</td>`).join('');
      return `<tr data-id="${i.id}" class="${selected.has(i.id)?'is-selected':''} ${i.archived?'is-archived':''}">
        <td class="td--check"><input type="checkbox" class="rowcheck" ${selected.has(i.id)?'checked':''}></td>
        ${cells}
        <td><div class="row-actions">
          <button class="icon-btn" data-act="fav" title="Favorite"><span class="fav-star ${i.favorite?'is-on':''}">${i.favorite?'★':'☆'}</span></button>
          <button class="icon-btn" data-act="edit" title="Edit">✎</button>
          <button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>
          <button class="icon-btn" data-act="del" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join('');

    // Row events
    $$('#tableBody tr').forEach(tr => {
      const id = tr.dataset.id;
      $('.rowcheck', tr).onchange = e => { e.target.checked ? selected.add(id) : selected.delete(id); syncBulk(); tr.classList.toggle('is-selected', e.target.checked); };
      $$('[data-act]', tr).forEach(btn => btn.onclick = () => rowAction(btn.dataset.act, id));
      tr.ondblclick = () => openDrawer(id);
    });

    // Pager
    const pages = Math.max(1, Math.ceil(all.length / prefs.pageSize));
    $('#pageInfo').textContent = `${view.page} / ${pages}`;
    $('#prevPage').disabled = view.page <= 1;
    $('#nextPage').disabled = view.page >= pages;
    syncBulk();
    const ca = $('#checkAll'); if (ca) ca.checked = rows.length && rows.every(r => selected.has(r.id));
  }

  function cellHtml(i, c) {
    const v = i[c.key];
    if (c.key === 'price') return `<span class="cell-price">${money((+v||0))}</span>`;
    if (c.key === 'status' && v) return `<span class="pill pill--${statusClass(v)}">${esc(v)}</span>`;
    if (c.key === 'warranty') {
      const w = warrantyState(v);
      return v ? `<span class="warranty-dot wd--${w}"></span>${fmtDate(v)}` : '—';
    }
    if (['purchaseDate','replaceDate','updatedAt'].includes(c.key)) return fmtDate(v);
    return esc(v || '—');
  }
  function statusClass(s) {
    s = (s||'').toLowerCase();
    if (s.includes('active') || s.includes('service')) return 'active';
    if (s.includes('repair')) return 'repair';
    if (s.includes('storage')) return 'storage';
    if (s.includes('retire')) return 'retired';
    if (s.includes('broken')) return 'broken';
    return 'active';
  }

  function describeFilters() {
    const f = view.filters; const parts = [];
    if (view.search) parts.push(`search "${view.search}"`);
    ['category','vendor','status','condition','location','year','warranty'].forEach(k => { if (f[k]) parts.push(`${k}: ${f[k]}`); });
    if (f.min != null) parts.push(`≥ ${money(f.min)}`);
    if (f.max != null) parts.push(`≤ ${money(f.max)}`);
    if (f.fav) parts.push('favorites');
    if (f.archived) parts.push('archived');
    return parts.length ? parts.join(' · ') : 'no filters';
  }

  /* ============================ 5. CRUD + drawer ======================== */

  let editingId = null;

  function buildForm() {
    const form = $('#equipForm');
    form.innerHTML = COLUMNS.filter(c => !c.readonly).map(c => {
      const span = (c.type === 'textarea') ? 'col-span' : '';
      let field;
      if (c.type === 'select') {
        field = `<select name="${c.key}"><option value="">—</option>${c.options.map(o=>`<option>${o}</option>`).join('')}</select>`;
      } else if (c.type === 'textarea') {
        field = `<textarea name="${c.key}" rows="3"></textarea>`;
      } else {
        const min = c.type === 'number' ? 'min="0" step="0.01"' : '';
        // Category gets a datalist of suggested types while staying free-text.
        const list = c.key === 'category' ? 'list="categoryList"' : '';
        field = `<input name="${c.key}" type="${c.type}" ${min} ${list}>`;
      }
      return `<label class="${span} ${c.required?'req':''}">${esc(c.label)}${field}<span class="field-error" data-err="${c.key}"></span></label>`;
    }).join('') + `<datalist id="categoryList">${CATEGORIES.map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist>`;
  }

  function openDrawer(id = null) {
    editingId = id;
    const rec = id ? items.find(i => i.id === id) : {};
    $('#drawerTitle').textContent = id ? 'Edit equipment' : 'Add equipment';
    COLUMNS.filter(c => !c.readonly).forEach(c => {
      const el = $(`[name="${c.key}"]`, $('#equipForm'));
      if (el) el.value = rec[c.key] ?? '';
      const err = $(`[data-err="${c.key}"]`); if (err) err.textContent = '';
      if (el) el.classList.remove('invalid');
    });
    $('#commentsBlock').hidden = !id;
    if (id) renderComments(rec);
    $('#drawer').hidden = false;
    setTimeout(() => $('[name="name"]').focus(), 50);
  }
  function closeDrawer() { $('#drawer').hidden = true; editingId = null; }

  function readForm() {
    const data = {};
    COLUMNS.filter(c => !c.readonly).forEach(c => {
      const el = $(`[name="${c.key}"]`, $('#equipForm'));
      data[c.key] = el ? el.value.trim() : '';
    });
    return data;
  }

  function validate(data) {
    let ok = true;
    const setErr = (k, msg) => { const e = $(`[data-err="${k}"]`); if (e) e.textContent = msg; const el = $(`[name="${k}"]`); if (el) el.classList.toggle('invalid', !!msg); if (msg) ok = false; };
    COLUMNS.forEach(c => setErr(c.key, ''));
    if (!data.name) setErr('name', 'Name is required.');
    if (data.price !== '' && +data.price < 0) setErr('price', 'Price cannot be negative.');
    if (data.quantity !== '' && +data.quantity < 0) setErr('quantity', 'Quantity cannot be negative.');
    ['purchaseDate','warranty','replaceDate'].forEach(k => { if (data[k] && isNaN(Date.parse(data[k]))) setErr(k, 'Invalid date.'); });
    // Duplicate serial — warn only (does not block).
    if (data.serial) {
      const dupe = items.some(i => i.serial && i.serial === data.serial && i.id !== editingId);
      if (dupe) toast(`Heads up: serial "${data.serial}" already exists.`, 'info');
    }
    return ok;
  }

  function saveEquip() {
    const data = readForm();
    if (!validate(data)) { toast('Fix the highlighted fields.', 'error'); return; }
    data.updatedAt = new Date().toISOString().slice(0, 10);
    if (editingId) {
      const idx = items.findIndex(i => i.id === editingId);
      items[idx] = { ...items[idx], ...data };
      toast('Equipment updated.');
    } else {
      items.unshift({ id: uid(), favorite: false, archived: false, comments: [], ...data });
      toast('Equipment added.');
    }
    save(); renderAll(); closeDrawer();
  }

  function rowAction(act, id) {
    if (act === 'edit') return openDrawer(id);
    if (act === 'dup') {
      const src = items.find(i => i.id === id);
      const copy = { ...structuredClone(src), id: uid(), name: src.name + ' (copy)', assetTag: '', serial: '', updatedAt: new Date().toISOString().slice(0,10) };
      items.unshift(copy); save(); renderAll(); toast('Equipment duplicated.');
    }
    if (act === 'fav') {
      const it = items.find(i => i.id === id); it.favorite = !it.favorite; save(); renderTable(); renderAnalytics();
    }
    if (act === 'del') confirmDialog('Delete equipment?', `"${items.find(i=>i.id===id).name}" will be removed. You can undo right after.`, () => deleteItems([id]));
  }

  function deleteItems(ids) {
    lastDeleted = items.filter(i => ids.includes(i.id));
    items = items.filter(i => !ids.includes(i.id));
    ids.forEach(id => selected.delete(id));
    save(); renderAll();
    toast(`${ids.length} item${ids.length>1?'s':''} deleted.`, 'info', { label: 'Undo', fn: undoDelete });
  }
  function undoDelete() {
    if (!lastDeleted) return;
    items = lastDeleted.concat(items); lastDeleted = null;
    save(); renderAll(); toast('Delete undone.');
  }

  /* -------- Comments -------- */
  function renderComments(rec) {
    rec.comments = rec.comments || [];
    $('#commentsList').innerHTML = rec.comments.length ? rec.comments.map((c, idx) => `
      <div class="comment">
        <div class="comment__meta"><span>${new Date(c.at).toLocaleString()}</span>
          <span><button data-edit="${idx}">edit</button> · <button data-del="${idx}">delete</button></span></div>
        <div data-body="${idx}">${esc(c.text)}</div>
      </div>`).join('') : `<p class="muted">No comments yet.</p>`;
    $$('#commentsList [data-del]').forEach(b => b.onclick = () => { rec.comments.splice(+b.dataset.del,1); save(); renderComments(rec); });
    $$('#commentsList [data-edit]').forEach(b => b.onclick = () => {
      const i = +b.dataset.edit; const nv = prompt('Edit comment:', rec.comments[i].text);
      if (nv != null) { rec.comments[i].text = nv.trim(); rec.comments[i].at = Date.now(); save(); renderComments(rec); }
    });
  }
  function addComment() {
    if (!editingId) return;
    const rec = items.find(i => i.id === editingId);
    const txt = $('#newComment').value.trim(); if (!txt) return;
    rec.comments = rec.comments || []; rec.comments.push({ text: txt, at: Date.now() });
    $('#newComment').value = ''; save(); renderComments(rec); toast('Comment added.');
  }

  /* ============================ 7. Bulk actions ========================= */

  function syncBulk() {
    const n = selected.size;
    $('#bulkbar').hidden = n === 0;
    $('#bulkCount').textContent = n;
  }
  function bulkDelete() {
    if (!selected.size) return;
    confirmDialog('Delete selected?', `${selected.size} items will be removed.`, () => deleteItems([...selected]));
  }
  function bulkFav()     { [...selected].forEach(id => items.find(i=>i.id===id).favorite = true); save(); renderTable(); toast('Marked as favorites.'); }
  function bulkArchive() { [...selected].forEach(id => items.find(i=>i.id===id).archived = true); selected.clear(); save(); renderAll(); toast('Items archived.'); }
  function applyBulk() {
    const map = { category:'#bulkCategory', vendor:'#bulkVendor', location:'#bulkLocation', status:'#bulkStatus', condition:'#bulkCondition' };
    let count = 0;
    [...selected].forEach(id => {
      const it = items.find(i => i.id === id);
      Object.entries(map).forEach(([k, sel]) => { const val = $(sel).value.trim(); if (val) it[k] = val; });
      it.updatedAt = new Date().toISOString().slice(0,10); count++;
    });
    Object.values(map).forEach(sel => $(sel).value = '');
    closeModal('#bulkModal'); save(); renderAll(); toast(`Updated ${count} items.`);
  }

  /* ============================ 8. Import / Export ===================== */

  // --- normalise a header string for fuzzy auto-mapping ---
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  function autoMatch(header) {
    const h = norm(header);
    // direct label / key matches first
    for (const c of COLUMNS) if (norm(c.label) === h || norm(c.key) === h) return c.key;
    // common aliases
    const alias = { equipmentname:'name', name:'name', itemname:'name', category:'category', type:'category',
      manufacturer:'manufacturer', make:'manufacturer', brand:'manufacturer', model:'model',
      serialnumber:'serial', serial:'serial', sn:'serial', vendor:'vendor', supplier:'vendor', seller:'vendor',
      invoicenumber:'invoice', invoice:'invoice', po:'invoice', purchasedate:'purchaseDate', datepurchased:'purchaseDate', date:'purchaseDate',
      purchaseprice:'price', price:'price', cost:'price', amount:'price', quantity:'quantity', qty:'quantity',
      condition:'condition', warrantyexpiration:'warranty', warranty:'warranty', warrantyexpiry:'warranty',
      expectedreplacement:'replaceDate', replacementdate:'replaceDate', location:'location', site:'location', office:'location',
      assettag:'assetTag', tag:'assetTag', status:'status', notes:'notes', comments:'notes', description:'notes', lastupdated:'updatedAt',
      // MedTrack export aliases
      refnumber:'assetTag', serialnumber:'serial', maker:'manufacturer', officename:'location', office:'location',
      dateadded:'purchaseDate', datereceived:'purchaseDate', ponumber:'poNumber', receivedby:'receivedBy', cost:'price',
      lastrepairvendor:'repairVendor', lastrepairdatesent:'repairSent', lastrepairdatereturned:'repairReturned', lastrepairreason:'repairReason' };
    return alias[h] || '';
  }

  function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = e => {
      try {
        let rows;
        if (ext === 'csv' || ext === 'tsv') {
          const wb = XLSX.read(e.target.result, { type: 'string' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        }
        if (!rows.length) { toast('That file has no rows.', 'error'); return; }
        openMapping(rows);
      } catch (err) { console.error(err); toast('Could not read that file.', 'error'); }
    };
    if (ext === 'csv' || ext === 'tsv') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  let pendingRows = [], pendingHeaders = [];
  function openMapping(rows) {
    pendingRows = rows;
    pendingHeaders = Object.keys(rows[0]);
    const importable = COLUMNS.filter(c => !c.readonly);
    $('#mapGrid').innerHTML = pendingHeaders.map(h => {
      const guess = autoMatch(h);
      return `<div class="map-row">
        <div class="map-row__src" title="${esc(h)}">${esc(h)}</div>
        <div class="map-row__arrow">→</div>
        <select data-src="${esc(h)}">
          <option value="">— ignore —</option>
          ${importable.map(c => `<option value="${c.key}" ${c.key===guess?'selected':''}>${esc(c.label)}</option>`).join('')}
        </select>
      </div>`;
    }).join('');
    openModal('#mapModal');
  }

  function confirmMapping() {
    const map = {};
    $$('#mapGrid select').forEach(s => { if (s.value) map[s.dataset.src] = s.value; });
    if (!Object.values(map).includes('name')) { toast('Map a column to Equipment Name first.', 'error'); return; }
    let added = 0;
    pendingRows.forEach(r => {
      const rec = { id: uid(), favorite:false, archived:false, comments:[] };
      Object.entries(map).forEach(([src, key]) => {
        let val = r[src];
        if (COL[key].type === 'date' && val) val = toISODate(val);
        if (COL[key].type === 'number' && val !== '') val = String(val).replace(/[^0-9.\-]/g, '');
        rec[key] = val;
      });
      if (!rec.name) return;
      rec.updatedAt = rec.updatedAt || new Date().toISOString().slice(0,10);
      items.unshift(rec); added++;
    });
    closeModal('#mapModal'); save(); renderAll();
    toast(`Imported ${added} items.`);
  }

  function toISODate(v) {
    if (typeof v === 'number') { // Excel serial date
      const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return d.toISOString().slice(0,10);
    }
    const d = new Date(v); return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }

  // ---- Exports ----
  function exportRows() {
    return items.map(i => {
      const o = {};
      COLUMNS.forEach(c => o[c.label] = i[c.key] ?? '');
      return o;
    });
  }
  function exportCSV() {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    download(new Blob([csv], { type: 'text/csv' }), 'equipment.csv');
  }
  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Equipment');
    XLSX.writeFile(wb, 'equipment.xlsx');
  }
  function exportJSON() {
    download(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }), 'equipment.json');
  }
  function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const cols = ['name','category','manufacturer','model','vendor','purchaseDate','price','quantity','status','location'];
    const active = items.filter(i => !i.archived);
    const totalCost = active.reduce((s,i)=>s+(+i.price||0)*(+i.quantity||1),0);
    doc.setFontSize(16); doc.text('Equipment Cost Report', 14, 15);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}  ·  ${active.length} items  ·  Total ${moneyExact(totalCost)}`, 14, 22);
    doc.autoTable({
      startY: 27,
      head: [cols.map(k => COL[k].label)],
      body: active.map(i => cols.map(k => k === 'price' ? moneyExact(i[k]) : (k.includes('Date')||k==='purchaseDate' ? fmtDate(i[k]) : (i[k] ?? '')))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [76, 175, 80] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save('equipment-report.pdf');
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Backup / restore ----
  function exportBackup() {
    download(new Blob([JSON.stringify({ at: Date.now(), items }, null, 2)], { type: 'application/json' }), `ect-backup-${new Date().toISOString().slice(0,10)}.json`);
  }
  function importBackup(file) {
    const r = new FileReader();
    r.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const arr = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(arr)) throw 0;
        items = arr; save(); renderAll(); toast(`Restored ${arr.length} items from backup.`);
      } catch { toast('That backup file is not valid.', 'error'); }
    };
    r.readAsText(file);
  }
  function restoreAutoBackup() {
    try {
      const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
      if (!b) return toast('No auto-backup found.', 'error');
      items = b.items; save(); renderAll();
      toast(`Restored auto-backup from ${new Date(b.at).toLocaleString()}.`);
    } catch { toast('Could not restore auto-backup.', 'error'); }
  }
  function resetDb() {
    confirmDialog('Reset database?', 'This clears all equipment from this browser. Export a backup first if you need it.', () => {
      items = []; selected.clear(); save(); renderAll(); toast('Database reset.', 'info');
    });
  }

  /* ============================ 9. Charts ============================== */

  function chartColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      grid: css.getPropertyValue('--line').trim(),
      text: css.getPropertyValue('--subtext').trim(),
      accent: css.getPropertyValue('--accent').trim(),
      accent2: css.getPropertyValue('--accent-2').trim(),
    };
  }
  const PALETTE = ['#4CAF50','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#14B8A6','#EC4899','#84CC16','#F97316','#06B6D4'];

  function destroyCharts() { Object.values(charts).forEach(c => c && c.destroy()); }

  function renderAnalytics() {
    if (typeof Chart === 'undefined') return;
    destroyCharts();
    const c = chartColors();
    Chart.defaults.color = c.text;
    Chart.defaults.borderColor = c.grid;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    const active = items.filter(i => !i.archived);

    // group helpers
    const sumBy = (key, val) => {
      const m = {};
      active.forEach(i => { const k = i[key] || 'Uncategorised'; m[k] = (m[k]||0) + val(i); });
      return m;
    };

    // by category (cost)
    const cat = sumBy('category', i => (+i.price||0)*(+i.quantity||1));
    mkChart('chartCategory', 'doughnut', Object.keys(cat), Object.values(cat), { legend: true });

    // monthly spending
    const months = {};
    active.forEach(i => { if (i.purchaseDate) { const m = i.purchaseDate.slice(0,7); months[m] = (months[m]||0) + (+i.price||0)*(+i.quantity||1); } });
    const mk = Object.keys(months).sort();
    mkChart('chartMonthly', 'bar', mk, mk.map(k => months[k]), { money: true, single: c.accent });

    // cumulative spend over time — running total, one point per purchase date
    renderCumulative(active, c);

    // vendor spending
    const ven = sumBy('vendor', i => (+i.price||0)*(+i.quantity||1));
    const vk = Object.entries(ven).sort((a,b)=>b[1]-a[1]).slice(0,8);
    mkChart('chartVendor', 'bar', vk.map(x=>x[0]), vk.map(x=>x[1]), { money: true, single: c.accent2, horizontal: true });

    // count by category
    const cnt = sumBy('category', () => 1);
    mkChart('chartCount', 'bar', Object.keys(cnt), Object.values(cnt), { single: c.accent });

    // lists
    const expensive = active.slice().sort((a,b)=>(+b.price||0)-(+a.price||0)).slice(0,6);
    $('#expensiveList').innerHTML = expensive.length ? expensive.map(rowHtml).join('') : '<p class="muted">No data.</p>';

    const avgByCat = {};
    Object.keys(cat).forEach(k => { const g = active.filter(i => (i.category||'Uncategorised')===k); avgByCat[k] = cat[k] / g.reduce((s,i)=>s+(+i.quantity||1),0); });
    $('#avgList').innerHTML = Object.keys(avgByCat).length ? Object.entries(avgByCat).sort((a,b)=>b[1]-a[1]).map(([k,v]) =>
      `<div class="mini-row"><div class="mini-row__main"><div class="mini-row__title">${esc(k)}</div></div><div class="mini-row__val">${money(v)}</div></div>`).join('') : '<p class="muted">No data.</p>';
  }

  // Cumulative spend: sort priced purchases by date, accumulate a running total.
  function renderCumulative(active, c) {
    const el = document.getElementById('chartCumulative'); if (!el) return;
    const priced = active
      .filter(i => i.purchaseDate && (+i.price || 0) > 0)
      .map(i => ({ date: i.purchaseDate, amount: (+i.price || 0) * (+i.quantity || 1), name: i.name }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    const points = priced.map(p => { running += p.amount; return { x: p.date, y: running, name: p.name, spent: p.amount }; });

    charts.chartCumulative = new Chart(el, {
      type: 'line',
      data: {
        labels: points.map(p => p.x),
        datasets: [{
          data: points.map(p => p.y),
          borderColor: c.accent,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: c.accent,
          tension: 0.25,
          fill: true,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: ctx => fmtDate(points[ctx[0].dataIndex].x),
            label: ctx => ` Total: ${money(ctx.parsed.y)}`,
            afterLabel: ctx => { const p = points[ctx.dataIndex]; return `${p.name} · +${money(p.spent)}`; },
          } },
        },
        scales: {
          x: { type: 'category', grid: { display: false },
               ticks: { callback: function (v) { const l = this.getLabelForValue(v); return l ? new Date(l + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : l; }, maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { color: c.grid || chartColors().grid }, ticks: { callback: v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
        },
      },
    });
  }

  /* -------- Per-category spend charts -------- */
  function renderCategories() {
    const grid = $('#categoryGrid'); if (!grid) return;
    if (typeof Chart === 'undefined') return;

    // Destroy any existing category charts before redrawing.
    Object.keys(charts).forEach(k => { if (k.startsWith('cat_')) { charts[k] && charts[k].destroy(); delete charts[k]; } });

    const grouping = $('#catGrouping') ? $('#catGrouping').value : 'cumulative';
    const c = chartColors();
    const active = items.filter(i => !i.archived && i.category && i.purchaseDate && (+i.price || 0) > 0);

    // Group priced purchases by category.
    const byCat = {};
    active.forEach(i => {
      (byCat[i.category] = byCat[i.category] || []).push({ date: i.purchaseDate, amount: (+i.price||0)*(+i.quantity||1), name: i.name });
    });

    const cats = Object.keys(byCat).sort((a, b) =>
      byCat[b].reduce((s,x)=>s+x.amount,0) - byCat[a].reduce((s,x)=>s+x.amount,0)); // richest first

    $('#categoryEmpty').hidden = cats.length > 0;

    grid.innerHTML = cats.map((cat, idx) => {
      const total = byCat[cat].reduce((s, x) => s + x.amount, 0);
      const units = byCat[cat].length;
      return `<div class="cat-card">
        <div class="cat-card__head">
          <span class="cat-card__title">${esc(cat)}</span>
          <span class="cat-card__total">${money(total)}</span>
        </div>
        <div class="cat-card__meta">${units} purchase${units>1?'s':''} · avg ${money(total/units)}</div>
        <div class="cat-card__chart"><canvas id="cat_${idx}"></canvas></div>
      </div>`;
    }).join('');

    // Draw a chart per category.
    cats.forEach((cat, idx) => {
      const el = document.getElementById('cat_' + idx); if (!el) return;
      const rows = byCat[cat].slice().sort((a, b) => a.date.localeCompare(b.date));
      const color = PALETTE[idx % PALETTE.length];

      let labels, data, type, tooltip;
      if (grouping === 'monthly') {
        // Sum by month.
        const m = {};
        rows.forEach(r => { const k = r.date.slice(0,7); m[k] = (m[k]||0) + r.amount; });
        labels = Object.keys(m).sort();
        data = labels.map(k => m[k]);
        type = 'bar';
        tooltip = { label: ctx => ` ${money(ctx.parsed.y)}` };
      } else {
        // Running total.
        let run = 0;
        const pts = rows.map(r => { run += r.amount; return { x: r.date, y: run, name: r.name, spent: r.amount }; });
        labels = pts.map(p => p.x);
        data = pts.map(p => p.y);
        type = 'line';
        tooltip = {
          title: ctx => fmtDate(pts[ctx[0].dataIndex].x),
          label: ctx => ` Total: ${money(ctx.parsed.y)}`,
          afterLabel: ctx => `${pts[ctx.dataIndex].name} · +${money(pts[ctx.dataIndex].spent)}`,
        };
      }

      charts['cat_' + idx] = new Chart(el, {
        type,
        data: { labels, datasets: [{
          data, borderColor: color, backgroundColor: type === 'bar' ? color : 'transparent',
          borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: color,
          tension: 0.25, fill: false, borderRadius: type === 'bar' ? 5 : 0,
        }]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: tooltip } },
          scales: {
            x: { type: 'category', grid: { display: false },
                 ticks: { callback: function (v) { const l = this.getLabelForValue(v); return l ? new Date((l.length===7?l+'-01':l) + 'T00:00:00').toLocaleDateString('en-US', { month:'short', year:'2-digit' }) : l; }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } },
            y: { beginAtZero: true, grid: { color: c.grid }, ticks: { maxTicksLimit: 4, callback: v => '$' + (v >= 1000 ? (v/1000)+'k' : v) } },
          },
        },
      });
    });
  }

  function mkChart(id, type, labels, data, opts = {}) {
    const el = document.getElementById(id); if (!el) return;
    const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
    charts[id] = new Chart(el, {
      type,
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: opts.single ? opts.single : colors,
          borderColor: type === 'doughnut' ? getComputedStyle(document.documentElement).getPropertyValue('--card').trim() : 'transparent',
          borderWidth: type === 'doughnut' ? 2 : 0,
          borderRadius: type === 'bar' ? 6 : 0,
        }],
      },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: !!opts.legend, position: 'right', labels: { boxWidth: 12, padding: 12 } },
          tooltip: { callbacks: { label: ctx => opts.money || type === 'doughnut' ? ` ${money(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}` : ` ${ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed}` } },
        },
        scales: type === 'doughnut' ? {} : {
          x: { grid: { display: opts.horizontal }, ticks: { callback: v => opts.money && !opts.horizontal ? '' : v } },
          y: { grid: { color: chartColors().grid }, beginAtZero: true },
        },
      },
    });
  }

  /* ============================ Filters UI ============================= */
  function populateFilterOptions() {
    const uniq = key => [...new Set(items.map(i => i[key]).filter(Boolean))].sort();
    const fill = (sel, vals, cur) => { const el = $(sel); if (!el) return; el.innerHTML = `<option value="">Any</option>` + vals.map(v => `<option ${v===cur?'selected':''}>${esc(v)}</option>`).join(''); };
    fill('#fCategory', uniq('category'), view.filters.category);
    fill('#fVendor',   uniq('vendor'),   view.filters.vendor);
    fill('#fStatus',   uniq('status'),   view.filters.status);
    fill('#fCondition',uniq('condition'),view.filters.condition);
    fill('#fLocation', uniq('location'), view.filters.location);
    const years = [...new Set(items.map(i => (i.purchaseDate||'').slice(0,4)).filter(Boolean))].sort().reverse();
    fill('#fYear', years, view.filters.year);
  }
  function readFilters() {
    view.filters = {
      category: $('#fCategory').value, vendor: $('#fVendor').value, status: $('#fStatus').value,
      condition: $('#fCondition').value, location: $('#fLocation').value, year: $('#fYear').value,
      warranty: $('#fWarranty').value,
      min: $('#fMin').value !== '' ? +$('#fMin').value : null,
      max: $('#fMax').value !== '' ? +$('#fMax').value : null,
      fav: $('#fFav').checked, archived: $('#fArchived').checked,
    };
    view.page = 1; renderTable();
  }
  function clearFilters() {
    view.filters = {}; view.search = ''; $('#globalSearch').value = '';
    ['#fCategory','#fVendor','#fStatus','#fCondition','#fLocation','#fYear','#fWarranty'].forEach(s=>$(s).value='');
    $('#fMin').value=''; $('#fMax').value=''; $('#fFav').checked=false; $('#fArchived').checked=false;
    renderTable();
  }

  /* ============================ Columns modal ========================= */
  function openColsModal() {
    $('#colsGrid').innerHTML = COLUMNS.map(c => `
      <label><input type="checkbox" data-col="${c.key}" ${prefs.visibleCols.includes(c.key)?'checked':''}> ${esc(c.label)}</label>`).join('');
    $$('#colsGrid [data-col]').forEach(cb => cb.onchange = () => {
      const k = cb.dataset.col;
      if (cb.checked) { if (!prefs.visibleCols.includes(k)) prefs.visibleCols.push(k); }
      else prefs.visibleCols = prefs.visibleCols.filter(x => x !== k);
      savePrefs(); renderTable();
    });
    openModal('#colsModal');
  }

  /* ============================ Modals / dialogs ====================== */
  function openModal(sel)  { $(sel).hidden = false; }
  function closeModal(sel) { $(sel).hidden = true; }
  let confirmFn = null;
  function confirmDialog(title, text, fn) {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text;
    confirmFn = fn; openModal('#confirmModal');
  }

  /* ============================ Navigation ============================ */
  function switchView(name) {
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${name}`));
    $$('.nav__item').forEach(n => n.classList.toggle('is-active', n.dataset.view === name));
    $('#sidebar').classList.remove('is-open');
    if (name === 'analytics' || name === 'dashboard') renderAnalytics();
    if (name === 'warranty') renderWarranty();
    if (name === 'categories') renderCategories();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = prefs.theme;
    $('#themeIcon').textContent = prefs.theme === 'dark' ? '☀' : '☾';
    $('#themeLabel').textContent = prefs.theme === 'dark' ? 'Light mode' : 'Dark mode';
    renderAnalytics();
  }
  function toggleTheme() { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); }

  /* ============================ 10. Events & boot ===================== */
  function bindEvents() {
    // nav
    $$('.nav__item').forEach(n => n.onclick = () => switchView(n.dataset.view));
    $('#menuToggle').onclick = () => $('#sidebar').classList.toggle('is-open');
    $('#themeToggle').onclick = toggleTheme;
    const catGroup = $('#catGrouping');
    if (catGroup) catGroup.onchange = renderCategories;
    const lockNow = $('#lockNow');
    if (lockNow) lockNow.onclick = () => { localStorage.removeItem(UNLOCK_KEY); location.reload(); };

    // search (instant)
    $('#globalSearch').addEventListener('input', e => { view.search = e.target.value; view.page = 1; renderTable(); });

    // add buttons
    ['#addBtn','#addBtn2','#emptyAdd'].forEach(s => { const el = $(s); if (el) el.onclick = () => { switchView('inventory'); openDrawer(); }; });

    // drawer
    $('#saveEquip').onclick = saveEquip;
    $('#addComment').onclick = addComment;
    $$('#drawer [data-close]').forEach(b => b.onclick = closeDrawer);

    // filters
    $('#filtersBtn').onclick = () => { const p = $('#filterPanel'); p.hidden = !p.hidden; };
    ['#fCategory','#fVendor','#fStatus','#fCondition','#fLocation','#fYear','#fWarranty','#fMin','#fMax','#fFav','#fArchived']
      .forEach(s => $(s).addEventListener('change', readFilters));
    $('#clearFilters').onclick = clearFilters;

    // columns
    $('#columnsBtn').onclick = openColsModal;

    // bulk
    $('#bulkDelete').onclick = bulkDelete;
    $('#bulkFav').onclick = bulkFav;
    $('#bulkArchive').onclick = bulkArchive;
    $('#bulkEdit').onclick = () => openModal('#bulkModal');
    $('#bulkClear').onclick = () => { selected.clear(); renderTable(); };
    $('#applyBulk').onclick = applyBulk;

    // pager
    $('#pageSize').onchange = e => { prefs.pageSize = +e.target.value; savePrefs(); view.page = 1; renderTable(); };
    $('#prevPage').onclick = () => { view.page--; renderTable(); };
    $('#nextPage').onclick = () => { view.page++; renderTable(); };

    // import/export
    $('#importFile').addEventListener('change', e => e.target.files[0] && parseFile(e.target.files[0]));
    const drop = $('#importDrop');
    drop.addEventListener('click', () => $('#importFile').click());
    ['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) parseFile(f); });
    $('#loadSample').onclick = loadSample;
    $$('[data-export]').forEach(b => b.onclick = () => ({ csv: exportCSV, xlsx: exportXLSX, json: exportJSON, pdf: exportPDF }[b.dataset.export]()));
    $('#confirmMap').onclick = confirmMapping;

    // backup
    $('#exportBackup').onclick = exportBackup;
    $('#importBackup').addEventListener('change', e => e.target.files[0] && importBackup(e.target.files[0]));
    $('#restoreBackup').onclick = restoreAutoBackup;
    $('#resetDb').onclick = resetDb;

    // modals close
    $$('[data-close]').forEach(b => { if (b.closest('.modal')) b.onclick = () => b.closest('.modal').hidden = true; });
    $('#confirmCancel').onclick = () => closeModal('#confirmModal');
    $('#confirmOk').onclick = () => { closeModal('#confirmModal'); confirmFn && confirmFn(); };

    // keyboard shortcuts
    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); $('#globalSearch').focus(); }
      else if ((e.key === 'n' || e.key === 'N') && !typing) { e.preventDefault(); switchView('inventory'); openDrawer(); }
      else if (e.key === '?' && !typing) openModal('#helpModal');
      else if (e.key === 'Escape') { $('#drawer').hidden = true; $$('.modal').forEach(m => m.hidden = true); }
      else if (e.key.toLowerCase() === 'l' && e.shiftKey && !typing) toggleTheme();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && lastDeleted) { e.preventDefault(); undoDelete(); }
    });
  }

  /* -------- Data sets --------
     SEED = your real MedTrack export (medtrack-inventory-2026-07-06.csv),
            loaded automatically on first run when storage is empty.
     DEMO = the original fictional showcase set, available on demand. */

  function loadSample() { // "Load demo data" button
    const s = DEMO.map(r => ({ id: uid(), favorite:false, archived:false, comments:[], updatedAt: new Date().toISOString().slice(0,10), ...r }));
    items = s.concat(items); save(); renderAll(); toast(`Loaded ${s.length} demo items.`);
  }

  // Real inventory — from MedTrack export dated 2026-07-06.
  // quantity defaults to 1; purchaseDate maps from MedTrack "dateReceived".
  const SEED = [
    { name:'Topcon AR KR 8800 Autorefractor', category:'Auto Refractors', manufacturer:'Topcon', model:'AR KR 8800', serial:'4117815', location:'Warehouse', status:'In Repair', quantity:'1', purchaseDate:'2026-06-04', notes:"Screen black. Can't see patient's eye." },
    { name:'Marco 101 Lensometer', category:'Lensometers', manufacturer:'Marco', model:'101', serial:'45343', location:'Edna', vendor:'AL Eye Equipment', status:'In Service', quantity:'1', purchaseDate:'2026-05-29', price:'650', receivedBy:'Tony', notes:'Lensometer.' },
    { name:'Lumenis SLT Laser', category:'Lasers', manufacturer:'Lumines', model:'SLT', serial:'001-510922', location:'North Office', status:'In Service', quantity:'1', purchaseDate:'2026-05-26', price:'1750', notes:'Dr. Hay states issues.', repairVendor:'Laser Locators', repairSent:'2026-06-04', repairReturned:'2026-06-04', repairReason:'Calibration required' },
  ];

  // Fictional demo set (for exploring features without real data).
  const DEMO = [
    { name:'ZEISS IOL Master 700', category:'Diagnostic', manufacturer:'ZEISS', model:'IOLMaster 700', serial:'IOL700-4471', vendor:'ZEISS Medical', purchaseDate:'2024-11-12', price:'62000', quantity:'1', condition:'New', warranty:'2027-11-12', location:'Perozek / 7190', assetTag:'ME-0001', status:'Active' },
    { name:'Humphrey HFA3 Field Analyzer', category:'Diagnostic', manufacturer:'ZEISS', model:'HFA3 860', serial:'HFA3-2290', vendor:'ZEISS Medical', purchaseDate:'2024-11-20', price:'38500', quantity:'1', condition:'New', warranty:'2026-11-20', location:'Henderson', assetTag:'ME-0002', status:'Active' },
    { name:'Heidelberg Spectralis OCT', category:'Imaging', manufacturer:'Heidelberg', model:'Spectralis', serial:'SPEC-9931', vendor:'Heidelberg Eng.', purchaseDate:'2023-06-02', price:'88000', quantity:'1', condition:'Excellent', warranty:'2025-06-02', location:'Camino', assetTag:'ME-0003', status:'In Repair' },
    { name:'Statim 5000 G4 Autoclave', category:'Sterilization', manufacturer:'SciCan', model:'Statim 5000 G4', serial:'STAT-5521', vendor:'Henry Schein', purchaseDate:'2025-01-08', price:'6200', quantity:'2', condition:'New', warranty:'2027-01-08', location:'Surgery Center', assetTag:'ME-0005', status:'Active' },
  ];

  /* -------- Passcode gate (soft lock) -------- */
  function startApp() {
    load();
    applyTheme();
    buildForm();
    bindEvents();
    renderAll();
    $('#lastSaved') && (localStorage.getItem(STORE_KEY) ? $('#lastSaved').textContent = 'on load' : null);
  }

  function gate() {
    // Already unlocked this browser? Skip straight to the app.
    if (localStorage.getItem(UNLOCK_KEY) === 'yes') { startApp(); return; }

    const screen = $('#lockScreen'), input = $('#lockInput'), err = $('#lockError'), btn = $('#lockBtn');
    screen.hidden = false;
    setTimeout(() => input.focus(), 50);

    const tryUnlock = () => {
      if (input.value === PASSCODE) {
        localStorage.setItem(UNLOCK_KEY, 'yes');
        screen.hidden = true;
        startApp();
      } else {
        err.hidden = false;
        input.value = '';
        input.focus();
      }
    };
    btn.onclick = tryUnlock;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    input.addEventListener('input', () => { err.hidden = true; });
  }

  /* -------- Boot -------- */
  function boot() { gate(); }
  document.addEventListener('DOMContentLoaded', boot);
})();
