-- Staff management from the app (via the `staff-admin` edge function).
--
-- Removing someone deactivates them instead of deleting them, so their name stays on
-- the trips and records they made. Deactivated staff can't read or change anything.

alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'manager');
$$;

-- If an account is ever deleted outright in the dashboard, keep its records and just
-- forget the author, instead of the delete failing.
do $$
declare
  t text;
  col text;
begin
  foreach t in array array['clients', 'trucks', 'drivers', 'trips', 'notifications'] loop
    foreach col in array array['created_by', 'updated_by'] loop
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_' || col || '_fkey');
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.profiles (id) on delete set null',
        t, t || '_' || col || '_fkey', col
      );
    end loop;
  end loop;
end;
$$;

-- Let those automatic "set null" updates through: they run inside the profile deletion
-- (trigger depth > 1), and restamping them would put the deleted author straight back.
create or replace function public.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
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
