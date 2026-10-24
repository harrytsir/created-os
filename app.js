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
  ['offers', 'Προσφορές', '▤', true, true],
  ['campaigns', 'Καμπάνιες', '✦', false, true],
  ['calendar', 'Ημερολόγιο', '▦', false, true],
  ['tasks', 'Tasks', '☑', false, true],
  ['decks', 'Παρουσιάσεις', '▶', true, true],
  ['sep'],
  ['team', 'Ομάδα', '◉', true],
];
function shell(route, content) {
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
  const [, route = 'dashboard', id] = location.hash.split('/');
  const adminOnly = ['leads', 'team'];
  if (adminOnly.includes(route) && !isAdmin()) return (location.hash = '#/dashboard');
  try {
    if (route === 'clients' && id) return await viewClient(id);
    const views = { dashboard: viewDashboard, clients: viewClients, leads: viewLeads, team: viewTeam };
    await (views[route] || viewDashboard)();
  } catch (e) { console.error(e); }
}
window.addEventListener('hashchange', router);

// ---------------------------------------------------------------- dashboard
async function viewDashboard() {
  const main = shell('dashboard', '<div class="empty">Φόρτωση…</div>');
  const clients = await q(sb.from('clients').select('id,name,status,created_at').order('created_at', { ascending: false }));
  const leads = isAdmin() ? await q(sb.from('leads').select('id,title,company,stage,value,expected_close').order('created_at', { ascending: false })) : [];
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
      <div class="card"><div class="num">${money(won)}</div><div class="lbl">Κερδισμένα</div></div>` : ''}
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
  const [contacts, notes, profiles, members] = await Promise.all([
    q(sb.from('contacts').select('*').eq('client_id', id).order('full_name')),
    q(sb.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false })),
    q(sb.from('profiles').select('id,full_name,email,role').order('full_name')),
    q(sb.from('client_members').select('user_id').eq('client_id', id)),
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
        ${isAdmin() ? `<div class="card"><h2>Ομάδα πελάτη</h2><p class="sub" style="margin-top:-6px">Συνεργάτες με πρόσβαση σε αυτόν τον πελάτη</p>
          ${collaborators.map((p) => `<label style="display:flex;gap:10px;align-items:center;color:var(--ink);font-size:14px;padding:6px 0"><input type="checkbox" style="width:auto" data-member="${p.id}" ${memberIds.has(p.id) ? 'checked' : ''}> ${esc(p.full_name)} <small class="muted">${esc(p.email)}</small></label>`).join('') || '<div class="muted" style="font-size:14px">Δεν υπάρχουν ακόμα συνεργάτες. Στείλε τους το link της εφαρμογής να κάνουν εγγραφή.</div>'}
        </div>` : ''}
      </div>
    </div>`;

  main.querySelector('#edit')?.addEventListener('click', () => clientForm(c));
  main.querySelector('#add-contact')?.addEventListener('click', () => contactForm(id));
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
  });
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
