-- WAKI Hotel: affiliation, access, room media, and deterministic tariff precedence.


alter policy "WAKI affiliation upload own hotel PDFs" on storage.objects
with check (
  bucket_id = 'hotel-affiliations'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(contracts|bank)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and (public.is_waki_admin() or exists (
    select 1 from public.hotels h
    where h.id::text = split_part(objects.name, '/', 1)
      and h.approval_status in ('draft', 'pending_review', 'rejected')
      and public.user_can_manage_hotel(h.id)
  ))
);
alter policy "WAKI affiliation read own hotel PDFs" on storage.objects
using (
  bucket_id = 'hotel-affiliations'
  and (public.is_waki_admin() or exists (
    select 1 from public.hotels h
    where h.id::text = split_part(objects.name, '/', 1)
      and public.user_can_manage_hotel(h.id)
  ))
);

alter policy "Hotel staff manage own room image storage" on storage.objects
using (bucket_id = 'room-images' and exists (
  select 1 from public.hotels h
  where h.id::text = split_part(objects.name, '/', 1)
    and public.user_can_manage_hotel(h.id)
))
with check (bucket_id = 'room-images' and exists (
  select 1 from public.hotels h
  where h.id::text = split_part(objects.name, '/', 1)
    and public.user_can_manage_hotel(h.id)
));

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'room-images';

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_security_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if
    old.role is distinct from new.role
    or old.account_status is distinct from new.account_status
  then
    if not (
      public.is_waki_super_admin()
      or auth.role() = 'service_role'
      or (
        old.role = 'user'
        and new.role = 'hotel'
        and old.account_status = new.account_status
        and (exists (
          select 1
          from public.sales_hotel_onboarding_cases oc
          where oc.claimed_by = auth.uid()
            and oc.status = 'claimed'
        ) or exists (
          select 1
          from waki_private.quick_hotel_invitations qi
          where qi.claimed_by = auth.uid()
            and qi.status = 'claimed'
        ))
      )
    ) then
      raise exception
        'Only a WAKI super admin, trusted backend service, or valid hotel invite claim can modify role or account status';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_quick_hotel_invitation(p_token uuid, p_legal_name text, p_ruc text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid();
 invite waki_private.quick_hotel_invitations;
 user_email text;
 current_role text;
 legal_clean text:=nullif(trim(coalesce(p_legal_name,'')),'');
 ruc_clean text:=regexp_replace(coalesce(p_ruc,''),'[^0-9]','','g');
 phone_clean text:=nullif(trim(coalesce(p_phone,'')),'');
 brand_id uuid;
 hotel_id uuid;
 slug text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 select lower(u.email) into user_email from auth.users u
 where u.id=uid and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
 if user_email is null then raise exception 'EMAIL_VERIFICATION_REQUIRED';end if;
 select p.role into current_role from public.profiles p where p.id=uid and p.account_status='active';
 if current_role not in ('user','hotel') or current_role is null then
  raise exception 'ACCOUNT_ROLE_CONFLICT';end if;
 if legal_clean is null or length(legal_clean)>160 then raise exception 'LEGAL_NAME_REQUIRED';end if;
 if length(ruc_clean)<>11 then raise exception 'VALID_RUC_REQUIRED';end if;
 if phone_clean is null or length(phone_clean)>40 then raise exception 'PHONE_REQUIRED';end if;

 select * into invite from waki_private.quick_hotel_invitations q
 where q.invite_token=p_token for update;
 if invite.id is null then raise exception 'INVITE_NOT_FOUND';end if;
 if invite.status='claimed' then
  if invite.claimed_by=uid then
   return jsonb_build_object('status','claimed','hotel_id',invite.claimed_hotel_id);
  end if;
  raise exception 'INVITE_ALREADY_CLAIMED';
 end if;
 if invite.status<>'pending' or invite.expires_at<=now() then
  raise exception 'INVITE_EXPIRED_OR_CANCELLED';end if;
 if user_email<>lower(invite.contact_email) then
  raise exception 'INVITE_EMAIL_MISMATCH';end if;
 if exists(select 1 from public.hotel_brands b where b.ruc=ruc_clean) then
  raise exception 'RUC_ALREADY_REGISTERED';end if;

 insert into public.hotel_brands(
  commercial_name,legal_name,ruc,billing_email,contact_email,
  phone,approval_status
 ) values(invite.hotel_name,legal_clean,ruc_clean,
  invite.contact_email,invite.contact_email,phone_clean,'draft')
 returning id into brand_id;

 slug:=trim(both '-' from regexp_replace(
   lower(invite.hotel_name),'[^a-z0-9]+','-','g'))
   ||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10);

 insert into public.hotels(
  brand_id,name,slug,address,district,province,department,country_code,
  phone,contact_email,approval_status,is_active
 ) values(
  brand_id,invite.hotel_name,slug,'Dirección por completar',
  'Por completar','Por completar','Por completar','PE',
  phone_clean,invite.contact_email,'draft',false)
 returning id into hotel_id;

 insert into public.hotel_staff(hotel_id,user_id,staff_role,is_active)
 values(hotel_id,uid,'admin',true);

 update waki_private.quick_hotel_invitations q set
  status='claimed',claimed_by=uid,claimed_hotel_id=hotel_id,updated_at=now()
 where q.id=invite.id;

 update public.profiles p set
  full_name=coalesce(nullif(trim(p.full_name),''),invite.representative_name),
  phone=coalesce(nullif(trim(p.phone),''),phone_clean),
  role='hotel',updated_at=now()
 where p.id=uid;

 return jsonb_build_object('status','claimed','hotel_id',hotel_id,'brand_id',brand_id);
end $function$;

CREATE OR REPLACE FUNCTION waki_private.verify_hotel_reservation_qr(target_qr_token text, target_documents_verified boolean, expected_reservation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.reservations;
  v_checked_at timestamptz;
  v_room_name text;
  v_unit_name text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if nullif(trim(coalesce(target_qr_token, '')), '') is null then
    raise exception 'QR_TOKEN_REQUIRED';
  end if;

  select *
    into r
  from public.reservations
  where qr_token = trim(target_qr_token)
  for update;

  if r.id is null then
    raise exception 'QR_NOT_FOUND';
  end if;

  if not (
    public.user_can_scan_hotel(r.hotel_id)
    or public.is_waki_admin()
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1 from public.hotels h
    where h.id = r.hotel_id and h.is_active and h.approval_status = 'approved'
  ) then
    raise exception 'HOTEL_NOT_OPERATIONAL';
  end if;

  if expected_reservation_id is not null and r.id <> expected_reservation_id then
    raise exception 'QR_RESERVATION_MISMATCH';
  end if;
  if expected_reservation_id is not null and not (
    public.user_can_operate_hotel_reservations(r.hotel_id) or public.is_waki_admin()
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  v_checked_at := clock_timestamp();
  if r.start_at > v_checked_at then
    raise exception 'RESERVATION_NOT_STARTED';
  end if;
  if r.status <> 'confirmed'
     or r.payment_status <> 'paid' then
    raise exception 'RESERVATION_NOT_VALID_FOR_ACCESS';
  end if;

  if r.end_at <= v_checked_at then
    raise exception 'RESERVATION_ALREADY_ENDED';
  end if;

  if r.qr_expires_at is not null
     and r.qr_expires_at <= v_checked_at then
    raise exception 'QR_EXPIRED';
  end if;

  update public.reservations
  set
    access_status = 'verified',
    access_verified_at = coalesce(access_verified_at, v_checked_at),
    access_verified_by = coalesce(access_verified_by, auth.uid()),
    checked_in_at = coalesce(checked_in_at, v_checked_at),
    documents_verified_at = case
      when target_documents_verified
        then coalesce(documents_verified_at, v_checked_at)
      else documents_verified_at
    end,
    documents_verified_by = case
      when target_documents_verified
        then coalesce(documents_verified_by, auth.uid())
      else documents_verified_by
    end
  where id = r.id
  returning * into r;

  select rt.name
    into v_room_name
  from public.room_types rt
  where rt.id = r.room_type_id;

  if r.room_unit_id is not null then
    select coalesce(ru.display_name, ru.unit_code)
      into v_unit_name
    from public.room_units ru
    where ru.id = r.room_unit_id;
  end if;

  return jsonb_build_object(
    'reservation_id', r.id,
    'booking_code', r.booking_code,
    'guest_name', r.guest_name,
    'room_type_name', v_room_name,
    'room_unit_name', v_unit_name,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'access_status', r.access_status,
    'access_verified_at', r.access_verified_at,
    'documents_verified', (r.documents_verified_at is not null),
    'documents_verified_at', r.documents_verified_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.hotel_preview_reservation_by_qr(target_qr_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.reservations;
  v_room_name text;
  v_unit_name text;
  v_validation_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if nullif(trim(coalesce(target_qr_token, '')), '') is null then
    raise exception 'QR_TOKEN_REQUIRED';
  end if;

  select *
    into r
  from public.reservations
  where qr_token = trim(target_qr_token)
  limit 1;

  if r.id is null then
    raise exception 'QR_NOT_FOUND';
  end if;

  if not (
    public.user_can_scan_hotel(r.hotel_id)
    or public.is_waki_admin()
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1 from public.hotels h
    where h.id = r.hotel_id and h.is_active and h.approval_status = 'approved'
  ) then
    raise exception 'HOTEL_NOT_OPERATIONAL';
  end if;

  select rt.name
    into v_room_name
  from public.room_types rt
  where rt.id = r.room_type_id;

  if r.room_unit_id is not null then
    select coalesce(ru.display_name, ru.unit_code)
      into v_unit_name
    from public.room_units ru
    where ru.id = r.room_unit_id;
  end if;

  v_validation_status :=
    case
      when r.access_status = 'verified' then 'already_verified'
      when r.end_at <= now() then 'ended'
      when r.start_at > now() then 'not_started'
      when r.status <> 'confirmed' then 'not_confirmed'
      when r.payment_status <> 'paid' then 'not_paid'
      when r.qr_expires_at is not null and r.qr_expires_at <= now() then 'expired'
      else 'valid'
    end;

  return jsonb_build_object(
    'reservation_id', r.id,
    'booking_code', r.booking_code,
    'guest_name', r.guest_name,
    'room_type_name', v_room_name,
    'room_unit_name', v_unit_name,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'status', r.status,
    'payment_status', r.payment_status,
    'access_status', r.access_status,
    'access_verified_at', r.access_verified_at,
    'documents_verified', (r.documents_verified_at is not null),
    'documents_verified_at', r.documents_verified_at,
    'validation_status', v_validation_status
  );
end;
$function$;


create or replace function public.hotel_verify_reservation_access_safe(
  target_qr_token text, target_documents_verified boolean default true
) returns jsonb language sql security invoker set search_path = '' as $$
  select waki_private.verify_hotel_reservation_qr(target_qr_token, target_documents_verified, null)
$$;

create function public.hotel_verify_reservation_for_detail(
  target_qr_token text, target_documents_verified boolean, target_reservation_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if target_reservation_id is null then
    raise exception 'QR_RESERVATION_MISMATCH';
  end if;
  return waki_private.verify_hotel_reservation_qr(
    target_qr_token, target_documents_verified, target_reservation_id
  );
end;
$$;

revoke execute on function public.hotel_verify_reservation_access(text, boolean) from public, anon, authenticated;
revoke execute on function public.hotel_verify_reservation_access_safe(text, boolean),
  public.hotel_verify_reservation_for_detail(text, boolean, uuid),
  waki_private.verify_hotel_reservation_qr(text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.hotel_verify_reservation_access_safe(text, boolean),
  public.hotel_verify_reservation_for_detail(text, boolean, uuid),
  waki_private.verify_hotel_reservation_qr(text, boolean, uuid) to authenticated;


-- Keep one cover per room category. Repair duplicate legacy covers first.
with ranked as (
  select id, row_number() over (
    partition by room_type_id order by display_order, created_at, id
  ) as position
  from public.room_type_images where is_cover
)
update public.room_type_images i set is_cover = false
from ranked where i.id = ranked.id and ranked.position > 1;

create unique index room_type_images_one_cover_idx
  on public.room_type_images(room_type_id) where is_cover;

create function public.hotel_manage_room_photo(
  target_room_type uuid, target_image uuid, target_action text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  room_hotel uuid;
  photo public.room_type_images;
  next_image uuid;
begin
  select rt.hotel_id into room_hotel from public.room_types rt
  where rt.id = target_room_type
    and (public.user_can_manage_hotel(rt.hotel_id) or public.is_waki_admin())
  for update;
  if room_hotel is null then raise exception 'ROOM_PHOTO_NOT_AUTHORIZED'; end if;

  select * into photo from public.room_type_images
  where id = target_image and room_type_id = target_room_type for update;
  if not found then raise exception 'ROOM_PHOTO_NOT_FOUND'; end if;

  if target_action = 'cover' then
    update public.room_type_images set is_cover = false
    where room_type_id = target_room_type and is_cover and id <> target_image;
    update public.room_type_images set is_cover = true, display_order = 0 where id = target_image;
    return null;
  elsif target_action = 'delete' then
    delete from public.room_type_images where id = target_image;
    if photo.is_cover then
      select id into next_image from public.room_type_images
      where room_type_id = target_room_type order by display_order, created_at, id limit 1;
      update public.room_type_images set is_cover = true, display_order = 0 where id = next_image;
    end if;
    return photo.storage_path;
  end if;
  raise exception 'ROOM_PHOTO_INVALID_ACTION';
end;
$$;

revoke execute on function public.hotel_manage_room_photo(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.hotel_manage_room_photo(uuid, uuid, text) to authenticated;

CREATE OR REPLACE FUNCTION public.get_effective_rate_price(target_rate_plan_id uuid, target_start_at timestamp with time zone)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  base_amount numeric;
  special_amount numeric;
  hotel_tz text;
  local_start timestamp;
  local_date date;
  local_time time;
  iso_dow smallint;
begin
  select rp.base_price, h.timezone
    into base_amount, hotel_tz
  from public.rate_plans rp
  join public.room_types rt on rt.id = rp.room_type_id
  join public.hotels h on h.id = rt.hotel_id
  where rp.id = target_rate_plan_id;

  if base_amount is null then
    raise exception 'RATE_PLAN_NOT_FOUND';
  end if;

  local_start := target_start_at at time zone coalesce(hotel_tz, 'America/Lima');
  local_date := local_start::date;
  local_time := local_start::time;
  iso_dow := extract(isodow from local_start)::smallint;

  select rr.price
    into special_amount
  from public.rate_rules rr
  where rr.rate_plan_id = target_rate_plan_id
    and rr.is_active = true
    and (rr.valid_from is null or local_date >= rr.valid_from)
    and (rr.valid_until is null or local_date <= rr.valid_until)
    and (rr.days_of_week is null or iso_dow = any(rr.days_of_week))
    and (
      rr.start_time is null
      or rr.end_time is null
      or (
        rr.start_time <= rr.end_time
        and local_time >= rr.start_time
        and local_time < rr.end_time
      )
      or (
        rr.start_time > rr.end_time
        and (
          local_time >= rr.start_time
          or local_time < rr.end_time
        )
      )
    )
  order by rr.priority desc, rr.created_at desc, rr.id desc
  limit 1;

  return coalesce(special_amount, base_amount);
end;
$function$;

