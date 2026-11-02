# Mapa de habitaciones — disponibilidad

La vista /disponibilidad consulta el RPC existente y conserva sus permisos y bloqueos atómicos. No requiere migraciones.

- Mini habitaciones agrupadas por categoría: verde libre; rojo reserva WAKI, reserva en pago, ampliación en pago o bloqueo del hotel.
- Fecha y hora de consulta explícitas; «Ahora» mantiene el reloj activo. Una reserva futura aparece como próxima sin pintar de rojo antes de su inicio.
- Tocar una verde abre el bloqueo con habitación preseleccionada, ingreso, salida y duraciones rápidas. Por defecto tres horas, recortadas a la próxima reserva conocida. El servidor valida todo el intervalo: el verde describe el instante, no garantiza la duración.
- Tocar una roja muestra horarios, enlace de reserva o liberación con confirmación de bloqueos del hotel. Nunca cancela reservas WAKI desde el mapa.
- Reservas heredadas sin unidad se muestran conservadoramente como ocupación de categoría; si el RPC no informa categoría, se restringe todo el mapa durante ese intervalo y se pide revisar Reservas.
- Refresco al recibir el aviso existente de reserva confirmada, al volver a la pestaña y cada minuto visible. No abre otro canal Realtime ni consulta por habitación. Los cambios de otros turnos se reflejan en el siguiente refresco.
- Si falla la lectura, no se muestran habitaciones verdes de un snapshot anterior.

Validación: npm run test:availability, npm run test:operations, npm run build y lint de archivos modificados. Las pruebas de UI usan exclusivamente datos simulados, sin crear reservas comerciales.

## Navegación por categorías

Los tipos de habitación aparecen como pestañas. Se abre la primera categoría disponible y solo se montan sus cuartos. Al cambiar pestaña, el mapa vuelve al inicio; los filtros de estado y horario se mantienen. Las pestañas admiten flechas, Inicio y Fin. El mapa tiene altura acotada con desplazamiento interno, de modo que 25 cuartos de una misma categoría no alargan toda la página. El resumen superior se retiró y «Ahora» permanece destacado, incluso al consultar otro horario.

Ingreso y salida tienen fecha y hora separadas. La hora se escribe directamente en formato de 24 horas; al salir del campo se normalizan entradas como 930 o 9:30 a 09:30. Las duraciones rápidas siguen calculando correctamente cambios de día y la validación rechaza horas inválidas.

## Recepción unificada

El menú muestra Recepción como única entrada operativa para administradores y recepción. /recepcion abre el mapa y /recepcion/reservas muestra el listado de reservas WAKI, manteniendo sus filtros, pagos e historial. Habitaciones conserva la configuración del inventario. Las rutas anteriores /disponibilidad y /reservas redirigen preservando query y hash; /reservas/:reservationId se mantiene para notificaciones y enlaces externos. El ingreso del personal de recepción abre el mapa. Ambos destinos mantienen los mismos roles y aprobación del hotel; no se cambiaron permisos del backend.
