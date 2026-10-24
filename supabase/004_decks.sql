-- =====================================================================
-- Created OS — Φάση 4: Παρουσιάσεις
-- Τρέξε ολόκληρο το αρχείο στο Supabase → SQL Editor → New query → Run
-- =====================================================================

create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'offer' check (kind in ('offer','credentials','custom')),
  title       text not null,
  kicker      text,
  client_id   uuid references public.clients(id) on delete set null,
  offer_id    uuid references public.offers(id) on delete set null,
  sections    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.decks enable row level security;
drop policy if exists decks_admin on public.decks;
create policy decks_admin on public.decks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Στοιχεία για τις παρουσιάσεις
alter table public.company_settings add column if not exists deck_font  text default 'Gotham Greek';
alter table public.company_settings add column if not exists facebook   text;
alter table public.company_settings add column if not exists instagram  text;
alter table public.company_settings add column if not exists linkedin   text;
alter table public.company_settings add column if not exists logo_light text;  -- λευκό logo για σκούρο φόντο

-- Χρώμα και στοιχεία του Created. από τις υπάρχουσες παρουσιάσεις
update public.company_settings set accent = '#FCB040' where accent is null or accent = '#ff5a1f';
update public.company_settings set phone = '+30 697 840 0728' where phone is null or phone = '';
update public.company_settings set email = 'hello@createdstudio.gr' where email is null or email = '';
update public.company_settings set website = 'createdstudio.gr' where website is null or website = '';
alter table public.company_settings alter column accent set default '#FCB040';
