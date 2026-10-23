-- Gashur Dispatch Log: schema, access rules and realtime.
--
-- Data is shared across the company: every signed-in staff member can read everything
-- and add or edit trips, trucks, drivers and clients. Only managers can delete records
-- or clear a fuel-loss flag. Rows are never hard-deleted; `deleted_at` marks them so the
-- deletion syncs to every device. Every row records who created and last changed it.
--
-- Accounts are invite-only: add staff in the Supabase dashboard (Authentication → Users).
-- Each new user gets a `profiles` row as a dispatcher; promote managers with
--   update public.profiles set role = 'manager' where id = '<user id>';

-- Staff --------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'dispatcher' check (role in ('manager', 'dispatcher')),
  -- Notifications newer than this are unread for this person.
  notifications_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by the policies below. Security definer so they can read profiles
-- without recursing into the profiles policies.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- Business data ------------------------------------------------------------------------
-- Ids are text and generated on the device, so records can be created offline and
-- synced later without changing their id.

create table public.clients (
  id text primary key,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  rate_per_litre numeric not null check (rate_per_litre > 0),
  credit_days integer not null check (credit_days >= 0),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trucks (
  id text primary key,
  plate text not null,
  capacity_litres integer not null check (capacity_litres > 0),
  odometer_km integer not null check (odometer_km >= 0),
  next_service_km integer not null,
  insurance_expiry date not null,
  inspection_expiry date not null,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.drivers (
  id text primary key,
  name text not null,
  phone text not null default '',
  license_no text not null,
  license_expiry date not null,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trips (
  id text primary key,
  ref text not null,
  client_id text not null references public.clients (id),
  truck_id text not null references public.trucks (id),
  driver_id text not null references public.drivers (id),
  product text not null check (product in ('PMS', 'AGO', 'DPK')),
  origin text not null,
  destination text not null,
  litres_loaded integer not null check (litres_loaded > 0),
  rate_per_litre numeric not null check (rate_per_litre > 0),
  dispatched_at timestamptz not null,
  due_at timestamptz not null,
  -- Delivery stage: all null until delivery is recorded.
  litres_delivered integer check (litres_delivered >= 0),
  arrived_at timestamptz,
  cost_fuel numeric,
  cost_allowance numeric,
  cost_tolls numeric,
  cost_other numeric,
  pod_received boolean,
  -- Billing stage.
  invoice_no text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  loss_reviewed boolean not null default false,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (litres_delivered is null or arrived_at is not null),
  check (invoiced_at is null or litres_delivered is not null),
  check (paid_at is null or invoiced_at is not null)
);

create table public.notifications (
  id text primary key,
  kind text not null check (kind in ('dispatched', 'delivered', 'billed', 'paid', 'loss')),
  trip_id text not null references public.trips (id),
  title text not null,
  body text not null,
  at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Devices pull changes by `updated_at`.
create index on public.clients (updated_at);
create index on public.trucks (updated_at);
create index on public.drivers (updated_at);
create index on public.trips (updated_at);
create index on public.notifications (updated_at);
create index on public.profiles (updated_at);

-- Audit stamps and manager-only changes ----------------------------------------------

-- The server, not the device, decides who made a change and when.
create or replace function public.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_manager_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_manager() then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.deleted_at is not null)
     or (tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at) then
    raise exception 'Only managers can delete records' using errcode = '42501';
  end if;
  if tg_table_name = 'trips' then
    if (tg_op = 'INSERT' and new.loss_reviewed)
       or (tg_op = 'UPDATE' and new.loss_reviewed is distinct from old.loss_reviewed) then
      raise exception 'Only managers can clear a fuel-loss flag' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'trucks', 'drivers', 'trips', 'notifications'] loop
    execute format('create trigger stamp before insert or update on public.%I for each row execute function public.stamp_row()', t);
    execute format('create trigger guard before insert or update on public.%I for each row execute function public.guard_manager_changes()', t);
  end loop;
end;
$$;

create or replace function public.touch_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch before update on public.profiles
  for each row execute function public.touch_profile();

-- Row level security ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.trucks enable row level security;
alter table public.drivers enable row level security;
alter table public.trips enable row level security;
alter table public.notifications enable row level security;

create policy "Staff can see all staff" on public.profiles
  for select to authenticated using (public.is_staff());
create policy "Staff can update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'trucks', 'drivers', 'trips', 'notifications'] loop
    execute format('create policy "Staff can read" on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy "Staff can add" on public.%I for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy "Staff can edit" on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end;
$$;

-- No delete policies: records are soft-deleted through `deleted_at`.
revoke all on public.profiles, public.clients, public.trucks, public.drivers, public.trips, public.notifications from anon;
grant select on public.profiles to authenticated;
-- Staff can change only their name and notification read time, never their role.
grant update (full_name, notifications_read_at) on public.profiles to authenticated;
grant select, insert, update on public.clients, public.trucks, public.drivers, public.trips, public.notifications to authenticated;

-- Realtime: tell devices when something changes so they pull straight away.
alter publication supabase_realtime add table
  public.profiles, public.clients, public.trucks, public.drivers, public.trips, public.notifications;
