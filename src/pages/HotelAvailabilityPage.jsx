import { Link } from 'react-router-dom';
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  LockKeyhole,
  Plus,
  RotateCw,
} from "lucide-react";
import HotelSidebar from "../components/hotel/HotelSidebar";
import OperationsDialog from "../components/hotel/OperationsDialog";
import { supabase } from "../lib/supabase";
import {
  blockReasons,
  limaDay,
  limaInput,
  fromLima,
  hour,
  operationsError,
} from "../lib/hotelOperations";
import "./HotelOperations.css";
export default function HotelAvailabilityPage() {
  const [day, setDay] = useState(() => limaDay()),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState([]),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [type, setType] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: r, error: e } = await supabase.rpc(
        "hotel_operations_read",
        { p_day: day },
      );
      if (!cancelled) {
        setData(e ? null : r);
        setError(e ? operationsError(e) : "");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [day, revision]);
  function refresh() {
    setLoading(true);
    setRevision((v) => v + 1);
  }
  function open(unit) {
    setSelected(unit ? [unit.id] : []);
    setType(unit?.room_type_id || "");
    setMessage("");
    const now = new Date(),
      date = day === limaDay(now) ? now : new Date(day + "T08:00:00-05:00");
    setStart(limaInput(date));
    setEnd(limaInput(new Date(date.getTime() + 3 * 3600000)));
    setModal({ kind: "block" });
  }
  function preset(hours) {
    if (!start) return;
    setEnd(
      limaInput(
        new Date(new Date(fromLima(start)).getTime() + hours * 3600000),
      ),
    );
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      let payload;
      if (modal.kind === "release") payload = { id: modal.block.id };
      else {
        if (!selected.length) {
          setMessage("Selecciona al menos una habitación.");
          setBusy(false);
          return;
        }
        if (start >= end) {
          setMessage("La salida debe ser posterior al inicio.");
          setBusy(false);
          return;
        }
        payload = {
          ...values,
          units: selected,
          start_at: fromLima(start),
          end_at: fromLima(end),
        };
      }
      const { data: r, error: e } = await supabase.rpc(
        "hotel_operations_action",
        { p_hotel: data.hotel.id, p_action: modal.kind, p_data: payload },
      );
      if (e) throw e;
      setNotice(
        modal.kind === "release"
          ? "Bloqueo liberado. La habitación vuelve a ofrecerse según sus demás reservas."
          : `${r.count} habitación(es) bloqueadas. WAKI no ofrecerá esos horarios.`,
      );
      setModal(null);
      refresh();
    } catch (err) {
      setMessage(operationsError(err));
    } finally {
      setBusy(false);
    }
  }
  const types = Array.from(
      new Map(
        (data?.units || []).map((u) => [u.room_type_id, u.room_type]),
      ).entries(),
    ),
    units = (data?.units || []).filter((u) => !type || u.room_type_id === type),
    events = [
      ...(data?.blocks || []).map((b) => ({ ...b, kind: "block" })),
      ...(data?.reservations || []).map((r) => ({ ...r, kind: "reservation" })),
      ...(data?.extensions || []).map((r) => ({ ...r, kind: "extension" })),
    ];
  return (
    <div className="hotel-portal">
      <HotelSidebar activeKey="disponibilidad" hotelName={data?.hotel?.name} />
      <main className="hotel-dashboard hotel-ops">
        <header className="hotel-ops-heading">
          <div>
            <span className="hotel-ops-icon">
              <CalendarDays size={22} />
            </span>
            <h1>Disponibilidad</h1>
            <p>
              Registra tus reservas presenciales y evita ofrecer la misma
              habitación dos veces.
            </p>
          </div>
          <button
            className="ops-button primary"
            disabled={loading || !data?.units?.length}
            onClick={() => open()}
          >
            <Plus size={17} /> Bloquear habitaciones
          </button>
        </header>
        {error && (
          <p className="ops-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="ops-success" role="status">
            {notice}
          </p>
        )}
        <section className="hotel-ops-toolbar">
          <label>
            Día a consultar
            <input
              type="date"
              value={day}
              onChange={(e) => {
                if (e.target.value) {
                  setDay(e.target.value);
                  setLoading(true);
                }
              }}
            />
          </label>
          <button
            className="ops-button"
            onClick={() => {
              setDay(limaDay());
              refresh();
            }}
          >
            Hoy
          </button>
          <button
            className="ops-button"
            onClick={() => {
              setDay(limaDay(new Date(Date.now() + 86400000)));
              setLoading(true);
            }}
          >
            Mañana
          </button>
          <button className="ops-button" disabled={loading} onClick={refresh}>
            <RotateCw size={15} /> Actualizar
          </button>
          <div className="ops-legend">
            <span>Reserva WAKI</span>
            <span>Bloqueo del hotel</span>
          </div>
        </section>
        <p className="ops-tip">
          <Clock3 size={16} /> Horarios de Lima. Los bloqueos dejan de
          restringir la habitación al finalizar. Usa “Liberar” si queda
          disponible antes.
        </p>
        <section className="hotel-ops-card">
          <div className="ops-card-title">
            <h2>Habitaciones y horarios</h2>
            <span>{data?.units?.length || 0} habitaciones activas</span>
          </div>
          {loading ? (
            <p className="ops-empty" role="status">
              Cargando disponibilidad…
            </p>
          ) : !data?.units?.length ? (
            <p className="ops-empty">
              Primero configura las habitaciones individuales de tu hotel en
              Habitaciones.
            </p>
          ) : (
            data.units.map((u) => {
              const own = events
                .filter((e) => e.room_unit_id === u.id)
                .sort((a, b) => a.start_at.localeCompare(b.start_at));
              return (
                <article className="ops-unit" key={u.id}>
                  <div className="ops-unit-name">
                    <strong>
                      {u.code}
                      {u.name ? " · " + u.name : ""}
                    </strong>
                    <small>{u.room_type}</small>
                    <button className="ops-link" onClick={() => open(u)}>
                      Bloquear horario
                    </button>
                  </div>
                  <div className="ops-periods">
                    {own.length ? (
                      own.map((e) => (
                        <div
                          className={"ops-period " + e.kind}
                          key={e.kind + e.id}
                        >
                          <div>
                            <strong>
                              {e.kind === "block"
                                ? blockReasons[e.reason]
                                : e.kind === "extension"
                                  ? "Ampliación en pago"
                                  : e.status === "pending_payment"
                                    ? "Reserva en pago"
                                    : "Reserva WAKI"}
                            </strong>
                            <span>
                              {hour(e.start_at)} — {hour(e.end_at)}
                            </span>
                            {e.notes && <small>{e.notes}</small>}
                          </div>
                          {e.kind === "block" ? (
                            <button
                              className="ops-button"
                              onClick={() => {
                                setMessage("");
                                setModal({
                                  kind: "release",
                                  block: e,
                                  unit: u,
                                });
                              }}
                            >
                              Liberar
                            </button>
                          ) : e.kind === "reservation" ? (
                            <Link className="ops-link" to={"/reservas/" + e.id}>
                              {e.code} · Ver reserva
                            </Link>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="ops-free">
                        Sin reservas ni bloqueos para este día
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
        {data?.reservations?.some((r) => !r.room_unit_id) && (
          <p className="ops-error">
            Hay reservas WAKI sin habitación asignada. Revísalas antes de
            registrar bloqueos de esa categoría.
          </p>
        )}
        {modal && (
          <OperationsDialog
            title={
              modal.kind === "block"
                ? "Bloquear disponibilidad"
                : "Liberar habitación"
            }
            busy={busy}
            onClose={() => setModal(null)}
          >
            <form className="ops-form" onSubmit={save}>
              {message && (
                <p className="ops-error" role="alert">
                  {message}
                </p>
              )}
              {modal.kind === "release" ? (
                <p>
                  ¿La habitación <strong>{modal.unit.code}</strong> ya está
                  disponible? Se retirará el bloqueo{" "}
                  <strong>{blockReasons[modal.block.reason]}</strong> de{" "}
                  {hour(modal.block.start_at)} a {hour(modal.block.end_at)}. Las
                  reservas WAKI se conservan.
                </p>
              ) : (
                <>
                  <p>
                    Oculta estos horarios en WAKI. Esto no registra una venta ni
                    modifica tu sistema presencial.
                  </p>
                  <label>
                    Tipo de habitación
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">Todos los tipos</option>
                      {types.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>
                      Habitaciones · {selected.length} seleccionadas
                    </legend>
                    <button
                      className="ops-link"
                      type="button"
                      onClick={() =>
                        setSelected(
                          Array.from(
                            new Set([...selected, ...units.map((u) => u.id)]),
                          ),
                        )
                      }
                    >
                      Seleccionar las visibles
                    </button>
                    <button
                      className="ops-link"
                      type="button"
                      onClick={() => setSelected([])}
                    >
                      Limpiar selección
                    </button>
                    <div className="ops-unit-picker">
                      {units.map((u) => (
                        <label
                          key={u.id}
                          className={selected.includes(u.id) ? "checked" : ""}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(u.id)}
                            onChange={(e) =>
                              setSelected((ids) =>
                                e.target.checked
                                  ? [...ids, u.id]
                                  : ids.filter((id) => id !== u.id),
                              )
                            }
                          />
                          <span>
                            <strong>{u.code}</strong>
                            <small>{u.room_type}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="ops-two">
                    <label>
                      Desde
                      <input
                        type="datetime-local"
                        value={start}
                        required
                        onChange={(e) => setStart(e.target.value)}
                      />
                    </label>
                    <label>
                      Hasta
                      <input
                        type="datetime-local"
                        value={end}
                        required
                        onChange={(e) => setEnd(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="ops-presets">
                    <span>Duración rápida:</span>
                    {[1, 2, 3, 6, 12, 24].map((h) => (
                      <button
                        type="button"
                        className="ops-button"
                        key={h}
                        onClick={() => preset(h)}
                      >
                        {h} h
                      </button>
                    ))}
                  </div>
                  <label>
                    Motivo
                    <select name="reason" defaultValue="walk_in">
                      {Object.entries(blockReasons).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nota interna opcional
                    <textarea
                      name="notes"
                      maxLength="300"
                      placeholder="Sin nombres, documentos ni datos de huéspedes"
                    />
                  </label>
                  <p className="ops-confirm-summary">
                    <LockKeyhole size={16} /> {selected.length} habitación(es) ·{" "}
                    {start.replace("T", " ")} al {end.replace("T", " ")} · Lima
                  </p>
                  <label className="ops-checkbox">
                    <input type="checkbox" required /> Revisé las habitaciones y
                    el horario. No se sobrescribirán reservas ni bloqueos
                    existentes.
                  </label>
                </>
              )}
              <footer>
                <button
                  type="button"
                  className="ops-button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="ops-button primary"
                  disabled={
                    busy || (modal.kind === "block" && !selected.length)
                  }
                >
                  {busy
                    ? "Guardando…"
                    : modal.kind === "block"
                      ? "Confirmar bloqueo"
                      : "Sí, liberar bloqueo"}
                </button>
              </footer>
            </form>
          </OperationsDialog>
        )}
      </main>
    </div>
  );
}
