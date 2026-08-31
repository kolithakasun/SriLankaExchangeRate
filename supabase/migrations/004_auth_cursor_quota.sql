-- Auth profiles, Cursor forecast run cache, and a global 2-per-Colombo-day quota.
-- Run after 001–003. Disable public sign-up in Supabase Auth settings before opening login.
-- Bootstrap first admin (after creating the account in the Dashboard):
--   update public.profiles set role = 'admin' where email = 'you@example.com';

create type public.app_role as enum ('user', 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'user')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Cursor forecast runs: cache + pending cloud agent state.
create type public.cursor_run_status as enum (
  'reserved',
  'pending',
  'completed',
  'failed',
  'released'
);

create table if not exists public.cursor_forecast_runs (
  id uuid primary key default gen_random_uuid(),
  quota_date date not null,
  slot smallint not null check (slot in (1, 2)),
  input_hash text not null,
  bank_code text not null,
  currency_code text not null,
  forecast_range text not null,
  status public.cursor_run_status not null default 'reserved',
  agent_id text,
  run_id text,
  narration text,
  error text,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint cursor_forecast_runs_day_slot unique (quota_date, slot)
);

create index if not exists cursor_forecast_runs_hash_idx
  on public.cursor_forecast_runs (input_hash, status, created_at desc);
create index if not exists cursor_forecast_runs_quota_date_idx
  on public.cursor_forecast_runs (quota_date desc);
create index if not exists cursor_forecast_runs_status_idx
  on public.cursor_forecast_runs (status);

alter table public.cursor_forecast_runs enable row level security;
-- No client policies: only the service role (Netlify functions) reads/writes this table.

/**
 * Atomically claim the next free Cursor slot (1 or 2) for a Colombo calendar day.
 * Returns the new row id and slot, or nulls when both slots are taken.
 * Callable only with the service role (SECURITY DEFINER + revoke from public).
 */
create or replace function public.claim_cursor_quota_slot(
  p_quota_date date,
  p_input_hash text,
  p_bank_code text,
  p_currency_code text,
  p_forecast_range text,
  p_requested_by uuid
)
returns table (run_id uuid, slot smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot smallint;
  v_id uuid;
begin
  -- Pick the lowest free slot under a day-level advisory lock.
  perform pg_advisory_xact_lock(hashtext('cursor_quota:' || p_quota_date::text));

  select s.slot
    into v_slot
  from generate_series(1, 2) as s(slot)
  where not exists (
    select 1
    from public.cursor_forecast_runs r
    where r.quota_date = p_quota_date
      and r.slot = s.slot
      and r.status <> 'released'
  )
  order by s.slot
  limit 1;

  if v_slot is null then
    return;
  end if;

  insert into public.cursor_forecast_runs (
    quota_date,
    slot,
    input_hash,
    bank_code,
    currency_code,
    forecast_range,
    status,
    requested_by
  )
  values (
    p_quota_date,
    v_slot,
    p_input_hash,
    p_bank_code,
    p_currency_code,
    p_forecast_range,
    'reserved',
    p_requested_by
  )
  returning id into v_id;

  run_id := v_id;
  slot := v_slot;
  return next;
end;
$$;

revoke all on function public.claim_cursor_quota_slot(date, text, text, text, text, uuid) from public;
grant execute on function public.claim_cursor_quota_slot(date, text, text, text, text, uuid) to service_role;

create or replace function public.release_cursor_quota_slot(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cursor_forecast_runs
  set status = 'released',
      updated_at = now(),
      error = coalesce(error, 'released before Cursor run started')
  where id = p_run_id
    and status = 'reserved';
  return found;
end;
$$;

revoke all on function public.release_cursor_quota_slot(uuid) from public;
grant execute on function public.release_cursor_quota_slot(uuid) to service_role;
