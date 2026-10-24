-- =====================================================================
-- Created OS — Φάση 1: Βάση, ρόλοι, CRM
-- Τρέξε ολόκληρο το αρχείο στο Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Προφίλ χρηστών & ρόλοι ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'collaborator' check (role in ('admin','collaborator')),
  created_at  timestamptz not null default now()
);

-- Ο πρώτος χρήστης που γράφεται γίνεται αυτόματα admin, οι επόμενοι συνεργάτες.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'collaborator' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Πελάτες ----------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  industry    text,
  vat_number  text,          -- ΑΦΜ
  tax_office  text,          -- ΔΟΥ
  address     text,
  website     text,
  email       text,
  phone       text,
  status      text not null default 'active' check (status in ('active','paused','past')),
  notes       text,
  created_at  timestamptz not null default now()
);

-- Ποιοι συνεργάτες έχουν πρόσβαση σε ποιον πελάτη
create table if not exists public.client_members (
  client_id   uuid references public.clients(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  primary key (client_id, user_id)
);

create or replace function public.can_see_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.client_members where client_id = cid and user_id = auth.uid());
$$;

-- ---------- Επαφές πελάτη ----------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  full_name   text not null,
  role_title  text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------- Leads (μόνο admin) ----------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  company        text,
  contact_name   text,
  email          text,
  phone          text,
  source         text,
  stage          text not null default 'new'
                 check (stage in ('new','contacted','meeting','proposal','won','lost')),
  value          numeric(12,2),
  expected_close date,
  notes          text,
  client_id      uuid references public.clients(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- Σημειώσεις / ιστορικό ----------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Δικαιώματα (Row Level Security)
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.client_members enable row level security;
alter table public.contacts       enable row level security;
alter table public.leads          enable row level security;
alter table public.activities     enable row level security;

-- profiles: όλοι βλέπουν την ομάδα, ο καθένας αλλάζει το όνομά του, ο admin τους ρόλους
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())));

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (public.can_see_client(id));
drop policy if exists clients_admin_all on public.clients;
create policy clients_admin_all on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- client_members
drop policy if exists members_select on public.client_members;
create policy members_select on public.client_members for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
drop policy if exists members_admin_all on public.client_members;
create policy members_admin_all on public.client_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- contacts: ο συνεργάτης τις βλέπει για τους πελάτες του, ο admin τις διαχειρίζεται
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated using (public.can_see_client(client_id));
drop policy if exists contacts_admin_all on public.contacts;
create policy contacts_admin_all on public.contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leads: μόνο admin (περιέχουν τιμές)
drop policy if exists leads_admin_all on public.leads;
create policy leads_admin_all on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- activities: σημειώσεις πελάτη ορατές σε όσους βλέπουν τον πελάτη· σημειώσεις lead μόνο admin
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated
  using (public.is_admin() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated
  with check (public.is_admin() or (client_id is not null and lead_id is null and public.can_see_client(client_id)));
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());
