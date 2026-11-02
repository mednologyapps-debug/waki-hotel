import assert from 'node:assert/strict';
import { availabilityEvents, roomAvailability } from '../src/lib/roomAvailability.js';
const room = { id:'101', room_type_id:'double' };
const data = { blocks:[{id:'b',room_unit_id:'101',start_at:'2026-11-02T18:00:00Z',end_at:'2026-11-02T19:00:00Z'}], reservations:[{id:'r',room_unit_id:'101',start_at:'2026-11-02T15:00:00Z',end_at:'2026-11-02T18:00:00Z'}], extensions:[{id:'e',room_unit_id:'102',start_at:'2026-11-02T18:00:00Z',end_at:'2026-11-02T20:00:00Z'}] };
const events=availabilityEvents(data);
assert.equal(roomAvailability(room,events,'2026-11-02T14:00:00Z').occupied,false);
assert.equal(roomAvailability(room,events,'2026-11-02T14:00:00Z').next.id,'r');
assert.equal(roomAvailability(room,events,'2026-11-02T15:00:00Z').active[0].kind,'reservation');
assert.equal(roomAvailability(room,events,'2026-11-02T18:00:00Z').active[0].kind,'block');
assert.equal(roomAvailability(room,events,'2026-11-02T19:00:00Z').occupied,false);
assert.equal(roomAvailability({id:'102'},events,'2026-11-02T19:00:00Z').active[0].kind,'extension');
assert.equal(roomAvailability({id:'103'},events,'2026-11-02T19:00:00Z').occupied,false);
// Defensive: legacy unassigned booking must not appear green and suggest a sale.
assert.equal(roomAvailability(room,availabilityEvents({reservations:[{room_unit_id:null,start_at:'2026-11-02T15:00:00Z',end_at:'2026-11-02T18:00:00Z'}]}),'2026-11-02T16:00:00Z').occupied,true);
assert.equal(roomAvailability(room,availabilityEvents({reservations:[{room_type_id:'suite',start_at:'2026-11-02T15:00:00Z',end_at:'2026-11-02T18:00:00Z'}]}),'2026-11-02T16:00:00Z').occupied,false);
console.log('PASS: app reservations, walk-in blocks, checkout boundary, extension holds, next booking and unassigned inventory.');
