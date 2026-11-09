-- Avoid collision with PostgreSQL's CURRENT_ROLE in the quick invitation flow.
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
 v_profile_role text;
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
 select p.role into v_profile_role from public.profiles p where p.id=uid and p.account_status='active';
 if v_profile_role not in ('user','hotel') or v_profile_role is null then
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
