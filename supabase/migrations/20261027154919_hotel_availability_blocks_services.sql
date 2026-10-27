-- Operational holds are separate from reservations/payments and never generate revenue.
create schema if not exists waki_private;
create table waki_private.room_blocks(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
 room_unit_id uuid not null references public.room_units(id), start_at timestamptz not null,end_at timestamptz not null,
 reason text not null check(reason in ('walk_in','maintenance','cleaning','other')),notes text not null default '' check(length(notes)<=300),
 created_by uuid not null,created_at timestamptz not null default now(),cancelled_at timestamptz,cancelled_by uuid,
 check(end_at>start_at),check(end_at-start_at<=interval '30 days')
);
alter table waki_private.room_blocks enable row level security;
revoke all on waki_private.room_blocks from public,anon,authenticated;
create index room_blocks_active_unit_idx on waki_private.room_blocks(room_unit_id,start_at,end_at) where cancelled_at is null;
create index room_blocks_hotel_period_idx on waki_private.room_blocks(hotel_id,start_at,end_at) where cancelled_at is null;
alter table public.hotels add column featured_services text[] not null default '{}';
alter table public.hotels add constraint valid_featured_services check(cardinality(featured_services)<=10 and featured_services <@ array['wifi','parking','air_conditioning','hot_water','tv','restaurant','room_service','accessible','jacuzzi','elevator']::text[] and array_position(featured_services,null) is null);

create function waki_private.hotel_operational_access(h uuid,manage boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_waki_admin() or public.get_hotel_staff_role(h)=any(case when manage then array['admin'] else array['admin','reception'] end))
$$;
create function waki_private.hotel_operations_read(p_hotel uuid,p_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h uuid:=p_hotel;start_day timestamptz:=coalesce(p_day,(now() at time zone 'America/Lima')::date)::timestamp at time zone 'America/Lima';v_hotel jsonb;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED';end if;
 if h is null then select hotel_id into h from public.hotel_staff where user_id=auth.uid() and is_active order by created_at,hotel_id limit 1;end if;
 if not coalesce(waki_private.hotel_operational_access(h),false) then raise exception 'NOT_AUTHORIZED';end if;
 select jsonb_build_object('id',id,'name',name,'district',district,'featured_services',featured_services,'can_manage_services',waki_private.hotel_operational_access(h,true)) into v_hotel from public.hotels where id=h;
 return jsonb_build_object('hotel',v_hotel,
 'units',coalesce((select jsonb_agg(jsonb_build_object('id',ru.id,'room_type_id',rt.id,'room_type',rt.name,'code',ru.unit_code,'name',ru.display_name) order by rt.display_order,ru.display_order,ru.unit_code) from public.room_units ru join public.room_types rt on rt.id=ru.room_type_id where rt.hotel_id=h and ru.is_active and rt.is_active),'[]'),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'room_unit_id',b.room_unit_id,'start_at',b.start_at,'end_at',b.end_at,'reason',b.reason,'notes',b.notes) order by b.start_at,b.id) from waki_private.room_blocks b where b.hotel_id=h and b.cancelled_at is null and b.start_at<start_day+interval '1 day' and b.end_at>start_day),'[]'),
 'reservations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'room_unit_id',r.room_unit_id,'start_at',r.start_at,'end_at',r.end_at,'code',r.booking_code,'status',r.status) order by r.start_at,r.id) from public.reservations r where r.hotel_id=h and r.start_at<start_day+interval '1 day' and r.end_at>start_day and (r.status in ('confirmed','checked_in') or (r.status='pending_payment' and r.payment_status='pending' and r.hold_expires_at>now()))),'[]'),
 'extensions',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'room_unit_id',e.room_unit_id,'start_at',e.original_end_at,'end_at',e.new_end_at,'status','pending_payment') order by e.original_end_at,e.id) from public.reservation_extensions e join public.reservations r on r.id=e.reservation_id where r.hotel_id=h and e.status='pending_payment' and e.hold_expires_at>now() and e.original_end_at<start_day+interval '1 day' and e.new_end_at>start_day),'[]'));
end $$;

create function waki_private.hotel_operations_action(p_hotel uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare unit record;t uuid;v_start timestamptz;v_end timestamptz;v_id uuid;ids uuid[];n integer:=0;b waki_private.room_blocks;services text[];
begin
 if not coalesce(waki_private.hotel_operational_access(p_hotel),false) then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
 if p_action='services' then
  if not waki_private.hotel_operational_access(p_hotel,true) then raise exception 'NOT_AUTHORIZED';end if;
  if jsonb_typeof(p_data->'services') is distinct from 'array' then raise exception 'INVALID_SERVICES';end if;
  select coalesce(array_agg(distinct v),'{}') into services from jsonb_array_elements_text(p_data->'services') v;
  if cardinality(services)>10 or not services <@ array['wifi','parking','air_conditioning','hot_water','tv','restaurant','room_service','accessible','jacuzzi','elevator']::text[] or array_position(services,null) is not null then raise exception 'INVALID_SERVICES';end if;
  update public.hotels set featured_services=services,updated_at=now() where id=p_hotel;
  return jsonb_build_object('ok',true);
 elsif p_action='block' then
  if jsonb_typeof(p_data->'units') is distinct from 'array' then raise exception 'INVALID_UNITS';end if;
  if jsonb_array_length(p_data->'units') not between 1 and 100 then raise exception 'INVALID_UNITS';end if;
  select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p_data->'units') v;
  v_start:=(p_data->>'start_at')::timestamptz;v_end:=(p_data->>'end_at')::timestamptz;
  if coalesce(cardinality(ids),0) not between 1 and 100 or v_start is null or v_end is null or v_end<=v_start or v_end<=now() or v_end-v_start>interval '30 days' or v_start<now()-interval '10 minutes' or v_start>now()+interval '365 days' then raise exception 'INVALID_PERIOD';end if;
  if p_data->>'reason' is null or p_data->>'reason' not in ('walk_in','maintenance','cleaning','other') or length(coalesce(p_data->>'notes',''))>300 then raise exception 'INVALID_REASON';end if;
  -- Same room-type lock/order as WAKI checkout; prevents a walk-in hold racing a booking.
  for t in select distinct rt.id from public.room_units ru join public.room_types rt on rt.id=ru.room_type_id where ru.id=any(ids) and rt.hotel_id=p_hotel order by rt.id loop perform pg_advisory_xact_lock(hashtextextended(t::text,0));end loop;
  if (select count(*) from public.room_units ru join public.room_types rt on rt.id=ru.room_type_id where ru.id=any(ids) and rt.hotel_id=p_hotel and ru.is_active and rt.is_active)<>cardinality(ids) then raise exception 'INVALID_UNITS';end if;
  for unit in select ru.id,ru.room_type_id from public.room_units ru where ru.id=any(ids) order by ru.id loop
   if exists(select 1 from waki_private.room_blocks x where x.room_unit_id=unit.id and x.cancelled_at is null and x.start_at<v_end and x.end_at>v_start)
   or exists(select 1 from public.reservations r where (r.room_unit_id=unit.id or (r.room_unit_id is null and r.room_type_id=unit.room_type_id)) and r.start_at<v_end and r.end_at>v_start and (r.status in ('confirmed','checked_in') or (r.status='pending_payment' and r.payment_status='pending' and r.hold_expires_at>now())))
   or exists(select 1 from public.reservation_extensions e where e.room_unit_id=unit.id and e.status='pending_payment' and e.hold_expires_at>now() and e.original_end_at<v_end and e.new_end_at>v_start) then raise exception 'ROOM_PERIOD_CONFLICT';end if;
   insert into waki_private.room_blocks(hotel_id,room_unit_id,start_at,end_at,reason,notes,created_by) values(p_hotel,unit.id,v_start,v_end,p_data->>'reason',trim(coalesce(p_data->>'notes','')),auth.uid());n:=n+1;
  end loop;
  return jsonb_build_object('ok',true,'count',n);
 elsif p_action='release' then
  select * into b from waki_private.room_blocks where id=(p_data->>'id')::uuid and hotel_id=p_hotel;
  if b.id is null then raise exception 'BLOCK_NOT_FOUND';end if;
  select room_type_id into t from public.room_units where id=b.room_unit_id;
  perform pg_advisory_xact_lock(hashtextextended(t::text,0));
  update waki_private.room_blocks set cancelled_at=now(),cancelled_by=auth.uid() where id=b.id and cancelled_at is null;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end $$;

-- Defense in depth: also catches extensions, late payment confirmations and reassignment.
create function waki_private.guard_operational_block() returns trigger language plpgsql security definer set search_path='' as $$
declare t uuid;s timestamptz;e timestamptz;active boolean;
begin
 if tg_table_name='reservations' then s:=new.start_at;e:=new.end_at;active:=new.status in ('confirmed','checked_in') or (new.status='pending_payment' and new.payment_status='pending' and new.hold_expires_at>now());
 else s:=new.original_end_at;e:=new.new_end_at;active:=new.status='pending_payment' and new.hold_expires_at>now();end if;
 if active and new.room_unit_id is not null then
  select room_type_id into t from public.room_units where id=new.room_unit_id;
  perform pg_advisory_xact_lock(hashtextextended(t::text,0));
  if exists(select 1 from waki_private.room_blocks b where b.room_unit_id=new.room_unit_id and b.cancelled_at is null and b.start_at<e and b.end_at>s) then raise exception 'ROOM_INVENTORY_UNAVAILABLE';end if;
 end if;
 return new;
end $$;
create trigger operational_block_reservation_guard before insert or update of start_at,end_at,room_unit_id,status,payment_status on public.reservations for each row execute function waki_private.guard_operational_block();
create trigger operational_block_extension_guard before insert or update of original_end_at,new_end_at,room_unit_id,status on public.reservation_extensions for each row execute function waki_private.guard_operational_block();

create function public.hotel_operations_read(p_hotel uuid default null,p_day date default null) returns jsonb language sql security invoker set search_path='' as $$select waki_private.hotel_operations_read(p_hotel,p_day)$$;
create function public.hotel_operations_action(p_hotel uuid,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select waki_private.hotel_operations_action(p_hotel,p_action,p_data)$$;
revoke all on function waki_private.hotel_operational_access(uuid,boolean),waki_private.hotel_operations_read(uuid,date),waki_private.hotel_operations_action(uuid,text,jsonb),waki_private.guard_operational_block(),public.hotel_operations_read(uuid,date),public.hotel_operations_action(uuid,text,jsonb) from public,anon,authenticated;
grant usage on schema waki_private to authenticated;
grant execute on function waki_private.hotel_operational_access(uuid,boolean),waki_private.hotel_operations_read(uuid,date),waki_private.hotel_operations_action(uuid,text,jsonb),public.hotel_operations_read(uuid,date),public.hotel_operations_action(uuid,text,jsonb) to authenticated;

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
    and not exists(select 1 from waki_private.room_blocks b where b.room_unit_id=ru.id and b.cancelled_at is null and b.start_at<p_end_at and b.end_at>p_start_at)
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

;
CREATE OR REPLACE FUNCTION public.create_reservation_intent(target_rate_plan_id uuid, target_start_at timestamp with time zone, target_guest_name text DEFAULT NULL::text, target_guest_phone text DEFAULT NULL::text, target_guest_email text DEFAULT NULL::text, target_notes text DEFAULT NULL::text)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare current_user_id uuid; profile_name text; profile_phone text; target_room_type_id uuid; target_hotel_id uuid; target_duration integer; target_rate_name text; target_currency text; target_price numeric; target_end_at timestamptz; selected_room_unit_id uuid; result_row public.reservations; begin current_user_id:=auth.uid(); if current_user_id is null then raise exception 'AUTH_REQUIRED'; end if; if target_start_at < now()-interval '2 minutes' then raise exception 'START_TIME_IN_PAST'; end if; select rp.room_type_id,rt.hotel_id,rp.duration_minutes,rp.name,rp.currency into target_room_type_id,target_hotel_id,target_duration,target_rate_name,target_currency from public.rate_plans rp join public.room_types rt on rt.id=rp.room_type_id join public.hotels h on h.id=rt.hotel_id where rp.id=target_rate_plan_id and rp.is_active=true and rt.is_active=true and h.approval_status='approved' and h.is_active=true; if target_room_type_id is null then raise exception 'RATE_NOT_BOOKABLE'; end if; target_end_at:=target_start_at+make_interval(mins=>target_duration); perform pg_advisory_xact_lock(hashtextextended(target_room_type_id::text,0)); select ru.id into selected_room_unit_id from public.room_units ru where ru.room_type_id=target_room_type_id and ru.is_active=true and not exists(select 1 from waki_private.room_blocks b where b.room_unit_id=ru.id and b.cancelled_at is null and b.start_at<target_end_at and b.end_at>target_start_at) and not exists (select 1 from public.reservations r where r.room_unit_id=ru.id and r.start_at<target_end_at and r.end_at>target_start_at and (r.status in ('confirmed','checked_in') or (r.status='pending_payment' and r.payment_status='pending' and r.hold_expires_at>now()))) and not exists (select 1 from public.reservation_extensions e where e.room_unit_id=ru.id and e.status='pending_payment' and e.hold_expires_at>now() and e.original_end_at<target_end_at and e.new_end_at>target_start_at) order by ru.display_order,ru.created_at limit 1; if selected_room_unit_id is null then raise exception 'ROOM_INVENTORY_UNAVAILABLE'; end if; select full_name,phone into profile_name,profile_phone from public.profiles where id=current_user_id; target_price:=public.get_effective_rate_price(target_rate_plan_id,target_start_at); insert into public.reservations(user_id,hotel_id,room_type_id,room_unit_id,rate_plan_id,guest_name,guest_phone,guest_email,start_at,end_at,duration_minutes,rate_name,unit_price,subtotal,total_amount,currency,status,payment_status,hold_expires_at,notes) values(current_user_id,target_hotel_id,target_room_type_id,selected_room_unit_id,target_rate_plan_id,coalesce(nullif(trim(target_guest_name),''),nullif(trim(profile_name),''),'Huésped WAKI'),coalesce(nullif(trim(target_guest_phone),''),nullif(trim(profile_phone),'')),nullif(trim(target_guest_email),''),target_start_at,target_end_at,target_duration,target_rate_name,target_price,target_price,target_price,target_currency,'pending_payment','pending',now()+interval '10 minutes',nullif(trim(target_notes),'')) returning * into result_row; return result_row; end; $function$

;
