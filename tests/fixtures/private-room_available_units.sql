CREATE OR REPLACE FUNCTION private.room_available_units(p_room_type_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::integer
  from public.room_units ru
  join public.room_types rt
    on rt.id = ru.room_type_id
  join public.hotels h
    on h.id = rt.hotel_id
  where ru.room_type_id = p_room_type_id
    and ru.is_active = true
    and rt.is_active = true
    and h.is_active = true
    and h.approval_status = 'approved'
    and not exists (
      select 1
      from public.reservations r
      where r.room_unit_id = ru.id
        and r.start_at < p_end_at
        and r.end_at > p_start_at
        and (
          r.status in ('confirmed', 'checked_in')
          or (
            r.status = 'pending_payment'
            and r.payment_status = 'pending'
            and r.hold_expires_at > now()
          )
        )
    )
    and not exists (
      select 1
      from public.reservation_extensions e
      where e.room_unit_id = ru.id
        and e.status = 'pending_payment'
        and e.hold_expires_at > now()
        and e.original_end_at < p_end_at
        and e.new_end_at > p_start_at
    );
$function$

