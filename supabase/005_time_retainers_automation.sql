-- =====================================================================
-- Created OS — Φάση 5: Χρονομέτρηση, Retainers, Κερδοφορία, Templates,
-- Επαναλαμβανόμενα tasks, Υπενθυμίσεις, Φόρμα leads για το site
-- Τρέξε ολόκληρο το αρχείο στο Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Χρονομέτρηση ----------
create table if not exists public.time_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  client_id    uuid references public.clients(id) on delete set null,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  task_id      uuid references public.tasks(id) on delete set null,
  work_date    date not null default current_date,
  minutes      int,                 -- null όσο τρέχει το χρονόμετρο
  started_at   timestamptz,         -- γεμίζει όσο τρέχει
  note         text,
  billable     boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists time_entries_user_date on public.time_entries (user_id, work_date);
create index if not exists time_entries_client_date on public.time_entries (client_id, work_date);

-- Κόστος ώρας ανά μέλος (μόνο admin)
create table if not exists public.member_rates (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  hourly_cost  numeric(10,2) not null default 0
);

-- ---------- Retainers ----------
create table if not exists public.retainers (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,
  monthly_fee     numeric(12,2) not null default 0,
  hours_included  numeric(8,2),
  start_date      date not null default current_date,
  end_date        date,
  billing_day     int not null default 1 check (billing_day between 1 and 28),
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);
create table if not exists public.retainer_billings (
  retainer_id   uuid references public.retainers(id) on delete cascade,
  period        text not null,      -- 'YYYY-MM'
  amount        numeric(12,2),
  invoiced_at   timestamptz not null default now(),
  primary key (retainer_id, period)
);

-- ---------- Templates tasks ----------
create table if not exists public.task_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  created_at   timestamptz not null default now()
);
create table if not exists public.task_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.task_templates(id) on delete cascade,
  position      int not null default 0,
  title         text not null,
  description   text,
  offset_days   int not null default 0,   -- ημέρες από την έναρξη
  assignee_id   uuid references public.profiles(id) on delete set null,
  priority      text not null default 'normal' check (priority in ('low','normal','high'))
);

-- ---------- Επαναλαμβανόμενα tasks ----------
create table if not exists public.recurring_tasks (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  title         text not null,
  description   text,
  assignee_id   uuid references public.profiles(id) on delete set null,
  priority      text not null default 'normal' check (priority in ('low','normal','high')),
  frequency     text not null default 'monthly' check (frequency in ('weekly','monthly')),
  next_date     date not null,             -- επόμενη ημερομηνία παράδοσης
  lead_days     int not null default 3,    -- πόσες μέρες πριν ανοίγει το task
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Δημιουργεί όσα επαναλαμβανόμενα tasks έχουν έρθει (καλείται από την εφαρμογή)
create or replace function public.generate_recurring_tasks()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.is_admin() then return 0; end if;
  for r in select * from public.recurring_tasks where active and next_date - lead_days <= current_date for update loop
    while r.next_date - r.lead_days <= current_date loop
      insert into public.tasks (client_id, campaign_id, title, description, assignee_id, priority, due_date, created_by)
      values (r.client_id, r.campaign_id, r.title, r.description, r.assignee_id, r.priority, r.next_date, auth.uid());
      n := n + 1;
      r.next_date := case when r.frequency = 'weekly' then r.next_date + 7 else (r.next_date + interval '1 month')::date end;
    end loop;
    update public.recurring_tasks set next_date = r.next_date where id = r.id;
  end loop;
  return n;
end $$;

-- ---------- Υπενθυμίσεις: πότε στάλθηκε η προσφορά, πότε άλλαξε το lead ----------
alter table public.offers add column if not exists sent_at timestamptz;
update public.offers set sent_at = created_at where status = 'sent' and sent_at is null;
alter table public.leads add column if not exists updated_at timestamptz default now();
update public.leads set updated_at = created_at where updated_at is null;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
create or replace function public.offer_sent_at() returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then new.sent_at := now(); end if;
  return new;
end $$;
drop trigger if exists offers_sent_at on public.offers;
create trigger offers_sent_at before insert or update on public.offers for each row execute function public.offer_sent_at();

-- ---------- Φόρμα leads από το createdstudio.gr ----------
-- Καλείται χωρίς login (anon). Κάνει έλεγχο μεγέθους και γράφει νέο lead.
create or replace function public.submit_lead(p_name text, p_email text, p_phone text default null, p_company text default null, p_message text default null, p_service text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name), '') = '' or coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  if length(coalesce(p_message,'')) > 4000 or length(p_name) > 200 or length(p_email) > 200 then return false; end if;
  -- απλό όριο: έως 5 αιτήματα ανά email την ώρα
  if (select count(*) from public.leads where email = lower(p_email) and created_at > now() - interval '1 hour') >= 5 then return false; end if;
  insert into public.leads (title, company, contact_name, email, phone, source, stage, notes)
  values (
    coalesce(nullif(trim(p_service), ''), 'Αίτημα από το site') || coalesce(' · ' || nullif(trim(p_company), ''), ''),
    nullif(trim(p_company), ''), trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), 'Website', 'new',
    nullif(trim(p_message), '')
  );
  return true;
end $$;
revoke all on function public.submit_lead(text,text,text,text,text,text) from public;
grant execute on function public.submit_lead(text,text,text,text,text,text) to anon, authenticated;

-- =====================================================================
-- Δικαιώματα
-- =====================================================================
alter table public.time_entries        enable row level security;
alter table public.member_rates        enable row level security;
alter table public.retainers           enable row level security;
alter table public.retainer_billings   enable row level security;
alter table public.task_templates      enable row level security;
alter table public.task_template_items enable row level security;
alter table public.recurring_tasks     enable row level security;

-- time_entries: ο καθένας τις δικές του, ο admin όλες
drop policy if exists time_select on public.time_entries;
create policy time_select on public.time_entries for select to authenticated using (public.is_admin() or user_id = auth.uid());
drop policy if exists time_insert on public.time_entries;
create policy time_insert on public.time_entries for insert to authenticated
  with check (user_id = auth.uid() and (public.is_admin() or (client_id is not null and public.can_see_client(client_id))));
drop policy if exists time_update on public.time_entries;
create policy time_update on public.time_entries for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or (user_id = auth.uid() and client_id is not null and public.can_see_client(client_id)));
drop policy if exists time_delete on public.time_entries;
create policy time_delete on public.time_entries for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- Οικονομικά: μόνο admin
drop policy if exists rates_admin on public.member_rates;
create policy rates_admin on public.member_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists retainers_admin on public.retainers;
create policy retainers_admin on public.retainers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists billings_admin on public.retainer_billings;
create policy billings_admin on public.retainer_billings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Templates: όλοι τα βλέπουν, ο admin τα διαχειρίζεται
drop policy if exists tpl_select on public.task_templates;
create policy tpl_select on public.task_templates for select to authenticated using (true);
drop policy if exists tpl_admin on public.task_templates;
create policy tpl_admin on public.task_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists tpli_select on public.task_template_items;
create policy tpli_select on public.task_template_items for select to authenticated using (true);
drop policy if exists tpli_admin on public.task_template_items;
create policy tpli_admin on public.task_template_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Επαναλαμβανόμενα: μόνο admin
drop policy if exists rec_admin on public.recurring_tasks;
create policy rec_admin on public.recurring_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Έτοιμο template για retainer social media ----------
insert into public.task_templates (name, description)
select 'Μηνιαίο social media retainer', 'Τα βασικά tasks κάθε μήνα για έναν πελάτη social media'
where not exists (select 1 from public.task_templates);
insert into public.task_template_items (template_id, position, title, offset_days, priority)
select t.id, v.pos, v.title, v.off, v.pri from public.task_templates t,
  (values (0, 'Content plan μήνα & έγκριση από πελάτη', 0, 'high'),
          (1, 'Γύρισμα / φωτογράφιση περιεχομένου', 5, 'normal'),
          (2, 'Μοντάζ reels', 9, 'normal'),
          (3, 'Copy & captions', 9, 'normal'),
          (4, 'Έγκριση υλικού από πελάτη', 11, 'high'),
          (5, 'Προγραμματισμός posts', 12, 'normal'),
          (6, 'Community management (εβδομαδιαίος έλεγχος)', 14, 'low'),
          (7, 'Μηνιαίο report & προτάσεις', 28, 'high')) as v(pos, title, off, pri)
where t.name = 'Μηνιαίο social media retainer'
  and not exists (select 1 from public.task_template_items i where i.template_id = t.id);
