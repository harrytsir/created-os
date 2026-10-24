// Created OS — Φάση 4: Παρουσιάσεις (επεξεργασία & λήψη PPTX)
import { buildDeck, credentialsSections, offerSections, SECTION_TYPES, DEFAULT_TEXTS } from './deckgen.js';

const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
const KIND = { offer: 'Πρόταση', credentials: 'Εταιρική παρουσίαση', custom: 'Ελεύθερη' };

// Πεδία που εμφανίζονται για κάθε ενότητα
const FIELDS = {
  cover:    [['subtitle', 'Υπότιτλος', 'input'], ['client', 'Όνομα πελάτη', 'input']],
  intro:    [['text', 'Κείμενο', 'area']],
  about:    [['title', 'Τίτλος', 'input'], ['text', 'Κείμενο', 'area'], ['diff_title', 'Υπότιτλος', 'input'], ['diff', 'Κείμενο υπότιτλου', 'area']],
  problems: [['title', 'Τίτλος', 'input'], ['subtitle', 'Υπότιτλος', 'input'], ['items', 'Έως 3 σημεία', 'pairs']],
  whatwedo: [['title', 'Τίτλος', 'input'], ['items', 'Υπηρεσίες', 'pairs']],
  goals:    [['title', 'Τίτλος', 'input'], ['items', 'Στόχοι (έως 5, ένας ανά γραμμή)', 'lines']],
  services: [['title', 'Τίτλος', 'input'], ['subtitle', 'Υπότιτλος', 'input'], ['items', 'Κάρτες', 'pairs']],
  timeline: [['title', 'Τίτλος', 'input'], ['subtitle', 'Υπότιτλος', 'input'], ['items', 'Ορόσημα (έως 8)', 'pairs']],
  prereq:   [['title', 'Τίτλος', 'input'], ['items', 'Προϋποθέσεις (έως 6)', 'pairs']],
  pricing:  [['title', 'Τίτλος', 'input'], ['items', 'Γραμμές τιμών', 'prices'], ['total_label', 'Ετικέτα συνόλου', 'input'], ['total', 'Σύνολο', 'input'], ['extra_title', 'Τίτλος «Επιπλέον»', 'input'], ['extra', 'Κείμενο «Επιπλέον» (δεξιά)', 'area'], ['note', 'Υποσημείωση', 'input']],
  steps:    [['title', 'Τίτλος', 'input'], ['items', 'Βήματα (έως 6, ένα ανά γραμμή)', 'lines']],
  closing:  [],
};
const HINT = {
  pairs: 'Μία ανά γραμμή: Τίτλος | Περιγραφή',
  prices: 'Μία ανά γραμμή: Υπηρεσία | Τιμή | Μονάδα, π.χ. Google Ads | 800€ | / μηνιαίως',
  lines: '',
};

const toText = (kind, v) => {
  const arr = Array.isArray(v) ? v : [];
  if (kind === 'lines') return arr.join('\n');
  if (kind === 'pairs') return arr.map((i) => (i.d ? `${i.t} | ${i.d}` : i.t)).join('\n');
  if (kind === 'prices') return arr.map((i) => [i.t, i.price, i.unit].filter((x) => x != null && x !== '').join(' | ')).join('\n');
  return v ?? '';
};
const fromText = (kind, txt) => {
  const lines = String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (kind === 'lines') return lines;
  if (kind === 'pairs') return lines.map((l) => { const [t, ...r] = l.split('|'); return { t: t.trim(), d: r.join('|').trim() }; });
  if (kind === 'prices') return lines.map((l) => { const [t, price = '', unit = ''] = l.split('|').map((x) => x.trim()); return { t, price, unit }; });
  return txt;
};

export function createDecks(ctx) {
  const { sb, esc, q, toast, shell, openModal, closeModal, options, formData, date, getSettings } = ctx;

  // ---------- βοηθητικά ----------
  let pptxLoading;
  const loadPptx = () => window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : (pptxLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = PPTX_CDN;
    s.onload = () => res(window.PptxGenJS); s.onerror = () => { pptxLoading = null; rej(new Error('Δεν φόρτωσε η βιβλιοθήκη PowerPoint')); };
    document.head.appendChild(s);
  }));
  const assetCache = {};
  const asset = async (path) => assetCache[path] ??= await fetch(path).then((r) => r.blob()).then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }));
  const pptxData = (dataUrl) => dataUrl ? dataUrl.replace(/^data:/, '') : null;
  async function brand() {
    const s = await getSettings();
    return {
      name: s.name, legal_name: s.legal_name, font: s.deck_font || 'Gotham Greek', accent: s.accent || '#FCB040',
      phone: s.phone, website: s.website, email: s.email,
      facebook: s.facebook ?? '', instagram: s.instagram ?? '', linkedin: s.linkedin ?? '',
      logoDark: pptxData(s.logo || await asset('assets/logo-black.png')),
      logoLight: pptxData(s.logo_light || await asset('assets/logo-white.png')),
      iconTarget: pptxData(await asset('assets/icon-target.png')),
    };
  }
  const fileName = (t) => (t || 'Created').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'Created';

  async function download(deck) {
    try {
      toast('Φτιάχνω το PowerPoint…');
      const [PptxGenJS, b] = await Promise.all([loadPptx(), brand()]);
      const pres = buildDeck(PptxGenJS, deck, b);
      const blob = await pres.write({ outputType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName(deck.title) + '.pptx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Το αρχείο κατέβηκε');
    } catch (e) { console.error(e); toast('Σφάλμα: ' + e.message); }
  }

  // ---------- δημιουργία ----------
  async function sectionsForOffer(offerId) {
    const o = await q(sb.from('offers').select('*').eq('id', offerId).maybeSingle());
    const items = await q(sb.from('offer_items').select('*').eq('offer_id', offerId).order('position'));
    const client = o.client_id ? await q(sb.from('clients').select('id,name').eq('id', o.client_id).maybeSingle()) : null;
    let campaign = null;
    if (o.client_id) {
      const ks = await q(sb.from('campaigns').select('objective,status').eq('client_id', o.client_id));
      campaign = ks.find((k) => k.status === 'active' || k.status === 'planning') || null;
    }
    const clientName = client?.name || o.recipient || '';
    const sections = offerSections(o, items, { clientName, campaign });
    sections[0].client = clientName;
    return { o, clientName, sections };
  }

  async function createFromOffer(offerId) {
    const { o, clientName, sections } = await sectionsForOffer(offerId);
    const d = await q(sb.from('decks').insert({
      kind: 'offer', title: o.title, kicker: `Πρόταση: ${o.title}${clientName ? ' — ' + clientName : ''}`,
      client_id: o.client_id, offer_id: o.id, sections,
    }).select().single());
    location.hash = `#/decks/${d.id}`;
  }

  async function newDeckModal(prefill = {}) {
    const offers = await q(sb.from('offers').select('id,number,title').order('created_at', { ascending: false }));
    openModal(`
      <h2>Νέα παρουσίαση</h2>
      <form class="form" id="f">
        <label>Τύπος<select name="kind">${options([['offer', 'Πρόταση από προσφορά'], ['credentials', 'Εταιρική παρουσίαση (credentials)'], ['custom', 'Κενή, τη στήνω μόνος μου']], prefill.kind || (offers.length ? 'offer' : 'credentials'))}</select></label>
        <label id="offer-row">Προσφορά<select name="offer_id">${offers.length ? options(offers.map((o) => [o.id, `${o.number} · ${o.title}`]), prefill.offer_id) : '<option value="">Δεν υπάρχουν προσφορές ακόμα</option>'}</select></label>
        <label id="title-row">Τίτλος<input name="title" placeholder="π.χ. Εταιρική παρουσίαση 2026"></label>
        <div class="modal-actions"><div class="right"><button type="button" class="btn" data-close>Άκυρο</button><button class="btn primary">Δημιουργία</button></div></div>
      </form>`, (m) => {
      const f = m.querySelector('#f');
      const sync = () => { const off = f.kind.value === 'offer'; m.querySelector('#offer-row').hidden = !off; m.querySelector('#title-row').hidden = off; };
      f.kind.onchange = sync; sync();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const x = formData(f);
        if (x.kind === 'offer') {
          if (!x.offer_id) { toast('Φτιάξε πρώτα μια προσφορά'); return; }
          closeModal(); return createFromOffer(x.offer_id);
        }
        const title = x.title || (x.kind === 'credentials' ? 'Εταιρική παρουσίαση' : 'Νέα παρουσίαση');
        const sections = x.kind === 'credentials' ? credentialsSections() : [{ type: 'cover', on: true }, { type: 'closing', on: true }];
        const d = await q(sb.from('decks').insert({ kind: x.kind, title, kicker: title, sections }).select().single());
        closeModal(); location.hash = `#/decks/${d.id}`;
      };
    });
  }

  // ---------- λίστα ----------
  async function viewDecks() {
    const main = shell('decks', '<div class="empty">Φόρτωση…</div>');
    const [decks, clients] = await Promise.all([
      q(sb.from('decks').select('*').order('updated_at', { ascending: false })),
      q(sb.from('clients').select('id,name')),
    ]);
    const cname = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    main.innerHTML = `
      <div class="head"><div><h1>Παρουσιάσεις</h1><div class="sub">Στο στυλ του Created. Τις κατεβάζεις σε PowerPoint, έτοιμες για αποστολή ή για αλλαγές.</div></div>
        <button class="btn primary" id="new">+ Νέα παρουσίαση</button></div>
      <div class="card table-wrap" style="padding:0"><table>
        <thead><tr><th>Τίτλος</th><th>Τύπος</th><th class="hide-sm">Πελάτης</th><th class="hide-sm">Ενημέρωση</th><th></th></tr></thead>
        <tbody>${decks.map((d) => `<tr data-id="${d.id}"><td><b>${esc(d.title)}</b></td><td><span class="pill">${KIND[d.kind]}</span></td>
          <td class="hide-sm">${esc(cname[d.client_id] || '—')}</td><td class="hide-sm">${date(d.updated_at)}</td>
          <td style="text-align:right"><button class="btn sm" data-dl="${d.id}">↓ PPTX</button></td></tr>`).join('')
          || '<tr><td colspan="5" class="empty">Φτιάξε την πρώτη σου παρουσίαση, από μια προσφορά ή την εταιρική.</td></tr>'}</tbody>
      </table></div>`;
    main.querySelector('#new').onclick = () => newDeckModal();
    main.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = (e) => { if (e.target.closest('[data-dl]')) return; location.hash = `#/decks/${tr.dataset.id}`; }));
    main.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); download(decks.find((d) => d.id === b.dataset.dl)); }));
  }

  // ---------- επεξεργασία ----------
  async function viewDeck(id) {
    const main = shell('decks', '<div class="empty">Φόρτωση…</div>');
    const d = await q(sb.from('decks').select('*').eq('id', id).maybeSingle());
    if (!d) { main.innerHTML = '<div class="empty">Η παρουσίαση δεν βρέθηκε.</div>'; return; }
    const clients = await q(sb.from('clients').select('id,name').order('name'));
    let sections = structuredClone(d.sections || []);

    main.innerHTML = `
      <div class="head"><div><a href="#/decks" class="muted" style="font-size:14px;text-decoration:none">← Παρουσιάσεις</a>
        <h1>${esc(d.title)}</h1><div class="sub">${KIND[d.kind]}${d.offer_id ? ` · <a href="#/offers/${d.offer_id}">από προσφορά</a>` : ''}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${d.offer_id ? '<button class="btn" id="refresh" title="Ξαναπαίρνει υπηρεσίες και τιμές από την προσφορά">↻ Από προσφορά</button>' : ''}
          <button class="btn" id="save">Αποθήκευση</button><button class="btn primary" id="dl">↓ Λήψη PPTX</button></div></div>
      <div class="grid two deck-grid">
        <div class="grid" style="align-content:start" id="secs"></div>
        <div class="grid" style="align-content:start">
          <div class="card form" id="meta">
            <label>Τίτλος<input name="title" value="${esc(d.title)}"></label>
            <label>Κείμενο πάνω αριστερά σε κάθε slide<input name="kicker" value="${esc(d.kicker)}"></label>
            <label>Πελάτης<select name="client_id"><option value="">—</option>${options(clients.map((c) => [c.id, c.name]), d.client_id)}</select></label>
          </div>
          <div class="card"><h2>Ενότητες</h2>
            <p class="sub" style="margin-top:-6px">Κάθε ενότητα γίνεται ένα slide (ή περισσότερα, αν έχει πολλά στοιχεία). Με το κουτάκι την κρύβεις.</p>
            <div style="display:flex;gap:8px"><select id="add-type" style="flex:1">${options(Object.entries(SECTION_TYPES))}</select><button class="btn" id="add">+ Ενότητα</button></div>
          </div>
          <button class="btn danger" id="del" style="justify-self:start">Διαγραφή παρουσίασης</button>
        </div>
      </div>`;

    const secsEl = main.querySelector('#secs');
    const readForm = () => {
      secsEl.querySelectorAll('.sec').forEach((el) => {
        const sec = sections[Number(el.dataset.i)];
        sec.on = el.querySelector('[data-on]').checked;
        el.querySelectorAll('[data-f]').forEach((inp) => { sec[inp.dataset.f] = fromText(inp.dataset.kind, inp.value); });
      });
    };
    const draw = () => {
      secsEl.innerHTML = sections.map((sec, i) => `
        <div class="card sec ${sec.on ? '' : 'off'}" data-i="${i}">
          <div class="sec-head">
            <label class="inline"><input type="checkbox" data-on ${sec.on ? 'checked' : ''}> <b>${i + 1}. ${esc(SECTION_TYPES[sec.type] || sec.type)}</b></label>
            <div><button type="button" class="icon-btn sm" data-up title="Πάνω">↑</button><button type="button" class="icon-btn sm" data-down title="Κάτω">↓</button><button type="button" class="icon-btn sm" data-rm title="Αφαίρεση">✕</button></div>
          </div>
          <div class="form sec-body">${(FIELDS[sec.type] || []).map(([k, label, kind]) => kind === 'input'
            ? `<label>${label}<input data-f="${k}" data-kind="input" value="${esc(sec[k])}"></label>`
            : `<label>${label}${HINT[kind] ? ` <small>${HINT[kind]}</small>` : ''}<textarea data-f="${k}" data-kind="${kind === 'area' ? 'input' : kind}" rows="${kind === 'area' ? 4 : Math.min(9, Math.max(3, (Array.isArray(sec[k]) ? sec[k].length : 0) + 1))}">${esc(toText(kind, sec[k]))}</textarea></label>`).join('')
            || '<div class="muted" style="font-size:14px">Χωρίς πεδία· παίρνει logo και social από τις Ρυθμίσεις.</div>'}</div>
        </div>`).join('') || '<div class="empty card">Πρόσθεσε ενότητες από δεξιά.</div>';
      secsEl.querySelectorAll('.sec').forEach((el) => {
        const i = Number(el.dataset.i);
        el.querySelector('[data-on]').onchange = (e) => el.classList.toggle('off', !e.target.checked);
        el.querySelector('[data-up]').onclick = () => { readForm(); if (i > 0) { [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]]; draw(); } };
        el.querySelector('[data-down]').onclick = () => { readForm(); if (i < sections.length - 1) { [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]]; draw(); } };
        el.querySelector('[data-rm]').onclick = () => { readForm(); sections.splice(i, 1); draw(); };
      });
    };
    draw();

    const current = () => {
      readForm();
      const m = formData(wrapForm(main.querySelector('#meta')));
      return { ...d, ...m, sections };
    };
    const save = async (silent) => {
      const x = current();
      await q(sb.from('decks').update({ title: x.title || 'Παρουσίαση', kicker: x.kicker, client_id: x.client_id, sections: x.sections, updated_at: new Date().toISOString() }).eq('id', id));
      if (!silent) toast('Αποθηκεύτηκε');
      return x;
    };
    main.querySelector('#save').onclick = async () => { await save(); viewDeck(id); };
    main.querySelector('#dl').onclick = async () => download(await save(true));
    main.querySelector('#add').onclick = () => {
      readForm();
      const type = main.querySelector('#add-type').value;
      const D = DEFAULT_TEXTS;
      const seed = {
        about: { title: 'Ποιοι είμαστε', text: D.about, diff_title: D.diff_title, diff: D.diff },
        problems: { title: D.problems_title, subtitle: D.problems_sub, items: D.problems },
        whatwedo: { title: 'Τι κάνουμε', items: D.whatwedo },
        goals: { title: 'Στόχοι που θέτουμε', items: D.goals },
        services: { title: 'Υπηρεσίες', items: [] },
        timeline: { title: 'Χρονοδιάγραμμα', items: [{ t: '1ος Μήνας', d: '' }, { t: '2ος Μήνας', d: '' }, { t: '3ος Μήνας', d: '' }] },
        prereq: { title: 'Βασικές προϋποθέσεις', items: [] },
        pricing: { title: 'Οικονομική προσφορά', items: [], total_label: 'Συνολικό κόστος:', total: '', note: D.note },
        steps: { title: 'Επόμενα βήματα', items: D.steps },
      }[type] || {};
      const at = sections.findIndex((s) => s.type === 'closing');
      sections.splice(at === -1 ? sections.length : at, 0, { type, on: true, ...structuredClone(seed) });
      draw(); toast(`Προστέθηκε: ${SECTION_TYPES[type]}`);
    };
    main.querySelector('#refresh')?.addEventListener('click', async () => {
      if (!confirm('Οι ενότητες «Υπηρεσίες» και «Οικονομική προσφορά» θα ξαναγεμίσουν από την προσφορά. Οι υπόλοιπες μένουν όπως είναι. Συνέχεια;')) return;
      readForm();
      const { sections: fresh } = await sectionsForOffer(d.offer_id);
      for (const type of ['services', 'pricing']) {
        const nu = fresh.find((s) => s.type === type), i = sections.findIndex((s) => s.type === type);
        if (i >= 0) sections[i] = { ...sections[i], items: nu.items, ...(type === 'pricing' ? { total: nu.total, total_label: nu.total_label } : {}) };
        else sections.splice(Math.max(0, sections.length - 1), 0, nu);
      }
      draw(); toast('Ενημερώθηκε από την προσφορά, πάτα Αποθήκευση');
    });
    main.querySelector('#del').onclick = async () => {
      if (!confirm('Διαγραφή παρουσίασης;')) return;
      await q(sb.from('decks').delete().eq('id', id)); location.hash = '#/decks';
    };
  }

  // Το #meta είναι div· το τυλίγουμε προσωρινά σε form για να διαβαστεί με FormData
  function wrapForm(div) {
    const f = document.createElement('form');
    div.querySelectorAll('input,select,textarea').forEach((el) => { const c = document.createElement('input'); c.name = el.name; c.value = el.value; f.appendChild(c); });
    return f;
  }

  return { viewDecks, viewDeck, createFromOffer, download };
}
