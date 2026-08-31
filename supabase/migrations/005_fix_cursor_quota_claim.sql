-- Fix claim_cursor_quota_slot: released rows still occupy unique (quota_date, slot),
-- so a naive INSERT after treating them as free raises cursor_forecast_runs_day_slot.
-- Reclaim released (or stale reserved) rows via UPDATE; INSERT only when the slot has no row.

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
  perform pg_advisory_xact_lock(hashtext('cursor_quota:' || p_quota_date::text));

  -- Prefer reclaiming a released row, or a reserved row stuck for >10 minutes.
  select r.id, r.slot
    into v_id, v_slot
  from public.cursor_forecast_runs r
  where r.quota_date = p_quota_date
    and (
      r.status = 'released'
      or (
        r.status = 'reserved'
        and r.updated_at < now() - interval '10 minutes'
      )
    )
  order by
    case when r.status = 'released' then 0 else 1 end,
    r.slot
  limit 1
  for update skip locked;

  if v_id is not null then
    update public.cursor_forecast_runs
    set input_hash = p_input_hash,
        bank_code = p_bank_code,
        currency_code = p_currency_code,
        forecast_range = p_forecast_range,
        status = 'reserved',
        agent_id = null,
        run_id = null,
        narration = null,
        error = null,
        requested_by = p_requested_by,
        updated_at = now(),
        completed_at = null
    where id = v_id;

    run_id := v_id;
    slot := v_slot;
    return next;
    return;
  end if;

  -- Fresh insert only when no row exists for that day/slot.
  select s.slot
    into v_slot
  from generate_series(1, 2) as s(slot)
  where not exists (
    select 1
    from public.cursor_forecast_runs r
    where r.quota_date = p_quota_date
      and r.slot = s.slot
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
