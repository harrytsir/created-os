-- =====================================================================
-- Created OS — Φάση 2: Προσφορές & κατάλογος υπηρεσιών
-- Τρέξε ολόκληρο το αρχείο στο Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Στοιχεία εταιρείας (μία γραμμή) ----------
create table if not exists public.company_settings (
  id             int primary key default 1 check (id = 1),
  name           text default 'Created.',
  legal_name     text,
  vat_number     text,
  tax_office     text,
  address        text,
  email          text,
  phone          text,
  website        text default 'createdstudio.gr',
  logo           text,            -- εικόνα ως data URL
  accent         text default '#ff5a1f',
  default_vat    numeric(5,2) default 24,
  validity_days  int default 30,
  default_terms  text default E'• Η προσφορά ισχύει για 30 ημέρες από την ημερομηνία έκδοσης.\n• Προκαταβολή 50% με την ανάθεση και εξόφληση με την παράδοση.\n• Στις τιμές δεν περιλαμβάνεται ΦΠΑ, εκτός αν αναφέρεται διαφορετικά.\n• Δύο κύκλοι διορθώσεων περιλαμβάνονται· επιπλέον αλλαγές χρεώνονται ξεχωριστά.',
  updated_at     timestamptz default now()
);
insert into public.company_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Κατάλογος υπηρεσιών ----------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  category     text,
  name         text not null,
  description  text,
  unit         text default 'τεμ.',
  price        numeric(12,2) not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- Προσφορές ----------
create table if not exists public.offers (
  id            uuid primary key default gen_random_uuid(),
  number        text not null unique,
  title         text not null,
  client_id     uuid references public.clients(id) on delete set null,
  lead_id       uuid references public.leads(id) on delete set null,
  recipient     text,             -- όνομα παραλήπτη αν δεν υπάρχει πελάτης
  status        text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  issue_date    date not null default current_date,
  valid_until   date,
  intro         text,
  terms         text,
  discount_pct  numeric(5,2) not null default 0,
  vat_pct       numeric(5,2) not null default 24,
  created_at    timestamptz not null default now()
);

create table if not exists public.offer_items (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers(id) on delete cascade,
  position     int not null default 0,
  name         text not null,
  description  text,
  unit         text,
  qty          numeric(10,2) not null default 1,
  unit_price   numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- Δικαιώματα: όλα μόνο για τον admin ----------
alter table public.company_settings enable row level security;
alter table public.services         enable row level security;
alter table public.offers           enable row level security;
alter table public.offer_items      enable row level security;

drop policy if exists settings_admin on public.company_settings;
create policy settings_admin on public.company_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists offers_admin on public.offers;
create policy offers_admin on public.offers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists offer_items_admin on public.offer_items;
create policy offer_items_admin on public.offer_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Ενδεικτικές υπηρεσίες (άλλαξέ τες από την εφαρμογή) ----------
insert into public.services (category, name, description, unit, price)
select * from (values
  ('Strategy',          'Brand strategy workshop',         'Ανάλυση, positioning, brand pillars, tone of voice',            'project', 0),
  ('Social media',      'Social media management',         'Στρατηγική, content calendar, δημιουργία & δημοσίευση posts',   'μήνας',   0),
  ('Social media',      'Paid ads management',             'Στήσιμο, βελτιστοποίηση και reporting καμπανιών',               'μήνας',   0),
  ('Media production',  'Reel / short video',              'Concept, γύρισμα, μοντάζ, μουσική, υπότιτλοι',                  'τεμ.',    0),
  ('Media production',  'Ημέρα γυρίσματος',                'Σκηνοθέτης/DoP με βασικό εξοπλισμό',                            'ημέρα',   0),
  ('PR',                'Δελτίο τύπου & διανομή',          'Συγγραφή, έγκριση, διανομή σε στοχευμένα ΜΜΕ',                  'τεμ.',    0),
  ('Creative direction','Creative direction',              'Δημιουργική κατεύθυνση καμπάνιας',                              'ώρα',     0)
) as v(category, name, description, unit, price)
where not exists (select 1 from public.services);
