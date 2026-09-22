import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  Camera,
  Check,
  CircleDollarSign,
  Clock3,
  DoorOpen,
  FileCheck2,
  KeyRound,
  QrCode,
  UserRound,
  X
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import {
  Html5Qrcode
} from 'html5-qrcode'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  supabase
} from '../lib/supabase'


export default function HotelReservationDetailPage() {
  const navigate =
    useNavigate()

  const {
    reservationId
  } =
    useParams()


  /* =========================================================
     ESTADOS
     ========================================================= */

  const [loading, setLoading] =
    useState(true)

  const [verifying, setVerifying] =
    useState(false)

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [reservation, setReservation] =
    useState(null)

  const [currentTime, setCurrentTime] =
    useState(
      new Date()
    )

  const [qrToken, setQrToken] =
    useState('')

  const [documentsVerified, setDocumentsVerified] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [scannerOpen, setScannerOpen] =
    useState(false)

  const [cameraError, setCameraError] =
    useState('')

  const [cameraStarted, setCameraStarted] =
    useState(false)

  const [cameraStarting, setCameraStarting] =
    useState(false)

  const scannerRef =
    useRef(null)

  const scanLockedRef =
    useRef(false)


  /* =========================================================
     RELOJ LOCAL
     ========================================================= */

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setCurrentTime(
            new Date()
          )
        },
        1000
      )


    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [])


  /* =========================================================
     CARGA INICIAL
     ========================================================= */

  useEffect(() => {
    loadInitialData()
  }, [reservationId])


  /* =========================================================
     REALTIME
     ========================================================= */

  useEffect(() => {
    if (!reservationId) {
      return undefined
    }


    const channel =
      supabase
        .channel(
          `hotel-reservation-${reservationId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter:
              `id=eq.${reservationId}`
          },
          () => {
            loadReservation(
              false
            )
          }
        )
        .subscribe()


    return () => {
      supabase
        .removeChannel(
          channel
        )
    }
  }, [reservationId])


  /* =========================================================
     ESCÁNER QR — MODO MÓVIL SEGURO
     ========================================================= */

  useEffect(() => {
    return () => {
      stopQrScanner()
    }
  }, [])


  async function startQrScanner() {
    if (
      cameraStarting ||
      cameraStarted
    ) {
      return
    }


    try {
      setCameraStarting(true)
      setCameraError('')
      setErrorMessage('')

      scanLockedRef.current =
        false


      const cameras =
        await Html5Qrcode
          .getCameras()


      if (
        !cameras ||
        cameras.length === 0
      ) {
        throw new Error(
          'No encontramos ninguna cámara disponible en este dispositivo.'
        )
      }


      const preferredCamera =
        cameras.find(
          (camera) => {
            const label =
              (
                camera.label ||
                ''
              )
                .toLowerCase()


            return (
              label.includes('back') ||
              label.includes('rear') ||
              label.includes('environment') ||
              label.includes('trasera')
            )
          }
        ) ||
        cameras[
          cameras.length - 1
        ] ||
        cameras[0]


      const readerElement =
        document.getElementById(
          'waki-hotel-qr-reader'
        )


      if (!readerElement) {
        throw new Error(
          'No encontramos el visor de cámara.'
        )
      }


      const scanner =
        new Html5Qrcode(
          'waki-hotel-qr-reader'
        )


      scannerRef.current =
        scanner


      await scanner.start(
        preferredCamera.id,
        {
          fps:
            10,

          qrbox: (
            viewfinderWidth,
            viewfinderHeight
          ) => {
            const minEdge =
              Math.min(
                viewfinderWidth,
                viewfinderHeight
              )


            const size =
              Math.floor(
                minEdge * .72
              )


            return {
              width:
                size,

              height:
                size
            }
          }
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


          await handleQrDetected(
            decodedText
          )
        },
        () => {}
      )


      setCameraStarted(
        true
      )

    } catch (error) {
      console.error(
        'Error iniciando cámara QR:',
        error
      )


      const rawMessage =
        String(
          error?.message ||
          error ||
          ''
        )


      if (
        rawMessage.includes(
          'Permission'
        ) ||
        rawMessage.includes(
          'NotAllowedError'
        ) ||
        rawMessage.includes(
          'permission'
        )
      ) {
        setCameraError(
          'El navegador bloqueó la cámara. En los permisos del sitio activa Cámara para hotel.wakipe.com y vuelve a intentarlo.'
        )

      } else if (
        rawMessage.includes(
          'NotFoundError'
        ) ||
        rawMessage.includes(
          'DevicesNotFoundError'
        )
      ) {
        setCameraError(
          'No encontramos una cámara disponible en este dispositivo.'
        )

      } else if (
        rawMessage.includes(
          'NotReadableError'
        ) ||
        rawMessage.includes(
          'TrackStartError'
        )
      ) {
        setCameraError(
          'La cámara está siendo utilizada por otra aplicación. Cierra otra app que pueda estar usando la cámara e inténtalo nuevamente.'
        )

      } else if (
        rawMessage.includes(
          'secure'
        ) ||
        rawMessage.includes(
          'HTTPS'
        )
      ) {
        setCameraError(
          'La cámara requiere una conexión HTTPS segura.'
        )

      } else {
        setCameraError(
          rawMessage ||
          'No pudimos acceder a la cámara. Revisa los permisos del navegador y vuelve a intentarlo.'
        )
      }

    } finally {
      setCameraStarting(
        false
      )
    }
  }


  async function stopQrScanner() {
    const scanner =
      scannerRef.current


    scannerRef.current =
      null


    if (!scanner) {
      setCameraStarted(
        false
      )

      return
    }


    try {
      await scanner.stop()
    } catch {}


    try {
      scanner.clear()
    } catch {}


    setCameraStarted(
      false
    )
  }


  function normalizeQrValue(
    value
  ) {
    const cleanValue =
      String(
        value ||
        ''
      )
        .trim()


    if (!cleanValue) {
      return ''
    }


    try {
      const url =
        new URL(
          cleanValue
        )


      const tokenFromQuery =
        url.searchParams.get(
          'qr_token'
        ) ||
        url.searchParams.get(
          'token'
        ) ||
        url.searchParams.get(
          'qr'
        )


      if (tokenFromQuery) {
        return tokenFromQuery.trim()
      }

    } catch {}


    return cleanValue
  }


  async function handleQrDetected(
    decodedText
  ) {
    const cleanToken =
      normalizeQrValue(
        decodedText
      )


    if (!cleanToken) {
      scanLockedRef.current =
        false

      return
    }


    setQrToken(
      cleanToken
    )


    await stopQrScanner()


    setScannerOpen(
      false
    )


    await verifyAccessToken(
      cleanToken
    )
  }


  async function closeScanner() {
    await stopQrScanner()

    setScannerOpen(
      false
    )

    setCameraError('')
  }


  /* =========================================================
     CARGA PRINCIPAL
     ========================================================= */

  async function loadInitialData() {
    try {
      setLoading(true)

      setErrorMessage('')


      /* =====================================================
         SESIÓN
         ===================================================== */

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
        throw new Error(
          'No encontramos una sesión activa.'
        )
      }


      /* =====================================================
         PERFIL
         ===================================================== */

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


      /* =====================================================
         HOTEL STAFF
         ===================================================== */

      const {
        data: staffData,
        error: staffError
      } =
        await supabase
          .from('hotel_staff')
          .select(`
            hotel_id
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .eq(
            'is_active',
            true
          )
          .limit(1)
          .maybeSingle()


      if (staffError) {
        throw staffError
      }


      if (!staffData?.hotel_id) {
        throw new Error(
          'Esta cuenta no tiene una sede asignada.'
        )
      }


      /* =====================================================
         HOTEL
         ===================================================== */

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
            staffData.hotel_id
          )
          .maybeSingle()


      if (hotelError) {
        throw hotelError
      }


      if (!hotelData) {
        throw new Error(
          'No encontramos la información del hotel.'
        )
      }


      setHotel(
        hotelData
      )


      await loadReservation(
        false,
        staffData.hotel_id
      )

    } catch (error) {
      console.error(
        'Error cargando detalle de reserva:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar la reserva.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     CARGAR RESERVA
     ========================================================= */

  async function loadReservation(
    showLoader = false,
    targetHotelId = hotel?.id
  ) {
    try {
      if (showLoader) {
        setLoading(true)
      }


      setErrorMessage('')


      let query =
        supabase
          .from('reservations')
          .select(`
            id,
            booking_code,
            hotel_id,
            user_id,
            guest_name,
            guest_phone,
            guest_email,
            room_type_id,
            room_unit_id,
            rate_plan_id,
            start_at,
            end_at,
            duration_minutes,
            status,
            payment_status,
            total_amount,
            currency,
            access_status,
            access_verified_at,
            documents_verified_at,
            checked_in_at,
            created_at,

            room_types (
              id,
              name
            ),

            room_units (
              id,
              unit_code,
              display_name,
              floor
            ),

            rate_plans (
              id,
              name,
              duration_minutes,
              base_price,
              currency
            )
          `)
          .eq(
            'id',
            reservationId
          )


      if (targetHotelId) {
        query =
          query.eq(
            'hotel_id',
            targetHotelId
          )
      }


      const {
        data,
        error
      } =
        await query
          .maybeSingle()


      if (error) {
        throw error
      }


      if (!data) {
        throw new Error(
          'No encontramos esta reserva o no pertenece a tu hotel.'
        )
      }


      setReservation(
        data
      )

    } catch (error) {
      console.error(
        'Error cargando reserva:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos actualizar la reserva.'
      )

    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }


  /* =========================================================
     FORMATO FECHA
     ========================================================= */

  function formatDate(
    value
  ) {
    if (!value) {
      return '—'
    }


    return new Intl.DateTimeFormat(
      'es-PE',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    )
      .format(
        new Date(
          value
        )
      )
  }


  /* =========================================================
     FORMATO HORA
     ========================================================= */

  function formatTime(
    value
  ) {
    if (!value) {
      return '—'
    }


    return new Intl.DateTimeFormat(
      'es-PE',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }
    )
      .format(
        new Date(
          value
        )
      )
  }


  /* =========================================================
     FORMATO PRECIO
     ========================================================= */

  function formatPrice(
    value,
    currency = 'PEN'
  ) {
    return new Intl.NumberFormat(
      'es-PE',
      {
        style:
          'currency',

        currency:
          currency ||
          'PEN'
      }
    )
      .format(
        Number(
          value ||
          0
        )
      )
  }


  /* =========================================================
     ESTADO TEMPORAL
     ========================================================= */

  const timeStatus =
    useMemo(
      () => {
        if (!reservation) {
          return null
        }


        if (
          [
            'cancelled',
            'payment_failed',
            'refunded'
          ].includes(
            reservation.status
          )
        ) {
          return {
            key:
              'cancelled',

            label:
              'Cancelada'
          }
        }


        if (
          reservation.payment_status !==
          'paid'
        ) {
          return {
            key:
              'payment_pending',

            label:
              'Pago pendiente'
          }
        }


        const now =
          currentTime.getTime()

        const start =
          new Date(
            reservation.start_at
          ).getTime()

        const end =
          new Date(
            reservation.end_at
          ).getTime()


        if (
          now < start
        ) {
          return {
            key:
              'upcoming',

            label:
              'Próxima'
          }
        }


        if (
          now >= start &&
          now < end
        ) {
          const remaining =
            end -
            now


          if (
            remaining <=
            15 * 60 * 1000
          ) {
            return {
              key:
                'ending',

              label:
                'Por finalizar'
            }
          }


          return {
            key:
              'active',

            label:
              'En curso'
          }
        }


        return {
          key:
            'ended',

          label:
            'Finalizada'
        }
      },
      [
        reservation,
        currentTime
      ]
    )


  /* =========================================================
     CONTADOR
     ========================================================= */

  const countdown =
    useMemo(
      () => {
        if (!reservation) {
          return '--:--:--'
        }


        const now =
          currentTime.getTime()

        const start =
          new Date(
            reservation.start_at
          ).getTime()

        const end =
          new Date(
            reservation.end_at
          ).getTime()


        let milliseconds =
          0


        if (
          now < start
        ) {
          milliseconds =
            start -
            now

        } else if (
          now < end
        ) {
          milliseconds =
            end -
            now

        } else {
          return '00:00:00'
        }


        const totalSeconds =
          Math.max(
            0,
            Math.floor(
              milliseconds /
              1000
            )
          )


        const hours =
          Math.floor(
            totalSeconds /
            3600
          )

        const minutes =
          Math.floor(
            (
              totalSeconds %
              3600
            ) /
            60
          )

        const seconds =
          totalSeconds %
          60


        return [
          hours,
          minutes,
          seconds
        ]
          .map(
            (value) =>
              String(
                value
              )
                .padStart(
                  2,
                  '0'
                )
          )
          .join(':')
      },
      [
        reservation,
        currentTime
      ]
    )


  /* =========================================================
     VERIFICAR QR
     ========================================================= */

  async function verifyAccessToken(
    token
  ) {
    const cleanToken =
      normalizeQrValue(
        token
      )


    if (!cleanToken) {
      setErrorMessage(
        'Ingresa o escanea el código QR de la reserva.'
      )

      return
    }


    try {
      setVerifying(true)

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .rpc(
            'hotel_verify_reservation_access',
            {
              target_qr_token:
                cleanToken,

              target_documents_verified:
                documentsVerified
            }
          )


      if (error) {
        throw error
      }


      setSuccessMessage(
        documentsVerified
          ? 'Acceso y documentos verificados correctamente.'
          : 'Acceso verificado correctamente.'
      )


      setQrToken('')


      await loadReservation(
        false
      )

    } catch (error) {
      console.error(
        'Error verificando QR:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos validar este código QR.'
      )

    } finally {
      setVerifying(false)

      scanLockedRef.current =
        false
    }
  }


  async function verifyQr(
    event
  ) {
    event.preventDefault()


    await verifyAccessToken(
      qrToken
    )
  }


  /* =========================================================
     UBICACIÓN HOTEL
     ========================================================= */

  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')


  /* =========================================================
     LOADER
     ========================================================= */

  if (loading) {
    return (
      <WakiGlobalLoader
        title="Preparando la reserva..."
        subtitle="Cargando información operativa"
      />
    )
  }


  /* =========================================================
     ERROR SIN RESERVA
     ========================================================= */

  if (!reservation) {
    return (
      <div className="hotel-portal">

        <HotelSidebar
          activeKey="reservas"

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

          <button
            type="button"
            className="hotel-back-button"
            onClick={() =>
              navigate(
                '/reservas'
              )
            }
          >
            <ArrowLeft
              size={18}
            />

            Volver a reservas
          </button>


          <div className="hotel-dashboard-error">
            {errorMessage ||
              'No encontramos esta reserva.'
            }
          </div>

        </main>

      </div>
    )
  }


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">

      <HotelSidebar
        activeKey="reservas"

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


      <main className="hotel-dashboard hotel-reservation-detail">

        <button
          type="button"
          className="hotel-back-button"
          onClick={() =>
            navigate(
              '/reservas'
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a reservas

        </button>


        {/* =================================================
            HEADER
            ================================================= */}

        <header className="hotel-reservation-detail__header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Detalle de reserva
            </span>

            <h1>
              {reservation.booking_code}
            </h1>

            <p>
              Información operativa y validación
              de acceso del huésped.
            </p>

          </div>


          <div
            className={
              `hotel-reservation-detail__status is-${timeStatus?.key}`
            }
          >

            <span>
              {timeStatus?.label}
            </span>

            <strong>
              {countdown}
            </strong>

            <small>
              {timeStatus?.key ===
              'upcoming'
                ? 'para iniciar'
                : timeStatus?.key ===
                    'ended'
                  ? 'tiempo finalizado'
                  : 'restantes'
              }
            </small>

          </div>

        </header>


        {errorMessage && (

          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>

        )}


        {successMessage && (

          <div className="hotel-dashboard-success">

            <Check
              size={17}
            />

            {successMessage}

          </div>

        )}


        {/* =================================================
            HABITACIÓN PRINCIPAL
            ================================================= */}

        <section className="hotel-reservation-room-card">

          <div className="hotel-reservation-room-card__icon">

            <DoorOpen
              size={26}
              strokeWidth={1.7}
            />

          </div>


          <div className="hotel-reservation-room-card__copy">

            <span>
              HABITACIÓN
            </span>

            <strong>
              {
                reservation
                  .room_units
                  ?.unit_code ||
                'Sin asignar'
              }
            </strong>

            <p>
              {
                reservation
                  .room_types
                  ?.name ||
                'Tipo de habitación'
              }
            </p>


            {
              reservation
                .room_units
                ?.floor &&
              (
                <small>
                  {
                    reservation
                      .room_units
                      .floor
                  }
                </small>
              )
            }

          </div>


          <BedDouble
            className="hotel-reservation-room-card__decoration"
            size={68}
            strokeWidth={1}
          />

        </section>


        {/* =================================================
            GRID
            ================================================= */}

        <div className="hotel-reservation-detail__grid">

          {/* ===============================================
              INFORMACIÓN
              =============================================== */}

          <section className="hotel-reservation-panel">

            <div className="hotel-reservation-panel__heading">

              <CalendarDays
                size={20}
              />

              <div>

                <span>
                  RESERVA
                </span>

                <h2>
                  Información de la estadía
                </h2>

              </div>

            </div>


            <div className="hotel-reservation-info-grid">

              <div className="hotel-reservation-info">

                <CalendarDays
                  size={17}
                />

                <div>

                  <span>
                    Fecha
                  </span>

                  <strong>
                    {
                      formatDate(
                        reservation.start_at
                      )
                    }
                  </strong>

                </div>

              </div>


              <div className="hotel-reservation-info">

                <Clock3
                  size={17}
                />

                <div>

                  <span>
                    Horario
                  </span>

                  <strong>
                    {
                      formatTime(
                        reservation.start_at
                      )
                    }
                    {' — '}
                    {
                      formatTime(
                        reservation.end_at
                      )
                    }
                  </strong>

                </div>

              </div>


              <div className="hotel-reservation-info">

                <KeyRound
                  size={17}
                />

                <div>

                  <span>
                    Tarifa
                  </span>

                  <strong>
                    {
                      reservation
                        .rate_plans
                        ?.name ||
                      '—'
                    }
                  </strong>

                </div>

              </div>


              <div className="hotel-reservation-info">

                <CircleDollarSign
                  size={17}
                />

                <div>

                  <span>
                    Total
                  </span>

                  <strong>
                    {
                      formatPrice(
                        reservation.total_amount,
                        reservation.currency
                      )
                    }
                  </strong>

                </div>

              </div>

            </div>

          </section>


          {/* ===============================================
              HUÉSPED
              =============================================== */}

          <section className="hotel-reservation-panel">

            <div className="hotel-reservation-panel__heading">

              <UserRound
                size={20}
              />

              <div>

                <span>
                  HUÉSPED
                </span>

                <h2>
                  Datos del titular
                </h2>

              </div>

            </div>


            <div className="hotel-reservation-guest">

              <div className="hotel-reservation-guest__avatar">

                {
                  reservation
                    .guest_name
                    ?.charAt(0)
                    ?.toUpperCase() ||
                  'W'
                }

              </div>


              <div>

                <strong>
                  {
                    reservation
                      .guest_name ||
                    'Huésped WAKI'
                  }
                </strong>

                <span>
                  {
                    reservation
                      .guest_phone ||
                    reservation
                      .guest_email ||
                    'Contacto no registrado'
                  }
                </span>

              </div>

            </div>

          </section>


          {/* ===============================================
              PAGO
              =============================================== */}

          <section className="hotel-reservation-panel">

            <div className="hotel-reservation-panel__heading">

              <CircleDollarSign
                size={20}
              />

              <div>

                <span>
                  PAGO
                </span>

                <h2>
                  Estado comercial
                </h2>

              </div>

            </div>


            <div
              className={
                `hotel-reservation-operation-status ${
                  reservation.payment_status ===
                  'paid'
                    ? 'is-success'
                    : 'is-pending'
                }`
              }
            >

              <BadgeCheck
                size={20}
              />

              <div>

                <strong>
                  {
                    reservation.payment_status ===
                    'paid'
                      ? 'Pagado'
                      : 'Pago pendiente'
                  }
                </strong>

                <span>
                  {
                    formatPrice(
                      reservation.total_amount,
                      reservation.currency
                    )
                  }
                </span>

              </div>

            </div>

          </section>


          {/* ===============================================
              ACCESO
              =============================================== */}

          <section className="hotel-reservation-panel">

            <div className="hotel-reservation-panel__heading">

              <QrCode
                size={20}
              />

              <div>

                <span>
                  ACCESO
                </span>

                <h2>
                  Validación del huésped
                </h2>

              </div>

            </div>


            <div
              className={
                `hotel-reservation-operation-status ${
                  reservation.access_status ===
                  'verified'
                    ? 'is-success'
                    : 'is-pending'
                }`
              }
            >

              <BadgeCheck
                size={20}
              />

              <div>

                <strong>
                  {
                    reservation.access_status ===
                    'verified'
                      ? 'Acceso verificado'
                      : 'Pendiente'
                  }
                </strong>

                <span>
                  {
                    reservation.access_verified_at
                      ? `Validado ${formatTime(
                          reservation.access_verified_at
                        )}`
                      : 'El QR todavía no ha sido validado'
                  }
                </span>

              </div>

            </div>


            <div
              className={
                `hotel-reservation-operation-status ${
                  reservation.documents_verified_at
                    ? 'is-success'
                    : 'is-pending'
                }`
              }
            >

              <FileCheck2
                size={20}
              />

              <div>

                <strong>
                  {
                    reservation.documents_verified_at
                      ? 'Documentos verificados'
                      : 'Documentos pendientes'
                  }
                </strong>

                <span>
                  {
                    reservation.documents_verified_at
                      ? `Verificados ${formatTime(
                          reservation.documents_verified_at
                        )}`
                      : 'No se almacena información sensible del documento'
                  }
                </span>

              </div>

            </div>

          </section>

        </div>


        {/* =================================================
            VALIDAR QR
            ================================================= */}

        {
          reservation.access_status !==
          'verified' &&
          reservation.payment_status ===
          'paid' &&
          (
            <section className="hotel-reservation-qr-card">

              <div className="hotel-reservation-qr-card__heading">

                <div className="hotel-reservation-qr-card__icon">

                  <QrCode
                    size={24}
                  />

                </div>


                <div>

                  <span>
                    CHECK-IN
                  </span>

                  <h2>
                    Validar QR del huésped
                  </h2>

                  <p>
                    La validación confirma el acceso.
                    No modifica el horario de la reserva.
                  </p>

                </div>

              </div>


              <button
                type="button"
                className="hotel-reservation-scan-button"
                disabled={
                  verifying
                }
                onClick={() => {
                  setCameraError('')
                  setCameraStarted(false)
                  setScannerOpen(true)
                }}
              >

                <Camera
                  size={18}
                  strokeWidth={1.8}
                />

                Escanear QR con cámara

              </button>


              <div className="hotel-reservation-qr-divider">

                <span>
                  o ingresa el código manualmente
                </span>

              </div>


              <form
                className="hotel-reservation-qr-form"
                onSubmit={
                  verifyQr
                }
              >

                <label>

                  <span>
                    Código QR
                  </span>

                  <input
                    type="text"
                    value={
                      qrToken
                    }
                    placeholder="Escanea o pega el token del QR"
                    disabled={
                      verifying
                    }
                    onChange={(event) =>
                      setQrToken(
                        event.target.value
                      )
                    }
                  />

                </label>


                <label className="hotel-reservation-checkbox">

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

                  <span>
                    También confirmé visualmente
                    los documentos del huésped
                  </span>

                </label>


                <button
                  type="submit"
                  className="hotel-primary-button"
                  disabled={
                    verifying
                  }
                >

                  {
                    verifying
                      ? (
                        <span className="hotel-inline-spinner" />
                      )
                      : (
                        <QrCode
                          size={17}
                        />
                      )
                  }

                  {
                    verifying
                      ? 'Validando...'
                      : 'Validar acceso'
                  }

                </button>

              </form>

            </section>
          )
        }

      </main>

    </div>
  )
}