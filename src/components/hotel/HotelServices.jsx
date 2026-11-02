import { useState } from "react";
import {
  Wifi,
  CarFront,
  Snowflake,
  Droplets,
  Tv,
  Utensils,
  BellRing,
  Accessibility,
  Bath,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { serviceOptions, operationsError } from "../../lib/hotelOperations";
import "../../pages/HotelOperations.css";
const icons = {
  wifi: Wifi,
  parking: CarFront,
  air_conditioning: Snowflake,
  hot_water: Droplets,
  tv: Tv,
  restaurant: Utensils,
  room_service: BellRing,
  accessible: Accessibility,
  jacuzzi: Bath,
  elevator: ArrowUpDown,
};
export default function HotelServices({ hotel }) {
  const [values, setValues] = useState(() => hotel.featured_services || []),
    [saved, setSaved] = useState(() => hotel.featured_services || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dirty =
    values.slice().sort().join(",") !== saved.slice().sort().join(",");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: err } = await supabase.rpc("hotel_operations_action", {
        p_hotel: hotel.id,
        p_action: "services",
        p_data: { services: values },
      });
      if (err) throw err;
      setSaved(values);
      setNotice(
        "Servicios guardados. Se mostrarán en la ficha del hotel en la app.",
      );
    } catch (err) {
      setError(operationsError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="hotel-ops-card hotel-services">
      <div className="ops-card-title">
        <div>
          <h2>Servicios destacados</h2>
          <p>Marca únicamente los servicios que realmente ofrece esta sede.</p>
        </div>
        <span>{values.length} seleccionados</span>
      </div>
      <form onSubmit={save}>
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
        <div className="ops-service-picker">
          {serviceOptions.map(([id, label]) => {
            const Icon = icons[id];
            return (
              <label key={id} className={values.includes(id) ? "checked" : ""}>
                <input
                  type="checkbox"
                  checked={values.includes(id)}
                  disabled={busy}
                  onChange={(e) => {
                    setNotice("");
                    setValues((v) =>
                      e.target.checked ? [...v, id] : v.filter((x) => x !== id),
                    );
                  }}
                />
                <Icon size={23} />
                <span>{label}</span>
                {values.includes(id) && (
                  <Check className="ops-service-check" size={16} />
                )}
              </label>
            );
          })}
        </div>
        <div className="ops-service-preview">
          <strong>Así aparecerán en la app</strong>
          <p>
            {values.length
              ? serviceOptions
                  .filter(([id]) => values.includes(id))
                  .map(([, name]) => name)
                  .join(" · ")
              : "No se mostrará una sección vacía si no hay servicios seleccionados."}
          </p>
        </div>
        <button className="ops-button primary" disabled={busy || !dirty}>
          {busy ? "Guardando…" : "Guardar servicios"}
        </button>
      </form>
    </section>
  );
}
