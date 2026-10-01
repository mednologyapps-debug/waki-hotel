import {
  useEffect,
  useRef,
  useState
} from 'react'

import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileCheck2,
  History,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  XCircle
} from 'lucide-react'

import {
  Html5Qrcode
} from 'html5-qrcode'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import {
  supabase
} from '../lib/supabase'

import wakiLogo
  from '../assets/waki_logo_full.png'


const STATUS_COPY = {
  valid: {
    title: 'Reserva válida',
    message:
      'Confirma los documentos del huésped antes de registrar el acceso.'
  },

  already_verified: {
    title: 'Acceso ya verificado',
    message:
      'Este QR ya fue validado anteriormente.'
  },

  expired: {
    title: 'QR vencido',
    message:
      'El código QR ya expiró y no puede utilizarse para registrar el acceso.'
  },

  ended: {
    title: 'Reserva finalizada',
    message:
      'El horario de esta reserva ya terminó y no puede registrarse un nuevo acceso.'
  },

  not_paid: {
    title: 'Pago pendiente',
    message:
      'La reserva todavía no figura como pagada.'
  },

  not_confirmed: {
    title: 'Reserva no confirmada',
    message:
      'Esta reserva no se encuentra confirmada para el acceso.'
  }
}


export default function HotelScanPlaceholderPage() {
  const scannerRef =
    useRef(null)

  const scanLockedRef =
    useRef(false)


  const [loading, setLoading] =
    useState(true)

  const [cameraActive, setCameraActive] =
    useState(false)

  const [cameraStarting, setCameraStarting] =
    useState(false)

  const [verifying, setVerifying] =
    useState(false)

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [staffRole, setStaffRole] =
    useState(null)

  const [qrToken, setQrToken] =
    useState('')

  const [preview, setPreview] =
    useState(null)

  const [
    documentsVerified,
    setDocumentsVerified
  ] =
    useState(false)

  const [recentScans, setRecentScans] =
    useState([])

  const [
    errorMessage,
    setErrorMessage
  ] =
    useState('')

  const [
    successMessage,
    setSuccessMessage
  ] =
    useState('')


  useEffect(() => {
    loadPage()

    return () => {
      void stopCamera()
    }
  }, [])


  /* =========================================================
     CARGAR PÁGINA
     ========================================================= */

  async function loadPage() {
    try {
      setLoading(true)
      setErrorMessage('')

      const {
        data: {
          session
        },
        error: sessionError
      } =
        await supabase
          .auth
          .getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.user) {
        window.location.replace(
          '/login'
        )

        return
      }


      /* PERFIL */

      const {
        data: profileData,
        error: profileError
      } =
        await supabase
          .from('profiles')
          .select(`
            id,
            full_name
          `)
          .eq(
            'id',
            session.user.id
          )
          .maybeSingle()

      if (profileError) {
        throw profileError
      }

      setProfile(
        profileData
      )


      /* ACCESO HOTEL */

      const {
        data: accessData,
        error: accessError
      } =
        await supabase
          .rpc(
            'get_my_hotel_access'
          )

      if (accessError) {
        throw accessError
      }

      const accessRows =
        Array.isArray(
          accessData
        )
          ? accessData
          : []

      const access =
        accessRows[0]

      if (
        !access?.hotel_id ||
        ![
          'admin',
          'reception',
          'scanner'
        ].includes(
          access?.staff_role
        )
      ) {
        throw new Error(
          'Tu cuenta no tiene permiso para utilizar el escáner.'
        )
      }

      setStaffRole(
        access.staff_role
      )


      /* HOTEL */

      const {
        data: hotelData,
        error: hotelError
      } =
        await supabase
          .from('hotels')
          .select(`
            id,
            name,
            district,
            province
          `)
          .eq(
            'id',
            access.hotel_id
          )
          .maybeSingle()

      if (hotelError) {
        throw hotelError
      }

      setHotel(
        hotelData
      )

      await loadRecentScans()

    } catch (error) {
      console.error(
        'Error cargando escáner:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos preparar el escáner.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     ÚLTIMOS ESCANEOS
     ========================================================= */

  async function loadRecentScans() {
    const {
      data,
      error
    } =
      await supabase
        .rpc(
          'get_my_recent_hotel_scans',
          {
            target_limit: 5
          }
        )

    if (error) {
      console.error(
        'Error cargando escaneos recientes:',
        error
      )

      return
    }

    setRecentScans(
      data || []
    )
  }


  /* =========================================================
     CÁMARA
     ========================================================= */

  async function startCamera() {
    try {
      setCameraStarting(true)
      setErrorMessage('')
      setSuccessMessage('')
      setPreview(null)
      setDocumentsVerified(false)

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          'Este navegador no permite utilizar la cámara.'
        )
      }

      await stopCamera()

      const scanner =
        new Html5Qrcode(
          'waki-dedicated-qr-reader'
        )

      scannerRef.current =
        scanner

      scanLockedRef.current =
        false

      await scanner.start(
        {
          facingMode:
            'environment'
        },
        {
          fps: 10,

          qrbox: (
            viewfinderWidth,
            viewfinderHeight
          ) => {
            const edge =
              Math.floor(
                Math.min(
                  viewfinderWidth,
                  viewfinderHeight
                ) * 0.68
              )

            return {
              width: edge,
              height: edge
            }
          },

          aspectRatio: 1
        },

        async (
          decodedText
        ) => {
          if (
            scanLockedRef.current
          ) {
            return
          }

          scanLockedRef.current =
            true

          await handleDetectedToken(
            decodedText
          )
        },

        () => {
          /*
           * html5-qrcode ejecuta este callback
           * mientras busca un QR.
           * No lo mostramos como error.
           */
        }
      )

      setCameraActive(
        true
      )

    } catch (error) {
      console.error(
        'Error activando cámara:',
        error
      )

      await stopCamera()

      setErrorMessage(
        getCameraErrorMessage(
          error
        )
      )

    } finally {
      setCameraStarting(false)
    }
  }


  function getCameraErrorMessage(
    error
  ) {
    const message =
      String(
        error?.message ||
        error ||
        ''
      )

    const normalized =
      message.toLowerCase()

    if (
      error?.name ===
        'NotAllowedError' ||
      normalized.includes(
        'permission'
      ) ||
      normalized.includes(
        'notallowed'
      )
    ) {
      return (
        'No tenemos permiso para usar la cámara. Revisa los permisos del navegador y permite el acceso para WAKI.'
      )
    }

    if (
      error?.name ===
        'NotFoundError' ||
      normalized.includes(
        'notfound'
      )
    ) {
      return (
        'No encontramos una cámara disponible en este dispositivo.'
      )
    }

    if (
      normalized.includes(
        'secure'
      )
    ) {
      return (
        'La cámara requiere una conexión segura. Abre WAKI desde https://hotel.wakipe.com.'
      )
    }

    return (
      message ||
      'No pudimos iniciar la cámara.'
    )
  }


  async function stopCamera() {
    const scanner =
      scannerRef.current

    if (scanner) {
      try {
        if (
          scanner.getState &&
          scanner.getState() !== 1
        ) {
          await scanner.stop()
        }
      } catch (error) {
        console.warn(
          'No fue necesario detener la cámara:',
          error
        )
      }

      try {
        await scanner.clear()
      } catch (error) {
        console.warn(
          'No fue necesario limpiar el lector:',
          error
        )
      }

      scannerRef.current =
        null
    }

    setCameraActive(
      false
    )
  }


  /* =========================================================
     QR DETECTADO
     ========================================================= */

  async function handleDetectedToken(
    token
  ) {
    const cleanToken =
      String(
        token || ''
      )
        .trim()

    if (!cleanToken) {
      scanLockedRef.current =
        false

      return
    }

    await stopCamera()

    setQrToken(
      cleanToken
    )

    await previewQr(
      cleanToken
    )
  }


  /* =========================================================
     PREVIEW QR
     ========================================================= */

  async function previewQr(
    token = qrToken
  ) {
    const cleanToken =
      String(
        token || ''
      )
        .trim()

    if (!cleanToken) {
      setErrorMessage(
        'Escanea o pega el código QR de la reserva.'
      )

      return
    }

    try {
      setVerifying(true)
      setErrorMessage('')
      setSuccessMessage('')
      setPreview(null)
      setDocumentsVerified(false)

      const {
        data,
        error
      } =
        await supabase
          .rpc(
            'hotel_preview_reservation_by_qr',
            {
              target_qr_token:
                cleanToken
            }
          )

      if (error) {
        throw error
      }

      setPreview(
        data
      )

    } catch (error) {
      console.error(
        'Error previsualizando QR:',
        error
      )

      setErrorMessage(
        mapQrError(
          error
        )
      )

    } finally {
      setVerifying(false)
    }
  }


  /* =========================================================
     CONFIRMAR ACCESO
     ========================================================= */

  async function confirmAccess() {
    if (
      !preview ||
      preview.validation_status !==
        'valid'
    ) {
      return
    }

    if (!documentsVerified) {
      setErrorMessage(
        'Confirma primero que verificaste visualmente los documentos del huésped.'
      )

      return
    }

    try {
      setVerifying(true)
      setErrorMessage('')
      setSuccessMessage('')

      const {
        data,
        error
      } =
        await supabase
          .rpc(
            'hotel_verify_reservation_access_safe',
            {
              target_qr_token:
                qrToken.trim(),

              target_documents_verified:
                true
            }
          )

      if (error) {
        throw error
      }

      setPreview({
        ...data,

        validation_status:
          'already_verified'
      })

      setSuccessMessage(
        'Acceso y documentos verificados correctamente.'
      )

      await loadRecentScans()

    } catch (error) {
      console.error(
        'Error verificando acceso:',
        error
      )

      setErrorMessage(
        mapQrError(
          error
        )
      )

    } finally {
      setVerifying(false)
    }
  }


  /* =========================================================
     ERRORES QR
     ========================================================= */

  function mapQrError(
    error
  ) {
    const message =
      error?.message || ''

    if (
      message.includes(
        'QR_NOT_FOUND'
      )
    ) {
      return (
        'No encontramos una reserva asociada a este QR.'
      )
    }

    if (
      message.includes(
        'QR_EXPIRED'
      )
    ) {
      return (
        'Este código QR ya expiró.'
      )
    }

    if (
      message.includes(
        'RESERVATION_ALREADY_ENDED'
      )
    ) {
      return (
        'El horario de esta reserva ya terminó y no puede registrarse el acceso.'
      )
    }

    if (
      message.includes(
        'RESERVATION_NOT_VALID_FOR_ACCESS'
      )
    ) {
      return (
        'La reserva no está habilitada para registrar el acceso.'
      )
    }

    if (
      message.includes(
        'NOT_AUTHORIZED'
      )
    ) {
      return (
        'Este QR no pertenece al hotel asignado a tu cuenta.'
      )
    }

    return (
      message ||
      'No pudimos validar este código QR.'
    )
  }


  /* =========================================================
     REINICIAR
     ========================================================= */

  function resetScanner() {
    void stopCamera()

    setQrToken('')
    setPreview(null)
    setDocumentsVerified(false)
    setErrorMessage('')
    setSuccessMessage('')

    scanLockedRef.current =
      false
  }


  /* =========================================================
     LOGOUT
     ========================================================= */

  async function handleLogout() {
    await stopCamera()

    await supabase
      .auth
      .signOut()

    window.location.replace(
      '/login'
    )
  }


  /* =========================================================
     FECHAS
     ========================================================= */

  function formatDateTime(
    value
  ) {
    if (!value) {
      return '—'
    }

    return new Intl.DateTimeFormat(
      'es-PE',
      {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }
    )
      .format(
        new Date(
          value
        )
      )
  }


  function formatTimeRange(
    startAt,
    endAt
  ) {
    if (
      !startAt ||
      !endAt
    ) {
      return '—'
    }

    const formatter =
      new Intl.DateTimeFormat(
        'es-PE',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )

    return (
      `${formatter.format(
        new Date(startAt)
      )} – ${formatter.format(
        new Date(endAt)
      )}`
    )
  }


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="waki-scan-loading">

        <div className="waki-scan-spinner" />

        <p>
          Preparando escáner...
        </p>

      </div>
    )
  }


  const validationCopy =
    preview
      ? STATUS_COPY[
          preview.validation_status
        ]
      : null

  const isValid =
    preview?.validation_status ===
    'valid'

  const isVerified =
    preview?.validation_status ===
    'already_verified'

  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')

  const showPortalNavigation =
    staffRole === 'admin' ||
    staffRole === 'reception'


  /* =========================================================
     CONTENIDO PRINCIPAL DEL SCANNER
     ========================================================= */

  const scannerContent = (
    <div
      className="waki-scan-page"
      style={
        showPortalNavigation
          ? {
              minHeight: 'auto'
            }
          : undefined
      }
    >

      {/* TOPBAR SOLO PARA ROL SCANNER */}

      {!showPortalNavigation && (

        <header className="waki-scan-topbar">

          <div className="waki-scan-brand">

            <img
              src={wakiLogo}
              alt="WAKI"
            />

            <span>
              ESCÁNER
            </span>

          </div>


          <div className="waki-scan-user">

            <div>

              <strong>
                {profile?.full_name ||
                  'Equipo WAKI'
                }
              </strong>

              <span>
                {hotel?.name ||
                  'Hotel'
                }
              </span>

            </div>


            <button
              type="button"
              onClick={
                handleLogout
              }
              aria-label="Cerrar sesión"
            >

              <LogOut
                size={18}
                strokeWidth={1.8}
              />

            </button>

          </div>

        </header>

      )}


      <div className="waki-scan-shell">

        {/* HERO */}

        <section className="waki-scan-hero">

          <span className="waki-scan-eyebrow">
            CONTROL DE ACCESO
          </span>

          <h1>
            Escanea el QR del huésped
          </h1>

          <p>
            Valida la reserva y confirma los
            documentos antes de registrar el ingreso.
          </p>

        </section>


        {/* ERROR */}

        {errorMessage && (

          <div className="waki-scan-alert is-error">

            <XCircle
              size={19}
              strokeWidth={1.8}
            />

            <span>
              {errorMessage}
            </span>

          </div>

        )}


        {/* SUCCESS */}

        {successMessage && (

          <div className="waki-scan-alert is-success">

            <CheckCircle2
              size={19}
              strokeWidth={1.8}
            />

            <span>
              {successMessage}
            </span>

          </div>

        )}


        {/* CÁMARA */}

        {!preview && (

          <section className="waki-scan-card">

            <div className="waki-scan-camera">

              <div
                id="waki-dedicated-qr-reader"
                className="waki-scan-camera__reader"
              />


              {!cameraActive && (

                <div className="waki-scan-camera__empty">

                  <div>

                    <QrCode
                      size={39}
                      strokeWidth={1.45}
                    />

                    <strong>
                      Cámara lista
                    </strong>

                    <span>
                      Activa la cámara para leer el QR
                    </span>

                  </div>

                </div>

              )}


              {cameraActive && (

                <div className="waki-scan-frame">

                  <span className="corner corner--tl" />
                  <span className="corner corner--tr" />
                  <span className="corner corner--bl" />
                  <span className="corner corner--br" />

                  <span className="waki-scan-line" />

                </div>

              )}

            </div>


            <button
              type="button"
              className="waki-scan-primary"
              disabled={
                cameraStarting ||
                verifying
              }
              onClick={
                cameraActive
                  ? stopCamera
                  : startCamera
              }
            >

              {cameraActive ? (

                <XCircle
                  size={19}
                  strokeWidth={1.8}
                />

              ) : (

                <Camera
                  size={19}
                  strokeWidth={1.8}
                />

              )}


              {cameraStarting
                ? 'Activando cámara...'
                : cameraActive
                  ? 'Detener cámara'
                  : 'Activar cámara'
              }

            </button>


            <div className="waki-scan-divider">

              <span>
                o ingresa el código manualmente
              </span>

            </div>


            <div className="waki-scan-manual">

              <input
                type="text"
                value={
                  qrToken
                }
                placeholder="Token del QR"
                disabled={
                  verifying
                }
                onChange={(event) =>
                  setQrToken(
                    event.target.value
                  )
                }
              />


              <button
                type="button"
                disabled={
                  verifying ||
                  !qrToken.trim()
                }
                onClick={() =>
                  previewQr()
                }
              >

                {verifying
                  ? 'Validando...'
                  : 'Validar'
                }

              </button>

            </div>

          </section>

        )}


        {/* RESULTADO */}

        {preview && (

          <section
            className={[
              'waki-scan-result',

              isVerified
                ? 'is-success'
                : isValid
                  ? 'is-valid'
                  : 'is-error'

            ].join(' ')}
          >

            <div className="waki-scan-result__status">

              <div className="waki-scan-result__status-icon">

                {isVerified ? (

                  <BadgeCheck
                    size={28}
                    strokeWidth={1.8}
                  />

                ) : isValid ? (

                  <ShieldCheck
                    size={27}
                    strokeWidth={1.8}
                  />

                ) : (

                  <XCircle
                    size={27}
                    strokeWidth={1.8}
                  />

                )}

              </div>


              <div>

                <span>
                  {preview.booking_code}
                </span>

                <h2>
                  {validationCopy?.title ||
                    'Resultado'
                  }
                </h2>

                <p>
                  {validationCopy?.message}
                </p>

              </div>

            </div>


            <div className="waki-scan-reservation">

              <div>

                <span>
                  Huésped
                </span>

                <strong>
                  {preview.guest_name ||
                    '—'
                  }
                </strong>

              </div>


              <div>

                <span>
                  Habitación
                </span>

                <strong>
                  {preview.room_unit_name ||
                    preview.room_type_name ||
                    '—'
                  }
                </strong>

                {preview.room_unit_name &&
                  preview.room_type_name && (

                    <small>
                      {preview.room_type_name}
                    </small>

                  )}

              </div>


              <div>

                <span>
                  Horario
                </span>

                <strong>
                  {formatTimeRange(
                    preview.start_at,
                    preview.end_at
                  )}
                </strong>

                <small>
                  {formatDateTime(
                    preview.start_at
                  )}
                </small>

              </div>

            </div>


            {/* DOCUMENTOS */}

            {isValid && (

              <>

                <label className="waki-scan-documents">

                  <input
                    type="checkbox"
                    checked={
                      documentsVerified
                    }
                    disabled={
                      verifying
                    }
                    onChange={(event) =>
                      setDocumentsVerified(
                        event.target.checked
                      )
                    }
                  />


                  <div>

                    <FileCheck2
                      size={20}
                      strokeWidth={1.8}
                    />


                    <span>

                      <strong>
                        Documentos verificados
                      </strong>

                      <small>
                        Confirmo que revisé visualmente
                        los documentos del huésped.
                        WAKI no almacena una copia.
                      </small>

                    </span>

                  </div>

                </label>


                <button
                  type="button"
                  className="waki-scan-primary"
                  disabled={
                    verifying ||
                    !documentsVerified
                  }
                  onClick={
                    confirmAccess
                  }
                >

                  <BadgeCheck
                    size={19}
                    strokeWidth={1.8}
                  />

                  {verifying
                    ? 'Registrando acceso...'
                    : 'Confirmar acceso'
                  }

                </button>

              </>

            )}


            {/* YA VERIFICADO */}

            {isVerified && (

              <div className="waki-scan-verified-detail">

                <CheckCircle2
                  size={18}
                  strokeWidth={1.8}
                />

                <div>

                  <strong>
                    Ingreso registrado
                  </strong>

                  <span>
                    {formatDateTime(
                      preview.access_verified_at
                    )}
                  </span>

                </div>

              </div>

            )}


            <button
              type="button"
              className="waki-scan-secondary"
              onClick={
                resetScanner
              }
            >

              <RefreshCw
                size={18}
                strokeWidth={1.8}
              />

              Escanear otro QR

            </button>

          </section>

        )}


        {/* ACTIVIDAD */}

        <section className="waki-scan-recent">

          <div className="waki-scan-recent__heading">

            <div>

              <History
                size={20}
                strokeWidth={1.7}
              />

              <div>

                <span>
                  ACTIVIDAD
                </span>

                <h2>
                  Mis últimos accesos
                </h2>

              </div>

            </div>

          </div>


          {recentScans.length === 0 ? (

            <div className="waki-scan-recent__empty">

              <ScanLine
                size={26}
                strokeWidth={1.6}
              />

              <p>
                Tus accesos verificados aparecerán aquí.
              </p>

            </div>

          ) : (

            <div className="waki-scan-recent__list">

              {recentScans.map(
                (item) => (

                  <article
                    key={
                      item.reservation_id
                    }
                    className="waki-scan-recent__item"
                  >

                    <div className="waki-scan-recent__icon">

                      <BadgeCheck
                        size={18}
                        strokeWidth={1.8}
                      />

                    </div>


                    <div className="waki-scan-recent__copy">

                      <div>

                        <strong>
                          {item.guest_name ||
                            item.booking_code
                          }
                        </strong>

                        <span>
                          {item.booking_code}
                        </span>

                      </div>


                      <small>

                        {item.room_unit_name ||
                          item.room_type_name ||
                          'Habitación'
                        }

                        {' · '}

                        {formatDateTime(
                          item.access_verified_at
                        )}

                      </small>

                    </div>


                    {item.documents_verified && (

                      <FileCheck2
                        size={17}
                        strokeWidth={1.7}
                        className="waki-scan-recent__doc"
                      />

                    )}

                  </article>

                )
              )}

            </div>

          )}

        </section>

      </div>

    </div>
  )


  /* =========================================================
     ADMIN / RECEPTION → PORTAL CON SIDEBAR
     ========================================================= */

  if (showPortalNavigation) {
    return (
      <div className="hotel-portal">

        <HotelSidebar
          activeKey="scanner"

          hotelName={
            hotel?.name ||
            'Mi hotel'
          }

          hotelLocation={
            hotelLocation ||
            'Lima, Perú'
          }

          profileName={
            profile?.full_name ||
            'Equipo WAKI'
          }
        />


        <main className="hotel-dashboard">

          {scannerContent}

        </main>

      </div>
    )
  }


  /* =========================================================
     SCANNER → VISTA DEDICADA
     ========================================================= */

  return scannerContent
}