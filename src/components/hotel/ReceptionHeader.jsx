import { NavLink } from 'react-router-dom';
import { BedDouble, CalendarDays } from 'lucide-react';
import './ReceptionHeader.css';

export default function ReceptionHeader({ view = 'map', children }) {
  return <header className="reception-header">
    <div className="reception-heading"><div><h1>Recepción</h1><p>Habitaciones y reservas, en un mismo lugar.</p></div>{children && <div className="reception-actions">{children}</div>}</div>
    <nav className="reception-views" aria-label="Vistas de recepción">
      <NavLink to="/recepcion" end><BedDouble size={20}/><span>Mapa de habitaciones</span></NavLink>
      <NavLink to="/recepcion/reservas"><CalendarDays size={20}/><span>Reservas WAKI</span></NavLink>
    </nav>
    <p className="reception-description">{view === 'map' ? 'Consulta la ocupación de tu hotel. Toca una habitación libre para registrar una reserva presencial o un bloqueo.' : 'Consulta las reservas recibidas desde WAKI, sus horarios, pagos e historial.'}</p>
  </header>;
}
