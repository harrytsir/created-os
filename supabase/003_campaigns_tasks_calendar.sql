-- =====================================================================
-- Created OS — Φάση 3: Καμπάνιες, Tasks, Ημερολόγιο
-- Τρέξε ολόκληρο το αρχείο στο Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Καμπάνιες ----------
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  objective   text,
  channels    text[] not null default '{}',
  status      text not null default 'planning' check (status in ('planning','active','paused','done')),
  start_date  date,
  end_date    date,
  kpis        text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Ο προϋπολογισμός σε ξεχωριστό πίνακα, ώστε να τον βλέπει μόνο ο admin
create table if not exists public.campaign_budgets (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  budget      numeric(12,2),
  spent       numeric(12,2)
);

-- ---------- Tasks ----------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  campaign_id  uuid references public.campaigns(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'todo' check (status in ('todo','doing','review','done')),
  priority     text not null default 'normal' check (priority in ('low','normal','high')),
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_date     date,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------- Ημερολόγιο ----------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  campaign_id  uuid references public.campaigns(id) on delete cascade,
  title        text not null,
  type         text not null default 'post' check (type in ('post','shoot','press','ad','meeting','event','other')),
  channel      text,
  start_at     timestamptz not null,
  end_at       timestamptz,
  all_day      boolean not null default false,
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------- Δικαιώματα ----------
alter table public.campaigns        enable row level security;
alter table public.campaign_budgets enable row level security;
alter table public.tasks            enable row level security;
alter table public.events           enable row level security;

-- campaigns: ο συνεργάτης βλέπει τις καμπάνιες των πελατών του, ο admin τις διαχειρίζεται
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated using (public.can_see_client(client_id));
drop policy if exists campaigns_admin on public.campaigns;
create policy campaigns_admin on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists budgets_admin on public.campaign_budgets;
create policy budgets_admin on public.campaign_budgets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tasks: ορατά σε όποιον βλέπει τον πελάτη ή του έχουν ανατεθεί·
-- ο συνεργάτης δημιουργεί/ενημερώνει tasks των πελατών του· διαγραφή admin ή δημιουργός
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_admin() or assignee_id = auth.uid() or created_by = auth.uid() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_admin() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_admin() or assignee_id = auth.uid() or (client_id is not null and public.can_see_client(client_id)))
  with check (public.is_admin() or assignee_id = auth.uid() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_admin() or created_by = auth.uid());

-- events: ίδια λογική με τα tasks
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (public.is_admin() or created_by = auth.uid() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.is_admin() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.is_admin() or created_by = auth.uid() or (client_id is not null and public.can_see_client(client_id)))
  with check (public.is_admin() or (client_id is not null and public.can_see_client(client_id)));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (public.is_admin() or created_by = auth.uid());
