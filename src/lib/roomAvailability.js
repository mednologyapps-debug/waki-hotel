// Half-open intervals: a room is available again exactly at checkout.
export function availabilityEvents(data) {
  return [
    ...(data?.blocks || []).map(e => ({ ...e, kind: 'block' })),
    ...(data?.reservations || []).map(e => ({ ...e, kind: 'reservation' })),
    ...(data?.extensions || []).map(e => ({ ...e, kind: 'extension' })),
  ].sort((a,b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}
export function roomAvailability(unit, events, at) {
  const time = new Date(at).getTime();
  const own = events.filter(e => e.room_unit_id === unit.id ||
    (!e.room_unit_id && (!e.room_type_id || e.room_type_id === unit.room_type_id)));
  const active = own.filter(e => Date.parse(e.start_at) <= time && Date.parse(e.end_at) > time);
  const next = own.find(e => Date.parse(e.start_at) > time);
  return { occupied: active.length > 0, active, next, events: own };
}
