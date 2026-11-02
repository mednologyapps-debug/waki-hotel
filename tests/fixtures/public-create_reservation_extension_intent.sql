CREATE OR REPLACE FUNCTION public.create_reservation_extension_intent(target_reservation_id uuid, target_rate_plan_id uuid)
 RETURNS reservation_extensions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.reservations;
  rp public.rate_plans;
  target_price numeric;
  target_new_end_at timestamptz;
  result_row public.reservation_extensions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.reservation_extensions
  set
    status = 'expired',
    updated_at = now()
  where reservation_id = target_reservation_id
    and status = 'pending_payment'
    and hold_expires_at <= now();

  select *
    into r
  from public.reservations
  where id = target_reservation_id
  for update;

  if r.id is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if not (
    r.user_id = auth.uid()
    or public.user_can_operate_hotel_reservations(r.hotel_id)
    or public.is_waki_admin()
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if r.status not in ('confirmed','checked_in')
     or r.payment_status <> 'paid' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;

  if r.end_at <= now() then
    raise exception 'RESERVATION_ALREADY_ENDED';
  end if;

  if r.room_unit_id is null then
    raise exception 'ROOM_UNIT_NOT_ASSIGNED';
  end if;

  select *
    into rp
  from public.rate_plans
  where id = target_rate_plan_id
    and room_type_id = r.room_type_id
    and is_active = true;

  if rp.id is null then
    raise exception 'EXTENSION_RATE_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.reservation_extensions e
    where e.reservation_id = r.id
      and e.status = 'pending_payment'
      and e.hold_expires_at > now()
  ) then
    raise exception 'EXTENSION_ALREADY_PENDING';
  end if;

  target_new_end_at :=
    r.end_at + make_interval(mins => rp.duration_minutes);

  if exists (
    select 1
    from public.reservations x
    where x.id <> r.id
      and x.room_unit_id = r.room_unit_id
      and x.start_at < target_new_end_at
      and x.end_at > r.end_at
      and (
        x.status in ('confirmed', 'checked_in')
        or (
          x.status = 'pending_payment'
          and x.payment_status = 'pending'
          and x.hold_expires_at > now()
        )
      )
  ) then
    raise exception 'NO_EXTENSION_AVAILABILITY';
  end if;

  if exists (
    select 1
    from public.reservation_extensions e
    join public.reservations er
      on er.id = e.reservation_id
    where e.reservation_id <> r.id
      and e.room_unit_id = r.room_unit_id
      and e.status = 'pending_payment'
      and e.hold_expires_at > now()
      and e.original_end_at < target_new_end_at
      and e.new_end_at > r.end_at
  ) then
    raise exception 'NO_EXTENSION_AVAILABILITY';
  end if;

  target_price :=
    public.get_effective_rate_price(
      rp.id,
      r.end_at
    );

  insert into public.reservation_extensions (
    reservation_id,
    rate_plan_id,
    room_unit_id,
    original_end_at,
    new_end_at,
    duration_minutes,
    amount,
    currency,
    status,
    hold_expires_at,
    created_by
  )
  values (
    r.id,
    rp.id,
    r.room_unit_id,
    r.end_at,
    target_new_end_at,
    rp.duration_minutes,
    target_price,
    rp.currency,
    'pending_payment',
    now() + interval '10 minutes',
    auth.uid()
  )
  returning * into result_row;

  return result_row;
end;
$function$

