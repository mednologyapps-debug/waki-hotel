import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const db = new PGlite(),
  id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema waki_private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table profiles(id uuid primary key,role text,account_status text,full_name text,phone text);
create table hotels(id uuid primary key,name text,district text,is_active boolean default true,approval_status text default 'approved',updated_at timestamptz default now());
create table hotel_staff(hotel_id uuid,user_id uuid,staff_role text,is_active boolean default true,created_at timestamptz default now());
create table room_types(id uuid primary key,hotel_id uuid,name text,is_active boolean default true,display_order integer default 0);
create table room_units(id uuid primary key,room_type_id uuid,unit_code text,display_name text,is_active boolean default true,display_order integer default 0,created_at timestamptz default now());
create table rate_plans(id uuid primary key,room_type_id uuid,duration_minutes integer,name text,currency text,is_active boolean default true,base_price numeric);
create table reservations(id uuid primary key default gen_random_uuid(),user_id uuid,hotel_id uuid,room_type_id uuid,room_unit_id uuid,rate_plan_id uuid,booking_code text default 'WAKI-TEST',guest_name text,guest_phone text,guest_email text,start_at timestamptz,end_at timestamptz,duration_minutes integer,rate_name text,unit_price numeric,subtotal numeric,total_amount numeric,currency text,status text,payment_status text,hold_expires_at timestamptz,notes text);
create table reservation_extensions(id uuid primary key default gen_random_uuid(),reservation_id uuid,room_unit_id uuid,rate_plan_id uuid,original_end_at timestamptz,new_end_at timestamptz,duration_minutes integer,amount numeric,currency text,status text,hold_expires_at timestamptz,created_by uuid,updated_at timestamptz default now());
create function public.is_waki_admin() returns boolean language sql as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and account_status='active')$$;
create function public.get_hotel_staff_role(h uuid) returns text language sql as $$select s.staff_role from public.hotel_staff s join public.profiles p on p.id=s.user_id where s.hotel_id=h and s.user_id=auth.uid() and s.is_active and p.account_status='active' limit 1$$;
create function public.user_can_operate_hotel_reservations(h uuid) returns boolean language sql as $$select coalesce(public.get_hotel_staff_role(h) in ('admin','reception'),false)$$;
create function public.get_effective_rate_price(r uuid,s timestamptz) returns numeric language sql as $$select base_price from public.rate_plans where id=r$$;
`);
for (const name of [
  "private-room_available_units",
  "private-room_available_slots",
  "public-create_reservation_extension_intent",
])
  await db.exec(
    await fs.readFile(
      new URL("./fixtures/" + name + ".sql", import.meta.url),
      "utf8",
    ),
  );
await db.exec(
  await fs.readFile(
    new URL(
      "../supabase/migrations/20261027154919_hotel_availability_blocks_services.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const n of [1, 2, 3, 4])
  await db.query(
    "insert into profiles(id,role,account_status)values($1,$2,$3)",
    [id(n), "user", "active"],
  );
for (const n of [10, 20])
  await db.query("insert into hotels(id,name)values($1,$2)", [
    id(n),
    "Hotel " + n,
  ]);
for (const [n, role] of [
  [1, "admin"],
  [2, "reception"],
  [3, "scanner"],
])
  await db.query(
    "insert into hotel_staff(hotel_id,user_id,staff_role)values($1,$2,$3)",
    [id(10), id(n), role],
  );
await db.query("insert into room_types(id,hotel_id,name)values($1,$2,$3)", [
  id(100),
  id(10),
  "Doble",
]);
for (const n of [101, 102])
  await db.query(
    "insert into room_units(id,room_type_id,unit_code,display_order)values($1,$2,$3,$4)",
    [id(n), id(100), String(n), n],
  );
await db.query(
  "insert into rate_plans(id,room_type_id,duration_minutes,name,currency,base_price)values($1,$2,60,'Una hora','PEN',50)",
  [id(200), id(100)],
);
const login = async (n) => db.exec(`set request.jwt.claim.sub='${id(n)}'`),
  read = async () =>
    (await db.query("select public.hotel_operations_read() data")).rows[0].data;
const action = async (a, data = {}, h = id(10)) =>
  (
    await db.query("select public.hotel_operations_action($1,$2,$3) data", [
      h,
      a,
      JSON.stringify(data),
    ])
  ).rows[0].data;
const start = new Date(Date.now() + 86400000),
  end = new Date(start.getTime() + 2 * 3600000),
  startIso = start.toISOString(),
  endIso = end.toISOString();
const args = {
  units: [id(101)],
  start_at: startIso,
  end_at: endIso,
  reason: "walk_in",
};
await assert.rejects(read(), /NOT_AUTHORIZED/);
await login(3);
await assert.rejects(read(), /NOT_AUTHORIZED/);
await login(1);
assert.equal((await read()).units.length, 2);
await action("services", { services: ["parking", "wifi", "wifi"] });
assert.deepEqual((await read()).hotel.featured_services, ["parking", "wifi"]);
await assert.rejects(
  action("services", { services: ["free_booking"] }),
  /INVALID_SERVICES/,
);
await login(2);
await assert.rejects(
  action("services", { services: ["wifi"] }),
  /NOT_AUTHORIZED/,
);
await assert.rejects(action("block", args, id(20)), /NOT_AUTHORIZED/);
await action("block", args);
const available = async (s = startIso, e = endIso) =>
  (
    await db.query("select private.room_available_units($1,$2,$3) n", [
      id(100),
      s,
      e,
    ])
  ).rows[0].n;
assert.equal(await available(), 1);
await assert.rejects(
  action("block", { ...args, units: [id(101), id(102)] }),
  /ROOM_PERIOD_CONFLICT/,
);
assert.equal(
  (await db.query("select count(*) n from waki_private.room_blocks")).rows[0].n,
  1,
);
// Checkout must choose the second unit instead of failing on the blocked first unit.
await login(4);
const booking = (
  await db.query("select public.create_reservation_intent($1,$2) r", [
    id(200),
    startIso,
  ])
).rows[0].r;
const stored = (await db.query("select * from reservations")).rows[0];
assert.equal(stored.room_unit_id, id(102));
assert.ok(booking);
assert.equal(await available(), 0);
await login(2);
await assert.rejects(
  action("block", { ...args, units: [id(102)] }),
  /ROOM_PERIOD_CONFLICT/,
);
// Touching endpoints are allowed; midnight uses a single continuous instant interval.
assert.equal(
  await available(endIso, new Date(end.getTime() + 3600000).toISOString()),
  2,
);
await assert.rejects(
  db.query(
    "insert into reservations(room_unit_id,room_type_id,status,payment_status,start_at,end_at)values($1,$2,'confirmed','paid',$3,$4)",
    [id(101), id(100), startIso, endIso],
  ),
  /ROOM_INVENTORY_UNAVAILABLE/,
);
await assert.rejects(
  db.query(
    "insert into reservation_extensions(room_unit_id,status,hold_expires_at,original_end_at,new_end_at)values($1,'pending_payment',now()+interval '10 minutes',$2,$3)",
    [id(101), startIso, endIso],
  ),
  /ROOM_INVENTORY_UNAVAILABLE/,
);
const b = (await db.query("select id from waki_private.room_blocks")).rows[0];
await action("release", { id: b.id });
assert.equal(await available(), 1);
await action("release", { id: b.id });
assert.equal(await available(), 1);
// A block crossing midnight must affect slots on both days, without a nightly reset.
const day2=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
const day3=new Date(new Date(day2+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
await action('block',{units:[id(101),id(102)],start_at:day2+'T22:45:00-05:00',end_at:day3+'T02:15:00-05:00',reason:'maintenance'});
const slots=(await db.query('select private.room_available_slots($1,$2,60,0) slots',[id(100),day2])).rows[0].slots;
assert.ok(slots.includes('21:30'));assert.ok(!slots.includes('22:00'));
assert.equal(await available(day3+'T00:00:00-05:00',day3+'T01:00:00-05:00'),0);
assert.equal(await available(day3+'T02:15:00-05:00',day3+'T03:00:00-05:00'),2);
const actualDay=(await db.query('select public.hotel_operations_read($1,$2) data',[id(10),day3])).rows[0].data;
assert.equal(actualDay.blocks.length,2);
await assert.rejects(
  action("block", { ...args, end_at: startIso }),
  /INVALID_PERIOD/,
);
await assert.rejects(action("block", { ...args, units: [] }), /INVALID_UNITS/);
await login(1);
await db.query("update profiles set account_status='suspended' where id=$1", [
  id(1),
]);
await assert.rejects(read(), /NOT_AUTHORIZED/);
assert.equal(
  (
    await db.query(
      "select has_function_privilege('anon','public.hotel_operations_action(uuid,text,jsonb)','execute') allowed",
    )
  ).rows[0].allowed,
  false,
);
assert.equal(
  (
    await db.query(
      "select has_table_privilege('authenticated','waki_private.room_blocks','select') allowed",
    )
  ).rows[0].allowed,
  false,
);
await db.close();
console.log(
  "PASS: staff permissions, services, atomic bulk blocks, real checkout selection, overlaps, extensions, endpoint boundaries, release and private access.",
);
