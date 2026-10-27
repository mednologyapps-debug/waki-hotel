# Disponibilidad y servicios destacados WAKI

## Validación previa

Había habitaciones individuales (`room_units`) y funciones de inventario, horarios e intentos de reserva. No había bloqueos operativos ni un catálogo de servicios guardados en el hotel. Android ya tenía una sección de servicios, pero el repositorio siempre le enviaba una lista vacía. El inicio enviaba a Login cuando no existía una sesión persistida.

## Uso en el portal

- Nueva sección **Disponibilidad**, para administrador y recepción de un hotel aprobado. Scanner no puede crear, consultar ni liberar bloqueos.
- Consulta por día, en horario de Lima. Muestra por habitación reservas WAKI, ampliaciones en pago y bloqueos del hotel. Una sola llamada carga el día; no hay consultas por pulsación ni sondeo permanente.
- **Bloquear habitaciones**: una o varias habitaciones, desde/hasta y duración rápida de 1/2/3/6/12/24 horas. Motivo: reserva presencial, mantenimiento, limpieza u otro. Nota interna opcional, sin datos personales de huéspedes.
- Confirmación con habitaciones y período. Hasta 100 habitaciones por operación, duración máxima 30 días, inicio hasta un año por adelantado. No se permite terminar en el pasado ni sobrescribir reservas existentes.
- Si una habitación del grupo tiene conflicto, no se guarda ningún bloqueo del grupo. Es necesario revisar la selección antes de volver a confirmar.
- **Liberar**: confirmación antes de retirar el bloqueo. Se conserva quién lo creó y quién lo liberó; las reservas WAKI no se cancelan. Al llegar la hora de fin deja de descontarse del inventario sin necesidad de cron ni tareas programadas.
- Mi hotel → **Servicios destacados**: Wi-Fi, cochera, aire acondicionado, agua caliente, TV, restaurante, servicio a la habitación, acceso adaptado, jacuzzi y ascensor. Solo el administrador puede guardarlos. Existe una vista previa y guardado separado de los datos generales del hotel.

## Integración con reservas

La migración `hotel_availability_blocks_services` se prueba con PostgreSQL embebido antes de aplicar. Bloqueos privados con RLS, acceso por funciones y validación de perfil/rol en servidor. La app solo recibe los servicios del hotel y conteos de disponibilidad; no recibe los motivos ni notas de bloqueos.

La función de disponibilidad base y el asignador real de reservas excluyen habitaciones bloqueadas. Los horarios disponibles, mapa y ficha de Android heredan esa regla desde las funciones existentes. Se usa el mismo bloqueo transaccional por tipo de habitación que el checkout, en orden estable, para coordinar bloqueos presenciales y reservas simultáneas. Triggers adicionales verifican cruces en reservas, ampliaciones pendientes y cambios posteriores de horario/unidad/estado.

Intervalos semiabiertos: `[desde, hasta)`. Una reserva puede comenzar exactamente cuando termina el bloqueo. El período es continuo al cruzar medianoche. Los bloqueos no representan ventas, pagos ni comisiones y no alteran la liquidación de hoteles.

El sistema presencial sigue siendo independiente: no hay sincronización con su PMS. El hotel debe registrar los bloqueos oportunamente; WAKI no puede conocer reservas que el personal no registra. Confirmaciones de pago tardías que encuentren una habitación ya bloqueada no deben forzarse: requieren revisión del pago/reserva conforme al flujo de incidencias existente.

## Android

Base de trabajo: `feature/android-map-style-v2`, manteniendo mapas, pagos, legales y enlaces de reservas de invitados.

- Tras restaurar Auth, abre Home. Sin sesión se prepara una sesión anónima; si falla, no fuerza Login para explorar. Solo crea Auth anónimo cuando no había sesión. Se conserva la sesión registrada y la recuperación de reservas de invitados.
- El acceso voluntario sigue disponible en Perfil y los controles existentes. Cerrar sesión regresa al home como invitado.
- Se quitan Hotel Verificado y Reserva Rápida de la ficha.
- `featured_services` se obtiene dentro de la misma consulta de hotel, sin una solicitud por servicio. Catálogo explícito y eliminación de duplicados/valores desconocidos. Todos los servicios seleccionados aparecen, en filas de tres; no se truncan a cuatro. Si no hay servicios, se oculta la sección.
- Si la disponibilidad no responde, la ficha no inventa stock utilizando el inventario total.

## Legales

La web ya indicaba 18 años. Se hace explícito que también aplica al uso como invitado y se añade la evaluación y aceptación/rechazo de hoteles con criterios objetivos, sin garantizar aprobación al enviar la solicitud. Se agrega el deber de mantener disponibilidad presencial actualizada, conservando obligaciones respecto de reservas y pagos vigentes.

Los enlaces de Android y Hotel apuntan al documento central `https://wakipe.com/legal.html`; el texto no requiere copias divergentes por plataforma. Hay que publicar la web para que la cláusula nueva esté visible en esa URL.

Referencia de revisión de no discriminación y criterios objetivos: https://www.gob.pe/institucion/indecopi/noticias/505754-desde-el-ano-2010-el-indecopi-impuso-mas-de-cuatro-millones-de-soles-en-multas-por-actos-de-discriminacion-contra-consumidores . La selección de afiliados no se presenta como una exención general de responsabilidad o de los derechos de los usuarios.

## Pruebas y publicación

`npm ci`, `npm run test:operations`, `npm run lint`, `npm run build`. El build se verifica también con variables públicas de prueba para evitar que una configuración vacía oculte código al compilar. Pruebas SQL: administrador/recepción/scanner, hoteles ajenos, catálogo, bloqueos por lote atómicos, asignación real de otra habitación libre, cruce de reservas/ampliaciones, límites de horario, medianoche, cancelación y acceso privado.

En Android se incluyen pruebas JUnit de catálogo. Este entorno no tiene Android SDK ni emulador: ejecutar en Android Studio `testDebugUnitTest` y compilar/revisar el APK, incluyendo instalación limpia, navegación de invitado, login opcional, recuperación de sesión y reservas. No se afirma prueba visual en dispositivo desde este entorno.

Frontend Hotel: instalar dependencias y `npm run dev`, entrar como admin/recepción y validar bloqueo de una habitación de prueba contra los horarios de la app. Probar que scanner no ve el módulo. Confirmar que no cambian reservas, tarifas ni importes existentes. Requiere publicar Hotel, publicar el documento central de Web y distribuir el APK actualizado. Las ramas no se fusionan ni publican automáticamente.
