CREATE OR REPLACE FUNCTION private.room_available_slots(p_room_type_id uuid, p_date date, p_duration_minutes integer, p_minimum_lead_minutes integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with candidates as (
    select
      (
        p_date::timestamp +
        make_interval(mins => 480 + (slot_index * 30))
      ) at time zone 'America/Lima' as start_at
    from generate_series(0, 31) as slot_index
  ),
  valid as (
    select c.start_at
    from candidates c
    where c.start_at >= now() + make_interval(mins => greatest(p_minimum_lead_minutes, 0))
      and ((c.start_at + make_interval(mins => p_duration_minutes)) at time zone 'America/Lima')::date = p_date
      and private.room_available_units(
        p_room_type_id,
        c.start_at,
        c.start_at + make_interval(mins => p_duration_minutes)
      ) > 0
    order by c.start_at
  )
  select coalesce(
    jsonb_agg(to_char(start_at at time zone 'America/Lima', 'HH24:MI') order by start_at),
    '[]'::jsonb
  )
  from valid;
$function$

