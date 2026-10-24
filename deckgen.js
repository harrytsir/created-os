// Created OS — δημιουργία παρουσιάσεων PowerPoint στο στυλ του Created.
// Λειτουργεί στον browser (window.PptxGenJS) και στο Node (για δοκιμές).

export const SECTION_TYPES = {
  cover:     'Εξώφυλλο',
  intro:     'Εισαγωγικό κείμενο',
  about:     'Ποιοι είμαστε',
  problems:  'Το πρόβλημα (3 σημεία)',
  whatwedo:  'Τι κάνουμε',
  goals:     'Στόχοι',
  services:  'Υπηρεσίες / παροχές',
  timeline:  'Χρονοδιάγραμμα',
  prereq:    'Προϋποθέσεις',
  pricing:   'Οικονομική προσφορά',
  steps:     'Επόμενα βήματα',
  closing:   'Κλείσιμο',
};

export const DEFAULT_TEXTS = {
  about: 'Στην Created. πιστεύουμε πως κάθε brand έχει μια ιστορία που αξίζει να ειπωθεί μοναδικά. Γι’ αυτό δημιουργήσαμε ένα 360° boutique creative studio, για να τη ζωντανέψουμε.\n\nΤο όνομά μας περικλείει την ουσία μας: ιδέες που γεννιούνται, ιστορίες που ζωντανεύουν, εμπειρίες που μένουν. Το motto μας, Made to Create, είναι το DNA μας.',
  diff_title: 'Τι μας κάνει διαφορετικούς;',
  diff: 'Οι τάσεις δεν μας καθορίζουν, τις γεννάμε. Μαζί σας, από το πρώτο concept μέχρι το τελευταίο detail, χτίζουμε έργα με ουσία και χαρακτήρα.',
  problems_title: 'Γιατί πολλά brands δεν πετυχαίνουν;',
  problems_sub: 'Δεν φταίει η έλλειψη παρουσίας. Φταίει η έλλειψη κατεύθυνσης.',
  problems: [
    { t: 'Κομμάτια χωρίς σύνδεση', d: 'Ένα post εδώ, μια καμπάνια εκεί, ένα site παραπέρα. Χωρίς κοινή στρατηγική, κάθε κανάλι λέει διαφορετική ιστορία.' },
    { t: 'Περιεχόμενο που «απλά ανεβαίνει»', d: 'Πολλή δραστηριότητα, καμία ιδέα. Το κοινό δεν θυμάται ό,τι δεν έχει ουσία, ύφος και λόγο ύπαρξης.' },
    { t: 'Αποτελέσματα που δεν μετριούνται', d: 'Χωρίς σαφείς στόχους και reporting, δεν ξέρεις τι δουλεύει. Άρα δεν μπορείς να το βελτιώσεις.' },
  ],
  whatwedo: [
    { t: '360° Marketing', d: 'Καμπάνιες που ενώνουν στρατηγική, περιεχόμενο και κανάλια σε μία κίνηση.' },
    { t: 'Strategic Communication', d: 'Μηνύματα που φτάνουν στους σωστούς ανθρώπους, τη σωστή στιγμή, από το σωστό κανάλι.' },
    { t: 'Media Production', d: 'Video, φωτογραφία και content από το concept μέχρι το τελικό αποτέλεσμα.' },
    { t: 'Brand Strategy', d: 'Positioning, ταυτότητα και αφήγηση που δίνουν σε ένα brand λόγο ύπαρξης και τρόπο να μεγαλώσει.' },
    { t: 'Creative Direction', d: 'Μία ενιαία οπτική που κρατά όλα τα touchpoints μαζί: εικόνα, ύφος, craft.' },
    { t: 'Public Relations', d: 'Φήμη και απήχηση με φροντίδα: οι ιστορίες που βάζουν ένα brand στο δωμάτιο.' },
  ],
  goals: ['Ανάπτυξη ολοκληρωμένης digital στρατηγικής.', 'Αύξηση επισκεψιμότητας, leads και conversions.', 'Ενίσχυση brand awareness μέσω performance και οργανικά.', 'Βελτιστοποίηση του ROI (Return on Investment).'],
  steps: ['Συζητάμε για το brand, τους στόχους, το ύφος και το κοινό-στόχο.', 'Συγκεντρώνουμε τις απαραίτητες προσβάσεις και κάνουμε αρχικό audit.', 'Παραδίδουμε πλάνο, χρονοδιάγραμμα και οικονομική προσφορά.', 'Υπογράφουμε συμφωνητικό και ξεκινά η υλοποίηση.'],
  steps_offer: ['Υπογραφή συμφωνητικού.', 'Συγκέντρωση των απαραίτητων προσβάσεων και υλικού.', 'Ολοκλήρωση του πλάνου και των πρώτων creatives.', 'Έναρξη υλοποίησης και πρώτο report.'],
  extra_title: 'Επιπλέον:',
  note: '* Τα κόστη είναι προ Φ.Π.Α.',
};

// ---------- έτοιμες δομές ----------
export function credentialsSections() {
  const D = DEFAULT_TEXTS;
  return [
    { type: 'cover', on: true },
    { type: 'about', on: true, title: 'Ποιοι είμαστε', text: D.about, diff_title: D.diff_title, diff: D.diff },
    { type: 'problems', on: true, title: D.problems_title, subtitle: D.problems_sub, items: D.problems },
    { type: 'whatwedo', on: true, title: 'Τι κάνουμε', items: D.whatwedo },
    { type: 'goals', on: true, title: 'Στόχοι που θέτουμε', items: D.goals },
    { type: 'steps', on: true, title: 'Επόμενα βήματα', items: D.steps },
    { type: 'closing', on: true },
  ];
}

const fmtEur = (n) => new Intl.NumberFormat('el-GR', { maximumFractionDigits: 2 }).format(Number(n || 0)) + '€';

export function offerSections(offer, items, { clientName, campaign } = {}) {
  const D = DEFAULT_TEXTS;
  const subtotal = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0), 0);
  const net = subtotal * (1 - Number(offer.discount_pct || 0) / 100);
  const monthly = items.length && items.every((i) => /μήν|month/i.test(i.unit || ''));
  const goals = campaign?.objective ? campaign.objective.split(/\n|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 4) : D.goals;
  return [
    { type: 'cover', on: true },
    { type: 'intro', on: !!offer.intro, text: offer.intro || '' },
    { type: 'about', on: true, title: 'Ποιοι είμαστε', text: D.about, diff_title: D.diff_title, diff: D.diff },
    { type: 'goals', on: true, title: 'Στόχοι που θέτουμε', items: goals },
    { type: 'services', on: true, title: 'Τι περιλαμβάνει η πρόταση', subtitle: clientName ? `Υπηρεσίες για ${clientName}` : '', items: items.map((i) => ({ t: i.name, d: i.description || '' })) },
    { type: 'timeline', on: false, title: 'Χρονοδιάγραμμα', subtitle: '', items: [{ t: '1ος Μήνας', d: 'Στρατηγική, setup και πρώτα creatives.' }, { t: '2ος Μήνας', d: 'Υλοποίηση, μέτρηση και βελτιστοποίηση.' }, { t: '3ος Μήνας', d: 'Αξιολόγηση αποτελεσμάτων και επόμενο πλάνο.' }] },
    { type: 'prereq', on: false, title: 'Βασικές προϋποθέσεις', items: [{ t: 'Πρόσβαση σε λογαριασμούς', d: 'Admin access στα social, στο site και στα εργαλεία μέτρησης.' }, { t: 'Έγκαιρες εγκρίσεις', d: 'Εγκρίσεις υλικού εντός 2 εργάσιμων για να τηρείται το πρόγραμμα.' }] },
    {
      type: 'pricing', on: true, title: 'Οικονομική προσφορά',
      items: items.map((i) => ({ t: i.name, price: fmtEur(Number(i.qty || 0) * Number(i.unit_price || 0)), unit: monthly ? '/ μηνιαίως' : (Number(i.qty) !== 1 ? `${Number(i.qty)} ${i.unit || ''}`.trim() : (i.unit && !/τεμ/.test(i.unit) ? '/ ' + i.unit : '')) })),
      total_label: monthly ? 'Συνολικό μηνιαίο κόστος:' : 'Συνολικό κόστος:',
      total: fmtEur(net) + (Number(offer.discount_pct) ? ` (έκπτωση ${Number(offer.discount_pct)}%)` : ''),
      extra_title: '', extra: '', note: D.note,
    },
    { type: 'steps', on: true, title: 'Επόμενα βήματα', items: D.steps_offer },
    { type: 'closing', on: true },
  ];
}

// ---------- γεννήτρια ----------
export function buildDeck(PptxGenJS, deck, brand) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.title = deck.title || 'Created.';
  pres.author = brand.name || 'Created.';
  pres.company = (brand.legal_name || brand.name || 'Created.').replace(/&/g, '&amp;');

  const F = brand.font || 'Gotham Greek';
  const FM = brand.fontMedium || (F === 'Gotham Greek' ? 'Gotham Greek Medium' : F);
  const ACC = (brand.accent || '#FCB040').replace('#', '').toUpperCase();
  const INK = '111111', MUTED = '5A5A5A', BG = 'F2F2F2', GREY = 'BDBDBD', WHITE = 'FFFFFF';
  const W = 13.333, H = 7.5, MX = 0.92;
  const kicker = deck.kicker || '';
  const LOGO_W = 1.79, LOGO_H = 1.79 * 259 / 1364;
  const logoDark = brand.logoDark, logoLight = brand.logoLight;
  const footer = [brand.phone, brand.website, brand.email];
  const T = (s) => String(s ?? '');

  // ---- layouts ----
  const footerObjs = (color) => [
    { text: { text: T(footer[0]), options: { x: 0.54, y: 7.0, w: 3, h: 0.25, fontFace: F, fontSize: 7, color, margin: 0 } } },
    { text: { text: T(footer[1]), options: { x: W / 2 - 1.5, y: 7.0, w: 3, h: 0.25, fontFace: F, fontSize: 7, color, align: 'center', margin: 0 } } },
    { text: { text: T(footer[2]), options: { x: W - 3.54, y: 7.0, w: 3, h: 0.25, fontFace: F, fontSize: 7, color, align: 'right', margin: 0 } } },
  ];
  const logoObj = (data) => data ? [{ image: { data, x: W - 0.54 - LOGO_W, y: 0.36, w: LOGO_W, h: LOGO_H } }] : [];
  pres.defineSlideMaster({
    title: 'CONTENT', background: { color: BG },
    objects: [
      { text: { text: kicker, options: { x: 0.54, y: 0.42, w: 6, h: 0.25, fontFace: F, fontSize: 7, color: MUTED, margin: 0 } } },
      ...logoObj(logoDark), ...footerObjs(MUTED),
      { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 1.35, w: W - 2 * MX, h: 0.8, fontFace: F, fontSize: 28, color: INK, align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'ACCENT', background: { color: ACC },
    objects: [
      { text: { text: kicker, options: { x: 0.54, y: 0.42, w: 6, h: 0.25, fontFace: F, fontSize: 7, color: INK, margin: 0 } } },
      ...logoObj(logoDark), ...footerObjs(INK),
    ],
  });
  pres.defineSlideMaster({ title: 'DARK', background: { color: '000000' }, objects: [...footerObjs('8A8A8A')] });

  const content = (title) => {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    if (title) s.addText(T(title), { placeholder: 'title', align: 'left' });
    return s;
  };
  const subtitle = (s, txt, y = 2.2) => { if (txt) s.addText(T(txt), { x: MX, y, w: W - 2 * MX, h: 0.4, fontFace: F, fontSize: 13, color: MUTED, margin: 0, isTextBox: true }); };
  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]]; };
  const num2 = (i) => String(i + 1).padStart(2, '0');

  const builders = {
    cover(sec) {
      const s = pres.addSlide({ masterName: 'DARK' });
      if (logoLight) s.addImage({ data: logoLight, x: (W - 5.33) / 2, y: 3.0, w: 5.33, h: 5.33 * 259 / 1364 });
      else s.addText(brand.name || 'created.', { x: 0, y: 2.9, w: W, h: 1.2, fontFace: FM, fontSize: 72, bold: true, color: WHITE, align: 'center', isTextBox: true });
      const sub = sec.subtitle || deck.title;
      if (sub) s.addText(T(sub), { x: 1, y: 4.5, w: W - 2, h: 0.5, fontFace: F, fontSize: 14, color: 'BBBBBB', align: 'center', margin: 0, isTextBox: true });
      if (sec.client) s.addText(T(sec.client), { x: 1, y: 5.0, w: W - 2, h: 0.4, fontFace: FM, fontSize: 12, color: ACC, align: 'center', margin: 0, isTextBox: true });
    },
    intro(sec) {
      const s = pres.addSlide({ masterName: 'CONTENT' });
      s.addText(T(sec.text), { x: 2.0, y: 2.2, w: 8.2, h: 3.2, fontFace: F, fontSize: 16, color: INK, valign: 'middle', margin: 0, lineSpacingMultiple: 1.25, isTextBox: true });
    },
    about(sec) {
      const s = content(sec.title);
      const runs = [
        ...T(sec.text).split(/\n{2,}/).map((p, i, a) => ({ text: p, options: { breakLine: true, paraSpaceAfter: 10 } })),
      ];
      if (sec.diff) runs.push({ text: T(sec.diff_title), options: { fontFace: FM, breakLine: true, paraSpaceBefore: 10, paraSpaceAfter: 4 } }, { text: T(sec.diff), options: {} });
      s.addText(runs, { x: MX, y: 2.6, w: 6.4, h: 3.8, fontFace: F, fontSize: 13, color: INK, valign: 'top', margin: 0, lineSpacingMultiple: 1.15, isTextBox: true });
      s.addShape(pres.shapes.OVAL, { x: 8.9, y: 2.55, w: 3.2, h: 3.2, fill: { color: ACC } });
      s.addText([{ text: 'Made to', options: { breakLine: true } }, { text: 'Create.', options: {} }], { x: 8.9, y: 2.55, w: 3.2, h: 3.2, fontFace: FM, fontSize: 26, color: INK, align: 'center', valign: 'middle', isTextBox: true });
    },
    problems(sec) {
      const items = (sec.items || []).slice(0, 3);
      const s = content(sec.title); subtitle(s, sec.subtitle);
      const n = Math.max(items.length, 1), gap = 0.25, cw = (W - 2 * 0.7 - gap * (n - 1)) / n;
      items.forEach((it, i) => {
        const x = 0.7 + i * (cw + gap);
        s.addShape(pres.shapes.RECTANGLE, { x, y: 2.97, w: cw, h: 3.2, fill: { color: WHITE }, line: { color: WHITE } });
        s.addShape(pres.shapes.RECTANGLE, { x, y: 2.97, w: cw, h: 0.07, fill: { color: ACC }, line: { color: ACC } });
        s.addText(num2(i), { x: x + 0.35, y: 3.35, w: 1, h: 0.3, fontFace: FM, fontSize: 11, color: ACC, margin: 0, isTextBox: true });
        s.addText(T(it.t), { x: x + 0.35, y: 3.8, w: cw - 0.7, h: 0.8, fontFace: FM, fontSize: 16, color: INK, valign: 'top', margin: 0, isTextBox: true });
        s.addText(T(it.d), { x: x + 0.35, y: 4.75, w: cw - 0.7, h: 1.25, fontFace: F, fontSize: 11, color: MUTED, valign: 'top', margin: 0, isTextBox: true });
      });
    },
    whatwedo(sec) {
      chunk(sec.items || [], 6).forEach((items, page) => {
        const s = content(sec.title + (page ? ' (συνέχεια)' : ''));
        const cols = Math.min(3, Math.max(items.length, 1)), rows = Math.ceil(items.length / 3) || 1;
        const gap = 0.22, cw = (W - 2 * 0.7 - gap * (cols - 1)) / cols, ch = rows > 1 ? 1.95 : 2.6, y0 = 2.65;
        items.forEach((it, i) => {
          const x = 0.7 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap);
          s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: WHITE }, line: { color: WHITE } });
          s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h: ch, fill: { color: ACC }, line: { color: ACC } });
          s.addText(num2(page * 6 + i), { x: x + 0.3, y: y + 0.22, w: 1, h: 0.25, fontFace: FM, fontSize: 9, color: ACC, margin: 0, isTextBox: true });
          s.addText(T(it.t), { x: x + 0.3, y: y + 0.5, w: cw - 0.55, h: 0.4, fontFace: FM, fontSize: 14, color: INK, margin: 0, isTextBox: true });
          s.addText(T(it.d), { x: x + 0.3, y: y + 0.95, w: cw - 0.55, h: ch - 1.1, fontFace: F, fontSize: 10.5, color: MUTED, valign: 'top', margin: 0, isTextBox: true });
        });
      });
    },
    goals(sec) {
      const items = (sec.items || []).slice(0, 5);
      const s = content(sec.title);
      const n = Math.max(items.length, 1), slot = Math.min(2.6, (W - 2 * MX) / n), x0 = (W - slot * n) / 2;
      items.forEach((g, i) => {
        const cx = x0 + i * slot + slot / 2;
        s.addShape(pres.shapes.OVAL, { x: cx - 0.6, y: 2.95, w: 1.2, h: 1.2, fill: { color: ACC } });
        if (brand.iconTarget) s.addImage({ data: brand.iconTarget, x: cx - 0.36, y: 3.19, w: 0.72, h: 0.72 });
        else s.addText(num2(i), { x: cx - 0.6, y: 2.95, w: 1.2, h: 1.2, fontFace: FM, fontSize: 20, color: INK, align: 'center', valign: 'middle', isTextBox: true });
        s.addText(T(g), { x: cx - slot / 2 + 0.15, y: 4.45, w: slot - 0.3, h: 1.4, fontFace: F, fontSize: 12, color: INK, align: 'center', valign: 'top', margin: 0, isTextBox: true });
      });
    },
    services(sec) {
      chunk(sec.items || [], 8).forEach((items, page) => {
        const s = content(sec.title + (page ? ' (συνέχεια)' : '')); subtitle(s, sec.subtitle);
        const cols = items.length <= 4 ? Math.max(items.length, 1) : items.length <= 6 ? 3 : 4;
        const rows = Math.ceil(items.length / cols) || 1;
        const gap = 0.22, cw = (W - 2 * 0.7 - gap * (cols - 1)) / cols;
        const top = 2.85, avail = 6.65 - top, ch = Math.min(rows === 1 ? 2.4 : 1.75, (avail - gap * (rows - 1)) / rows);
        items.forEach((it, i) => {
          const x = 0.7 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
          s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.14, fill: { color: ACC }, line: { color: ACC } });
          s.addText(T(it.t), { x: x + 0.22, y: y + 0.18, w: cw - 0.44, h: 0.5, fontFace: FM, fontSize: cols === 4 ? 12 : 14, color: INK, valign: 'top', margin: 0, isTextBox: true });
          if (it.d) s.addText(T(it.d), { x: x + 0.22, y: y + 0.72, w: cw - 0.44, h: ch - 0.85, fontFace: F, fontSize: cols === 4 ? 9.5 : 10.5, color: INK, valign: 'top', margin: 0, isTextBox: true });
        });
      });
    },
    timeline(sec) {
      const items = (sec.items || []).slice(0, 8);
      const s = content(sec.title); subtitle(s, sec.subtitle);
      const n = Math.max(items.length, 1), x0 = 1.1, x1 = W - 1.1, ly = 4.45, step = (x1 - x0 - 0.6) / n;
      s.addShape(pres.shapes.LINE, { x: x0, y: ly, w: x1 - x0, h: 0, line: { color: MUTED, width: 1.25, endArrowType: 'triangle' } });
      items.forEach((it, i) => {
        const x = x0 + 0.25 + i * step, up = i % 2 === 0, w = Math.min(2.4, step * 2 - 0.2);
        s.addShape(pres.shapes.LINE, { x, y: up ? ly - 1.35 : ly, w: 0, h: 1.35, line: { color: ACC, width: 1.25 } });
        const ty = up ? ly - 1.35 : ly + 0.2;
        s.addText(T(it.t), { x: x + 0.1, y: ty, w, h: 0.3, fontFace: FM, fontSize: 12, color: INK, margin: 0, isTextBox: true });
        s.addText(T(it.d), { x: x + 0.1, y: ty + 0.32, w, h: 0.95, fontFace: F, fontSize: 9.5, color: MUTED, valign: 'top', margin: 0, isTextBox: true });
      });
    },
    prereq(sec) {
      const items = (sec.items || []).slice(0, 6);
      const s = content(sec.title);
      const cols = items.length <= 2 ? Math.max(items.length, 1) : 3, rows = Math.ceil(items.length / cols) || 1;
      const gap = 0.22, cw = (W - 2 * 0.7 - gap * (cols - 1)) / cols, top = 2.6, ch = Math.min(2.5, (6.65 - top - gap * (rows - 1)) / rows);
      items.forEach((it, i) => {
        const x = 0.7 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.14, fill: { color: ACC }, line: { color: ACC } });
        s.addText(T(it.t), { x: x + 0.25, y: y + 0.2, w: cw - 0.5, h: 0.55, fontFace: FM, fontSize: 14, color: INK, valign: 'top', margin: 0, isTextBox: true });
        s.addText(T(it.d), { x: x + 0.25, y: y + 0.8, w: cw - 0.5, h: ch - 0.95, fontFace: F, fontSize: 11, color: INK, valign: 'top', margin: 0, isTextBox: true });
      });
    },
    pricing(sec) {
      const items = sec.items || [];
      chunk(items, 6).forEach((list, page) => {
        const last = page === Math.ceil(items.length / 6) - 1 || !items.length;
        const s = content(sec.title + (page ? ' (συνέχεια)' : ''));
        const hasExtra = !!(sec.extra && sec.extra.trim());
        const areaW = hasExtra ? 7.6 : W - 2 * 0.7;
        const cols = Math.min(3, Math.max(list.length, 1)), gap = 0.18, cw = (areaW - gap * (cols - 1)) / cols, ch = 1.05;
        list.forEach((it, i) => {
          const x = 0.7 + (i % cols) * (cw + gap), y = 2.55 + Math.floor(i / cols) * (ch + gap);
          s.addShape(pres.shapes.SNIP_1_RECTANGLE, { x, y, w: cw, h: ch, fill: { color: GREY }, line: { color: GREY } });
          s.addText(T(it.t), { x: x + 0.2, y: y + 0.12, w: cw - 0.6, h: 0.4, fontFace: F, fontSize: 11, color: INK, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true });
          s.addText([{ text: T(it.price), options: { fontSize: 17, fontFace: FM } }, { text: it.unit ? '  ' + T(it.unit) : '', options: { fontSize: 10 } }], { x: x + 0.2, y: y + 0.55, w: cw - 0.4, h: 0.38, fontFace: F, color: INK, margin: 0, isTextBox: true });
        });
        if (last) {
          const rows = Math.ceil(list.length / cols) || 0, ty = 2.55 + rows * (ch + gap) + 0.1;
          s.addShape(pres.shapes.SNIP_1_RECTANGLE, { x: 0.7, y: ty, w: areaW, h: 0.9, fill: { color: ACC }, line: { color: ACC } });
          s.addText(T(sec.total_label), { x: 0.95, y: ty, w: areaW * 0.55, h: 0.9, fontFace: FM, fontSize: 15, color: INK, underline: { style: 'sng' }, valign: 'middle', margin: 0, isTextBox: true });
          s.addText(T(sec.total), { x: 0.7 + areaW * 0.5, y: ty, w: areaW * 0.5 - 0.3, h: 0.9, fontFace: FM, fontSize: 20, color: INK, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
          if (sec.note) s.addText(T(sec.note), { x: 0.7, y: ty + 1.05, w: 6, h: 0.3, fontFace: F, fontSize: 8, color: MUTED, margin: 0, isTextBox: true });
        }
        if (hasExtra && page === 0) {
          s.addText([{ text: T(sec.extra_title || 'Επιπλέον:'), options: { fontFace: FM, breakLine: true, paraSpaceAfter: 6 } }, { text: T(sec.extra) }], { x: 8.75, y: 2.55, w: 3.9, h: 2.8, fontFace: F, fontSize: 11, color: INK, valign: 'top', margin: 0, isTextBox: true });
        }
      });
    },
    steps(sec) {
      const items = (sec.items || []).slice(0, 6);
      const s = content(sec.title);
      const top = 2.6, avail = 6.6 - top, rh = Math.min(0.85, avail / Math.max(items.length, 1));
      items.forEach((t, i) => {
        const y = top + i * rh;
        s.addText(num2(i), { x: 1.15, y, w: 0.8, h: rh, fontFace: FM, fontSize: 15, color: INK, valign: 'middle', margin: 0, isTextBox: true });
        s.addText(T(t), { x: 2.3, y, w: 9.6, h: rh, fontFace: F, fontSize: 12, color: INK, valign: 'middle', margin: 0, isTextBox: true });
        s.addShape(pres.shapes.LINE, { x: 0.95, y: y + rh, w: 11.25, h: 0, line: { color: INK, width: 0.75 } });
      });
    },
    closing() {
      const s = pres.addSlide({ masterName: 'DARK' });
      if (logoLight) s.addImage({ data: logoLight, x: (W - 5.33) / 2, y: 2.55, w: 5.33, h: 5.33 * 259 / 1364 });
      const soc = [['FACEBOOK', brand.facebook], ['INSTAGRAM', brand.instagram], ['LINKEDIN', brand.linkedin]].filter(([, u]) => u !== null);
      soc.forEach(([label, url], i) => s.addText(url ? [{ text: label, options: { hyperlink: { url } } }] : label, { x: W / 2 - 1.5, y: 4.3 + i * 0.32, w: 3, h: 0.3, fontFace: F, fontSize: 8, color: '9A9A9A', align: 'center', margin: 0, isTextBox: true }));
    },
  };

  for (const sec of deck.sections || []) {
    if (!sec.on || !builders[sec.type]) continue;
    builders[sec.type](sec);
  }
  return pres;
}
