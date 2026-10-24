import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');

const state = { user: null, profile: null };
const isAdmin = () => state.profile?.role === 'admin';

// ---------------------------------------------------------------- helpers
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => n == null || n === '' ? '—' : new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const date = (d) => d ? new Date(d).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const dateTime = (d) => new Date(d).toLocaleString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formData = (form) => {
  const o = Object.fromEntries(new FormData(form));
  for (const k in o) if (o[k] === '') o[k] = null;
  return o;
};
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
}
async function q(promise) {
  const { data, error } = await promise;
  if (error) { console.error(error); toast('Σφάλμα: ' + error.message); throw error; }
  return data;
}

const CLIENT_STATUS = { active: 'Ενεργός', paused: 'Σε παύση', past: 'Παλιός' };
const STAGES = [
  ['new', 'Νέο'], ['contacted', 'Επικοινωνία'], ['meeting', 'Συνάντηση'],
  ['proposal', 'Προσφορά'], ['won', 'Κερδήθηκε'], ['lost', 'Χάθηκε'],
];
const STAGE = Object.fromEntries(STAGES);
const OFFER_STATUS = { draft: 'Πρόχειρη', sent: 'Στάλθηκε', accepted: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε' };
const num = (n) => new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const eur = (n) => num(n) + ' €';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + Number(n || 0)); return x.toISOString().slice(0, 10); };
function offerTotals(items, discountPct, vatPct) {
  const subtotal = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0), 0);
  const discount = subtotal * Number(discountPct || 0) / 100;
  const net = subtotal - discount;
  const vat = net * Number(vatPct || 0) / 100;
  return { subtotal, discount, net, vat, total: net + vat };
}
const options = (pairs, sel) => pairs.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');

// ---------------------------------------------------------------- modal
function openModal(html, onMount) {
  $modal.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
  const bg = $modal.firstElementChild;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  onMount?.(bg.querySelector('.modal'));
}
function closeModal() { $modal.innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', (e) => {
  const side = document.getElementById('side');
  if (side?.classList.contains('open') && !side.contains(e.target) && e.target.id !== 'menu') side.classList.remove('open');
});

// ---------------------------------------------------------------- auth
function renderAuth(mode = 'login', error = '') {
  const signup = mode === 'signup';
  $app.innerHTML = `
    <div class="auth"><div class="card">
      <div class="logo">Created<span class="dot">.</span> OS</div>
      <p class="sub" style="margin:0 0 18px">${signup ? 'Δημιουργία λογαριασμού' : 'Σύνδεση'}</p>
      <form class="form" id="auth-form">
        ${signup ? '<label>Ονοματεπώνυμο<input name="full_name" required></label>' : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Κωδικός<input name="password" type="password" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <button class="btn primary" type="submit">${signup ? 'Εγγραφή' : 'Σύνδεση'}</button>
      </form>
      <div class="switch">${signup ? 'Έχεις ήδη λογαριασμό; <a data-mode="login">Σύνδεση</a>' : 'Νέος συνεργάτης; <a data-mode="signup">Εγγραφή</a>'}</div>
    </div></div>`;
  $app.querySelector('[data-mode]').onclick = (e) => renderAuth(e.target.dataset.mode);
  $app.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const res = signup
      ? await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.full_name } } })
      : await sb.auth.signInWithPassword({ email: f.email, password: f.password });
    if (res.error) return renderAuth(mode, translateAuthError(res.error.message));
    if (signup && !res.data.session) return renderAuth('login', 'Σου στείλαμε email επιβεβαίωσης. Πάτησε τον σύνδεσμο και μετά συνδέσου.');
  };
}
function translateAuthError(m) {
  if (/invalid login/i.test(m)) return 'Λάθος email ή κωδικός.';
  if (/already registered/i.test(m)) return 'Υπάρχει ήδη λογαριασμός με αυτό το email.';
  if (/email not confirmed/i.test(m)) return 'Επιβεβαίωσε πρώτα το email σου.';
  return m;
}

// ---------------------------------------------------------------- shell
const NAV = [
  ['dashboard', 'Αρχική', '◎'],
  ['clients', 'Πελάτες', '◧'],
  ['leads', 'Leads', '◇', true],
  ['sep'],
  ['offers', 'Προσφορές', '▤', true],
  ['campaigns', 'Καμπάνιες', '✦', false, true],
  ['calendar', 'Ημερολόγιο', '▦', false, true],
  ['tasks', 'Tasks', '☑', false, true],
  ['decks', 'Παρουσιάσεις', '▶', true, true],
  ['sep'],
  ['team', 'Ομάδα', '◉', true],
  ['settings', 'Ρυθμίσεις', '⚙', true],
];
function shell(route, content) {
  document.title = 'Created OS';
  const nav = NAV.filter((n) => n[0] === 'sep' || !n[3] || isAdmin()).map((n) => n[0] === 'sep'
    ? '<div class="sep"></div>'
    : `<a href="#/${n[0]}" class="${route === n[0] ? 'active' : ''} ${n[4] ? 'soon' : ''}"><span>${n[2]}</span>${n[1]}${n[4] ? '<span class="tag">σύντομα</span>' : ''}</a>`).join('');
  $app.innerHTML = `
    <div class="shell">
      <aside class="side" id="side">
        <div class="brand">Created<span class="dot">.</span><small>Operating System</small></div>
        <nav class="nav">${nav}</nav>
        <div class="me"><b>${esc(state.profile?.full_name)}</b>${isAdmin() ? 'Admin' : 'Συνεργάτης'} · <a href="#" id="logout">Αποσύνδεση</a></div>
      </aside>
      <div>
        <div class="topbar"><button class="icon-btn" id="menu" aria-label="Μενού">☰</button><b>Created<span class="dot">.</span></b><span style="width:38px"></span></div>
        <main class="main" id="main">${content}</main>
      </div>
    </div>`;
  const side = document.getElementById('side');
  document.getElementById('menu').onclick = (e) => { e.stopPropagation(); side.classList.toggle('open'); };
  side.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => side.classList.remove('open')));
  document.getElementById('logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); };
  return document.getElementById('main');
}

// ---------------------------------------------------------------- router
async function router() {
  if (!state.user) return;
  const [, route = 'dashboard', id, sub] = location.hash.split('/');
  const adminOnly = ['leads', 'team', 'offers', 'settings'];
  if (adminOnly.includes(route) && !isAdmin()) return (location.hash = '#/dashboard');
  try {
    if (route === 'clients' && id) return await viewClient(id);
    if (route === 'offers' && id && sub === 'pdf') return await viewOfferPrint(id);
    if (route === 'offers' && id) return await viewOffer(id);
    const views = { dashboard: viewDashboard, clients: viewClients, leads: viewLeads, team: viewTeam, offers: viewOffers, settings: viewSettings };
    await (views[route] || viewDashboard)();
  } catch (e) { console.error(e); }
}
window.addEventListener('hashchange', router);

// ---------------------------------------------------------------- dashboard
async function viewDashboard() {
  const main = shell('dashboard', '<div class="empty">Φόρτωση…</div>');
  const clients = await q(sb.from('clients').select('id,name,status,created_at').order('created_at', { ascending: false }));
  const leads = isAdmin() ? await q(sb.from('leads').select('id,title,company,stage,value,expected_close').order('created_at', { ascending: false })) : [];
  const sentOffers = isAdmin() ? (await q(sb.from('offers').select('id,status'))).filter((o) => o.status === 'sent').length : 0;
  const open = leads.filter((l) => !['won', 'lost'].includes(l.stage));
  const pipeline = open.reduce((s, l) => s + Number(l.value || 0), 0);
  const won = leads.filter((l) => l.stage === 'won').reduce((s, l) => s + Number(l.value || 0), 0);
  const greet = new Date().getHours() < 12 ? 'Καλημέρα' : 'Καλησπέρα';
  main.innerHTML = `
    <div class="head"><div><h1>${greet}, ${esc(state.profile.full_name?.split(' ')[0])}</h1><div class="sub">Η εικόνα του Created. σήμερα</div></div></div>
    <div class="grid kpi" style="margin-bottom:16px">
      <div class="card"><div class="num">${clients.filter((c) => c.status === 'active').length}</div><div class="lbl">Ενεργοί πελάτες</div></div>
      ${isAdmin() ? `
      <div class="card"><div class="num">${open.length}</div><div class="lbl">Ανοιχτά leads</div></div>
      <div class="card"><div class="num">${money(pipeline)}</div><div class="lbl">Αξία pipeline</div></div>
      <div class="card"><div class="num">${money(won)}</div><div class="lbl">Κερδισμένα</div></div>
      <a class="card" href="#/offers" style="text-decoration:none"><div class="num">${sentOffers}</div><div class="lbl">Προσφορές σε αναμονή</div></a>` : ''}
    </div>
    <div class="grid ${isAdmin() ? 'two' : ''}">
      <div class="card"><h2>Πρόσφατοι πελάτες</h2>
        ${clients.slice(0, 6).map((c) => `<a class="list-row" href="#/clients/${c.id}" style="text-decoration:none"><span>${esc(c.name)}</span><span class="pill ${c.status}">${CLIENT_STATUS[c.status]}</span></a>`).join('') || '<div class="empty">Δεν υπάρχουν ακόμα πελάτες.</div>'}
      </div>
      ${isAdmin() ? `<div class="card"><h2>Leads σε εξέλιξη</h2>
        ${open.slice(0, 6).map((l) => `<a class="list-row" href="#/leads" style="text-decoration:none"><span>${esc(l.title)}<br><small class="muted">${esc(l.company || '')}</small></span><span style="text-align:right"><span class="pill ${l.stage}">${STAGE[l.stage]}</span><br><small class="muted">${money(l.value)}</small></span></a>`).join('') || '<div class="empty">Κανένα ανοιχτό lead.</div>'}
      </div>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- clients
async function viewClients() {
  const main = shell('clients', '<div class="empty">Φόρτωση…</div>');
  const clients = await q(sb.from('clients').select('*').order('name'));
  main.innerHTML = `
    <div class="head"><div><h1>Πελάτες</h1><div class="sub">${clients.length} συνολικά</div></div>
      ${isAdmin() ? '<button class="btn primary" id="new-client">+ Νέος πελάτης</button>' : ''}</div>
    <div class="toolbar">
      <input class="search" id="q" placeholder="Αναζήτηση…">
      <select id="st"><option value="">Όλες οι καταστάσεις</option>${options(Object.entries(CLIENT_STATUS))}</select>
    </div>
    <div class="card table-wrap" style="padding:0"><table>
      <thead><tr><th>Επωνυμία</th><th class="hide-sm">Κλάδος</th><th class="hide-sm">Email</th><th>Κατάσταση</th></tr></thead>
      <tbody id="rows"></tbody></table></div>`;
  const draw = () => {
    const term = main.querySelector('#q').value.toLowerCase();
    const st = main.querySelector('#st').value;
    const list = clients.filter((c) => (!st || c.status === st) && [c.name, c.industry, c.email].join(' ').toLowerCase().includes(term));
    main.querySelector('#rows').innerHTML = list.map((c) => `
      <tr data-id="${c.id}"><td><b>${esc(c.name)}</b></td><td class="hide-sm">${esc(c.industry || '—')}</td>
      <td class="hide-sm">${esc(c.email || '—')}</td><td><span class="pill ${c.status}">${CLIENT_STATUS[c.status]}</span></td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">${clients.length ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Πρόσθεσε τον πρώτο σου πελάτη.'}</td></tr>`;
    main.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => (location.hash = `#/clients/${tr.dataset.id}`)));
  };
  main.querySelector('#q').oninput = draw;
  main.querySelector('#st').onchange = draw;
  draw();
  main.querySelector('#new-client')?.addEventListener('click', () => clientForm());
}

function clientForm(c = {}, prefill = {}) {
  const v = { status: 'active', ...prefill, ...c };
  openModal(`
    <h2>${c.id ? 'Επεξεργασία πελάτη' : 'Νέος πελάτης'}</h2>
    <form class="form" id="f">
      <label>Επωνυμία *<input name="name" required value="${esc(v.name)}"></label>
      <div class="row2"><label>Κλάδος<input name="industry" value="${esc(v.industry)}"></label>
        <label>Κατάσταση<select name="status">${options(Object.entries(CLIENT_STATUS), v.status)}</select></label></div>
      <div class="row2"><label>ΑΦΜ<input name="vat_number" value="${esc(v.vat_number)}"></label>
        <label>ΔΟΥ<input name="tax_office" value="${esc(v.tax_office)}"></label></div>
      <label>Διεύθυνση<input name="address" value="${esc(v.address)}"></label>
      <div class="row2"><label>Email<input name="email" type="email" value="${esc(v.email)}"></label>
        <label>Τηλέφωνο<input name="phone" value="${esc(v.phone)}"></label></div>
      <label>Website<input name="website" value="${esc(v.website)}" placeholder="https://"></label>
      <label>Σημειώσεις<textarea name="notes">${esc(v.notes)}</textarea></label>
      <div class="modal-actions">
        ${c.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
        <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div>
      </div>
    </form>`, (m) => {
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (c.id) { await q(sb.from('clients').update(data).eq('id', c.id)); toast('Αποθηκεύτηκε'); closeModal(); router(); return; }
      const row = await q(sb.from('clients').insert(data).select().single());
      closeModal(); toast('Ο πελάτης δημιουργήθηκε');
      await prefill.onCreated?.(row);
      location.hash = `#/clients/${row.id}`;
    };
    m.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm(`Διαγραφή του «${c.name}» μαζί με επαφές και σημειώσεις;`)) return;
      await q(sb.from('clients').delete().eq('id', c.id));
      closeModal(); toast('Διαγράφηκε'); location.hash = '#/clients';
    });
  });
}

async function viewClient(id) {
  const main = shell('clients', '<div class="empty">Φόρτωση…</div>');
  const c = await q(sb.from('clients').select('*').eq('id', id).maybeSingle());
  if (!c) { main.innerHTML = '<div class="empty">Ο πελάτης δεν βρέθηκε ή δεν έχεις πρόσβαση.</div>'; return; }
  const [contacts, notes, profiles, members, offers] = await Promise.all([
    q(sb.from('contacts').select('*').eq('client_id', id).order('full_name')),
    q(sb.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false })),
    q(sb.from('profiles').select('id,full_name,email,role').order('full_name')),
    q(sb.from('client_members').select('user_id').eq('client_id', id)),
    isAdmin() ? q(sb.from('offers').select('id,number,title,status,issue_date').eq('client_id', id).order('created_at', { ascending: false })) : [],
  ]);
  const who = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
  const memberIds = new Set(members.map((m) => m.user_id));
  const collaborators = profiles.filter((p) => p.role === 'collaborator');
  const link = (u) => u ? `<a href="${esc(/^https?:/.test(u) ? u : 'https://' + u)}" target="_blank" rel="noopener">${esc(u)}</a>` : '—';

  main.innerHTML = `
    <div class="head"><div><a href="#/clients" class="muted" style="font-size:14px;text-decoration:none">← Πελάτες</a>
      <h1>${esc(c.name)}</h1><div class="sub">${esc(c.industry || '')} <span class="pill ${c.status}">${CLIENT_STATUS[c.status]}</span></div></div>
      ${isAdmin() ? '<button class="btn" id="edit">Επεξεργασία</button>' : ''}</div>
    <div class="grid two">
      <div class="grid">
        <div class="card"><h2>Στοιχεία</h2><dl class="info">
          <dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
          <dt>Τηλέφωνο</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
          <dt>Website</dt><dd>${link(c.website)}</dd>
          <dt>Διεύθυνση</dt><dd>${esc(c.address || '—')}</dd>
          ${isAdmin() ? `<dt>ΑΦΜ / ΔΟΥ</dt><dd>${esc(c.vat_number || '—')} · ${esc(c.tax_office || '—')}</dd>` : ''}
          <dt>Από</dt><dd>${date(c.created_at)}</dd>
        </dl>${c.notes ? `<p style="white-space:pre-wrap;margin:14px 0 0">${esc(c.notes)}</p>` : ''}</div>

        <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Σημειώσεις & ιστορικό</h2></div>
          <form class="note-form" id="note-form"><textarea name="body" placeholder="Π.χ. Κλείσαμε συνάντηση για το νέο brief…" required></textarea><button class="btn primary">Προσθήκη</button></form>
          <div id="notes">${notes.map((n) => `<div class="note"><div class="meta">${esc(who[n.created_by] || '—')} · ${dateTime(n.created_at)}
            ${isAdmin() || n.created_by === state.user.id ? ` · <a href="#" data-del-note="${n.id}">διαγραφή</a>` : ''}</div><div style="white-space:pre-wrap">${esc(n.body)}</div></div>`).join('') || '<div class="empty">Καμία σημείωση ακόμα.</div>'}</div>
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Επαφές</h2>${isAdmin() ? '<button class="btn sm" id="add-contact">+ Επαφή</button>' : ''}</div>
          ${contacts.map((p) => `<div class="list-row" ${isAdmin() ? `data-contact="${p.id}" style="cursor:pointer"` : ''}><span><b>${esc(p.full_name)}</b><br><small class="muted">${esc(p.role_title || '')}</small></span>
            <span style="text-align:right;font-size:13px">${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}<br>${p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''}</span></div>`).join('') || '<div class="empty">Καμία επαφή.</div>'}
        </div>
        ${isAdmin() ? `<div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Προσφορές</h2><button class="btn sm" id="add-offer">+ Προσφορά</button></div>
          ${offers.map((o) => `<a class="list-row" href="#/offers/${o.id}" style="text-decoration:none"><span><b>${esc(o.title)}</b><br><small class="muted">${esc(o.number)} · ${date(o.issue_date)}</small></span><span class="pill ${o.status}">${OFFER_STATUS[o.status]}</span></a>`).join('') || '<div class="empty" style="padding:16px">Καμία προσφορά.</div>'}
        </div>` : ''}
        ${isAdmin() ? `<div class="card"><h2>Ομάδα πελάτη</h2><p class="sub" style="margin-top:-6px">Συνεργάτες με πρόσβαση σε αυτόν τον πελάτη</p>
          ${collaborators.map((p) => `<label style="display:flex;gap:10px;align-items:center;color:var(--ink);font-size:14px;padding:6px 0"><input type="checkbox" style="width:auto" data-member="${p.id}" ${memberIds.has(p.id) ? 'checked' : ''}> ${esc(p.full_name)} <small class="muted">${esc(p.email)}</small></label>`).join('') || '<div class="muted" style="font-size:14px">Δεν υπάρχουν ακόμα συνεργάτες. Στείλε τους το link της εφαρμογής να κάνουν εγγραφή.</div>'}
        </div>` : ''}
      </div>
    </div>`;

  main.querySelector('#edit')?.addEventListener('click', () => clientForm(c));
  main.querySelector('#add-contact')?.addEventListener('click', () => contactForm(id));
  main.querySelector('#add-offer')?.addEventListener('click', () => { state.offerPrefill = { client_id: id }; location.hash = '#/offers/new'; });
  main.querySelectorAll('[data-contact]').forEach((el) => (el.onclick = () => contactForm(id, contacts.find((x) => x.id === el.dataset.contact))));
  main.querySelector('#note-form').onsubmit = async (e) => {
    e.preventDefault();
    await q(sb.from('activities').insert({ client_id: id, body: formData(e.target).body }));
    viewClient(id);
  };
  main.querySelectorAll('[data-del-note]').forEach((a) => (a.onclick = async (e) => {
    e.preventDefault(); if (!confirm('Διαγραφή σημείωσης;')) return;
    await q(sb.from('activities').delete().eq('id', a.dataset.delNote)); viewClient(id);
  }));
  main.querySelectorAll('[data-member]').forEach((cb) => (cb.onchange = async () => {
    if (cb.checked) await q(sb.from('client_members').insert({ client_id: id, user_id: cb.dataset.member }));
    else await q(sb.from('client_members').delete().eq('client_id', id).eq('user_id', cb.dataset.member));
    toast(cb.checked ? 'Δόθηκε πρόσβαση' : 'Αφαιρέθηκε η πρόσβαση');
  }));
}

function contactForm(clientId, p = {}) {
  openModal(`
    <h2>${p.id ? 'Επεξεργασία επαφής' : 'Νέα επαφή'}</h2>
    <form class="form" id="f">
      <div class="row2"><label>Ονοματεπώνυμο *<input name="full_name" required value="${esc(p.full_name)}"></label>
        <label>Θέση<input name="role_title" value="${esc(p.role_title)}" placeholder="π.χ. Marketing Manager"></label></div>
      <div class="row2"><label>Email<input name="email" type="email" value="${esc(p.email)}"></label>
        <label>Τηλέφωνο<input name="phone" value="${esc(p.phone)}"></label></div>
      <label>Σημειώσεις<textarea name="notes">${esc(p.notes)}</textarea></label>
      <div class="modal-actions">${p.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
        <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
    </form>`, (m) => {
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (p.id) await q(sb.from('contacts').update(data).eq('id', p.id));
      else await q(sb.from('contacts').insert({ ...data, client_id: clientId }));
      closeModal(); viewClient(clientId);
    };
    m.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm('Διαγραφή επαφής;')) return;
      await q(sb.from('contacts').delete().eq('id', p.id)); closeModal(); viewClient(clientId);
    });
  });
}

// ---------------------------------------------------------------- leads
async function viewLeads() {
  const main = shell('leads', '<div class="empty">Φόρτωση…</div>');
  const leads = await q(sb.from('leads').select('*').order('created_at', { ascending: false }));
  const open = leads.filter((l) => !['won', 'lost'].includes(l.stage));
  main.innerHTML = `
    <div class="head"><div><h1>Leads</h1><div class="sub">${open.length} ανοιχτά · ${money(open.reduce((s, l) => s + Number(l.value || 0), 0))} σε εξέλιξη</div></div>
      <button class="btn primary" id="new-lead">+ Νέο lead</button></div>
    <div class="board">${STAGES.map(([k, label]) => {
      const items = leads.filter((l) => l.stage === k);
      return `<div class="col" data-stage="${k}"><h3><span>${label}</span><span>${items.length}</span></h3>
        ${items.map((l) => `<div class="lead" draggable="true" data-id="${l.id}"><b>${esc(l.title)}</b>
          <div class="row"><span>${esc(l.company || '—')}</span><span>${money(l.value)}</span></div>
          ${l.expected_close ? `<div class="row"><span>Κλείσιμο</span><span>${date(l.expected_close)}</span></div>` : ''}</div>`).join('')}
      </div>`;
    }).join('')}</div>`;

  main.querySelector('#new-lead').onclick = () => leadForm();
  main.querySelectorAll('.lead').forEach((el) => {
    el.onclick = () => leadForm(leads.find((l) => l.id === el.dataset.id));
    el.ondragstart = (e) => e.dataTransfer.setData('text/plain', el.dataset.id);
  });
  main.querySelectorAll('.col').forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
    col.ondragleave = () => col.classList.remove('drop');
    col.ondrop = async (e) => {
      e.preventDefault(); col.classList.remove('drop');
      const lead = leads.find((l) => l.id === e.dataTransfer.getData('text/plain'));
      if (!lead || lead.stage === col.dataset.stage) return;
      await moveLead(lead, col.dataset.stage);
    };
  });
}

async function moveLead(lead, stage) {
  await q(sb.from('leads').update({ stage }).eq('id', lead.id));
  toast(`«${lead.title}» → ${STAGE[stage]}`);
  if (stage === 'won' && !lead.client_id && confirm('Κερδήθηκε! Να δημιουργηθεί πελάτης από αυτό το lead;')) return convertLead(lead);
  viewLeads();
}

function convertLead(lead) {
  clientForm({}, {
    name: lead.company || lead.title, email: lead.email, phone: lead.phone,
    notes: lead.notes, status: 'active',
    onCreated: async (client) => {
      await q(sb.from('leads').update({ client_id: client.id, stage: 'won' }).eq('id', lead.id));
      if (lead.contact_name) await q(sb.from('contacts').insert({ client_id: client.id, full_name: lead.contact_name, email: lead.email, phone: lead.phone }));
    },
  });
}

function leadForm(l = {}) {
  const v = { stage: 'new', ...l };
  openModal(`
    <h2>${l.id ? 'Lead' : 'Νέο lead'}</h2>
    <form class="form" id="f">
      <label>Τίτλος / έργο *<input name="title" required value="${esc(v.title)}" placeholder="π.χ. Social media retainer 2027"></label>
      <div class="row2"><label>Εταιρεία<input name="company" value="${esc(v.company)}"></label>
        <label>Επαφή<input name="contact_name" value="${esc(v.contact_name)}"></label></div>
      <div class="row2"><label>Email<input name="email" type="email" value="${esc(v.email)}"></label>
        <label>Τηλέφωνο<input name="phone" value="${esc(v.phone)}"></label></div>
      <div class="row2"><label>Στάδιο<select name="stage">${options(STAGES, v.stage)}</select></label>
        <label>Πηγή<input name="source" value="${esc(v.source)}" placeholder="Σύσταση, LinkedIn, site…"></label></div>
      <div class="row2"><label>Εκτιμώμενη αξία (€)<input name="value" type="number" step="0.01" min="0" value="${esc(v.value)}"></label>
        <label>Αναμενόμενο κλείσιμο<input name="expected_close" type="date" value="${esc(v.expected_close)}"></label></div>
      <label>Σημειώσεις<textarea name="notes">${esc(v.notes)}</textarea></label>
      <div class="modal-actions">
        ${l.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
        ${l.id && !l.client_id ? '<button type="button" class="btn" id="convert">→ Πελάτης</button>' : ''}
        ${l.client_id ? `<a class="btn ghost" href="#/clients/${l.client_id}">Δες πελάτη</a>` : ''}
        ${l.id ? '<button type="button" class="btn" id="offer">+ Προσφορά</button>' : ''}
        <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div>
      </div>
    </form>`, (m) => {
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      if (l.id) {
        const becameWon = data.stage === 'won' && l.stage !== 'won';
        await q(sb.from('leads').update(data).eq('id', l.id));
        closeModal();
        if (becameWon && !l.client_id && confirm('Κερδήθηκε! Να δημιουργηθεί πελάτης από αυτό το lead;')) return convertLead({ ...l, ...data });
      } else {
        await q(sb.from('leads').insert(data)); closeModal();
      }
      toast('Αποθηκεύτηκε'); viewLeads();
    };
    m.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm('Διαγραφή lead;')) return;
      await q(sb.from('leads').delete().eq('id', l.id)); closeModal(); viewLeads();
    });
    m.querySelector('#convert')?.addEventListener('click', () => { closeModal(); convertLead(l); });
    m.querySelector('#offer')?.addEventListener('click', () => {
      closeModal();
      state.offerPrefill = { lead_id: l.id, client_id: l.client_id, title: l.title, recipient: l.company || l.contact_name };
      location.hash = '#/offers/new';
    });
  });
}

// ---------------------------------------------------------------- settings & catalogue
async function getSettings() {
  let s = await q(sb.from('company_settings').select('*').eq('id', 1).maybeSingle());
  if (!s) s = await q(sb.from('company_settings').insert({ id: 1 }).select().single());
  return s;
}

async function viewSettings() {
  const main = shell('settings', '<div class="empty">Φόρτωση…</div>');
  const [s, services] = await Promise.all([getSettings(), q(sb.from('services').select('*').order('category'))]);
  let logo = s.logo;
  main.innerHTML = `
    <div class="head"><div><h1>Ρυθμίσεις</h1><div class="sub">Στοιχεία εταιρείας για τις προσφορές και κατάλογος υπηρεσιών</div></div></div>
    <div class="grid two">
      <div class="card"><h2>Στοιχεία εταιρείας</h2>
        <form class="form" id="company">
          <div class="row2"><label>Εμπορικό όνομα<input name="name" value="${esc(s.name)}"></label>
            <label>Επωνυμία (νόμιμη)<input name="legal_name" value="${esc(s.legal_name)}"></label></div>
          <div class="row2"><label>ΑΦΜ<input name="vat_number" value="${esc(s.vat_number)}"></label>
            <label>ΔΟΥ<input name="tax_office" value="${esc(s.tax_office)}"></label></div>
          <label>Διεύθυνση<input name="address" value="${esc(s.address)}"></label>
          <div class="row2"><label>Email<input name="email" value="${esc(s.email)}"></label>
            <label>Τηλέφωνο<input name="phone" value="${esc(s.phone)}"></label></div>
          <div class="row2"><label>Website<input name="website" value="${esc(s.website)}"></label>
            <label>Χρώμα brand<input name="accent" type="color" value="${esc(s.accent || '#ff5a1f')}" style="height:40px;padding:4px"></label></div>
          <div class="row2"><label>ΦΠΑ προεπιλογή (%)<input name="default_vat" type="number" step="0.01" value="${esc(s.default_vat ?? 24)}"></label>
            <label>Ισχύς προσφοράς (ημέρες)<input name="validity_days" type="number" value="${esc(s.validity_days ?? 30)}"></label></div>
          <label>Όροι προσφοράς (προεπιλογή)<textarea name="default_terms" rows="6">${esc(s.default_terms)}</textarea></label>
          <label>Logo
            <div style="display:flex;gap:12px;align-items:center">
              <div id="logo-prev" style="width:140px;height:56px;border:1px dashed var(--line);border-radius:8px;display:grid;place-items:center;background:#fff;overflow:hidden">${logo ? `<img src="${logo}" style="max-width:100%;max-height:100%">` : '<small class="muted">χωρίς logo</small>'}</div>
              <input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml" style="width:auto;border:0;padding:0">
              ${logo ? '<button type="button" class="btn sm" id="logo-rm">Αφαίρεση</button>' : ''}
            </div></label>
          <div><button class="btn primary">Αποθήκευση</button></div>
        </form>
      </div>
      <div class="card" style="align-self:start"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Κατάλογος υπηρεσιών</h2><button class="btn sm" id="add-svc">+ Υπηρεσία</button></div>
        <p class="sub" style="margin-top:0">Αυτές εμφανίζονται για γρήγορη προσθήκη στις προσφορές.</p>
        ${services.map((v) => `<div class="list-row" data-svc="${v.id}" style="cursor:pointer;${v.active ? '' : 'opacity:.5'}"><span><b>${esc(v.name)}</b><br><small class="muted">${esc(v.category || '')}${v.active ? '' : ' · ανενεργή'}</small></span>
          <span style="text-align:right;white-space:nowrap">${eur(v.price)}<br><small class="muted">/ ${esc(v.unit || '')}</small></span></div>`).join('') || '<div class="empty">Ο κατάλογος είναι άδειος.</div>'}
      </div>
    </div>`;

  main.querySelector('#logo-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    logo = await imageToDataUrl(f);
    main.querySelector('#logo-prev').innerHTML = `<img src="${logo}" style="max-width:100%;max-height:100%">`;
  };
  main.querySelector('#logo-rm')?.addEventListener('click', () => { logo = null; main.querySelector('#logo-prev').innerHTML = '<small class="muted">χωρίς logo</small>'; });
  main.querySelector('#company').onsubmit = async (e) => {
    e.preventDefault();
    await q(sb.from('company_settings').update({ ...formData(e.target), logo, updated_at: new Date().toISOString() }).eq('id', 1));
    toast('Τα στοιχεία αποθηκεύτηκαν');
  };
  main.querySelector('#add-svc').onclick = () => serviceForm();
  main.querySelectorAll('[data-svc]').forEach((el) => (el.onclick = () => serviceForm(services.find((v) => v.id === el.dataset.svc))));
}

function imageToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      if (file.type === 'image/svg+xml') return resolve(r.result);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 600 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

function serviceForm(v = {}) {
  const x = { unit: 'τεμ.', active: true, ...v };
  openModal(`
    <h2>${v.id ? 'Επεξεργασία υπηρεσίας' : 'Νέα υπηρεσία'}</h2>
    <form class="form" id="f">
      <div class="row2"><label>Όνομα *<input name="name" required value="${esc(x.name)}"></label>
        <label>Κατηγορία<input name="category" value="${esc(x.category)}" placeholder="Social media, PR, Production…"></label></div>
      <label>Περιγραφή<textarea name="description" rows="3">${esc(x.description)}</textarea></label>
      <div class="row2"><label>Τιμή (€, χωρίς ΦΠΑ)<input name="price" type="number" step="0.01" min="0" value="${esc(x.price ?? 0)}"></label>
        <label>Μονάδα<input name="unit" value="${esc(x.unit)}" placeholder="μήνας, ώρα, τεμ., project"></label></div>
      <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" name="active" style="width:auto" ${x.active ? 'checked' : ''}> Ενεργή</label>
      <div class="modal-actions">${v.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
        <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
    </form>`, (m) => {
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const data = formData(e.target);
      data.active = !!e.target.active.checked;
      data.price = Number(data.price || 0);
      if (v.id) await q(sb.from('services').update(data).eq('id', v.id));
      else await q(sb.from('services').insert(data));
      closeModal(); viewSettings();
    };
    m.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm('Διαγραφή υπηρεσίας από τον κατάλογο; Οι παλιές προσφορές δεν επηρεάζονται.')) return;
      await q(sb.from('services').delete().eq('id', v.id)); closeModal(); viewSettings();
    });
  });
}

// ---------------------------------------------------------------- offers
async function viewOffers() {
  const main = shell('offers', '<div class="empty">Φόρτωση…</div>');
  const [offers, items, clients] = await Promise.all([
    q(sb.from('offers').select('*').order('created_at', { ascending: false })),
    q(sb.from('offer_items').select('offer_id,qty,unit_price')),
    q(sb.from('clients').select('id,name')),
  ]);
  const cname = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const totalOf = (o) => offerTotals(items.filter((i) => i.offer_id === o.id), o.discount_pct, o.vat_pct).net;
  const pending = offers.filter((o) => o.status === 'sent');
  main.innerHTML = `
    <div class="head"><div><h1>Προσφορές</h1><div class="sub">${pending.length} σε αναμονή απάντησης · ${eur(pending.reduce((s, o) => s + totalOf(o), 0))} καθαρή αξία</div></div>
      <a class="btn primary" href="#/offers/new">+ Νέα προσφορά</a></div>
    <div class="toolbar">
      <input class="search" id="q" placeholder="Αναζήτηση…">
      <select id="st"><option value="">Όλες</option>${options(Object.entries(OFFER_STATUS))}</select>
    </div>
    <div class="card table-wrap" style="padding:0"><table>
      <thead><tr><th>Αρ.</th><th>Τίτλος</th><th class="hide-sm">Πελάτης</th><th class="hide-sm">Ημ/νία</th><th style="text-align:right">Καθαρό</th><th>Κατάσταση</th></tr></thead>
      <tbody id="rows"></tbody></table></div>`;
  const draw = () => {
    const term = main.querySelector('#q').value.toLowerCase();
    const st = main.querySelector('#st').value;
    const list = offers.filter((o) => (!st || o.status === st) && [o.number, o.title, cname[o.client_id], o.recipient].join(' ').toLowerCase().includes(term));
    main.querySelector('#rows').innerHTML = list.map((o) => `
      <tr data-id="${o.id}"><td class="muted" style="white-space:nowrap">${esc(o.number)}</td><td><b>${esc(o.title)}</b></td>
      <td class="hide-sm">${esc(cname[o.client_id] || o.recipient || '—')}</td><td class="hide-sm" style="white-space:nowrap">${date(o.issue_date)}</td>
      <td style="text-align:right;white-space:nowrap">${eur(totalOf(o))}</td><td><span class="pill ${o.status}">${OFFER_STATUS[o.status]}</span></td></tr>`).join('')
      || `<tr><td colspan="6" class="empty">${offers.length ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Φτιάξε την πρώτη σου προσφορά.'}</td></tr>`;
    main.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => (location.hash = `#/offers/${tr.dataset.id}`)));
  };
  main.querySelector('#q').oninput = draw;
  main.querySelector('#st').onchange = draw;
  draw();
}

async function nextOfferNumber() {
  const year = new Date().getFullYear();
  const prefix = `CR-${year}-`;
  const rows = await q(sb.from('offers').select('number'));
  const max = rows.map((r) => r.number).filter((n) => n?.startsWith(prefix)).map((n) => parseInt(n.slice(prefix.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

async function viewOffer(id) {
  const main = shell('offers', '<div class="empty">Φόρτωση…</div>');
  const isNew = id === 'new';
  const [settings, services, clients, leads] = await Promise.all([
    getSettings(),
    q(sb.from('services').select('*').eq('active', true).order('category')),
    q(sb.from('clients').select('id,name').order('name')),
    q(sb.from('leads').select('id,title,company,stage,client_id').order('created_at', { ascending: false })),
  ]);
  let o, items;
  if (isNew) {
    const pre = state.offerPrefill || {}; state.offerPrefill = null;
    o = { status: 'draft', issue_date: today(), valid_until: addDays(today(), settings.validity_days ?? 30), terms: settings.default_terms, vat_pct: settings.default_vat ?? 24, discount_pct: 0, ...pre };
    items = [];
  } else {
    o = await q(sb.from('offers').select('*').eq('id', id).maybeSingle());
    if (!o) { main.innerHTML = '<div class="empty">Η προσφορά δεν βρέθηκε.</div>'; return; }
    items = await q(sb.from('offer_items').select('*').eq('offer_id', id).order('position'));
  }
  const cats = [...new Set(services.map((s) => s.category || 'Άλλα'))];

  main.innerHTML = `
    <div class="head"><div><a href="#/offers" class="muted" style="font-size:14px;text-decoration:none">← Προσφορές</a>
      <h1>${isNew ? 'Νέα προσφορά' : esc(o.number)}</h1>${isNew ? '' : `<div class="sub"><span class="pill ${o.status}">${OFFER_STATUS[o.status]}</span></div>`}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isNew ? '' : '<button class="btn" id="dup">Αντίγραφο</button><button class="btn" id="pdf">PDF</button>'}
        <button class="btn primary" id="save">Αποθήκευση</button></div></div>
    <form id="of" class="grid two" onsubmit="return false">
      <div class="grid" style="align-content:start">
        <div class="card form">
          <label>Τίτλος προσφοράς *<input name="title" required value="${esc(o.title)}" placeholder="π.χ. Social media & content — Q1 2027"></label>
          <div class="row2"><label>Πελάτης<select name="client_id"><option value="">— Χωρίς πελάτη —</option>${options(clients.map((c) => [c.id, c.name]), o.client_id)}</select></label>
            <label>Ή παραλήπτης<input name="recipient" value="${esc(o.recipient)}" placeholder="Για υποψήφιο πελάτη"></label></div>
          <label>Lead (προαιρετικά)<select name="lead_id"><option value="">—</option>${options(leads.map((l) => [l.id, l.title + (l.company ? ' · ' + l.company : '')]), o.lead_id)}</select></label>
          <label>Εισαγωγικό κείμενο<textarea name="intro" rows="3" placeholder="Σας ευχαριστούμε για την εμπιστοσύνη. Με βάση τη συνάντησή μας…">${esc(o.intro)}</textarea></label>
        </div>
        <div class="card">
          <div class="head" style="margin-bottom:10px"><h2 style="margin:0">Υπηρεσίες</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <select id="from-cat" style="width:auto"><option value="">+ Από κατάλογο…</option>${cats.map((c) => `<optgroup label="${esc(c)}">${services.filter((s) => (s.category || 'Άλλα') === c).map((s) => `<option value="${s.id}">${esc(s.name)} · ${eur(s.price)}</option>`).join('')}</optgroup>`).join('')}</select>
              <button type="button" class="btn sm" id="add-line">+ Ελεύθερη γραμμή</button></div></div>
          <div id="lines"></div>
        </div>
        <div class="card form"><label>Όροι<textarea name="terms" rows="6">${esc(o.terms)}</textarea></label></div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card form">
          <label>Κατάσταση<select name="status">${options(Object.entries(OFFER_STATUS), o.status)}</select></label>
          <div class="row2"><label>Ημ/νία έκδοσης<input type="date" name="issue_date" value="${esc(o.issue_date)}"></label>
            <label>Ισχύει έως<input type="date" name="valid_until" value="${esc(o.valid_until)}"></label></div>
          <div class="row2"><label>Έκπτωση (%)<input type="number" step="0.01" min="0" max="100" name="discount_pct" value="${esc(o.discount_pct)}"></label>
            <label>ΦΠΑ (%)<input type="number" step="0.01" min="0" name="vat_pct" value="${esc(o.vat_pct)}"></label></div>
        </div>
        <div class="card" id="totals"></div>
        ${isNew ? '' : '<button type="button" class="btn danger" id="del" style="justify-self:start">Διαγραφή προσφοράς</button>'}
      </div>
    </form>`;

  const form = main.querySelector('#of');
  const drawLines = () => {
    main.querySelector('#lines').innerHTML = items.map((it, i) => `
      <div class="line" data-i="${i}">
        <div class="line-main">
          <input data-k="name" value="${esc(it.name)}" placeholder="Υπηρεσία" class="line-name">
          <textarea data-k="description" rows="1" placeholder="Περιγραφή (προαιρετικά)">${esc(it.description)}</textarea>
        </div>
        <div class="line-nums">
          <label>Ποσ.<input data-k="qty" type="number" step="0.01" min="0" value="${esc(it.qty)}"></label>
          <label>Μον.<input data-k="unit" value="${esc(it.unit)}"></label>
          <label>Τιμή €<input data-k="unit_price" type="number" step="0.01" min="0" value="${esc(it.unit_price)}"></label>
          <div class="line-total">${eur(Number(it.qty || 0) * Number(it.unit_price || 0))}</div>
          <div class="line-tools"><button type="button" class="icon-btn sm" data-up title="Πάνω">↑</button><button type="button" class="icon-btn sm" data-rm title="Αφαίρεση">✕</button></div>
        </div>
      </div>`).join('') || '<div class="empty" style="padding:20px">Πρόσθεσε υπηρεσίες από τον κατάλογο ή ελεύθερες γραμμές.</div>';
    main.querySelectorAll('.line').forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelectorAll('[data-k]').forEach((inp) => (inp.oninput = () => {
        items[i][inp.dataset.k] = inp.value;
        row.querySelector('.line-total').textContent = eur(Number(items[i].qty || 0) * Number(items[i].unit_price || 0));
        drawTotals();
      }));
      row.querySelector('[data-rm]').onclick = () => { items.splice(i, 1); drawLines(); };
      row.querySelector('[data-up]').onclick = () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; drawLines(); } };
    });
    drawTotals();
  };
  const drawTotals = () => {
    const f = new FormData(form);
    const t = offerTotals(items, f.get('discount_pct'), f.get('vat_pct'));
    main.querySelector('#totals').innerHTML = `<h2>Σύνολα</h2><dl class="info totals">
      <dt>Υποσύνολο</dt><dd>${eur(t.subtotal)}</dd>
      ${t.discount ? `<dt>Έκπτωση ${num(f.get('discount_pct'))}%</dt><dd>−${eur(t.discount)}</dd>` : ''}
      <dt>Καθαρό</dt><dd>${eur(t.net)}</dd>
      <dt>ΦΠΑ ${num(f.get('vat_pct'))}%</dt><dd>${eur(t.vat)}</dd>
      <dt><b>Σύνολο</b></dt><dd><b style="font-size:20px">${eur(t.total)}</b></dd></dl>`;
  };
  form.discount_pct.oninput = drawTotals;
  form.vat_pct.oninput = drawTotals;
  main.querySelector('#from-cat').onchange = (e) => {
    const s = services.find((x) => x.id === e.target.value); e.target.value = '';
    if (!s) return;
    items.push({ name: s.name, description: s.description, unit: s.unit, qty: 1, unit_price: s.price });
    drawLines();
  };
  main.querySelector('#add-line').onclick = () => { items.push({ name: '', description: '', unit: 'τεμ.', qty: 1, unit_price: 0 }); drawLines(); main.querySelector('.line:last-child .line-name')?.focus(); };
  drawLines();

  const save = async () => {
    if (!form.title.value.trim()) { form.title.focus(); toast('Βάλε τίτλο στην προσφορά'); return null; }
    const data = formData(form);
    data.discount_pct = Number(data.discount_pct || 0);
    data.vat_pct = Number(data.vat_pct || 0);
    let offerId = o.id;
    if (isNew || !offerId) {
      data.number = await nextOfferNumber();
      offerId = (await q(sb.from('offers').insert(data).select().single())).id;
    } else {
      await q(sb.from('offers').update(data).eq('id', offerId));
      await q(sb.from('offer_items').delete().eq('offer_id', offerId));
    }
    const rows = items.filter((it) => (it.name || '').trim()).map((it, i) => ({
      offer_id: offerId, position: i, name: it.name.trim(), description: it.description || null,
      unit: it.unit || null, qty: Number(it.qty || 0), unit_price: Number(it.unit_price || 0),
    }));
    if (rows.length) await q(sb.from('offer_items').insert(rows));
    await syncLead(data, o, offerTotals(rows, data.discount_pct, data.vat_pct).net, leads);
    return offerId;
  };
  main.querySelector('#save').onclick = async () => {
    const oid = await save(); if (!oid) return;
    toast('Η προσφορά αποθηκεύτηκε');
    if (isNew) location.hash = `#/offers/${oid}`; else viewOffer(oid);
  };
  main.querySelector('#pdf')?.addEventListener('click', async () => { const oid = await save(); if (oid) location.hash = `#/offers/${oid}/pdf`; });
  main.querySelector('#dup')?.addEventListener('click', async () => {
    const oid = await save(); if (!oid) return;
    const copy = { ...formData(form), status: 'draft', issue_date: today(), valid_until: addDays(today(), settings.validity_days ?? 30), number: await nextOfferNumber(), title: form.title.value + ' (αντίγραφο)' };
    copy.discount_pct = Number(copy.discount_pct || 0); copy.vat_pct = Number(copy.vat_pct || 0);
    const n = await q(sb.from('offers').insert(copy).select().single());
    const rows = items.filter((it) => (it.name || '').trim()).map((it, i) => ({ offer_id: n.id, position: i, name: it.name, description: it.description || null, unit: it.unit || null, qty: Number(it.qty || 0), unit_price: Number(it.unit_price || 0) }));
    if (rows.length) await q(sb.from('offer_items').insert(rows));
    toast('Δημιουργήθηκε αντίγραφο'); location.hash = `#/offers/${n.id}`;
  });
  main.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm(`Διαγραφή της προσφοράς ${o.number};`)) return;
    await q(sb.from('offers').delete().eq('id', o.id)); toast('Διαγράφηκε'); location.hash = '#/offers';
  });
}

// Κρατάει το lead σε συγχρονισμό με την προσφορά.
async function syncLead(data, before, net, leads) {
  if (!data.lead_id) return;
  const lead = leads.find((l) => l.id === data.lead_id); if (!lead) return;
  const patch = {};
  if (data.status === 'sent' && ['new', 'contacted', 'meeting'].includes(lead.stage)) patch.stage = 'proposal';
  if (data.status === 'sent' || data.status === 'draft') patch.value = net;
  if (data.status === 'accepted' && before.status !== 'accepted' && lead.stage !== 'won' && confirm('Η προσφορά εγκρίθηκε. Να μαρκαριστεί και το lead ως «Κερδήθηκε»;')) patch.stage = 'won';
  if (data.status === 'rejected' && before.status !== 'rejected' && lead.stage !== 'lost' && confirm('Η προσφορά απορρίφθηκε. Να μαρκαριστεί και το lead ως «Χάθηκε»;')) patch.stage = 'lost';
  if (Object.keys(patch).length) await q(sb.from('leads').update(patch).eq('id', lead.id));
}

async function viewOfferPrint(id) {
  const [s, o] = await Promise.all([getSettings(), q(sb.from('offers').select('*').eq('id', id).maybeSingle())]);
  if (!o) { location.hash = '#/offers'; return; }
  const [items, client, contacts] = await Promise.all([
    q(sb.from('offer_items').select('*').eq('offer_id', id).order('position')),
    o.client_id ? q(sb.from('clients').select('*').eq('id', o.client_id).maybeSingle()) : null,
    o.client_id ? q(sb.from('contacts').select('*').eq('client_id', o.client_id).order('created_at')) : [],
  ]);
  const t = offerTotals(items, o.discount_pct, o.vat_pct);
  const accent = s.accent || '#ff5a1f';
  const to = client ? client.name : (o.recipient || '');
  const attn = contacts?.[0];
  document.title = `${o.number} — ${o.title}`;
  $app.innerHTML = `
    <div class="print-bar no-print">
      <a class="btn" href="#/offers/${o.id}">← Πίσω</a>
      <span class="muted" style="font-size:14px">Στο παράθυρο εκτύπωσης διάλεξε «Αποθήκευση ως PDF»</span>
      <button class="btn primary" id="print">Λήψη PDF</button>
    </div>
    <article class="doc" style="--doc-accent:${esc(accent)}">
      <header class="doc-head">
        <div>${s.logo ? `<img src="${s.logo}" class="doc-logo" alt="">` : `<div class="doc-word">${esc(s.name || 'Created.')}</div>`}</div>
        <div class="doc-co">
          ${s.legal_name ? `<b>${esc(s.legal_name)}</b><br>` : ''}
          ${s.address ? esc(s.address) + '<br>' : ''}
          ${s.vat_number ? `ΑΦΜ ${esc(s.vat_number)}${s.tax_office ? ' · ΔΟΥ ' + esc(s.tax_office) : ''}<br>` : ''}
          ${[s.email, s.phone, s.website].filter(Boolean).map(esc).join(' · ')}
        </div>
      </header>
      <section class="doc-title">
        <div class="doc-kicker">Οικονομική προσφορά</div>
        <h1>${esc(o.title)}</h1>
        <div class="doc-meta">
          <div><span>Προς</span><b>${esc(to || '—')}</b>${attn ? `<br>Υπ' όψιν: ${esc(attn.full_name)}${attn.role_title ? ', ' + esc(attn.role_title) : ''}` : ''}${client?.vat_number ? `<br>ΑΦΜ ${esc(client.vat_number)}` : ''}</div>
          <div><span>Αριθμός</span><b>${esc(o.number)}</b></div>
          <div><span>Ημερομηνία</span><b>${date(o.issue_date)}</b></div>
          <div><span>Ισχύει έως</span><b>${date(o.valid_until)}</b></div>
        </div>
      </section>
      ${o.intro ? `<p class="doc-intro">${esc(o.intro)}</p>` : ''}
      <table class="doc-table">
        <thead><tr><th style="width:52%">Υπηρεσία</th><th class="r">Ποσ.</th><th class="r">Τιμή μον.</th><th class="r">Σύνολο</th></tr></thead>
        <tbody>${items.map((it) => `<tr><td><b>${esc(it.name)}</b>${it.description ? `<div class="doc-desc">${esc(it.description)}</div>` : ''}</td>
          <td class="r">${num(it.qty).replace(/,00$/, '')}${it.unit ? ' ' + esc(it.unit) : ''}</td><td class="r">${eur(it.unit_price)}</td><td class="r">${eur(Number(it.qty) * Number(it.unit_price))}</td></tr>`).join('')}</tbody>
      </table>
      <div class="doc-totals">
        <div><span>Υποσύνολο</span><span>${eur(t.subtotal)}</span></div>
        ${t.discount ? `<div><span>Έκπτωση ${num(o.discount_pct)}%</span><span>−${eur(t.discount)}</span></div><div><span>Καθαρό</span><span>${eur(t.net)}</span></div>` : ''}
        <div><span>ΦΠΑ ${num(o.vat_pct)}%</span><span>${eur(t.vat)}</span></div>
        <div class="grand"><span>Σύνολο</span><span>${eur(t.total)}</span></div>
      </div>
      ${o.terms ? `<section class="doc-terms"><h3>Όροι</h3><p>${esc(o.terms)}</p></section>` : ''}
      <section class="doc-sign">
        <div><div class="line"></div>Υπογραφή · ${esc(s.name || "Created.")}</div>
        <div><div class="line"></div>Αποδοχή πελάτη · Ημερομηνία</div>
      </section>
    </article>`;
  document.getElementById('print').onclick = () => window.print();
}

// ---------------------------------------------------------------- team
async function viewTeam() {
  const main = shell('team', '<div class="empty">Φόρτωση…</div>');
  const [profiles, members, clients] = await Promise.all([
    q(sb.from('profiles').select('*').order('created_at')),
    q(sb.from('client_members').select('*')),
    q(sb.from('clients').select('id,name')),
  ]);
  const cname = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  main.innerHTML = `
    <div class="head"><div><h1>Ομάδα</h1><div class="sub">Οι συνεργάτες κάνουν εγγραφή από το link της εφαρμογής και μετά τους δίνεις πρόσβαση ανά πελάτη.</div></div>
      <button class="btn" id="copy">Αντιγραφή link εγγραφής</button></div>
    <div class="card table-wrap" style="padding:0"><table>
      <thead><tr><th>Όνομα</th><th class="hide-sm">Email</th><th>Ρόλος</th><th class="hide-sm">Πελάτες</th></tr></thead>
      <tbody>${profiles.map((p) => `<tr style="cursor:default"><td><b>${esc(p.full_name)}</b></td><td class="hide-sm">${esc(p.email)}</td>
        <td>${p.id === state.user.id ? '<span class="pill">Admin (εσύ)</span>' : `<select data-role="${p.id}" style="width:auto">${options([['collaborator', 'Συνεργάτης'], ['admin', 'Admin']], p.role)}</select>`}</td>
        <td class="hide-sm">${p.role === 'admin' ? '<span class="muted">Όλοι</span>' : esc(members.filter((m) => m.user_id === p.id).map((m) => cname[m.client_id]).join(', ') || '—')}</td></tr>`).join('')}</tbody>
    </table></div>`;
  main.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('Το link αντιγράφηκε'); }
    catch { prompt('Αντέγραψε το link:', location.origin + location.pathname); }
  };
  main.querySelectorAll('[data-role]').forEach((s) => (s.onchange = async () => {
    if (s.value === 'admin' && !confirm('Ο admin βλέπει όλους τους πελάτες, τα leads και τις τιμές. Συνέχεια;')) { s.value = 'collaborator'; return; }
    await q(sb.from('profiles').update({ role: s.value }).eq('id', s.dataset.role)); toast('Ο ρόλος άλλαξε'); viewTeam();
  }));
}

// ---------------------------------------------------------------- boot
async function loadProfile() {
  state.profile = await q(sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle());
  if (!state.profile) state.profile = { id: state.user.id, full_name: state.user.email, role: 'collaborator' };
}
sb.auth.onAuthStateChange(async (_event, session) => {
  const uid = session?.user?.id;
  if (uid && uid === state.user?.id) return; // token refresh
  state.user = session?.user || null;
  if (!state.user) { state.profile = null; return renderAuth(); }
  setTimeout(async () => { await loadProfile(); router(); }, 0);
});
