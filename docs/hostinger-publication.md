# Publicación del portal Hotel en Hostinger

El sitio actual usa el despliegue Git estático de hPanel (Advanced → Git). Ese despliegue copia archivos de la rama; no compila el proyecto Vite.

- Fuente editable: `codex/availability-services`.
- Rama a conectar en Hostinger: `deploy/hotel`.
- Directorio de destino: `public_html`, relativo al sitio hotel.wakipe.com.
- Despliegue automático activado para `deploy/hotel`.

La rama de publicación contiene index.html, assets compilados, archivos públicos y .htaccess de rutas SPA; no el proyecto fuente. No requiere instalar Node ni borrar/recrear el sitio.

## Protocolo de actualización del agente

Al implementar un cambio, actualizar la fuente, compilarla con configuración de producción válida, validar el build y publicar su contenido en la raíz de `deploy/hotel`. Hostinger publica automáticamente el cambio de esa rama. Cambiar únicamente la fuente no actualiza el sitio: el agente debe completar también la compilación y publicación. No hay un workflow de GitHub Actions que lo compile por separado.

Usar la URL de Supabase WAKI y exclusivamente una clave pública publishable (o anon legado), nunca service_role. La configuración VITE es pública por diseño. Obtenerla de Supabase o de la configuración de despliegue autorizada, sin publicarla en mensajes de chat. Respetar una clave de navegador Google Maps configurada por el propietario; no inventarla. La compilación inicial no encontró una clave de Maps en el portal publicado, por lo que el selector de ubicación requiere configuración independiente; las reservas, servicios y bloqueos no usan esa clave.

Vite copia public/.htaccess para conservar rutas como /disponibilidad y /mi-hotel al recargar. La regla impide servir .git/.env y desactiva el listado de directorios. index.html y version.json evitan conservar una entrada obsoleta en caché.

Antes de publicar: npm ci, npm run build; verificar que dist contenga index.html, .htaccess y los archivos referenciados, que las variables no estén vacías ni sean marcadores de prueba, y que no haya secretos de servidor. Agregar version.json con source_commit y built_at para verificar qué versión sirve el dominio.

Actualizar deploy/hotel sin force push: tomar su cabeza actual como padre, crear un árbol con el nuevo contenido de dist y mover la referencia con comprobación del SHA anterior. En la primera publicación se crea la rama desde el commit generado. Los assets idénticos pueden reutilizar sus blobs de GitHub sin subirlos otra vez. Registrar cualquier cambio adicional en el build.

Tras cada publicación verificar /version.json, /login, /disponibilidad y los archivos JS/CSS desde el dominio, sin iniciar reservas ni enviar mensajes de prueba. La conexión inicial del repositorio y del directorio la realiza el propietario en hPanel. No se puede confirmar el despliegue inicial antes de que termine ese paso.
