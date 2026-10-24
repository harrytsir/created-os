// Created OS — Φάση 5: Χρονομέτρηση, Retainers, Κερδοφορία, Templates,
// Επαναλαμβανόμενα tasks, Υπενθυμίσεις, Φόρμα leads για το site
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const PRIORITY = { low: 'Χαμηλή', normal: 'Κανονική', high: 'Υψηλή' };
const FREQ = { weekly: 'Κάθε εβδομάδα', monthly: 'Κάθε μήνα' };

export function createGrowth(ctx) {
  const { sb, state, isAdmin, esc, q, toast, shell, openModal, closeModal, options, formData, date, money } = ctx;

  // ---------- βοηθητικά ----------
  const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const today = () => ymd(new Date());
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + Number(n || 0)); return ymd(x); };
  const period = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (p) => new Date(p + '-15').toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
  const hrs = (min) => { const m = Math.round(Number(min || 0)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const hrsNum = (min) => Number(min || 0) / 60;
  const parseDuration = (s) => {
    s = String(s || '').trim().replace(',', '.');
    if (!s) return 0;
    if (s.includes(':')) { const [h, m] = s.split(':'); return Number(h || 0) * 60 + Number(m || 0); }
    if (/[hμω]/i.test(s) || /m$/i.test(s)) {
      const h = /([\d.]+)\s*[hω]/i.exec(s), m = /([\d.]+)\s*(m|λ)/i.exec(s);
      return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
    }
    return Math.round(Number(s) * 60); // σκέτος αριθμός = ώρες
  };
  const monday = (d) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };

  async function lookups() {
    const [clients, campaigns, tasks, profiles] = await Promise.all([
      q(sb.from('clients').select('id,name,status').order('name')),
      q(sb.from('campaigns').select('id,name,client_id,status').order('name')),
      q(sb.from('tasks').select('id,title,client_id,campaign_id,status')),
      q(sb.from('profiles').select('id,full_name,role').order('full_name')),
    ]);
    return {
      clients, campaigns, tasks, profiles,
      cname: Object.fromEntries(clients.map((c) => [c.id, c.name])),
      kname: Object.fromEntries(campaigns.map((c) => [c.id, c.name])),
      tname: Object.fromEntries(tasks.map((t) => [t.id, t.title])),
      pname: Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
    };
  }

  // ============================================================ χρονόμετρο
  let tick;
  async function loadRunning() {
    const rows = await q(sb.from('time_entries').select('*').eq('user_id', state.user.id).is('minutes', null));
    state.running = rows.find((r) => r.started_at) || null;
    return state.running;
  }
  const elapsed = (r) => Math.max(1, Math.round((Date.now() - new Date(r.started_at).getTime()) / 60000));

  async function mountTimer(slot) {
    if (!slot) return;
    if (state.running === undefined) await loadRunning();
    const r = state.running;
    const L = r ? await cachedLookups() : null;
    slot.innerHTML = r
      ? `<div class="timer on"><div><b id="tm-clock">${hrs(elapsed(r))}</b><small>${esc((r.task_id && L.tname[r.task_id]) || L.cname[r.client_id] || 'Χρόνος')}</small></div><button class="btn sm" id="tm-stop">■ Στοπ</button></div>`
      : `<button class="timer" id="tm-start"><span>▶</span> Ξεκίνα χρονόμετρο</button>`;
    clearInterval(tick);
    if (r) tick = setInterval(() => { const el = document.getElementById('tm-clock'); if (el) el.textContent = hrs(elapsed(r)); else clearInterval(tick); }, 20000);
    slot.querySelector('#tm-start')?.addEventListener('click', () => startTimerModal());
    slot.querySelector('#tm-stop')?.addEventListener('click', () => stopTimer());
  }
  let LC, LCt = 0;
  const cachedLookups = async () => (Date.now() - LCt < 60000 && LC) ? LC : (LCt = Date.now(), LC = await lookups());

  async function startTimer(prefill = {}) {
    if (state.running) await stopTimer(true);
    const row = await q(sb.from('time_entries').insert({
      user_id: state.user.id, client_id: prefill.client_id || null, campaign_id: prefill.campaign_id || null, task_id: prefill.task_id || null,
      note: prefill.note || null, work_date: today(), started_at: new Date().toISOString(), minutes: null,
    }).select().single());
    state.running = row; LCt = 0;
    toast('Το χρονόμετρο ξεκίνησε');
    mountTimer(document.getElementById('timer-slot'));
  }
  async function stopTimer(silent) {
    const r = state.running; if (!r) return;
    const minutes = elapsed(r);
    await q(sb.from('time_entries').update({ minutes, started_at: null }).eq('id', r.id));
    state.running = null;
    if (!silent) toast(`Καταγράφηκαν ${hrs(minutes)} ώρες`);
    mountTimer(document.getElementById('timer-slot'));
    if (location.hash.startsWith('#/time')) viewTime();
  }

  async function startTimerModal() {
    const L = await lookups();
    openModal(`
      <h2>Έναρξη χρονομέτρου</h2>
      <form class="form" id="f">
        <label>Πελάτης ${isAdmin() ? '' : '*'}<select name="client_id" ${isAdmin() ? '' : 'required'}><option value="">${isAdmin() ? '— Εσωτερικό —' : '—'}</option>${options(L.clients.map((c) => [c.id, c.name]))}</select></label>
        <label>Task (προαιρετικά)<select name="task_id"><option value="">—</option></select></label>
        <label>Σε τι δουλεύεις;<input name="note" placeholder="π.χ. Μοντάζ reel"></label>
        <div class="modal-actions"><div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">▶ Έναρξη</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      const drawTasks = () => {
        const cid = f.client_id.value;
        f.task_id.innerHTML = '<option value="">—</option>' + options(L.tasks.filter((t) => t.status !== 'done' && (!cid || t.client_id === cid)).map((t) => [t.id, t.title]));
      };
      f.client_id.onchange = drawTasks; drawTasks();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const x = formData(f);
        const t = L.tasks.find((k) => k.id === x.task_id);
        closeModal();
        await startTimer({ client_id: x.client_id || t?.client_id, campaign_id: t?.campaign_id, task_id: x.task_id, note: x.note });
      };
    });
  }

  // ============================================================ καταχώριση χρόνου
  async function entryForm(e = {}, L, onSaved) {
    L = L || await lookups();
    const v = { work_date: today(), billable: true, ...e };
    openModal(`
      <h2>${e.id ? 'Επεξεργασία χρόνου' : 'Καταχώριση χρόνου'}</h2>
      <form class="form" id="f">
        <div class="row2"><label>Ημερομηνία<input type="date" name="work_date" required value="${esc(v.work_date)}"></label>
          <label>Διάρκεια *<input name="dur" required value="${v.minutes ? hrs(v.minutes) : ''}" placeholder="1:30 ή 1.5 ή 45m"></label></div>
        <div class="row2"><label>Πελάτης ${isAdmin() ? '' : '*'}<select name="client_id" ${isAdmin() ? '' : 'required'}><option value="">${isAdmin() ? '— Εσωτερικό —' : '—'}</option>${options(L.clients.map((c) => [c.id, c.name]), v.client_id)}</select></label>
          <label>Task<select name="task_id"></select></label></div>
        <label>Σημείωση<input name="note" value="${esc(v.note)}"></label>
        <label class="inline"><input type="checkbox" name="billable" ${v.billable ? 'checked' : ''}> Χρεώσιμος χρόνος</label>
        ${isAdmin() && e.id && e.user_id !== state.user.id ? `<p class="muted" style="margin:0;font-size:13px">Καταχώριση του/της ${esc(L.pname[e.user_id] || '')}</p>` : ''}
        <div class="modal-actions">${e.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      const drawTasks = () => {
        const cid = f.client_id.value;
        f.task_id.innerHTML = '<option value="">—</option>' + options(L.tasks.filter((t) => t.id === v.task_id || (t.status !== 'done' && (!cid || t.client_id === cid))).map((t) => [t.id, t.title]), v.task_id);
      };
      f.client_id.onchange = () => { v.task_id = null; drawTasks(); }; drawTasks();
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const x = formData(f);
        const minutes = parseDuration(x.dur);
        if (!minutes || minutes < 1 || minutes > 24 * 60) { toast('Γράψε διάρκεια, π.χ. 1:30'); return; }
        const t = L.tasks.find((k) => k.id === x.task_id);
        const data = { work_date: x.work_date, minutes, client_id: x.client_id || t?.client_id || null, task_id: x.task_id, campaign_id: t?.campaign_id || null, note: x.note, billable: f.billable.checked, started_at: null };
        if (e.id) await q(sb.from('time_entries').update(data).eq('id', e.id));
        else await q(sb.from('time_entries').insert({ ...data, user_id: state.user.id }));
        closeModal(); toast('Αποθηκεύτηκε'); onSaved?.();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή καταχώρισης;')) return;
        await q(sb.from('time_entries').delete().eq('id', e.id));
        if (state.running?.id === e.id) { state.running = null; mountTimer(document.getElementById('timer-slot')); }
        closeModal(); onSaved?.();
      });
    });
  }

  async function viewTime() {
    state.timeWeek ??= monday(today());
    state.timeUser ??= state.user.id;
    const from = state.timeWeek, to = addDays(from, 7);
    const main = shell('time', '<div class="empty">Φόρτωση…</div>');
    const [entries, L] = await Promise.all([
      q(sb.from('time_entries').select('*').gte('work_date', from).lt('work_date', to).order('work_date')),
      lookups(),
    ]);
    const who = isAdmin() ? state.timeUser : state.user.id;
    const list = entries.filter((e) => (!who || e.user_id === who));
    const done = list.filter((e) => e.minutes);
    const total = done.reduce((s, e) => s + e.minutes, 0);
    const billable = done.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0);
    const byClient = {};
    done.forEach((e) => { const k = e.client_id || '_'; byClient[k] = (byClient[k] || 0) + e.minutes; });
    const days = [...Array(7)].map((_, i) => addDays(from, i));
    const label = `${new Date(from + 'T12:00').toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })} – ${new Date(addDays(from, 6) + 'T12:00').toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    main.innerHTML = `
      <div class="head"><div><h1>Χρόνος</h1><div class="sub">${label}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="prev">‹</button><button class="btn" id="now">Αυτή η εβδομάδα</button><button class="btn" id="next">›</button><button class="btn primary" id="add">+ Χρόνος</button></div></div>
      ${isAdmin() ? `<div class="toolbar"><select id="who"><option value="">Όλη η ομάδα</option>${options(L.profiles.map((p) => [p.id, p.full_name + (p.id === state.user.id ? ' (εγώ)' : '')]), who)}</select></div>` : ''}
      <div class="grid kpi" style="margin-bottom:16px">
        <div class="card"><div class="num">${hrs(total)}</div><div class="lbl">Σύνολο εβδομάδας</div></div>
        <div class="card"><div class="num">${total ? Math.round(billable / total * 100) : 0}%</div><div class="lbl">Χρεώσιμος χρόνος</div></div>
        <div class="card"><div class="num">${Object.keys(byClient).length}</div><div class="lbl">Πελάτες</div></div>
      </div>
      <div class="grid two">
        <div class="card"><h2>Καταχωρίσεις</h2>
          ${days.map((d) => {
            const es = list.filter((e) => e.work_date === d);
            const sum = es.reduce((s, e) => s + (e.minutes || 0), 0);
            return `<div class="day-block ${d === today() ? 'today' : ''}"><div class="day-head"><b>${new Date(d + 'T12:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' })}</b><span>${sum ? hrs(sum) : ''}</span></div>
              ${es.map((e) => `<div class="time-row" data-e="${e.id}">
                <div style="flex:1;min-width:0"><b>${esc(e.note || (e.task_id && L.tname[e.task_id]) || 'Χωρίς σημείωση')}</b>
                  <div class="task-meta">${esc(L.cname[e.client_id] || 'Εσωτερικό')}${e.task_id && e.note ? ' · ' + esc(L.tname[e.task_id] || '') : ''}${!who ? ' · ' + esc(L.pname[e.user_id] || '') : ''}${e.billable ? '' : ' · μη χρεώσιμο'}</div></div>
                <b class="${e.minutes ? '' : 'live'}">${e.minutes ? hrs(e.minutes) : '● τρέχει'}</b></div>`).join('')}
            </div>`;
          }).join('')}
        </div>
        <div class="card" style="align-self:start"><h2>Ανά πελάτη</h2>
          ${Object.entries(byClient).sort((a, b) => b[1] - a[1]).map(([k, mm]) => `<div class="bar-row"><div class="bar-lbl"><span>${esc(k === '_' ? 'Εσωτερικό' : L.cname[k] || '—')}</span><b>${hrs(mm)}</b></div><div class="progress"><span style="width:${Math.round(mm / total * 100)}%"></span></div></div>`).join('') || '<div class="empty" style="padding:16px">Καμία καταχώριση αυτή την εβδομάδα.</div>'}
        </div>
      </div>`;
    const go = (n) => { state.timeWeek = n === 0 ? monday(today()) : addDays(from, n * 7); viewTime(); };
    main.querySelector('#prev').onclick = () => go(-1);
    main.querySelector('#next').onclick = () => go(1);
    main.querySelector('#now').onclick = () => go(0);
    main.querySelector('#who')?.addEventListener('change', (e) => { state.timeUser = e.target.value; viewTime(); });
    main.querySelector('#add').onclick = () => entryForm({}, L, viewTime);
    main.querySelectorAll('[data-e]').forEach((row) => (row.onclick = () => {
      const e = list.find((x) => x.id === row.dataset.e);
      if (!e.minutes && e.user_id === state.user.id) { if (confirm('Το χρονόμετρο τρέχει. Να σταματήσει;')) stopTimer(); return; }
      entryForm(e, L, viewTime);
    }));
  }

  // ============================================================ retainers
  const activeIn = (r, p) => r.active && r.start_date.slice(0, 7) <= p && (!r.end_date || r.end_date.slice(0, 7) >= p);

  async function retainerForm(r = {}, clients, onSaved) {
    clients = clients || await q(sb.from('clients').select('id,name').order('name'));
    const v = { start_date: today(), billing_day: 1, active: true, ...r };
    openModal(`
      <h2>${r.id ? 'Retainer' : 'Νέο retainer'}</h2>
      <form class="form" id="f">
        <div class="row2"><label>Πελάτης *<select name="client_id" required><option value="">—</option>${options(clients.map((c) => [c.id, c.name]), v.client_id)}</select></label>
          <label>Όνομα *<input name="name" required value="${esc(v.name)}" placeholder="π.χ. Social media & reels"></label></div>
        <div class="row2"><label>Μηνιαία αμοιβή (€, χωρίς ΦΠΑ)<input type="number" step="0.01" min="0" name="monthly_fee" required value="${esc(v.monthly_fee)}"></label>
          <label>Ώρες που περιλαμβάνει / μήνα<input type="number" step="0.5" min="0" name="hours_included" value="${esc(v.hours_included)}"></label></div>
        <div class="row3"><label>Έναρξη<input type="date" name="start_date" required value="${esc(v.start_date)}"></label>
          <label>Λήξη<input type="date" name="end_date" value="${esc(v.end_date)}"></label>
          <label>Ημέρα τιμολόγησης<input type="number" min="1" max="28" name="billing_day" value="${esc(v.billing_day)}"></label></div>
        <label class="inline"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Ενεργό</label>
        <label>Σημειώσεις<textarea name="notes" rows="3">${esc(v.notes)}</textarea></label>
        <div class="modal-actions">${r.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const x = formData(f);
        const data = { ...x, active: f.active.checked, monthly_fee: Number(x.monthly_fee || 0), hours_included: x.hours_included == null ? null : Number(x.hours_included), billing_day: Number(x.billing_day || 1) };
        if (r.id) await q(sb.from('retainers').update(data).eq('id', r.id));
        else await q(sb.from('retainers').insert(data));
        closeModal(); toast('Αποθηκεύτηκε'); onSaved?.();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή retainer; Για παλιούς πελάτες καλύτερα βάλε ημερομηνία λήξης.')) return;
        await q(sb.from('retainers').delete().eq('id', r.id)); closeModal(); onSaved?.();
      });
    });
  }

  async function viewRetainers() {
    const p = state.retPeriod ??= period();
    const main = shell('retainers', '<div class="empty">Φόρτωση…</div>');
    const [rets, bills, clients, entries] = await Promise.all([
      q(sb.from('retainers').select('*').order('created_at')),
      q(sb.from('retainer_billings').select('*').eq('period', p)),
      q(sb.from('clients').select('id,name').order('name')),
      q(sb.from('time_entries').select('client_id,minutes,work_date').gte('work_date', p + '-01').lt('work_date', nextPeriod(p) + '-01')),
    ]);
    const cname = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    const act = rets.filter((r) => activeIn(r, p));
    const mrr = act.reduce((s, r) => s + Number(r.monthly_fee || 0), 0);
    const billed = new Set(bills.map((b) => b.retainer_id));
    const minsBy = {}; entries.forEach((e) => { if (e.minutes && e.client_id) minsBy[e.client_id] = (minsBy[e.client_id] || 0) + e.minutes; });
    const isNow = p === period();
    const dayNow = new Date().getDate();
    main.innerHTML = `
      <div class="head"><div><h1>Retainers</h1><div class="sub" style="text-transform:capitalize">${monthLabel(p)}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="prev">‹</button><button class="btn" id="now">Τρέχων μήνας</button><button class="btn" id="next">›</button><button class="btn primary" id="new">+ Retainer</button></div></div>
      <div class="grid kpi" style="margin-bottom:16px">
        <div class="card"><div class="num">${money(mrr)}</div><div class="lbl">MRR · μηνιαίο σταθερό έσοδο</div></div>
        <div class="card"><div class="num">${money(mrr * 12)}</div><div class="lbl">Ετήσια αξία (ARR)</div></div>
        <div class="card"><div class="num">${act.length}</div><div class="lbl">Ενεργά retainers</div></div>
        <div class="card"><div class="num">${act.filter((r) => billed.has(r.id)).length}/${act.length}</div><div class="lbl">Τιμολογήθηκαν</div></div>
      </div>
      <div class="card table-wrap" style="padding:0"><table>
        <thead><tr><th>Πελάτης / retainer</th><th style="text-align:right">Αμοιβή</th><th class="hide-sm">Ώρες μήνα</th><th>Τιμολόγηση</th></tr></thead>
        <tbody>${act.map((r) => {
          const used = minsBy[r.client_id] || 0, inc = Number(r.hours_included || 0) * 60, pct = inc ? Math.round(used / inc * 100) : 0;
          const due = isNow && !billed.has(r.id) && dayNow >= r.billing_day;
          return `<tr data-r="${r.id}"><td><b>${esc(cname[r.client_id] || '—')}</b><div class="task-meta">${esc(r.name)} · τιμολόγηση στις ${r.billing_day}</div></td>
            <td style="text-align:right;white-space:nowrap">${money(r.monthly_fee)}</td>
            <td class="hide-sm" style="min-width:150px">${inc ? `<div class="bar-lbl"><span>${hrs(used)} / ${hrs(inc)}</span><b class="${pct > 100 ? 'late' : ''}">${pct}%</b></div><div class="progress ${pct > 100 ? 'over' : ''}"><span style="width:${Math.min(100, pct)}%"></span></div>` : `<span class="muted">${hrs(used)}</span>`}</td>
            <td><label class="inline" data-stop><input type="checkbox" data-bill="${r.id}" ${billed.has(r.id) ? 'checked' : ''}> ${billed.has(r.id) ? 'Τιμολογήθηκε' : due ? '<span class="late">Να τιμολογηθεί</span>' : 'Εκκρεμεί'}</label></td></tr>`;
        }).join('') || '<tr><td colspan="4" class="empty">Κανένα ενεργό retainer αυτόν τον μήνα.</td></tr>'}</tbody>
      </table></div>
      ${rets.filter((r) => !activeIn(r, p)).length ? `<details class="card" style="margin-top:16px"><summary>Ανενεργά / εκτός μήνα (${rets.filter((r) => !activeIn(r, p)).length})</summary>
        ${rets.filter((r) => !activeIn(r, p)).map((r) => `<div class="list-row" data-r="${r.id}" style="cursor:pointer"><span>${esc(cname[r.client_id] || '—')} · ${esc(r.name)}</span><span class="muted">${money(r.monthly_fee)}</span></div>`).join('')}</details>` : ''}`;
    const go = (n) => { state.retPeriod = n === 0 ? period() : shiftPeriod(p, n); viewRetainers(); };
    main.querySelector('#prev').onclick = () => go(-1);
    main.querySelector('#next').onclick = () => go(1);
    main.querySelector('#now').onclick = () => go(0);
    main.querySelector('#new').onclick = () => retainerForm({}, clients, viewRetainers);
    main.querySelectorAll('[data-r]').forEach((row) => (row.onclick = (e) => { if (e.target.closest('[data-stop]')) return; retainerForm(rets.find((r) => r.id === row.dataset.r), clients, viewRetainers); }));
    main.querySelectorAll('[data-bill]').forEach((cb) => (cb.onchange = async () => {
      const r = rets.find((x) => x.id === cb.dataset.bill);
      if (cb.checked) await q(sb.from('retainer_billings').insert({ retainer_id: r.id, period: p, amount: r.monthly_fee }));
      else await q(sb.from('retainer_billings').delete().eq('retainer_id', r.id).eq('period', p));
      toast(cb.checked ? 'Σημειώθηκε ως τιμολογημένο' : 'Αναιρέθηκε'); viewRetainers();
    }));
  }
  const shiftPeriod = (p, n) => { const [y, m] = p.split('-').map(Number); return period(new Date(y, m - 1 + n, 15)); };
  const nextPeriod = (p) => shiftPeriod(p, 1);

  async function clientRetainersCard(clientId) {
    const rets = await q(sb.from('retainers').select('*').eq('client_id', clientId));
    const p = period();
    return `<div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Retainers</h2><button class="btn sm" id="add-ret">+ Retainer</button></div>
      ${rets.map((r) => `<div class="list-row" data-ret="${r.id}" style="cursor:pointer"><span><b>${esc(r.name)}</b><br><small class="muted">${r.hours_included ? r.hours_included + ' ώρες/μήνα · ' : ''}από ${date(r.start_date)}</small></span><span style="text-align:right">${money(r.monthly_fee)}<br><small class="${activeIn(r, p) ? '' : 'muted'}">${activeIn(r, p) ? 'ενεργό' : 'ανενεργό'}</small></span></div>`).join('') || '<div class="empty" style="padding:16px">Κανένα retainer.</div>'}</div>`;
  }
  function bindClientRetainers(root, clientId, reload) {
    root.querySelector('#add-ret')?.addEventListener('click', () => retainerForm({ client_id: clientId }, null, reload));
    root.querySelectorAll('[data-ret]').forEach((el) => (el.onclick = async () => {
      const r = await q(sb.from('retainers').select('*').eq('id', el.dataset.ret).maybeSingle());
      retainerForm(r, null, reload);
    }));
  }

  // ============================================================ κερδοφορία
  async function viewProfit() {
    const p = state.profPeriod ??= period();
    const from = p + '-01', to = nextPeriod(p) + '-01';
    const main = shell('profit', '<div class="empty">Φόρτωση…</div>');
    const [clients, rets, entries, rates, profiles, offers, items] = await Promise.all([
      q(sb.from('clients').select('id,name').order('name')),
      q(sb.from('retainers').select('*')),
      q(sb.from('time_entries').select('*').gte('work_date', from).lt('work_date', to)),
      q(sb.from('member_rates').select('*')),
      q(sb.from('profiles').select('id,full_name').order('full_name')),
      q(sb.from('offers').select('id,client_id,status,issue_date,discount_pct').eq('status', 'accepted')),
      q(sb.from('offer_items').select('offer_id,qty,unit_price,unit')),
    ]);
    const rate = Object.fromEntries(rates.map((r) => [r.user_id, Number(r.hourly_cost || 0)]));
    const pname = Object.fromEntries(profiles.map((x) => [x.id, x.full_name]));
    const missingRates = profiles.filter((x) => !rate[x.id] && entries.some((e) => e.user_id === x.id && e.minutes));
    const rows = {};
    const row = (cid) => (rows[cid] ??= { cid, retainer: 0, projects: 0, minutes: 0, billable: 0, cost: 0 });
    rets.filter((r) => activeIn(r, p)).forEach((r) => (row(r.client_id).retainer += Number(r.monthly_fee || 0)));
    offers.filter((o) => o.client_id && o.issue_date >= from && o.issue_date < to).forEach((o) => {
      const its = items.filter((i) => i.offer_id === o.id);
      if (its.some((i) => /μήν|month/i.test(i.unit || ''))) return; // μηνιαίες = retainer
      const net = its.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0), 0) * (1 - Number(o.discount_pct || 0) / 100);
      row(o.client_id).projects += net;
    });
    entries.filter((e) => e.minutes).forEach((e) => {
      const r = row(e.client_id || '_');
      r.minutes += e.minutes; if (e.billable) r.billable += e.minutes;
      r.cost += hrsNum(e.minutes) * (rate[e.user_id] || 0);
    });
    const cname = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    const list = Object.values(rows).map((r) => ({ ...r, revenue: r.retainer + r.projects, margin: r.retainer + r.projects - r.cost })).sort((a, b) => b.revenue - a.revenue);
    const T = list.reduce((s, r) => ({ revenue: s.revenue + r.revenue, cost: s.cost + r.cost, minutes: s.minutes + r.minutes, billable: s.billable + r.billable }), { revenue: 0, cost: 0, minutes: 0, billable: 0 });
    const perUser = {}; entries.filter((e) => e.minutes).forEach((e) => (perUser[e.user_id] = (perUser[e.user_id] || 0) + e.minutes));
    const eph = (r) => r.minutes ? r.revenue / hrsNum(r.minutes) : null;
    const marginPct = (r) => r.revenue ? Math.round(r.margin / r.revenue * 100) : null;
    main.innerHTML = `
      <div class="head"><div><h1>Κερδοφορία</h1><div class="sub" style="text-transform:capitalize">${monthLabel(p)}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="prev">‹</button><button class="btn" id="now">Τρέχων μήνας</button><button class="btn" id="next">›</button></div></div>
      ${missingRates.length ? `<div class="notice">Λείπει κόστος/ώρα για: ${missingRates.map((x) => esc(x.full_name)).join(', ')}. Συμπλήρωσέ το στην <a href="#/team">Ομάδα</a> για σωστό περιθώριο.</div>` : ''}
      <div class="grid kpi" style="margin-bottom:16px">
        <div class="card"><div class="num">${money(T.revenue)}</div><div class="lbl">Έσοδα μήνα</div></div>
        <div class="card"><div class="num">${money(T.cost)}</div><div class="lbl">Κόστος χρόνου</div></div>
        <div class="card"><div class="num ${T.revenue - T.cost < 0 ? 'late' : ''}">${money(T.revenue - T.cost)}</div><div class="lbl">Περιθώριο ${T.revenue ? Math.round((T.revenue - T.cost) / T.revenue * 100) + '%' : ''}</div></div>
        <div class="card"><div class="num">${T.minutes ? money(T.revenue / hrsNum(T.minutes)) : '—'}</div><div class="lbl">Πραγματικά € / ώρα</div></div>
      </div>
      <div class="card table-wrap" style="padding:0;margin-bottom:16px"><table>
        <thead><tr><th>Πελάτης</th><th style="text-align:right">Έσοδα</th><th style="text-align:right" class="hide-sm">Ώρες</th><th style="text-align:right" class="hide-sm">Κόστος</th><th style="text-align:right">Περιθώριο</th><th style="text-align:right">€/ώρα</th></tr></thead>
        <tbody>${list.map((r) => `<tr style="cursor:default"><td><b>${esc(r.cid === '_' ? 'Εσωτερικό / χωρίς πελάτη' : cname[r.cid] || '—')}</b>
            <div class="task-meta">${[r.retainer ? 'retainer ' + money(r.retainer) : '', r.projects ? 'έργα ' + money(r.projects) : ''].filter(Boolean).join(' · ') || '—'}</div></td>
          <td style="text-align:right;white-space:nowrap">${money(r.revenue)}</td>
          <td style="text-align:right" class="hide-sm">${hrs(r.minutes)}</td>
          <td style="text-align:right;white-space:nowrap" class="hide-sm">${money(r.cost)}</td>
          <td style="text-align:right;white-space:nowrap"><b class="${r.margin < 0 ? 'late' : ''}">${money(r.margin)}</b>${marginPct(r) != null ? `<div class="task-meta">${marginPct(r)}%</div>` : ''}</td>
          <td style="text-align:right;white-space:nowrap">${eph(r) != null ? money(eph(r)) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Δεν υπάρχουν έσοδα ή χρόνος αυτόν τον μήνα.</td></tr>'}</tbody>
      </table></div>
      <div class="grid two">
        <div class="card"><h2>Χρόνος ομάδας</h2>
          ${Object.entries(perUser).sort((a, b) => b[1] - a[1]).map(([u, mm]) => `<div class="bar-row"><div class="bar-lbl"><span>${esc(pname[u] || '—')}</span><b>${hrs(mm)}${rate[u] ? ` · ${money(hrsNum(mm) * rate[u])}` : ''}</b></div><div class="progress"><span style="width:${Math.round(mm / Math.max(...Object.values(perUser)) * 100)}%"></span></div></div>`).join('') || '<div class="empty" style="padding:16px">Καμία καταχώριση χρόνου.</div>'}
        </div>
        <div class="card"><h2>Πώς υπολογίζεται</h2><p class="muted" style="margin:0;font-size:14px;line-height:1.6">
          <b>Έσοδα</b> = ενεργά retainers του μήνα + εγκεκριμένες προσφορές με ημερομηνία έκδοσης μέσα στον μήνα (εκτός όσων έχουν μηνιαίες γραμμές, που μετράνε ως retainer).<br>
          <b>Κόστος</b> = ώρες × κόστος/ώρα κάθε μέλους, από την Ομάδα.<br>
          <b>€/ώρα</b> = έσοδα ÷ ώρες που δουλέψατε για τον πελάτη. Αν πέφτει κάτω από αυτό που χρεώνεις, το retainer θέλει αναπροσαρμογή.</p></div>
      </div>`;
    const go = (n) => { state.profPeriod = n === 0 ? period() : shiftPeriod(p, n); viewProfit(); };
    main.querySelector('#prev').onclick = () => go(-1);
    main.querySelector('#next').onclick = () => go(1);
    main.querySelector('#now').onclick = () => go(0);
  }

  // ============================================================ templates & επαναλαμβανόμενα
  async function viewTemplates() {
    const main = shell('templates', '<div class="empty">Φόρτωση…</div>');
    const [tpls, items, recs, L] = await Promise.all([
      q(sb.from('task_templates').select('*').order('name')),
      q(sb.from('task_template_items').select('*').order('position')),
      q(sb.from('recurring_tasks').select('*').order('next_date')),
      lookups(),
    ]);
    main.innerHTML = `
      <div class="head"><div><h1>Templates & αυτοματισμοί</h1><div class="sub">Έτοιμα πακέτα tasks για καμπάνιες και tasks που ανοίγουν μόνα τους</div></div></div>
      <div class="grid two">
        <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Templates</h2><button class="btn sm" id="new-tpl">+ Template</button></div>
          <p class="sub" style="margin-top:0">Τα εφαρμόζεις από τη σελίδα μιας καμπάνιας με το «+ Από template».</p>
          ${tpls.map((t) => { const its = items.filter((i) => i.template_id === t.id); return `<div class="list-row" data-tpl="${t.id}" style="cursor:pointer"><span><b>${esc(t.name)}</b><br><small class="muted">${its.length} tasks · ${its.length ? 'διάρκεια ' + (Math.max(...its.map((i) => i.offset_days)) + 1) + ' ημέρες' : ''}</small></span><span class="muted">›</span></div>`; }).join('') || '<div class="empty" style="padding:16px">Κανένα template.</div>'}
        </div>
        <div class="card"><div class="head" style="margin-bottom:6px"><h2 style="margin:0">Επαναλαμβανόμενα tasks</h2><button class="btn sm" id="new-rec">+ Επαναλαμβανόμενο</button></div>
          <p class="sub" style="margin-top:0">Ανοίγουν αυτόματα λίγες μέρες πριν από την παράδοση, π.χ. το μηνιαίο report κάθε πελάτη.</p>
          ${recs.map((r) => `<div class="list-row" data-rec="${r.id}" style="cursor:pointer;${r.active ? '' : 'opacity:.5'}"><span><b>${esc(r.title)}</b><br><small class="muted">${esc(L.cname[r.client_id] || 'Εσωτερικό')} · ${FREQ[r.frequency]}${r.assignee_id ? ' · ' + esc(L.pname[r.assignee_id] || '') : ''}</small></span><span style="text-align:right;white-space:nowrap"><small class="muted">επόμενο</small><br>${date(r.next_date)}</span></div>`).join('') || '<div class="empty" style="padding:16px">Κανένα επαναλαμβανόμενο task.</div>'}
        </div>
      </div>`;
    main.querySelector('#new-tpl').onclick = () => templateForm({}, [], L);
    main.querySelectorAll('[data-tpl]').forEach((el) => (el.onclick = () => templateForm(tpls.find((t) => t.id === el.dataset.tpl), items.filter((i) => i.template_id === el.dataset.tpl), L)));
    main.querySelector('#new-rec').onclick = () => recurringForm({}, L);
    main.querySelectorAll('[data-rec]').forEach((el) => (el.onclick = () => recurringForm(recs.find((r) => r.id === el.dataset.rec), L)));
  }

  function templateForm(t = {}, items = [], L) {
    let rows = items.map((i) => ({ ...i }));
    openModal(`
      <h2>${t.id ? 'Template' : 'Νέο template'}</h2>
      <form class="form" id="f">
        <label>Όνομα *<input name="name" required value="${esc(t.name)}" placeholder="π.χ. Λανσάρισμα προϊόντος"></label>
        <label>Περιγραφή<input name="description" value="${esc(t.description)}"></label>
        <div><div class="lbl-sm">Tasks · «Ημέρα» = πόσες μέρες μετά την έναρξη παραδίδεται</div><div id="rows"></div>
          <button type="button" class="btn sm" id="add-row">+ Task</button></div>
        <div class="modal-actions">${t.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const box = m.querySelector('#rows');
      const read = () => box.querySelectorAll('.tpl-row').forEach((el, i) => {
        rows[i].title = el.querySelector('[data-k=title]').value;
        rows[i].offset_days = Number(el.querySelector('[data-k=offset_days]').value || 0);
        rows[i].assignee_id = el.querySelector('[data-k=assignee_id]').value || null;
        rows[i].priority = el.querySelector('[data-k=priority]').value;
      });
      const draw = () => {
        box.innerHTML = rows.map((r, i) => `<div class="tpl-row">
          <input data-k="title" value="${esc(r.title)}" placeholder="Task">
          <input data-k="offset_days" type="number" min="0" value="${esc(r.offset_days ?? 0)}" title="Ημέρα" aria-label="Ημέρα">
          <select data-k="assignee_id"><option value="">Ανάθεση…</option>${options(L.profiles.map((p) => [p.id, p.full_name]), r.assignee_id)}</select>
          <select data-k="priority">${options(Object.entries(PRIORITY), r.priority || 'normal')}</select>
          <button type="button" class="icon-btn sm" data-rm="${i}" aria-label="Αφαίρεση">✕</button></div>`).join('') || '<div class="muted" style="font-size:14px;margin:6px 0">Πρόσθεσε το πρώτο task.</div>';
        box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { read(); rows.splice(Number(b.dataset.rm), 1); draw(); }));
      };
      draw();
      m.querySelector('#add-row').onclick = () => { read(); rows.push({ title: '', offset_days: rows.length ? rows[rows.length - 1].offset_days : 0, priority: 'normal' }); draw(); box.querySelector('.tpl-row:last-child input')?.focus(); };
      m.querySelector('#f').onsubmit = async (e) => {
        e.preventDefault(); read();
        const x = formData(e.target);
        let id = t.id;
        if (id) { await q(sb.from('task_templates').update(x).eq('id', id)); await q(sb.from('task_template_items').delete().eq('template_id', id)); }
        else id = (await q(sb.from('task_templates').insert(x).select().single())).id;
        const ins = rows.filter((r) => (r.title || '').trim()).map((r, i) => ({ template_id: id, position: i, title: r.title.trim(), offset_days: r.offset_days || 0, assignee_id: r.assignee_id || null, priority: r.priority || 'normal' }));
        if (ins.length) await q(sb.from('task_template_items').insert(ins));
        closeModal(); toast('Το template αποθηκεύτηκε'); viewTemplates();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή template; Τα tasks που έχουν ήδη δημιουργηθεί μένουν.')) return;
        await q(sb.from('task_templates').delete().eq('id', t.id)); closeModal(); viewTemplates();
      });
    });
  }

  function recurringForm(r = {}, L, prefill = {}) {
    const v = { frequency: 'monthly', lead_days: 3, priority: 'normal', active: true, next_date: addDays(today(), 7), ...prefill, ...r };
    openModal(`
      <h2>${r.id ? 'Επαναλαμβανόμενο task' : 'Νέο επαναλαμβανόμενο task'}</h2>
      <form class="form" id="f">
        <label>Τίτλος *<input name="title" required value="${esc(v.title)}" placeholder="π.χ. Μηνιαίο report"></label>
        <div class="row2"><label>Πελάτης<select name="client_id"><option value="">— Εσωτερικό —</option>${options(L.clients.map((c) => [c.id, c.name]), v.client_id)}</select></label>
          <label>Ανάθεση σε<select name="assignee_id"><option value="">—</option>${options(L.profiles.map((p) => [p.id, p.full_name]), v.assignee_id)}</select></label></div>
        <div class="row3"><label>Συχνότητα<select name="frequency">${options(Object.entries(FREQ), v.frequency)}</select></label>
          <label>Επόμενη παράδοση<input type="date" name="next_date" required value="${esc(v.next_date)}"></label>
          <label>Ανοίγει … μέρες πριν<input type="number" min="0" max="27" name="lead_days" value="${esc(v.lead_days)}"></label></div>
        <div class="row2"><label>Προτεραιότητα<select name="priority">${options(Object.entries(PRIORITY), v.priority)}</select></label>
          <label class="inline" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Ενεργό</label></div>
        <label>Περιγραφή<textarea name="description" rows="3">${esc(v.description)}</textarea></label>
        <div class="modal-actions">${r.id ? '<button type="button" class="btn danger" id="del">Διαγραφή</button>' : ''}
          <div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Αποθήκευση</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const x = formData(f);
        const data = { ...x, active: f.active.checked, lead_days: Number(x.lead_days || 0) };
        if (r.id) await q(sb.from('recurring_tasks').update(data).eq('id', r.id));
        else await q(sb.from('recurring_tasks').insert(data));
        closeModal();
        const n = await generateRecurring(true);
        toast(n ? `Αποθηκεύτηκε · άνοιξαν ${n} tasks` : 'Αποθηκεύτηκε');
        if (location.hash.startsWith('#/templates')) viewTemplates();
      };
      m.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Διαγραφή; Τα tasks που έχουν ήδη ανοίξει μένουν.')) return;
        await q(sb.from('recurring_tasks').delete().eq('id', r.id)); closeModal(); viewTemplates();
      });
    });
  }

  async function generateRecurring(silent) {
    if (!isAdmin()) return 0;
    const { data, error } = await sb.rpc('generate_recurring_tasks');
    if (error) { console.warn(error); return 0; }
    if (data && !silent) toast(`Άνοιξαν ${data} επαναλαμβανόμενα tasks`);
    return data || 0;
  }

  async function applyTemplate(campaign, onDone) {
    const [tpls, items, L] = await Promise.all([
      q(sb.from('task_templates').select('*').order('name')),
      q(sb.from('task_template_items').select('*').order('position')),
      lookups(),
    ]);
    if (!tpls.length) { toast('Φτιάξε πρώτα ένα template'); location.hash = '#/templates'; return; }
    openModal(`
      <h2>Tasks από template</h2>
      <form class="form" id="f">
        <label>Template<select name="tpl">${options(tpls.map((t) => [t.id, t.name]))}</select></label>
        <label>Ημερομηνία έναρξης<input type="date" name="start" required value="${esc(campaign.start_date && campaign.start_date > today() ? campaign.start_date : today())}"></label>
        <div id="pv" class="tpl-preview"></div>
        <div class="modal-actions"><div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Δημιουργία tasks</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      const pv = () => {
        const its = items.filter((i) => i.template_id === f.tpl.value);
        m.querySelector('#pv').innerHTML = its.map((i) => `<div class="list-row"><span>${esc(i.title)}${i.assignee_id ? ` <small class="muted">· ${esc(L.pname[i.assignee_id] || '')}</small>` : ''}</span><small class="muted">${date(addDays(f.start.value, i.offset_days))}</small></div>`).join('') || '<div class="muted">Το template δεν έχει tasks.</div>';
      };
      f.tpl.onchange = pv; f.start.oninput = pv; pv();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const its = items.filter((i) => i.template_id === f.tpl.value);
        if (!its.length) return;
        await q(sb.from('tasks').insert(its.map((i) => ({ client_id: campaign.client_id, campaign_id: campaign.id, title: i.title, description: i.description, assignee_id: i.assignee_id, priority: i.priority, due_date: addDays(f.start.value, i.offset_days), status: 'todo' }))));
        closeModal(); toast(`Δημιουργήθηκαν ${its.length} tasks`); onDone?.();
      };
    });
  }

  // ============================================================ υπενθυμίσεις
  async function attentionCard() {
    const now = Date.now(), t = today(), p = period(), day = new Date().getDate();
    const items = [];
    const tasks = await q(sb.from('tasks').select('id,title,due_date,status,assignee_id,client_id'));
    const mine = (x) => isAdmin() || x.assignee_id === state.user.id;
    const late = tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date < t && mine(x));
    if (late.length) items.push({ icon: '⏰', text: late.length === 1 ? '1 εκπρόθεσμο task' : `${late.length} εκπρόθεσμα tasks`, sub: late.slice(0, 3).map((x) => x.title).join(' · '), href: '#/tasks' });
    if (isAdmin()) {
      const [offers, leads, rets, bills] = await Promise.all([
        q(sb.from('offers').select('id,number,title,status,sent_at,created_at').eq('status', 'sent')),
        q(sb.from('leads').select('id,title,company,stage,updated_at,created_at')),
        q(sb.from('retainers').select('*')),
        q(sb.from('retainer_billings').select('retainer_id').eq('period', p)),
      ]);
      offers.filter((o) => now - new Date(o.sent_at || o.created_at).getTime() > 5 * 864e5).forEach((o) => {
        const d = Math.floor((now - new Date(o.sent_at || o.created_at).getTime()) / 864e5);
        items.push({ icon: '✉', text: `Follow-up: ${o.title}`, sub: `Η προσφορά ${o.number} στάλθηκε πριν από ${d} ημέρες και δεν έχει απάντηση`, href: `#/offers/${o.id}` });
      });
      leads.filter((l) => !['won', 'lost'].includes(l.stage) && now - new Date(l.updated_at || l.created_at).getTime() > 14 * 864e5).slice(0, 5).forEach((l) => {
        items.push({ icon: '◇', text: `Lead χωρίς κίνηση: ${l.title}`, sub: `${l.company ? l.company + ' · ' : ''}καμία αλλαγή εδώ και 2+ εβδομάδες`, href: '#/leads' });
      });
      const newSite = leads.filter((l) => l.stage === 'new' && now - new Date(l.created_at).getTime() < 3 * 864e5);
      if (newSite.length) items.unshift({ icon: '★', text: newSite.length === 1 ? '1 νέο lead' : `${newSite.length} νέα leads`, sub: newSite.slice(0, 3).map((l) => l.title).join(' · '), href: '#/leads' });
      const billed = new Set(bills.map((b) => b.retainer_id));
      const due = rets.filter((r) => activeIn(r, p) && !billed.has(r.id) && day >= r.billing_day);
      if (due.length) items.push({ icon: '€', text: due.length === 1 ? '1 retainer για τιμολόγηση' : `${due.length} retainers για τιμολόγηση`, sub: `Μήνας ${monthLabel(p)}`, href: '#/retainers' });
    }
    if (!items.length) return '';
    return `<div class="card attention"><h2>Χρειάζονται προσοχή</h2>${items.slice(0, 8).map((i) => `<a class="att-row" href="${i.href}"><span class="att-ico">${i.icon}</span><span><b>${esc(i.text)}</b><small>${esc(i.sub)}</small></span><span class="muted">›</span></a>`).join('')}</div>`;
  }

  // ============================================================ ομάδα: κόστος/ώρα
  async function ratesMap() {
    const rows = await q(sb.from('member_rates').select('*'));
    return Object.fromEntries(rows.map((r) => [r.user_id, r.hourly_cost]));
  }
  async function setRate(userId, value) {
    const v = Number(String(value).replace(',', '.') || 0);
    const ex = await q(sb.from('member_rates').select('user_id').eq('user_id', userId));
    if (ex.length) await q(sb.from('member_rates').update({ hourly_cost: v }).eq('user_id', userId));
    else await q(sb.from('member_rates').insert({ user_id: userId, hourly_cost: v }));
    toast('Το κόστος/ώρα αποθηκεύτηκε');
  }

  // ============================================================ φόρμα site
  function siteFormSnippet() {
    return `<!-- Φόρμα επικοινωνίας Created OS: κάθε αίτημα γίνεται lead -->
<form id="created-lead-form">
  <input name="name" placeholder="Ονοματεπώνυμο" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Τηλέφωνο">
  <input name="company" placeholder="Εταιρεία">
  <select name="service">
    <option value="">Τι σας ενδιαφέρει;</option>
    <option>360° Marketing</option><option>Strategic Communication</option>
    <option>Media Production</option><option>Brand Strategy</option>
    <option>Creative Direction</option><option>Public Relations</option>
  </select>
  <textarea name="message" placeholder="Πείτε μας για το project σας"></textarea>
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <button type="submit">Αποστολή</button>
  <p id="created-lead-msg" role="status"></p>
</form>
<script>
document.getElementById('created-lead-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var f = e.target, msg = document.getElementById('created-lead-msg');
  if (f.website.value) return; // spam
  f.querySelector('button').disabled = true;
  try {
    var r = await fetch('${SUPABASE_URL}/rest/v1/rpc/submit_lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: '${SUPABASE_ANON_KEY}', Authorization: 'Bearer ${SUPABASE_ANON_KEY}' },
      body: JSON.stringify({ p_name: f.name.value, p_email: f.email.value, p_phone: f.phone.value, p_company: f.company.value, p_service: f.service.value, p_message: f.message.value })
    });
    var ok = r.ok && (await r.json()) === true;
    msg.textContent = ok ? 'Ευχαριστούμε! Θα επικοινωνήσουμε σύντομα μαζί σας.' : 'Κάτι πήγε στραβά. Ελέγξτε το email σας και δοκιμάστε ξανά.';
    if (ok) f.reset();
  } catch (err) { msg.textContent = 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.'; }
  f.querySelector('button').disabled = false;
});
</script>`;
  }
  function siteFormCard() {
    return `<div class="card"><h2>Φόρμα επικοινωνίας για το site</h2>
      <p class="sub" style="margin-top:-6px">Βάλε αυτόν τον κώδικα στη σελίδα επικοινωνίας του createdstudio.gr (σε WordPress: μπλοκ «Προσαρμοσμένο HTML»). Κάθε αίτημα μπαίνει αυτόματα στα <a href="#/leads">Leads</a> με πηγή «Website».</p>
      <textarea readonly rows="7" id="snippet" style="font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(siteFormSnippet())}</textarea>
      <div style="margin-top:8px"><button class="btn" id="copy-snippet">Αντιγραφή κώδικα</button></div></div>`;
  }
  function bindSiteForm(root) {
    root.querySelector('#copy-snippet')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(siteFormSnippet()); toast('Ο κώδικας αντιγράφηκε'); }
      catch { const t = root.querySelector('#snippet'); t.select(); document.execCommand('copy'); toast('Ο κώδικας αντιγράφηκε'); }
    });
  }

  return {
    mountTimer, startTimer, stopTimer, loadRunning, viewTime, viewRetainers, viewProfit, viewTemplates,
    applyTemplate, recurringForm, generateRecurring, attentionCard, clientRetainersCard, bindClientRetainers,
    ratesMap, setRate, siteFormCard, bindSiteForm, entryForm,
  };
}
