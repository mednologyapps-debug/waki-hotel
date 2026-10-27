export const blockReasons = {
  walk_in: "Reserva presencial",
  maintenance: "Mantenimiento",
  cleaning: "Limpieza",
  other: "Otro motivo",
};
export const serviceOptions = [
  ["wifi", "Wi-Fi"],
  ["parking", "Cochera"],
  ["air_conditioning", "Aire acondicionado"],
  ["hot_water", "Agua caliente"],
  ["tv", "TV"],
  ["restaurant", "Restaurante"],
  ["room_service", "Servicio a la habitación"],
  ["accessible", "Acceso adaptado"],
  ["jacuzzi", "Jacuzzi"],
  ["elevator", "Ascensor"],
];
export const limaDay = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const limaInput = (value = new Date()) => {
  const d = new Date(value.getTime() - 5 * 3600000);
  return d.toISOString().slice(0, 16);
};
export const fromLima = (value) => new Date(value + ":00-05:00").toISOString();
export const hour = (value) =>
  new Date(value).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export function operationsError(err) {
  const message = String(err?.message || "");
  for (const [key, text] of Object.entries({
    NOT_AUTHORIZED: "Tu cuenta no tiene permiso para esta operación.",
    INVALID_PERIOD:
      "Revisa el horario: debe terminar después del inicio y durar hasta 30 días.",
    INVALID_UNITS:
      "Una habitación cambió o ya no está activa. Actualiza la disponibilidad.",
    ROOM_PERIOD_CONFLICT:
      "Una habitación ya tiene una reserva o bloqueo en ese horario. No se guardó ningún bloqueo; revisa las habitaciones y vuelve a intentar.",
    INVALID_REASON: "Selecciona el motivo del bloqueo.",
    INVALID_SERVICES: "Selecciona únicamente servicios de la lista.",
    BLOCK_NOT_FOUND: "Este bloqueo ya no está disponible.",
  }))
    if (message.includes(key)) return text;
  return "No se pudo guardar. Actualiza e inténtalo nuevamente.";
}
