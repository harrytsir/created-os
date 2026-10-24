// Created OS — Φάση 3: Καμπάνιες, Tasks, Ημερολόγιο
// Φορτώνεται από το app.js και παίρνει τα κοινά εργαλεία μέσω του ctx.

export const CAMPAIGN_STATUS = { planning: 'Σχεδιασμός', active: 'Σε εξέλιξη', paused: 'Σε παύση', done: 'Ολοκληρώθηκε' };
export const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'Meta Ads', 'Google Ads', 'Website', 'Email', 'PR / ΜΜΕ', 'Events', 'Video', 'Print', 'OOH'];
export const TASK_STATUS = [['todo', 'To do'], ['doing', 'Σε εξέλιξη'], ['review', 'Για έγκριση'], ['done', 'Έγινε']];
const TASK_LABEL = Object.fromEntries(TASK_STATUS);
export const PRIORITY = { low: 'Χαμηλή', normal: 'Κανονική', high: 'Υψηλή' };
export const EVENT_TYPES = {
  post: ['Post', '#3b82f6'], shoot: ['Γύρισμα', '#ff5a1f'], press: ['Δελτίο τύπου', '#8b5cf6'],
  ad: ['Διαφήμιση', '#10b981'], meeting: ['Συνάντηση', '#64748b'], event: ['Event', '#e11d48'], other: ['Άλλο', '#a3a3a3'],
};
const WEEKDAYS = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'];

export function createWork(ctx) {
  const { sb, state, isAdmin, esc, q, toast, shell, openModal, closeModal, options, formData, date, money } = ctx;

  const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const hm = (d) => new Date(d).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const todayYmd = () => ymd(new Date());
  const overdue = (t) => t.due_date && t.status !== 'done' && t.due_date < todayYmd();
  const chip = (txt, color) => `<span class="chip" ${color ? `style="--c:${color}"` : ''}>${esc(txt)}</span>`;
  const typeDot = (type) => `<i class="dot-ev" style="background:${EVENT_TYPES[type]?.[1] || '#999'}"></i>`;

  async function lookups() {
    const [clients, campaigns, profiles] = await Promise.all([
      q(sb.from('clients').select('id,name,status').order('name')),
      q(sb.from('campaigns').select('id,name,client_id,status').order('name')),
      q(sb.from('profiles').select('id,full_name,role').order('full_name')),
    ]);
    return {
      clients, campaigns, profiles,
      cname: Object.fromEntries(clients.map((c) => [c.id, c.name])),
      kname: Object.fromEntries(campaigns.map((c) => [c.id, c.name])),
      pname: Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
    };
  }

  // Σύνδεση πελάτη → καμπάνιες στις φόρμες
  function linkClientCampaign(form, L, selectedCampaign) {
    const draw = () => {
      const cid = form.client_id.value;
      const list = L.campaigns.filter((k) => !cid || k.client_id === cid);
      form.campaign_id.innerHTML = '<option value="">— Χωρίς καμπάνια —</option>' + options(list.map((k) => [k.id, k.name]), selectedCampaign);
    };
    form.client_id.addEventListener('change', () => { selectedCampaign = null; draw(); });
    form.campaign_id.addEventListener('change', () => {
      const k = L.campaigns.find((x) => x.id === form.campaign_id.value);
      if (k && form.client_id.value !== k.client_id) { form.client_id.value = k.client_id; }
    });
    draw();
  }

  // ============================================================ campaigns
  async function viewCampaigns() {
    const main = shell('campaigns', '<div class="empty">Φόρτωση…</div>');
    const [campaigns, tasks, L] = await Promise.all([
      q(sb.from('campaigns').select('*').order('start_date', { ascending: false })),
      q(sb.from('tasks').select('id,campaign_id,status')),
      lookups(),
    ]);
    main.innerHTML = `
      <div class="head"><div><h1>Καμπάνιες</h1><div class="sub">${campaigns.filter((c) => c.status === 'active').length} σε εξέλιξη</div></div>
        ${isAdmin() ? '<button class="btn primary" id="new">+ Νέα καμπάνια</button>' : ''}</div>
      <div class="toolbar">
        <select id="fc"><option value="">Όλοι οι πελάτες</option>${options(L.clients.map((c) => [c.id, c.name]))}</select>
        <select id="fs"><option value="">Όλες οι καταστάσεις</option>${options(Object.entries(CAMPAIGN_STATUS))}</select>
      </div>
      <div class="cards" id="list"></div>`;
    const draw = () => {
      const fc = main.querySelector('#fc').value, fs = main.querySelector('#fs').value;
      const list = campaigns.filter((c) => (!fc || c.client_id === fc) && (!fs || c.status === fs));
      main.querySelector('#list').innerHTML = list.map((c) => {
        const ts = tasks.filter((t) => t.campaign_id === c.id);
        const done = ts.filter((t) => t.status === 'done').length;
        const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
        return `<a class="card camp" href="#/campaigns/${c.id}">
          <div class="camp-top"><small class="muted">${esc(L.cname[c.client_id] || '')}</small><span class="pill ${c.status}">${CAMPAIGN_STATUS[c.status]}</span></div>
          <h3>${esc(c.name)}</h3>
          <div class="muted" style="font-size:13px">${c.start_date ? date(c.start_date) : '—'} → ${c.end_date ? date(c.end_date) : '—'}</div>
          <div class="chips">${(c.channels || []).slice(0, 5).map((x) => chip(x)).join('')}${(c.channels || []).length > 5 ? chip('+' + (c.channels.length - 5)) : ''}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="muted" style="font-size:12px">${done}/${ts.length} tasks</div>
        </a>`;
      }).join('') || `<div class="empty card">${campaigns.length ? 'Καμία καμπάνια με αυτά τα φίλτρα.' : (isAdmin() ? 'Φτιάξε την πρώτη καμπάνια.' : 'Δεν υπάρχουν ακόμα καμπάνιες στους πελάτες σου.')}</div>`;
    };
    main.querySelector('#fc').onchange = draw;
    main.querySelector('#fs').onchange = draw;
    draw();
    main.querySelector('#new')?.addEventListener('click', () => campaignForm({}, L));
  }

  async function campaignForm(c = {}, L, prefill = {}) {
    L = L || await lookups();
    const v = { status: 'planning', channels: [], ...prefill, ...c };
    let b = null;
    if (c.id) b = await q(sb.from('campaign_budgets').select('*').eq('campaign_id', c.id).maybeSingle());
    openModal(`
      <h2>${c.id ? 'Επεξεργασία καμπάνιας' : 'Νέα καμπάνια'}</h2>
      <form class="form" id="f">
        <label>Όνομα *<input name="name" required value="${esc(v.name)}" placeholder="π.χ. Χριστούγεννα 2026"></label>
        <div class="row2"><label>Πελάτης *<select name="client_id" required><option value="">—</option>${options(L.clients.map((x) => [x.id, x.name]), v.client_id)}</select></label>
          <label>Κατάσταση<select name="status">${options(Object.entries(CAMPAIGN_STATUS), v.status)}</select></label></div>
        <div class="row2"><label>Έναρξη<input type="date" name="start_date" value="${esc(v.start_date)}"></label>
          <label>Λήξη<input type="date" name="end_date" value="${esc(v.end_date)}"></label></div>
        <label>Στόχος<textarea name="objective" rows="2" placeholder="Τι θέλουμε να πετύχουμε">${esc(v.objective)}</textarea></label>
        <div><div class="lbl-sm">Κανάλια</div><div class="chip-picks">${CHANNELS.map((x) => `<label class="pick"><input type="checkbox" name="ch" value="${esc(x)}" ${v.channels.includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></div>
        <label>KPIs<textarea name="kpis" rows="2" placeholder="π.χ. +15% reach, 40 leads, 3 δημοσιεύματα">${esc(v.kpis)}</textarea></label>
        ${isAdmin() ? `<div class="row2"><label>Προϋπολογισμός (€)<input type="number" step="0.01" min="0" name="budget" value="${esc(b?.budget)}"></label>
          <label>Έχουν δαπανηθεί (€)<input type="number" step="0.01" min="0" name="spent" value="${esc(b?.spent)}"></label></div>` : ''}
        <label>Σημειώσεις<textarea name="notes" rows="3">${esc(v.notes)}</textarea></label>
        <div class="modal-actions">${c.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      m.querySelector('#f').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const data = formData(f);
        data.channels = [...f.querySelectorAll('[name=ch]:checked')].map((x) => x.value);
        delete data.ch;
        const budget = { budget: data.budget == null ? null : Number(data.budget), spent: data.spent == null ? null : Number(data.spent) };
        delete data.budget; delete data.spent;
        let id = c.id;
        if (id) await q(sb.from('campaigns').update(data).eq('id', id));
        else id = (await q(sb.from('campaigns').insert(data).select().single())).id;
        if (isAdmin()) {
          if (b) await q(sb.from('campaign_budgets').update(budget).eq('campaign_id', id));
          else if (budget.budget != null || budget.spent != null) await q(sb.from('campaign_budgets').insert({ campaign_id: id, ...budget }));
        }
        closeModal(); toast('Η καμπάνια αποθηκεύτηκε');
        if (location.hash === `#/campaigns/${id}`) viewCampaign(id); else location.hash = `#/campaigns/${id}`;
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm(`Διαγραφή της καμπάνιας «${c.name}» μαζί με τα tasks και τις ημερομηνίες της;`)) return;
        await q(sb.from('campaigns').delete().eq('id', c.id)); closeModal(); toast('Διαγράφηκε'); location.hash = '#/campaigns';
      });
    });
  }

  async function viewCampaign(id) {
    const main = shell('campaigns', '<div class="empty">Φόρτωση…</div>');
    const c = await q(sb.from('campaigns').select('*').eq('id', id).maybeSingle());
    if (!c) { main.innerHTML = '<div class="empty">Η καμπάνια δεν βρέθηκε ή δεν έχεις πρόσβαση.</div>'; return; }
    const [tasks, events, L, b] = await Promise.all([
      q(sb.from('tasks').select('*').eq('campaign_id', id).order('due_date')),
      q(sb.from('events').select('*').eq('campaign_id', id).order('start_at')),
      lookups(),
      isAdmin() ? q(sb.from('campaign_budgets').select('*').eq('campaign_id', id).maybeSingle()) : null,
    ]);
    const done = tasks.filter((t) => t.status === 'done').length;
    const upcoming = events.filter((e) => new Date(e.end_at || e.start_at) >= new Date(new Date().setHours(0, 0, 0, 0)));
    const past = events.length - upcoming.length;
    main.innerHTML = `
      <div class="head"><div><a href="#/campaigns" class="muted" style="font-size:14px;text-decoration:none">← Καμπάνιες</a>
        <h1>${esc(c.name)}</h1>
        <div class="sub"><a href="#/clients/${c.client_id}">${esc(L.cname[c.client_id] || '')}</a> · ${c.start_date ? date(c.start_date) : '—'} → ${c.end_date ? date(c.end_date) : '—'} <span class="pill ${c.status}">${CAMPAIGN_STATUS[c.status]}</span></div></div>
        ${isAdmin() ? '<button class="btn" id="edit">Επεξεργασία</button>' : ''}</div>
      <div class="grid two">
        <div class="grid" style="align-content:start">
          <div class="card">
            <div class="head" style="margin-bottom:8px"><h2 style="margin:0">Tasks <small class="muted">${done}/${tasks.length}</small></h2><button class="btn sm" id="add-task">+ Task</button></div>
            <div class="progress" style="margin:0 0 10px"><span style="width:${tasks.length ? Math.round(done / tasks.length * 100) : 0}%"></span></div>
            <div id="tasks">${tasks.map((t) => taskRow(t, L)).join('') || '<div class="empty" style="padding:16px">Κανένα task ακόμα.</div>'}</div>
          </div>
          <div class="card">
            <div class="head" style="margin-bottom:8px"><h2 style="margin:0">Ημερολόγιο καμπάνιας</h2><button class="btn sm" id="add-ev">+ Ημερομηνία</button></div>
            ${upcoming.map((e) => eventRow(e, L)).join('') || '<div class="empty" style="padding:16px">Καμία επόμενη ημερομηνία.</div>'}
            ${past ? `<div class="muted" style="font-size:13px;margin-top:8px">+ ${past} παλαιότερες στο <a href="#/calendar">Ημερολόγιο</a></div>` : ''}
          </div>
        </div>
        <div class="grid" style="align-content:start">
          <div class="card"><h2>Brief</h2><dl class="info">
            <dt>Στόχος</dt><dd style="white-space:pre-wrap">${esc(c.objective || '—')}</dd>
            <dt>KPIs</dt><dd style="white-space:pre-wrap">${esc(c.kpis || '—')}</dd>
            <dt>Κανάλια</dt><dd><div class="chips" style="margin:0">${(c.channels || []).map((x) => chip(x)).join('') || '—'}</div></dd>
          </dl>${c.notes ? `<p style="white-space:pre-wrap;margin:14px 0 0">${esc(c.notes)}</p>` : ''}</div>
          ${isAdmin() ? `<div class="card"><h2>Προϋπολογισμός</h2>${b?.budget != null ? `
            <div class="kpi"><div class="num">${money(b.budget)}</div><div class="lbl">Σύνολο · ${money(b.spent || 0)} δαπανήθηκαν</div></div>
            <div class="progress ${Number(b.spent || 0) > Number(b.budget) ? 'over' : ''}" style="margin-top:10px"><span style="width:${Math.min(100, Math.round(Number(b.spent || 0) / Number(b.budget || 1) * 100))}%"></span></div>
            <div class="muted" style="font-size:13px;margin-top:6px">Υπόλοιπο ${money(Number(b.budget) - Number(b.spent || 0))}</div>` : '<div class="muted">Δεν έχει οριστεί. <a href="#" id="set-b">Όρισέ τον</a></div>'}
          </div>` : ''}
        </div>
      </div>`;
    main.querySelector('#edit')?.addEventListener('click', () => campaignForm(c, L));
    main.querySelector('#set-b')?.addEventListener('click', (e) => { e.preventDefault(); campaignForm(c, L); });
    const reload = () => viewCampaign(id);
    main.querySelector('#add-task').onclick = () => taskForm({}, L, { client_id: c.client_id, campaign_id: id }, reload);
    main.querySelector('#add-ev').onclick = () => eventForm({}, L, { client_id: c.client_id, campaign_id: id }, reload);
    bindTaskRows(main, tasks, L, reload);
    bindEventRows(main, events, L, reload);
  }

  // ============================================================ tasks
  function taskRow(t, L, showContext = false) {
    return `<div class="task-row ${t.status === 'done' ? 'is-done' : ''}" data-task="${t.id}">
      <input type="checkbox" data-check="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Ολοκλήρωση">
      <div class="task-main"><b>${esc(t.title)}</b>
        <div class="task-meta">${showContext && t.client_id ? esc(L.cname[t.client_id] || '') + (t.campaign_id ? ' · ' + esc(L.kname[t.campaign_id] || '') : '') + ' · ' : ''}${TASK_LABEL[t.status]}${t.assignee_id ? ' · ' + esc(L.pname[t.assignee_id] || '') : ''}</div></div>
      <div class="task-side">${t.priority === 'high' ? '<span class="pill high">Υψηλή</span>' : ''}${t.due_date ? `<small class="${overdue(t) ? 'late' : 'muted'}">${date(t.due_date)}</small>` : ''}</div>
    </div>`;
  }
  function bindTaskRows(root, tasks, L, reload) {
    root.querySelectorAll('[data-task]').forEach((row) => {
      row.onclick = (e) => { if (e.target.matches('[data-check]')) return; taskForm(tasks.find((t) => t.id === row.dataset.task), L, {}, reload); };
    });
    root.querySelectorAll('[data-check]').forEach((cb) => (cb.onchange = async () => {
      await q(sb.from('tasks').update({ status: cb.checked ? 'done' : 'todo' }).eq('id', cb.dataset.check));
      toast(cb.checked ? 'Μπράβο, έγινε ✓' : 'Ξανάνοιξε'); reload();
    }));
  }

  async function taskForm(t = {}, L, prefill = {}, onSaved) {
    L = L || await lookups();
    const v = { status: 'todo', priority: 'normal', ...prefill, ...t };
    const canDelete = !t.id || isAdmin() || t.created_by === state.user.id;
    openModal(`
      <h2>${t.id ? 'Task' : 'Νέο task'}</h2>
      <form class="form" id="f">
        <label>Τίτλος *<input name="title" required value="${esc(v.title)}" placeholder="π.χ. Μοντάζ reel #3"></label>
        <div class="row2"><label>Πελάτης<select name="client_id" ${isAdmin() ? '' : 'required'}><option value="">${isAdmin() ? '— Εσωτερικό —' : '—'}</option>${options(L.clients.map((x) => [x.id, x.name]), v.client_id)}</select></label>
          <label>Καμπάνια<select name="campaign_id"></select></label></div>
        <div class="row2"><label>Ανάθεση σε<select name="assignee_id"><option value="">—</option>${options(L.profiles.map((p) => [p.id, p.full_name + (p.id === state.user.id ? ' (εγώ)' : '')]), v.assignee_id)}</select></label>
          <label>Παράδοση<input type="date" name="due_date" value="${esc(v.due_date)}"></label></div>
        <div class="row2"><label>Κατάσταση<select name="status">${options(TASK_STATUS, v.status)}</select></label>
          <label>Προτεραιότητα<select name="priority">${options(Object.entries(PRIORITY), v.priority)}</select></label></div>
        <label>Περιγραφή<textarea name="description" rows="4">${esc(v.description)}</textarea></label>
        <div class="modal-actions">${t.id && canDelete ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      linkClientCampaign(f, L, v.campaign_id);
      f.onsubmit = async (e) => {
        e.preventDefault();
        const data = formData(f);
        if (t.id) await q(sb.from('tasks').update(data).eq('id', t.id));
        else await q(sb.from('tasks').insert(data));
        closeModal(); toast('Αποθηκεύτηκε'); onSaved?.();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή task;')) return;
        await q(sb.from('tasks').delete().eq('id', t.id)); closeModal(); onSaved?.();
      });
    });
  }

  async function viewTasks() {
    const main = shell('tasks', '<div class="empty">Φόρτωση…</div>');
    const [tasks, L] = await Promise.all([q(sb.from('tasks').select('*').order('due_date')), lookups()]);
    state.taskFilter ??= isAdmin() ? '' : 'me';
    main.innerHTML = `
      <div class="head"><div><h1>Tasks</h1><div class="sub" id="sub"></div></div><button class="btn primary" id="new">+ Νέο task</button></div>
      <div class="toolbar">
        <select id="fa"><option value="">Όλα</option><option value="me">Τα δικά μου</option><option value="none">Χωρίς ανάθεση</option>${options(L.profiles.filter((p) => p.id !== state.user.id).map((p) => [p.id, p.full_name]))}</select>
        <select id="fc"><option value="">Όλοι οι πελάτες</option>${options(L.clients.map((c) => [c.id, c.name]))}</select>
      </div>
      <div class="board tasks-board" id="board"></div>`;
    main.querySelector('#fa').value = state.taskFilter;
    const reload = () => viewTasks();
    const draw = () => {
      const fa = state.taskFilter = main.querySelector('#fa').value;
      const fc = main.querySelector('#fc').value;
      const list = tasks.filter((t) => (!fc || t.client_id === fc) && (!fa || (fa === 'me' ? t.assignee_id === state.user.id : fa === 'none' ? !t.assignee_id : t.assignee_id === fa)));
      const late = list.filter(overdue).length;
      main.querySelector('#sub').innerHTML = `${list.filter((t) => t.status !== 'done').length} ανοιχτά${late ? ` · <span class="late">${late} εκπρόθεσμα</span>` : ''}`;
      main.querySelector('#board').innerHTML = TASK_STATUS.map(([k, label]) => {
        const items = list.filter((t) => t.status === k);
        return `<div class="col" data-status="${k}"><h3><span>${label}</span><span>${items.length}</span></h3>
          ${items.map((t) => `<div class="lead tcard" draggable="true" data-id="${t.id}">
            <b>${esc(t.title)}</b>
            <div class="row"><span>${esc(L.cname[t.client_id] || 'Εσωτερικό')}</span>${t.priority === 'high' ? '<span class="pill high">!</span>' : ''}</div>
            <div class="row"><span>${t.assignee_id ? esc(L.pname[t.assignee_id] || '') : '<i>χωρίς ανάθεση</i>'}</span>${t.due_date ? `<span class="${overdue(t) ? 'late' : ''}">${date(t.due_date)}</span>` : ''}</div>
          </div>`).join('')}</div>`;
      }).join('');
      main.querySelectorAll('.tcard').forEach((el) => {
        el.onclick = () => taskForm(tasks.find((t) => t.id === el.dataset.id), L, {}, reload);
        el.ondragstart = (e) => e.dataTransfer.setData('text/plain', el.dataset.id);
      });
      main.querySelectorAll('.col').forEach((col) => {
        col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
        col.ondragleave = () => col.classList.remove('drop');
        col.ondrop = async (e) => {
          e.preventDefault(); col.classList.remove('drop');
          const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
          if (!t || t.status === col.dataset.status) return;
          await q(sb.from('tasks').update({ status: col.dataset.status }).eq('id', t.id));
          t.status = col.dataset.status; toast(`«${t.title}» → ${TASK_LABEL[t.status]}`); draw();
        };
      });
    };
    main.querySelector('#fa').onchange = draw;
    main.querySelector('#fc').onchange = draw;
    main.querySelector('#new').onclick = () => taskForm({}, L, { assignee_id: state.taskFilter === 'me' ? state.user.id : null, client_id: main.querySelector('#fc').value || null }, reload);
    draw();
  }

  // ============================================================ calendar
  function eventRow(e, L, showClient = false) {
    const t = EVENT_TYPES[e.type] || EVENT_TYPES.other;
    return `<div class="ev-row" data-ev="${e.id}">
      <div class="ev-date"><b>${new Date(e.start_at).getDate()}</b><small>${new Date(e.start_at).toLocaleDateString('el-GR', { month: 'short' })}</small></div>
      <div style="flex:1;min-width:0"><b>${esc(e.title)}</b>
        <div class="task-meta">${typeDot(e.type)} ${t[0]}${e.channel ? ' · ' + esc(e.channel) : ''}${e.all_day ? '' : ' · ' + hm(e.start_at)}${showClient && e.client_id ? ' · ' + esc(L.cname[e.client_id] || '') : ''}</div></div>
    </div>`;
  }
  function bindEventRows(root, events, L, reload) {
    root.querySelectorAll('[data-ev]').forEach((row) => (row.onclick = (e) => { e.stopPropagation(); eventForm(events.find((x) => x.id === row.dataset.ev), L, {}, reload); }));
  }

  async function eventForm(ev = {}, L, prefill = {}, onSaved) {
    L = L || await lookups();
    const v = { type: 'post', all_day: false, ...prefill, ...ev };
    const start = v.start_at ? new Date(v.start_at) : null;
    const d = v.date || (start ? ymd(start) : todayYmd());
    const t1 = start && !v.all_day ? hm(start) : '10:00';
    const t2 = v.end_at && !v.all_day ? hm(v.end_at) : '';
    const canDelete = !ev.id || isAdmin() || ev.created_by === state.user.id;
    openModal(`
      <h2>${ev.id ? 'Ημερομηνία' : 'Νέα ημερομηνία'}</h2>
      <form class="form" id="f">
        <label>Τίτλος *<input name="title" required value="${esc(v.title)}" placeholder="π.χ. Post: νέα συλλογή"></label>
        <div class="row2"><label>Τύπος<select name="type">${options(Object.entries(EVENT_TYPES).map(([k, x]) => [k, x[0]]), v.type)}</select></label>
          <label>Κανάλι<select name="channel"><option value="">—</option>${options(CHANNELS.map((x) => [x, x]), v.channel)}</select></label></div>
        <div class="row2"><label>Πελάτης<select name="client_id" ${isAdmin() ? '' : 'required'}><option value="">${isAdmin() ? '— Εσωτερικό —' : '—'}</option>${options(L.clients.map((x) => [x.id, x.name]), v.client_id)}</select></label>
          <label>Καμπάνια<select name="campaign_id"></select></label></div>
        <div class="row3"><label>Ημερομηνία<input type="date" name="d" required value="${esc(d)}"></label>
          <label>Από<input type="time" name="t1" value="${esc(t1)}"></label>
          <label>Έως<input type="time" name="t2" value="${esc(t2)}"></label></div>
        <label class="inline"><input type="checkbox" name="all_day" ${v.all_day ? 'checked' : ''}> Ολοήμερο</label>
        <label>Σημειώσεις<textarea name="notes" rows="3" placeholder="Caption, location, crew, link…">${esc(v.notes)}</textarea></label>
        <div class="modal-actions">${ev.id && canDelete ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      linkClientCampaign(f, L, v.campaign_id);
      const toggle = () => { f.t1.disabled = f.t2.disabled = f.all_day.checked; };
      f.all_day.onchange = toggle; toggle();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const x = formData(f);
        const allDay = f.all_day.checked;
        const data = {
          title: x.title, type: x.type, channel: x.channel, client_id: x.client_id, campaign_id: x.campaign_id, notes: x.notes, all_day: allDay,
          start_at: new Date(`${x.d}T${allDay ? '00:00' : (x.t1 || '00:00')}`).toISOString(),
          end_at: !allDay && x.t2 ? new Date(`${x.d}T${x.t2}`).toISOString() : null,
        };
        if (ev.id) await q(sb.from('events').update(data).eq('id', ev.id));
        else await q(sb.from('events').insert(data));
        closeModal(); toast('Αποθηκεύτηκε'); onSaved?.();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή ημερομηνίας;')) return;
        await q(sb.from('events').delete().eq('id', ev.id)); closeModal(); onSaved?.();
      });
    });
  }

  async function viewCalendar() {
    state.cal ??= (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); })();
    state.calClient ??= '';
    state.calShowTasks ??= true;
    const month = state.cal;
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + 6) % 7));
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42);
    const main = shell('calendar', '<div class="empty">Φόρτωση…</div>');
    const [events, tasks, campaigns, L] = await Promise.all([
      q(sb.from('events').select('*').gte('start_at', gridStart.toISOString()).lt('start_at', gridEnd.toISOString()).order('start_at')),
      q(sb.from('tasks').select('*').gte('due_date', ymd(gridStart)).lt('due_date', ymd(gridEnd))),
      q(sb.from('campaigns').select('id,name,client_id,start_date,end_date,status')),
      lookups(),
    ]);
    const fc = state.calClient;
    const evs = events.filter((e) => !fc || e.client_id === fc);
    const tks = state.calShowTasks ? tasks.filter((t) => t.status !== 'done' && (!fc || t.client_id === fc)) : [];
    const kms = campaigns.filter((k) => !fc || k.client_id === fc);
    const byDay = {};
    const push = (day, item) => (byDay[day] ??= []).push(item);
    evs.forEach((e) => push(ymd(e.start_at), { kind: 'ev', e }));
    tks.forEach((t) => push(t.due_date, { kind: 'task', t }));
    kms.forEach((k) => { if (k.start_date) push(k.start_date, { kind: 'camp', k, edge: 'start' }); if (k.end_date) push(k.end_date, { kind: 'camp', k, edge: 'end' }); });
    const title = month.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
    const tday = todayYmd();
    const itemHtml = (it) => it.kind === 'ev'
      ? `<div class="cal-item" data-ev="${it.e.id}" style="--c:${EVENT_TYPES[it.e.type]?.[1] || '#999'}">${it.e.all_day ? '' : `<small>${hm(it.e.start_at)}</small> `}${esc(it.e.title)}</div>`
      : it.kind === 'task'
        ? `<div class="cal-item task ${overdue(it.t) ? 'late' : ''}" data-task="${it.t.id}">☐ ${esc(it.t.title)}</div>`
        : `<a class="cal-item camp" href="#/campaigns/${it.k.id}">${it.edge === 'start' ? '▶' : '■'} ${esc(it.k.name)}</a>`;

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const key = ymd(d);
      const items = byDay[key] || [];
      cells.push(`<div class="cal-cell ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${key === tday ? 'today' : ''}" data-day="${key}">
        <div class="cal-num">${d.getDate()}</div>${items.slice(0, 4).map(itemHtml).join('')}${items.length > 4 ? `<div class="cal-more">+${items.length - 4} ακόμα</div>` : ''}</div>`);
    }
    const monthDays = Object.keys(byDay).filter((k) => k.slice(0, 7) === ymd(first).slice(0, 7)).sort();
    main.innerHTML = `
      <div class="head"><div><h1 style="text-transform:capitalize">${esc(title)}</h1><div class="sub">${(() => { const n = evs.filter((e) => ymd(e.start_at).slice(0, 7) === ymd(first).slice(0, 7)).length; return n === 1 ? '1 ημερομηνία' : n + ' ημερομηνίες'; })()} αυτόν τον μήνα</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="prev" aria-label="Προηγούμενος">‹</button><button class="btn" id="now">Σήμερα</button><button class="btn" id="next" aria-label="Επόμενος">›</button><button class="btn primary" id="new">+ Ημερομηνία</button></div></div>
      <div class="toolbar">
        <select id="fc"><option value="">Όλοι οι πελάτες</option>${options(L.clients.map((c) => [c.id, c.name]), fc)}</select>
        <label class="inline" style="color:var(--ink)"><input type="checkbox" id="st" ${state.calShowTasks ? 'checked' : ''}> Δείξε tasks</label>
        <div class="legend">${Object.values(EVENT_TYPES).map(([l, c]) => `<span><i class="dot-ev" style="background:${c}"></i>${l}</span>`).join('')}</div>
      </div>
      <div class="cal card">
        <div class="cal-head">${WEEKDAYS.map((w) => `<div>${w}</div>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>
      <div class="agenda">${monthDays.map((k) => `<div class="agenda-day"><div class="agenda-date ${k === tday ? 'today' : ''}">${new Date(k + 'T12:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>${byDay[k].map(itemHtml).join('')}</div>`).join('') || '<div class="empty card">Τίποτα προγραμματισμένο αυτόν τον μήνα.</div>'}</div>`;

    const go = (delta) => { state.cal = delta === 0 ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(month.getFullYear(), month.getMonth() + delta, 1); viewCalendar(); };
    main.querySelector('#prev').onclick = () => go(-1);
    main.querySelector('#next').onclick = () => go(1);
    main.querySelector('#now').onclick = () => go(0);
    main.querySelector('#fc').onchange = (e) => { state.calClient = e.target.value; viewCalendar(); };
    main.querySelector('#st').onchange = (e) => { state.calShowTasks = e.target.checked; viewCalendar(); };
    const reload = () => viewCalendar();
    main.querySelector('#new').onclick = () => eventForm({}, L, { client_id: fc || null }, reload);
    main.querySelectorAll('.cal-cell').forEach((cell) => (cell.onclick = (e) => {
      if (e.target.closest('.cal-item')) return;
      eventForm({}, L, { date: cell.dataset.day, client_id: fc || null }, reload);
    }));
    main.querySelectorAll('.cal-more').forEach((el) => (el.onclick = (e) => { e.stopPropagation(); document.querySelector('.agenda')?.scrollIntoView({ behavior: 'smooth' }); }));
    bindEventRows(main, events, L, reload);
    main.querySelectorAll('[data-task]').forEach((el) => (el.onclick = (e) => { e.stopPropagation(); taskForm(tasks.find((t) => t.id === el.dataset.task), L, {}, reload); }));
  }

  // ============================================================ widgets for other pages
  async function myWorkCard() {
    const [tasks, events, L] = await Promise.all([
      q(sb.from('tasks').select('*').eq('assignee_id', state.user.id).order('due_date')),
      q(sb.from('events').select('*').gte('start_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).lt('start_at', new Date(Date.now() + 7 * 864e5).toISOString()).order('start_at')),
      lookups(),
    ]);
    const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const html = `
      <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Τα tasks μου</h2><a class="btn sm" href="#/tasks">Όλα</a></div>
        ${open.slice(0, 7).map((t) => taskRow(t, L, true)).join('') || '<div class="empty" style="padding:16px">Κανένα ανοιχτό task. 🎉</div>'}</div>
      <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Επόμενες 7 ημέρες</h2><a class="btn sm" href="#/calendar">Ημερολόγιο</a></div>
        ${events.slice(0, 7).map((e) => eventRow(e, L, true)).join('') || '<div class="empty" style="padding:16px">Τίποτα προγραμματισμένο.</div>'}</div>`;
    return { html, bind: (root, reload) => { bindTaskRows(root, tasks, L, reload); bindEventRows(root, events, L, reload); } };
  }

  async function clientCampaignsCard(clientId) {
    const campaigns = await q(sb.from('campaigns').select('*').eq('client_id', clientId).order('start_date', { ascending: false }));
    return `<div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Καμπάνιες</h2>${isAdmin() ? '<button class="btn sm" id="add-camp">+ Καμπάνια</button>' : ''}</div>
      ${campaigns.map((k) => `<a class="list-row" href="#/campaigns/${k.id}" style="text-decoration:none"><span><b>${esc(k.name)}</b><br><small class="muted">${k.start_date ? date(k.start_date) : '—'} → ${k.end_date ? date(k.end_date) : '—'}</small></span><span class="pill ${k.status}">${CAMPAIGN_STATUS[k.status]}</span></a>`).join('') || '<div class="empty" style="padding:16px">Καμία καμπάνια.</div>'}</div>`;
  }

  return { viewCampaigns, viewCampaign, viewTasks, viewCalendar, campaignForm, taskForm, eventForm, myWorkCard, clientCampaignsCard };
}
