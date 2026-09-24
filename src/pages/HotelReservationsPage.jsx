import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Search,
  ShieldCheck,
  UserRound
} from 'lucide-react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import {
  supabase
} from '../lib/supabase'


export default function HotelReservationsPage() {
  const navigate =
    useNavigate()


  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [hotelId, setHotelId] =
    useState(null)

  const [reservations, setReservations] =
    useState([])

  const [extensionSummaries, setExtensionSummaries] =
    useState({})

  const [search, setSearch] =
    useState('')

  const [activeFilter, setActiveFilter] =
    useState('now')

  const [currentTime, setCurrentTime] =
    useState(
      new Date()
    )


  /* =========================================================
     RELOJ
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
    loadReservations()
  }, [])


  /* =========================================================
     REALTIME
     ========================================================= */

  useEffect(() => {
    if (!hotelId) {
      return undefined
    }


    const channel =
      supabase
        .channel(
          `hotel-reservations-${hotelId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter:
              `hotel_id=eq.${hotelId}`
          },
          () => {
            loadReservationRows(
              hotelId
            )
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservation_extensions'
          },
          () => {
            loadExtensionSummaries(
              hotelId
            )

            loadReservationRows(
              hotelId
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
  }, [hotelId])


  /* =========================================================
     CARGAR TODO
     ========================================================= */

  async function loadReservations() {
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


      setHotelId(
        staffData.hotel_id
      )


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
            province,
            timezone
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


      await loadReservationRows(
        staffData.hotel_id
      )

      await loadExtensionSummaries(
        staffData.hotel_id
      )

    } catch (error) {
      console.error(
        'Error cargando reservas:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar las reservas.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     CARGAR RESERVAS
     ========================================================= */

  async function loadReservationRows(
    targetHotelId
  ) {
    const {
      data,
      error
    } =
      await supabase
        .from('reservations')
        .select(`
          id,
          booking_code,

          guest_name,
          guest_phone,
          guest_email,

          start_at,
          end_at,
          duration_minutes,

          rate_name,
          total_amount,
          currency,

          status,
          payment_status,

          access_status,
          access_verified_at,
          documents_verified_at,

          created_at,
          confirmed_at,
          checked_in_at,
          completed_at,

          room_types (
            id,
            name
          ),

          room_units (
            id,
            unit_code,
            display_name,
            floor
          )
        `)
        .eq(
          'hotel_id',
          targetHotelId
        )
        .order(
          'start_at',
          {
            ascending: true
          }
        )


    if (error) {
      throw error
    }


    setReservations(
      data || []
    )
  }


  /* =========================================================
     RESUMEN DE EXTENSIONES
     ========================================================= */

  async function loadExtensionSummaries(
    targetHotelId
  ) {
    const {
      data,
      error
    } =
      await supabase.rpc(
        'hotel_get_reservation_extension_summaries',
        {
          target_hotel_id:
            targetHotelId
        }
      )


    if (error) {
      console.error(
        'Error cargando resumen de extensiones:',
        error
      )

      return
    }


    const map = {}

    ;(
      Array.isArray(data)
        ? data
        : []
    ).forEach(
      (item) => {
        map[
          item.reservation_id
        ] =
          item
      }
    )


    setExtensionSummaries(
      map
    )
  }


  function formatExtensionDuration(
    minutes
  ) {
    const totalMinutes =
      Number(
        minutes ||
        0
      )

    const hours =
      Math.floor(
        totalMinutes /
        60
      )

    const remaining =
      totalMinutes %
      60


    if (
      hours > 0 &&
      remaining > 0
    ) {
      return `${hours} h ${remaining} min`
    }


    if (hours > 0) {
      return `${hours} h`
    }


    return `${remaining} min`
  }


  /* =========================================================
     FECHA
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
        timeZone:
          hotel?.timezone ||
          'America/Lima',

        day: '2-digit',
        month: 'short'
      }
    ).format(
      new Date(value)
    )
  }


  /* =========================================================
     HORA
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
        timeZone:
          hotel?.timezone ||
          'America/Lima',

        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }
    ).format(
      new Date(value)
    )
  }


  /* =========================================================
     DINERO
     ========================================================= */

  function formatMoney(
    value,
    currency = 'PEN'
  ) {
    return new Intl.NumberFormat(
      'es-PE',
      {
        style: 'currency',

        currency:
          currency ||
          'PEN'
      }
    ).format(
      Number(
        value || 0
      )
    )
  }


  /* =========================================================
     ESTADO TEMPORAL
     ========================================================= */

  function getTimeStatus(
    reservation
  ) {
    const start =
      new Date(
        reservation.start_at
      )

    const end =
      new Date(
        reservation.end_at
      )


    if (
      reservation.status ===
        'cancelled' ||
      reservation.status ===
        'payment_failed' ||
      reservation.status ===
        'refunded'
    ) {
      return 'cancelled'
    }


    if (
      reservation.payment_status !==
      'paid'
    ) {
      return 'payment_pending'
    }


    if (
      currentTime < start
    ) {
      return 'upcoming'
    }


    if (
      currentTime >= start &&
      currentTime < end
    ) {
      const difference =
        end.getTime() -
        currentTime.getTime()


      const minutes =
        difference /
        1000 /
        60


      if (
        minutes <= 15
      ) {
        return 'ending_soon'
      }


      return 'active'
    }


    return 'ended'
  }


  /* =========================================================
     TIEMPO RESTANTE
     ========================================================= */

  function getRemainingTime(
    reservation
  ) {
    const end =
      new Date(
        reservation.end_at
      )


    const difference =
      end.getTime() -
      currentTime.getTime()


    if (
      difference <= 0
    ) {
      return '00:00:00'
    }


    const totalSeconds =
      Math.floor(
        difference /
        1000
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
          String(value)
            .padStart(
              2,
              '0'
            )
      )
      .join(':')
  }


  /* =========================================================
     FALTA PARA COMENZAR
     ========================================================= */

  function getStartsIn(
    reservation
  ) {
    const start =
      new Date(
        reservation.start_at
      )


    const difference =
      start.getTime() -
      currentTime.getTime()


    if (
      difference <= 0
    ) {
      return null
    }


    const totalMinutes =
      Math.max(
        1,
        Math.floor(
          difference /
          1000 /
          60
        )
      )


    if (
      totalMinutes < 60
    ) {
      return `${totalMinutes} min`
    }


    const hours =
      Math.floor(
        totalMinutes /
        60
      )


    const minutes =
      totalMinutes %
      60


    if (
      minutes === 0
    ) {
      return `${hours} h`
    }


    return (
      `${hours} h ${minutes} min`
    )
  }


  /* =========================================================
     MÉTRICAS
     ========================================================= */

  const metrics =
    useMemo(
      () => {
        const active =
          reservations.filter(
            (reservation) =>
              getTimeStatus(
                reservation
              ) ===
              'active'
          ).length


        const endingSoon =
          reservations.filter(
            (reservation) =>
              getTimeStatus(
                reservation
              ) ===
              'ending_soon'
          ).length


        const upcoming =
          reservations.filter(
            (reservation) =>
              getTimeStatus(
                reservation
              ) ===
              'upcoming'
          ).length


        const ended =
          reservations.filter(
            (reservation) =>
              getTimeStatus(
                reservation
              ) ===
              'ended'
          ).length


        return {
          active,
          endingSoon,
          upcoming,
          ended
        }
      },
      [
        reservations,
        currentTime
      ]
    )


  /* =========================================================
     FILTRAR
     ========================================================= */

  const visibleReservations =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase()


        return reservations
          .filter(
            (reservation) => {

              const timeStatus =
                getTimeStatus(
                  reservation
                )


              if (
                activeFilter ===
                'now'
              ) {
                return [
                  'active',
                  'ending_soon'
                ].includes(
                  timeStatus
                )
              }


              if (
                activeFilter ===
                'upcoming'
              ) {
                return (
                  timeStatus ===
                  'upcoming'
                )
              }


              if (
                activeFilter ===
                'ended'
              ) {
                return (
                  timeStatus ===
                  'ended'
                )
              }


              return true
            }
          )
          .filter(
            (reservation) => {

              if (
                !normalizedSearch
              ) {
                return true
              }


              const searchable =
                [
                  reservation.booking_code,
                  reservation.guest_name,
                  reservation.guest_phone,
                  reservation.room_types?.name,
                  reservation.room_units?.unit_code,
                  reservation.room_units?.display_name
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()


              return searchable
                .includes(
                  normalizedSearch
                )
            }
          )
      },
      [
        reservations,
        activeFilter,
        search,
        currentTime
      ]
    )


  /* =========================================================
     UBICACIÓN
     ========================================================= */

  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tus reservas..."
      subtitle="Sincronizando la operación"
    />
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


      <main className="hotel-dashboard hotel-live-reservations">

        {/* =================================================
            HEADER
            ================================================= */}

        <header className="hotel-live-reservations__header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Operación en tiempo real
            </span>

            <h1>
              Reservas
            </h1>

            <p>
              Sigue automáticamente las estadías,
              horarios y accesos de tu hotel.
            </p>

          </div>


          <div className="hotel-live-indicator">

            <span />

            En vivo

          </div>

        </header>


        {errorMessage && (

          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>

        )}


        {/* =================================================
            STATS
            ================================================= */}

        <section className="hotel-live-reservations__stats">

          <article>

            <div className="hotel-live-stat-icon is-purple">

              <Clock3
                size={22}
                strokeWidth={1.8}
              />

            </div>

            <div>

              <span>
                En curso
              </span>

              <strong>
                {
                  metrics.active +
                  metrics.endingSoon
                }
              </strong>

            </div>

          </article>


          <article>

            <div className="hotel-live-stat-icon is-warning">

              <CalendarClock
                size={22}
                strokeWidth={1.8}
              />

            </div>

            <div>

              <span>
                Por finalizar
              </span>

              <strong>
                {metrics.endingSoon}
              </strong>

            </div>

          </article>


          <article>

            <div className="hotel-live-stat-icon is-blue">

              <CalendarDays
                size={22}
                strokeWidth={1.8}
              />

            </div>

            <div>

              <span>
                Próximas
              </span>

              <strong>
                {metrics.upcoming}
              </strong>

            </div>

          </article>


          <article>

            <div className="hotel-live-stat-icon is-green">

              <CheckCircle2
                size={22}
                strokeWidth={1.8}
              />

            </div>

            <div>

              <span>
                Finalizadas
              </span>

              <strong>
                {metrics.ended}
              </strong>

            </div>

          </article>

        </section>


        {/* =================================================
            PANEL
            ================================================= */}

        <section className="hotel-live-reservations__panel">

          <div className="hotel-live-reservations__toolbar">

            <div className="hotel-live-tabs">

              <button
                type="button"
                className={
                  activeFilter ===
                  'now'
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  setActiveFilter(
                    'now'
                  )
                }
              >

                Ahora

                <span>
                  {
                    metrics.active +
                    metrics.endingSoon
                  }
                </span>

              </button>


              <button
                type="button"
                className={
                  activeFilter ===
                  'upcoming'
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  setActiveFilter(
                    'upcoming'
                  )
                }
              >

                Próximas

                <span>
                  {metrics.upcoming}
                </span>

              </button>


              <button
                type="button"
                className={
                  activeFilter ===
                  'ended'
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  setActiveFilter(
                    'ended'
                  )
                }
              >

                Finalizadas

                <span>
                  {metrics.ended}
                </span>

              </button>


              <button
                type="button"
                className={
                  activeFilter ===
                  'all'
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  setActiveFilter(
                    'all'
                  )
                }
              >

                Todas

                <span>
                  {reservations.length}
                </span>

              </button>

            </div>


            <label className="hotel-reservations-search">

              <Search
                size={18}
                strokeWidth={1.8}
              />

              <input
                type="search"
                value={
                  search
                }
                placeholder="Buscar reserva o huésped"
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </label>

          </div>


          {/* =================================================
              VACÍO
              ================================================= */}

          {visibleReservations.length === 0 ? (

            <div className="hotel-live-empty">

              <CalendarDays
                size={35}
                strokeWidth={1.5}
              />

              <strong>

                {activeFilter === 'now'
                  ? 'No hay estadías en curso'
                  : 'No hay reservas para mostrar'
                }

              </strong>


              <p>

                {activeFilter === 'now'
                  ? (
                    'Las reservas aparecerán aquí automáticamente cuando llegue su horario.'
                  )
                  : (
                    'Cuando existan reservas en esta categoría aparecerán aquí.'
                  )
                }

              </p>

            </div>

          ) : (

            <div className="hotel-live-reservation-list">

              {visibleReservations.map(
                (reservation) => {

                  const timeStatus =
                    getTimeStatus(
                      reservation
                    )


                  const roomCode =
                    reservation
                      .room_units
                      ?.unit_code ||
                    'Sin asignar'


                  const roomType =
                    reservation
                      .room_types
                      ?.name ||
                    'Habitación'


                  const accessVerified =
                    reservation
                      .access_status ===
                      'verified' ||
                    Boolean(
                      reservation
                        .access_verified_at
                    )


                  const extensionSummary =
                    extensionSummaries[
                      reservation.id
                    ]


                  return (
                    <article
                      key={
                        reservation.id
                      }
                      className={
                        `hotel-live-reservation-card is-${timeStatus}`
                      }
                      onClick={() =>
                        navigate(
                          `/reservas/${reservation.id}`
                        )
                      }
                    >

                      {/* =====================================
                          HABITACIÓN
                          ===================================== */}

                      <div className="hotel-live-reservation-card__room">

                        <div className="hotel-live-room-icon">

                          <DoorOpen
                            size={24}
                            strokeWidth={1.7}
                          />

                        </div>


                        <div>

                          <span className="hotel-live-field-label">
                            Habitación
                          </span>

                          <strong className="hotel-live-room-number">
                            {roomCode}
                          </strong>

                          <small className="hotel-live-room-type">
                            {roomType}
                          </small>

                        </div>

                      </div>


                      {/* =====================================
                          HUÉSPED
                          ===================================== */}

                      <div className="hotel-live-reservation-card__guest">

                        <span className="hotel-live-field-label">
                          Huésped
                        </span>


                        <strong className="hotel-live-guest-name">

                          <UserRound
                            size={16}
                            strokeWidth={1.7}
                          />

                          {
                            reservation
                              .guest_name
                          }

                        </strong>


                        <small className="hotel-live-booking-code">
                          {
                            reservation
                              .booking_code
                          }
                        </small>

                      </div>


                      {/* =====================================
                          HORARIO
                          ===================================== */}

                      <div className="hotel-live-reservation-card__schedule">

                        <span className="hotel-live-field-label">
                          Horario
                        </span>


                        <strong className="hotel-live-schedule-value">

                          {
                            formatTime(
                              reservation
                                .start_at
                            )
                          }

                          {' — '}

                          {
                            formatTime(
                              reservation
                                .end_at
                            )
                          }

                        </strong>


                        <small className="hotel-live-date-value">
                          {
                            formatDate(
                              reservation
                                .start_at
                            )
                          }
                        </small>


                        {extensionSummary && (

                          <span className="hotel-live-extension-badge">

                            +{
                              formatExtensionDuration(
                                extensionSummary
                                  .total_extension_minutes
                              )
                            }

                            <small>
                              extendida
                            </small>

                          </span>

                        )}

                      </div>


                      {/* =====================================
                          TIEMPO
                          ===================================== */}

                      <div className="hotel-live-reservation-card__timer">

                        {timeStatus ===
                          'active' && (

                          <>

                            <span className="hotel-time-label is-active">
                              En curso
                            </span>

                            <strong className="hotel-live-countdown">
                              {
                                getRemainingTime(
                                  reservation
                                )
                              }
                            </strong>

                            <small className="hotel-live-countdown-caption">
                              tiempo restante
                            </small>

                          </>

                        )}


                        {timeStatus ===
                          'ending_soon' && (

                          <>

                            <span className="hotel-time-label is-ending">
                              Por finalizar
                            </span>

                            <strong className="hotel-live-countdown">
                              {
                                getRemainingTime(
                                  reservation
                                )
                              }
                            </strong>

                            <small className="hotel-live-countdown-caption">
                              tiempo restante
                            </small>

                          </>

                        )}


                        {timeStatus ===
                          'upcoming' && (

                          <>

                            <span className="hotel-time-label is-upcoming">
                              Próxima
                            </span>

                            <strong className="hotel-live-countdown">
                              {
                                getStartsIn(
                                  reservation
                                )
                              }
                            </strong>

                            <small className="hotel-live-countdown-caption">
                              para comenzar
                            </small>

                          </>

                        )}


                        {timeStatus ===
                          'ended' && (

                          <>

                            <span className="hotel-time-label is-ended">
                              Finalizada
                            </span>

                            <strong className="hotel-live-countdown">
                              00:00:00
                            </strong>

                            <small className="hotel-live-countdown-caption">
                              horario terminado
                            </small>

                          </>

                        )}

                      </div>


                      {/* =====================================
                          ACCESO
                          ===================================== */}

                      <div className="hotel-live-reservation-card__access">

                        <span className="hotel-live-field-label">
                          Acceso
                        </span>


                        {accessVerified ? (

                          <strong className="is-verified">

                            <ShieldCheck
                              size={17}
                              strokeWidth={1.8}
                            />

                            Verificado

                          </strong>

                        ) : (

                          <strong className="is-pending">

                            <BedDouble
                              size={17}
                              strokeWidth={1.8}
                            />

                            Pendiente

                          </strong>

                        )}


                        {reservation
                          .documents_verified_at && (

                          <small>
                            Documentos verificados
                          </small>

                        )}

                      </div>


                      {/* =====================================
                          TOTAL
                          ===================================== */}

                      <div className="hotel-live-reservation-card__amount">

                        <span className="hotel-live-field-label">
                          Total
                        </span>

                        <strong>
                          {
                            formatMoney(
                              reservation
                                .total_amount,

                              reservation
                                .currency
                            )
                          }
                        </strong>

                        <small>
                          Pagado
                        </small>

                      </div>

                    </article>
                  )
                }
              )}

            </div>

          )}

        </section>

      </main>

    </div>
  )
}