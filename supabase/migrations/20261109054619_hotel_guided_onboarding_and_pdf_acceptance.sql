CREATE OR REPLACE FUNCTION public.get_hotel_onboarding_status(target_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  h public.hotels;
  active_room_count integer := 0;
  active_unit_count integer := 0;
  rooms_without_photos integer := 0;
  rooms_without_rates integer := 0;
  info_complete boolean := false;
  rooms_complete boolean := false;
  photos_complete boolean := false;
  rates_complete boolean := false;
  completed_steps integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not (public.user_can_manage_hotel(target_hotel_id) or public.is_waki_admin()) then
    raise exception 'HOTEL_ACCESS_DENIED';
  end if;

  select *
  into h
  from public.hotels
  where id = target_hotel_id;

  if not found then
    raise exception 'HOTEL_NOT_FOUND';
  end if;

  info_complete :=
    nullif(trim(coalesce(h.name, '')), '') is not null
    and nullif(trim(coalesce(h.description, '')), '') is not null
    and nullif(trim(coalesce(h.address, '')), '') is not null
    and nullif(trim(coalesce(h.district, '')), '') is not null
    and nullif(trim(coalesce(h.province, '')), '') is not null
    and nullif(trim(coalesce(h.department, '')), '') is not null
    and nullif(trim(coalesce(h.phone, '')), '') is not null
    and nullif(trim(coalesce(h.contact_email, '')), '') is not null;

  select count(*)
  into active_room_count
  from public.room_types rt
  where rt.hotel_id = target_hotel_id
    and rt.is_active = true;

  select count(*) into active_unit_count
  from public.room_types rt join public.room_units ru on ru.room_type_id = rt.id
  where rt.hotel_id = target_hotel_id and rt.is_active and ru.is_active;

  rooms_complete := active_unit_count > 0;

  select count(*)
  into rooms_without_photos
  from public.room_types rt
  where rt.hotel_id = target_hotel_id
    and rt.is_active = true
    and not exists (
      select 1
      from public.room_type_images rti
      where rti.room_type_id = rt.id
    );

  photos_complete := active_room_count > 0 and rooms_without_photos = 0;

  select count(*)
  into rooms_without_rates
  from public.room_types rt
  where rt.hotel_id = target_hotel_id
    and rt.is_active = true
    and not exists (
      select 1
      from public.rate_plans rp
      where rp.room_type_id = rt.id
        and rp.is_active = true
    );

  rates_complete := active_room_count > 0 and rooms_without_rates = 0;

  completed_steps :=
    (case when info_complete then 1 else 0 end) +
    (case when rooms_complete then 1 else 0 end) +
    (case when photos_complete then 1 else 0 end) +
    (case when rates_complete then 1 else 0 end);

  return jsonb_build_object(
    'hotel_id', target_hotel_id,
    'info_complete', info_complete,
    'rooms_complete', rooms_complete,
    'photos_complete', photos_complete,
    'rates_complete', rates_complete,
    'active_room_count', active_room_count,
    'active_unit_count', active_unit_count,
    'rooms_without_photos', rooms_without_photos,
    'rooms_without_rates', rooms_without_rates,
    'completed_steps', completed_steps,
    'total_steps', 4,
    'progress_percent', completed_steps * 25,
    'is_ready', info_complete and rooms_complete and photos_complete and rates_complete
  );
end;
$function$;

CREATE OR REPLACE FUNCTION waki_private.approve_hotel_affiliation(p_hotel uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hotels;v_rate numeric;v_code text;
begin
 if auth.uid() is null or not coalesce(public.is_waki_admin(),false) then raise exception 'NOT_AUTHORIZED';end if;
 select * into h from public.hotels where id=p_hotel for update;
 if h.id is null or h.approval_status not in ('draft','pending_review','rejected')
   then raise exception 'INVALID_REVIEW_STATUS';end if;
 v_code:=p_data->>'plan_code';
 if v_code is null or v_code not in ('socio','flexible') then raise exception 'PLAN_REQUIRED';end if;
 if not exists (
   select 1 from public.room_types rt join public.room_units ru on ru.room_type_id=rt.id
   where rt.hotel_id=p_hotel and rt.is_active and ru.is_active
 ) then raise exception 'HOTEL_ACTIVE_UNIT_REQUIRED';end if;
 if h.latitude is null or h.longitude is null
   or h.latitude not between -90 and 90 or h.longitude not between -180 and 180
 then raise exception 'HOTEL_LOCATION_REQUIRED';end if;
 if nullif(trim(p_data->>'agreement_reference'),'') is null then
   p_data:=p_data || jsonb_build_object('agreement_reference',
     coalesce((select signed_contract_path from waki_private.hotel_affiliation_dossiers where hotel_id=p_hotel), ''));
 end if;
 perform waki_private.hotel_affiliation(p_hotel,'review',p_data);
 perform waki_private.assign_commercial_plan(p_hotel,v_code,p_data->>'plan_reason');
 select commission_rate into v_rate from waki_private.hotel_finance_settings where hotel_id=p_hotel;
 update public.hotels set approval_status='approved',is_active=true,approved_by=auth.uid(),
  approved_at=now(),reviewed_at=now(),rejection_reason=null where id=p_hotel;
 update waki_private.hotel_commercial_plans set activated_on=(now() at time zone 'America/Lima')::date
  where hotel_id=p_hotel and activated_on is null;
 perform waki_private.generate_subscription_charges();
 insert into public.hotel_review_events(hotel_id,action,comment,created_by)
  values(p_hotel,'approved','Aprobación con plan comercial y expediente verificado.',auth.uid());
 return jsonb_build_object('ok',true,'plan',v_code,'commission_rate',v_rate);
end $function$;

-- One current PDF per hotel. Once accepted, its exact Storage path and acceptance evidence are immutable.
create table waki_private.hotel_contract_offers (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  document_path text not null unique,
  offered_by uuid not null,
  offered_at timestamptz not null default now(),
  accepted_by uuid,
  accepted_at timestamptz,
  check ((accepted_by is null) = (accepted_at is null))
);
alter table waki_private.hotel_contract_offers enable row level security;
revoke all on waki_private.hotel_contract_offers from public, anon, authenticated;

create function waki_private.hotel_contract_offer(
  p_hotel uuid, p_action text, p_path text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  offer waki_private.hotel_contract_offers;
  h public.hotels;
  is_admin boolean := coalesce(public.is_waki_admin(),false);
  can_manage boolean := coalesce(public.user_can_manage_hotel(p_hotel),false);
begin
  if actor is null or not (is_admin or can_manage) then
    raise exception 'NOT_AUTHORIZED' using errcode='42501';
  end if;
  if p_action = 'read' then
    select * into offer from waki_private.hotel_contract_offers where hotel_id=p_hotel;
  elsif p_action in ('publish','accept') then
    select * into h from public.hotels where id=p_hotel for update;
    if h.id is null or h.approval_status not in ('draft','rejected','pending_review') then
      raise exception 'INVALID_CONTRACT_STATUS';
    end if;
    select * into offer from waki_private.hotel_contract_offers where hotel_id=p_hotel for update;
    if p_action = 'publish' then
      if not is_admin then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
      if offer.accepted_at is not null or exists (
        select 1 from waki_private.hotel_affiliation_dossiers where hotel_id=p_hotel and signed_contract_path is not null
      ) then raise exception 'CONTRACT_ALREADY_ACCEPTED'; end if;
      if p_path is null or p_path !~ ('^'||p_hotel::text||'/contracts/[0-9a-f-]{36}\.pdf$')
        or not exists (select 1 from storage.objects so where so.bucket_id='hotel-affiliations' and so.name=p_path)
      then raise exception 'INVALID_CONTRACT_PDF'; end if;
      insert into waki_private.hotel_contract_offers(hotel_id,document_path,offered_by)
        values(p_hotel,p_path,actor)
      on conflict(hotel_id) do update set document_path=excluded.document_path,
        offered_by=excluded.offered_by,offered_at=now()
      returning * into offer;
    else
      if not can_manage then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
      if offer.hotel_id is null or offer.document_path is distinct from p_path then
        raise exception 'CONTRACT_VERSION_CHANGED';
      end if;
      if offer.accepted_at is null then
        update waki_private.hotel_contract_offers set accepted_at=now(), accepted_by=actor
        where hotel_id=p_hotel returning * into offer;
        insert into waki_private.hotel_affiliation_dossiers(hotel_id,signed_contract_path,signed_contract_at,updated_by)
          values(p_hotel,offer.document_path,offer.accepted_at,actor)
        on conflict(hotel_id) do update set signed_contract_path=excluded.signed_contract_path,
          signed_contract_at=excluded.signed_contract_at,contract_verified_at=null,contract_verified_by=null,
          updated_by=actor,updated_at=now();
      end if;
    end if;
  else
    raise exception 'INVALID_ACTION';
  end if;
  return jsonb_build_object('document_path',offer.document_path,'accepted_at',offer.accepted_at,
    'accepted_by',case when is_admin then offer.accepted_by else null end);
end;
$$;

create function public.hotel_contract_offer(p_hotel uuid, p_action text default 'read', p_path text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select waki_private.hotel_contract_offer(p_hotel,p_action,p_path)
$$;
revoke all on function waki_private.hotel_contract_offer(uuid,text,text),
  public.hotel_contract_offer(uuid,text,text) from public,anon,authenticated;
grant execute on function waki_private.hotel_contract_offer(uuid,text,text),
  public.hotel_contract_offer(uuid,text,text) to authenticated;

CREATE OR REPLACE FUNCTION waki_private.hotel_dossier_control(p_hotel uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hotels;
  doc waki_private.hotel_affiliation_dossiers;
  is_admin boolean := coalesce(public.is_waki_admin(),false);
  can_manage boolean := coalesce(public.user_can_manage_hotel(p_hotel),false);
  f_path text;
  f_ok boolean;
  v_action text := coalesce(p_action,'read');
begin
  if auth.uid() is null or not (is_admin or can_manage) then
    raise exception 'NOT_AUTHORIZED' using errcode='42501';
  end if;
  if v_action in ('attach_contract','attach_bank_document','save_bank','verify') then
    select * into h from public.hotels where id=p_hotel for update;
  else
    select * into h from public.hotels where id=p_hotel;
  end if;
  if h.id is null then raise exception 'HOTEL_NOT_FOUND'; end if;

  if v_action='save_bank' then
    if not is_admin and h.approval_status not in ('draft','pending_review','rejected') then
      raise exception 'CONTACT_WAKI_FOR_BANK_CHANGES';
    end if;
    if length(trim(coalesce(p_data->>'bank_name',''))) not between 3 and 80
      or coalesce(p_data->>'account_type','') not in ('corriente','ahorros')
      or coalesce(p_data->>'account_number','') !~ '^[0-9]{6,30}$'
      or coalesce(p_data->>'cci','') !~ '^[0-9]{20}$'
      or length(trim(coalesce(p_data->>'account_holder',''))) not between 3 and 150
      or coalesce(p_data->>'holder_ruc','') !~ '^[0-9]{11}$' then
      raise exception 'INVALID_BANK_DETAILS';
    end if;
    insert into waki_private.hotel_affiliation_dossiers(
      hotel_id,bank_name,account_type,account_number,cci,account_holder,holder_ruc,updated_by)
    values (p_hotel,trim(p_data->>'bank_name'),p_data->>'account_type',
      p_data->>'account_number',p_data->>'cci',trim(p_data->>'account_holder'),
      p_data->>'holder_ruc',auth.uid())
    on conflict(hotel_id) do update set
      bank_name=excluded.bank_name,account_type=excluded.account_type,
      account_number=excluded.account_number,cci=excluded.cci,
      account_holder=excluded.account_holder,holder_ruc=excluded.holder_ruc,
      bank_verified_at=null,bank_verified_by=null,updated_by=auth.uid(),updated_at=now();
    insert into waki_private.hotel_affiliation_audit(hotel_id,actor_id,action)
    values(p_hotel,auth.uid(),'bank_updated');

  elsif v_action in ('attach_contract','attach_bank_document') then
    if v_action='attach_contract' and exists (
      select 1 from waki_private.hotel_contract_offers where hotel_id=p_hotel
    ) then raise exception 'CONTRACT_ACCEPTANCE_REQUIRED'; end if;
    if not is_admin and h.approval_status not in ('draft','pending_review','rejected') then
      raise exception 'CONTACT_WAKI_FOR_DOCUMENT_CHANGES';
    end if;
    f_path:=p_data->>'path';
    if f_path is null or length(f_path)>220 or
      f_path !~ ('^'||p_hotel::text||'/'||
          case when v_action='attach_contract' then 'contracts' else 'bank' end||
          '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$') then
      raise exception 'INVALID_DOCUMENT_PATH';
    end if;
    select exists(select 1 from storage.objects so
      where so.bucket_id='hotel-affiliations' and so.name=f_path)
    into f_ok;
    if not f_ok then raise exception 'DOCUMENT_NOT_UPLOADED'; end if;
    insert into waki_private.hotel_affiliation_dossiers(hotel_id,updated_by)
    values(p_hotel,auth.uid()) on conflict(hotel_id) do nothing;
    if v_action='attach_contract' then
      update waki_private.hotel_affiliation_dossiers
        set signed_contract_path=f_path,signed_contract_at=now(),
            contract_verified_at=null,contract_verified_by=null,updated_by=auth.uid(),updated_at=now()
      where hotel_id=p_hotel;
    else
      update waki_private.hotel_affiliation_dossiers
        set bank_document_path=f_path,bank_verified_at=null,
            bank_verified_by=null,updated_by=auth.uid(),updated_at=now()
      where hotel_id=p_hotel;
    end if;
    insert into waki_private.hotel_affiliation_audit(hotel_id,actor_id,action)
    values(p_hotel,auth.uid(),case when v_action='attach_contract'
      then 'contract_uploaded' else 'bank_document_uploaded' end);

  elsif v_action='verify' then
    if not is_admin then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
    select * into doc from waki_private.hotel_affiliation_dossiers where hotel_id=p_hotel for update;
    if doc.hotel_id is null or doc.signed_contract_path is null
      or doc.bank_name is null or doc.account_number is null or doc.cci is null then
      raise exception 'AFFILIATION_DOSSIER_INCOMPLETE';
    end if;
    if p_data->>'contract_verified' is distinct from 'true'
       or p_data->>'bank_verified' is distinct from 'true' then
      raise exception 'AFFILIATION_VERIFICATION_REQUIRED';
    end if;
    update waki_private.hotel_affiliation_dossiers
    set contract_verified_by=auth.uid(),contract_verified_at=now(),
      bank_verified_by=auth.uid(),bank_verified_at=now(),
      updated_by=auth.uid(),updated_at=now()
    where hotel_id=p_hotel;
    insert into waki_private.hotel_affiliation_audit(hotel_id,actor_id,action)
    values(p_hotel,auth.uid(),'verified');

  elsif v_action<>'read' then
    raise exception 'INVALID_ACTION';
  end if;

  select * into doc from waki_private.hotel_affiliation_dossiers where hotel_id=p_hotel;
  return jsonb_build_object(
    'hotel_id',p_hotel,
    'bank_name',doc.bank_name,'account_type',doc.account_type,
    'account_number',doc.account_number,'cci',doc.cci,
    'account_holder',doc.account_holder,'holder_ruc',doc.holder_ruc,'currency','PEN',
    'signed_contract_path',doc.signed_contract_path,
    'bank_document_path',doc.bank_document_path,
    'contract_verified',doc.contract_verified_at is not null,
    'bank_verified',doc.bank_verified_at is not null,
    'bank_ready',doc.bank_name is not null and doc.account_number is not null and doc.cci is not null,
    'contract_ready',doc.signed_contract_path is not null,
    'updated_at',doc.updated_at
  );
end $function$;
