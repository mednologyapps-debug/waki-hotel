import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BedDouble, CalendarDays, Check, Clock3, LockKeyhole, Plus, RotateCw } from 'lucide-react';
import HotelSidebar from '../components/hotel/HotelSidebar';
import OperationsDialog from '../components/hotel/OperationsDialog';
import { supabase } from '../lib/supabase';
import { blockReasons, limaDay, limaInput, fromLima, hour, operationsError } from '../lib/hotelOperations';
import { availabilityEvents, roomAvailability } from '../lib/roomAvailability';
import './HotelOperations.css';
import './HotelAvailability.css';

const timeOnly = value => new Date(value).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
const eventLabel = e => e.kind === 'block' ? blockReasons[e.reason] || 'Bloqueo del hotel' : e.kind === 'extension' ? 'Ampliación en pago' : e.status === 'pending_payment' ? 'Reserva en pago' : 'Reserva WAKI';

export default function HotelAvailabilityPage() {
  const [day, setDay] = useState(() => limaDay());
  const [time, setTime] = useState(''); // Empty = live view, not a frozen clock.
  const [now, setNow] = useState(() => new Date());
  const [data, setData] = useState(null), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [updated, setUpdated] = useState(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all'), [category, setCategory] = useState('');
  const [modal, setModal] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [selected, setSelected] = useState([]), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const events = availabilityEvents(data);
  const at = !time && day === limaDay(now) ? now : new Date(`${day}T${time || '08:00'}:00-05:00`);
  const rooms = (data?.units || []).map(unit => ({ ...unit, ...roomAvailability(unit, events, at) }));
  const types = [...new Map(rooms.map(u => [u.room_type_id, u.room_type])).entries()];
  const visible = rooms.filter(u => (!category || u.room_type_id === category) && (filter === 'all' || (filter === 'free' ? !u.occupied : u.occupied)));
  const freeCount = rooms.filter(u => !u.occupied).length;
  const current = rooms.find(u => u.id === modal?.unit?.id);

  useEffect(() => {
    let cancelled = false, pending = false, lastLoad = 0;
    async function load(force = false) {
      if (pending || (!force && Date.now() - lastLoad < 2000)) return;
      pending = true;
      const { data: result, error: err } = await supabase.rpc('hotel_operations_read', { p_day: day });
      pending = false; lastLoad = Date.now();
      if (!cancelled) {
        setData(err ? null : result); setError(err ? 'No pudimos actualizar la disponibilidad. Intenta nuevamente.' : '');
        setLoading(false); if (!err) setUpdated(new Date());
      }
    }
    load(true);
    const refreshVisible = () => { if (!document.hidden) load(); };
    // Reuse the existing hotel notice feed; no additional Realtime subscription.
    window.addEventListener('waki:booking-updated', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = setInterval(refreshVisible, 60000);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('waki:booking-updated', refreshVisible); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [day, revision]);
  useEffect(() => {
    const timer = setInterval(() => { const date = new Date(); setNow(date); if (!time) setDay(limaDay(date)); }, 30000);
    return () => clearInterval(timer);
  }, [time]);
  function refresh() { setLoading(true); setRevision(v => v + 1); }
  function changeDay(value) { if (!value) return; setDay(value); setTime(value === limaDay() ? '' : '08:00'); setLoading(true); }
  function open(unit) {
    setSelected(unit ? [unit.id] : []); setMessage('');
    const date = new Date(at);
    // Avoid suggesting a block that crosses a known upcoming booking.
    const maxEnd = date.getTime() + 3 * 3600000;
    setStart(limaInput(date));
    setEnd(limaInput(new Date(unit?.next ? Math.min(maxEnd, Date.parse(unit.next.start_at)) : maxEnd)));
    setModal({ kind: 'block', unit });
  }
  function showRoom(unit) { if (unit.occupied) { setMessage(''); setModal({ kind: 'detail', unit }); } else open(unit); }
  function preset(hours) { if (start) setEnd(limaInput(new Date(Date.parse(fromLima(start)) + hours * 3600000))); }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    if (modal.kind === 'block' && (!selected.length || !start || !end || start >= end)) { setMessage('Selecciona una habitación y una salida posterior al ingreso.'); return; }
    setBusy(true); setMessage('');
    try {
      const payload = modal.kind === 'release' ? { id: modal.block.id } : { ...Object.fromEntries(new FormData(e.currentTarget)), units: selected, start_at: fromLima(start), end_at: fromLima(end) };
      const { data: result, error: err } = await supabase.rpc('hotel_operations_action', { p_hotel: data.hotel.id, p_action: modal.kind, p_data: payload });
      if (err) throw err;
      setNotice(modal.kind === 'release' ? 'Bloqueo liberado. Las demás reservas se mantienen.' : `${result.count === 1 ? 'Habitación bloqueada' : result.count + ' habitaciones bloqueadas'}. WAKI no ofrecerá ese horario.`);
      setModal(null); refresh();
    } catch (err) { setMessage(operationsError(err)); } finally { setBusy(false); }
  }
  const title = modal?.kind === 'release' ? 'Liberar bloqueo' : modal?.kind === 'detail' ? `Habitación ${modal.unit.code}` : modal?.unit ? `Bloquear habitación ${modal.unit.code}` : 'Bloquear varias habitaciones';
  return <div className="hotel-portal">
    <HotelSidebar activeKey="disponibilidad" hotelName={data?.hotel?.name} />
    <main className="hotel-dashboard hotel-ops availability-page">
      <header className="hotel-ops-heading"><div><h1>Disponibilidad</h1><p>Tu hotel, de un vistazo. Toca una habitación libre para bloquearla.</p></div><button className="ops-button" disabled={loading || !rooms.length} onClick={() => open()}><Plus size={17}/> Bloquear varias</button></header>
      {error && <p className="ops-error" role="alert">{error}</p>}
      {notice && <p className="ops-success" role="status">{notice}</p>}
      <section className="availability-controls" aria-label="Consultar disponibilidad">
        <div className="availability-date"><CalendarDays size={18}/><label>Fecha<input type="date" value={day} onChange={e => changeDay(e.target.value)}/></label></div>
        <label className="availability-time">Hora de consulta<input type="time" value={time || limaInput(now).slice(11)} onChange={e => setTime(e.target.value)}/></label>
        <button className={'ops-button ' + (!time && day === limaDay(now) ? 'primary' : '')} onClick={() => { setDay(limaDay()); setTime(''); setNow(new Date()); refresh(); }}>Ahora</button>
        <button className="ops-button availability-refresh" disabled={loading} onClick={refresh}><RotateCw size={16} className={loading ? 'is-spinning' : ''}/><span>Actualizar</span></button>
      </section>
      <section className="availability-summary" aria-label="Resumen y filtros">
        {[['all', 'Habitaciones', rooms.length], ['free', 'Libres', freeCount], ['busy', 'Ocupadas / bloqueadas', rooms.length - freeCount]].map(([value,label,count]) => <button key={value} className={'availability-count ' + value + (filter === value ? ' selected' : '')} aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{label}</span><strong>{loading ? '—' : count}</strong></button>)}
      </section>
      <section className="hotel-ops-card room-map" aria-busy={loading}>
        <div className="ops-card-title"><div><h2>Mapa de habitaciones</h2><p>{!time && day === limaDay(now) ? 'Disponibilidad ahora' : `Disponibilidad el ${day.split('-').reverse().join('/')} a las ${time || '08:00'}`} · hora de Lima</p></div><label className="availability-category"><span className="sr-only">Tipo de habitación</span><select aria-label="Tipo de habitación" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todos los tipos</option>{types.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
        <div className="room-map-guide"><span><i className="free"/> Libre</span><span><i className="busy"/> Ocupada o bloqueada</span><small>El estado corresponde a la hora consultada.</small></div>
        {loading ? <p className="ops-empty" role="status">Actualizando habitaciones…</p> : !data ? <div className="ops-empty"><p>No hay disponibilidad actualizada para mostrar.</p><button className="ops-button" onClick={refresh}>Reintentar</button></div> : !rooms.length ? <p className="ops-empty">Primero agrega las habitaciones individuales de tu hotel en <Link to="/habitaciones">Habitaciones</Link>.</p> : !visible.length ? <p className="ops-empty">No hay habitaciones con este filtro.</p> : <div className="room-map-groups">{types.filter(([id]) => visible.some(u => u.room_type_id === id)).map(([id,name]) => <section className="room-map-group" key={id}><h3>{name}<span>{visible.filter(u => u.room_type_id === id).length} habitaciones</span></h3><div className="room-map-grid">{visible.filter(u => u.room_type_id === id).map(u => <button key={u.id} className={'mini-room ' + (u.occupied ? 'busy' : 'free')} onClick={() => showRoom(u)} aria-label={`Habitación ${u.code}, ${u.occupied ? eventLabel(u.active[0]) : 'libre'}. ${u.occupied ? 'Ver detalle' : 'Bloquear horario'}`}><span className="mini-room-top"><strong>{u.code}</strong>{u.occupied ? <LockKeyhole size={13}/> : <Check size={14}/>}</span><span className="mini-room-interior"><BedDouble size={35} strokeWidth={1.5}/><i/></span><span className="mini-room-status">{u.occupied ? eventLabel(u.active[0]) : 'Libre'}</span><small>{u.occupied ? `Hasta ${timeOnly(u.active.reduce((a,b) => Date.parse(a.end_at) > Date.parse(b.end_at) ? a : b).end_at)}` : u.next ? `Próxima ${timeOnly(u.next.start_at)}` : 'Toca para bloquear'}</small></button>)}</div></section>)}</div>}
        <footer className="room-map-footer"><Clock3 size={14}/><span>{updated ? `Última actualización ${timeOnly(updated)}` : 'Consultando…'} · Se actualiza cada minuto mientras esta vista está abierta.</span></footer>
      </section>
      {data?.reservations?.some(r => !r.room_unit_id) && <p className="ops-error">Hay reservas sin habitación asignada. Revisa <Link to="/reservas">Reservas</Link> antes de bloquear esa categoría.</p>}
      <p className="ops-tip"><LockKeyhole size={16}/>Los bloqueos terminan a la hora indicada. Las reservas de la app se gestionan desde su detalle.</p>
      {modal && <OperationsDialog title={title} busy={busy} onClose={() => setModal(null)}>
        {modal.kind === 'detail' ? <div className="ops-form"><p>{modal.unit.room_type} · Estos son sus horarios para el día consultado.</p><div className="ops-periods">{(current?.events || []).map(e => <div className={'ops-period ' + e.kind} key={e.kind + e.id}><div><strong>{eventLabel(e)}</strong><span>{hour(e.start_at)} — {hour(e.end_at)}</span>{e.notes && <small>{e.notes}</small>}</div>{e.kind === 'block' ? <button className="ops-button" onClick={() => { setMessage(''); setModal({ kind: 'release', unit: modal.unit, block: e }); }}>Liberar bloqueo</button> : e.kind === 'reservation' ? <Link className="ops-link" to={'/reservas/' + e.id}>Ver reserva {e.code}</Link> : null}</div>)}</div><footer><button className="ops-button" onClick={() => setModal(null)}>Cerrar</button></footer></div> : <form className="ops-form" onSubmit={save}>
          {message && <p className="ops-error" role="alert">{message}</p>}
          {modal.kind === 'release' ? <p>¿Quieres retirar el bloqueo de la habitación <strong>{modal.unit.code}</strong> del {hour(modal.block.start_at)} al {hour(modal.block.end_at)}? Las reservas WAKI no se modifican.</p> : <>
            {modal.unit ? <div className="quick-block-room"><BedDouble size={30}/><div><strong>Habitación {modal.unit.code}</strong><span>{modal.unit.room_type}</span></div><span className="quick-block-badge">Reserva presencial</span></div> : <fieldset><legend>Selecciona las habitaciones</legend><div className="ops-unit-picker">{rooms.map(u => <label key={u.id} className={selected.includes(u.id) ? 'checked' : ''}><input type="checkbox" checked={selected.includes(u.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids,u.id] : ids.filter(id => id !== u.id))}/><span><strong>{u.code}</strong><small>{u.room_type}</small></span></label>)}</div></fieldset>}
            <div className="ops-two"><label>Ingreso<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)}/></label><label>Salida<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)}/></label></div>
            <div className="ops-presets"><span>Duración:</span>{[1,2,3,6,12,24].map(h => <button className={'ops-button ' + (start && end && Date.parse(fromLima(end)) - Date.parse(fromLima(start)) === h * 3600000 ? 'primary' : '')} type="button" key={h} onClick={() => preset(h)}>{h} h</button>)}</div>
            {modal.unit?.next && <p className="quick-block-next"><Clock3 size={15}/>Próxima reserva: {hour(modal.unit.next.start_at)}. El bloqueo debe terminar antes.</p>}
            <details className="quick-block-extra"><summary>Otro motivo o nota interna</summary><label>Motivo<select name="reason" defaultValue="walk_in">{Object.entries(blockReasons).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Nota opcional<textarea name="notes" maxLength={300} placeholder="Sin datos personales de huéspedes"/></label></details>
            <p className="ops-confirm-summary"><LockKeyhole size={16}/>{selected.length === 1 ? 'Esta habitación no se ofrecerá' : `${selected.length} habitaciones no se ofrecerán`} en WAKI durante el horario indicado.</p>
          </>}
          <footer><button className="ops-button" type="button" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button className="ops-button primary" disabled={busy || (modal.kind === 'block' && !selected.length)}>{busy ? 'Guardando…' : modal.kind === 'release' ? 'Sí, liberar bloqueo' : 'Confirmar bloqueo'}</button></footer>
        </form>}
      </OperationsDialog>}
    </main>
  </div>;
}
