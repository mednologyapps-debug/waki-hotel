import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CirclePlus,
  Pencil,
  Power,
  Trash2
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

import HotelOnboardingGuide
  from '../components/hotel/HotelOnboardingGuide'

import {
  supabase
} from '../lib/supabase'


export default function HotelRatesPage() {
  const navigate =
    useNavigate()


  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [rooms, setRooms] =
    useState([])


  useEffect(() => {
    loadRates()
  }, [])


  /* =========================================================
     CARGAR TARIFAS
     ========================================================= */

  async function loadRates() {
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
            province,
            approval_status,
            is_active,
            rejection_reason,
            submitted_at,
            reviewed_at,
            approved_at
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
          'No encontramos la información de tu hotel.'
        )
      }


      setHotel(
        hotelData
      )


      /* =====================================================
         HABITACIONES + FOTOS + TARIFAS
         ===================================================== */

      const {
        data: roomsData,
        error: roomsError
      } =
        await supabase
          .from('room_types')
          .select(`
            id,
            name,
            is_active,
            display_order,

            room_type_images (
              id,
              image_url,
              is_cover,
              display_order
            ),

            rate_plans (
              id,
              name,
              duration_minutes,
              base_price,
              currency,
              is_active,
              display_order
            )
          `)
          .eq(
            'hotel_id',
            staffData.hotel_id
          )
          .order(
            'display_order',
            {
              ascending: true
            }
          )


      if (roomsError) {
        throw roomsError
      }


      /* =====================================================
         NORMALIZAR ORDEN
         ===================================================== */

      const normalizedRooms =
        (roomsData || [])
          .map(
            (room) => ({
              ...room,

              room_type_images:
                [
                  ...(room.room_type_images || [])
                ]
                  .sort(
                    (a, b) =>
                      Number(
                        Boolean(
                          b.is_cover
                        )
                      ) -
                      Number(
                        Boolean(
                          a.is_cover
                        )
                      ) ||
                      Number(
                        a.display_order ||
                        0
                      ) -
                      Number(
                        b.display_order ||
                        0
                      )
                  ),

              rate_plans:
                [
                  ...(room.rate_plans || [])
                ]
                  .sort(
                    (a, b) =>
                      Number(
                        a.display_order ||
                        0
                      ) -
                      Number(
                        b.display_order ||
                        0
                      )
                  )
            })
          )


      setRooms(
        normalizedRooms
      )

    } catch (error) {
      console.error(
        'Error cargando tarifas:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar las tarifas.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     DURACIÓN
     ========================================================= */

  function formatDuration(
    minutes
  ) {
    const value =
      Number(
        minutes || 0
      )


    if (
      value <= 0
    ) {
      return 'Sin duración'
    }


    if (
      value % 60 === 0
    ) {
      const hours =
        value / 60

      return `${hours} h`
    }


    const hours =
      Math.floor(
        value / 60
      )


    const remainingMinutes =
      value % 60


    if (
      hours > 0
    ) {
      return `${hours} h ${remainingMinutes} min`
    }


    return `${value} min`
  }


  /* =========================================================
     PRECIO
     ========================================================= */

  function formatPrice(
    rate
  ) {
    return new Intl.NumberFormat(
      'es-PE',
      {
        style:
          'currency',

        currency:
          rate.currency ||
          'PEN'
      }
    )
      .format(
        Number(
          rate.base_price ||
          0
        )
      )
  }


  /* =========================================================
     ACTIVAR / DESACTIVAR
     ========================================================= */

  async function toggleRate(
    rate
  ) {
    try {
      setActionLoading(
        rate.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .from('rate_plans')
          .update({
            is_active:
              !rate.is_active
          })
          .eq(
            'id',
            rate.id
          )


      if (error) {
        throw error
      }


      await loadRates()


      setSuccessMessage(
        !rate.is_active
          ? 'La tarifa fue activada.'
          : 'La tarifa fue desactivada.'
      )

    } catch (error) {
      console.error(
        'Error cambiando estado de tarifa:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos actualizar la tarifa.'
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


  /* =========================================================
     ELIMINAR TARIFA
     ========================================================= */

  async function deleteRate(
    rate
  ) {
    const confirmed =
      window.confirm(
        `¿Quieres eliminar la tarifa "${rate.name}"?`
      )


    if (!confirmed) {
      return
    }


    try {
      setActionLoading(
        rate.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .from('rate_plans')
          .delete()
          .eq(
            'id',
            rate.id
          )


      if (error) {
        throw error
      }


      await loadRates()


      setSuccessMessage(
        'La tarifa se eliminó correctamente.'
      )

    } catch (error) {
      console.error(
        'Error eliminando tarifa:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos eliminar la tarifa.'
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


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
     HABITACIONES ACTIVAS
     ========================================================= */

  const activeRooms =
    useMemo(
      () =>
        rooms.filter(
          (room) =>
            room.is_active !== false
        ),
      [
        rooms
      ]
    )


  /* =========================================================
     PRIMERA HABITACIÓN SIN FOTO
     ========================================================= */

  const firstRoomWithoutPhotos =
    useMemo(
      () =>
        activeRooms.find(
          (room) =>
            (
              room.room_type_images ||
              []
            ).length === 0
        ) ||
        null,
      [
        activeRooms
      ]
    )


  /* =========================================================
     PRIMERA HABITACIÓN SIN TARIFA ACTIVA
     ========================================================= */

  const firstRoomWithoutRates =
    useMemo(
      () =>
        activeRooms.find(
          (room) => {

            const activeRates =
              (
                room.rate_plans ||
                []
              )
                .filter(
                  (rate) =>
                    rate.is_active !== false
                )


            return (
              activeRates.length === 0
            )
          }
        ) ||
        null,
      [
        activeRooms
      ]
    )


  /* =========================================================
     CTA INFERIOR
     ========================================================= */

  const onboardingAction =
    useMemo(
      () => {

        if (
          !hotel ||
          [
            'pending_review',
            'approved',
            'suspended'
          ].includes(
            hotel.approval_status
          )
        ) {
          return null
        }


        if (
          activeRooms.length === 0
        ) {
          return null
        }


        /* =================================================
           FALTAN FOTOS
           ================================================= */

        if (
          firstRoomWithoutPhotos
        ) {
          return {
            eyebrow:
              'Paso pendiente',

            title:
              `${firstRoomWithoutPhotos.name} todavía necesita fotografías.`,

            buttonLabel:
              'Completar fotografías',

            route:
              `/habitaciones/${firstRoomWithoutPhotos.id}/fotos`
          }
        }


        /* =================================================
           FALTAN TARIFAS
           ================================================= */

        if (
          firstRoomWithoutRates
        ) {
          return {
            eyebrow:
              'Tarifas pendientes',

            title:
              `${firstRoomWithoutRates.name} necesita al menos una tarifa activa.`,

            buttonLabel:
              'Agregar tarifa',

            route:
              `/tarifas/nueva?roomId=${firstRoomWithoutRates.id}`
          }
        }


        /* =================================================
           TODO LISTO
           ================================================= */

        return {
          eyebrow:
            'Configuración completa',

          title:
            'La información, habitaciones, fotografías y tarifas están listas.',

          buttonLabel:
            'Revisar configuración',

          route:
            '/mi-hotel/revision'
        }
      },
      [
        hotel,
        activeRooms,
        firstRoomWithoutPhotos,
        firstRoomWithoutRates
      ]
    )


  /* =========================================================
     LOADING
     ========================================================= */

 if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tus tarifas..."
      subtitle="Cargando precios y configuraciones de tu hotel"
    />
  )
}


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">


      <HotelSidebar
        activeKey="tarifas"
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


        <header className="hotel-dashboard-header">

          <div className="hotel-dashboard-header__copy">

            <span className="hotel-dashboard-eyebrow">
              Tarifas
            </span>

            <h1>
              Tarifas de tu hotel
            </h1>

            <p>
              Define cuánto cuesta reservar cada
              habitación según su duración y configura
              precios especiales cuando lo necesites.
            </p>

          </div>

        </header>


        {errorMessage && (

          <div className="hotel-dashboard-error">

            {errorMessage}

          </div>

        )}


        {successMessage && (

          <div className="hotel-dashboard-success">

            {successMessage}

          </div>

        )}


        <HotelOnboardingGuide />


        <section className="hotel-rates-guide">

          <div className="hotel-rates-guide__icon">

            <CircleDollarSign
              size={23}
              strokeWidth={1.7}
            />

          </div>


          <div>

            <strong>
              ¿Cómo funcionan las tarifas?
            </strong>

            <p>
              Cada habitación puede tener distintas
              duraciones, como 3, 6 o 12 horas.
              También puedes establecer precios
              especiales para determinados días
              u horarios.
            </p>

          </div>

        </section>


        {rooms.length === 0 ? (

          <section className="hotel-empty-state">

            <div className="hotel-empty-state__icon">

              <BedDouble
                size={34}
                strokeWidth={1.6}
              />

            </div>


            <h2>
              Primero agrega una habitación
            </h2>


            <p>
              Necesitas al menos un tipo de
              habitación antes de configurar
              tarifas.
            </p>


            <button
              type="button"
              className="hotel-primary-button"
              onClick={() =>
                navigate(
                  '/habitaciones/nueva'
                )
              }
            >

              <CirclePlus
                size={18}
                strokeWidth={1.8}
              />

              Agregar habitación

            </button>

          </section>

        ) : (

          <section className="hotel-rate-room-list">


            {rooms.map(
              (room) => {

                const images =
                  room.room_type_images ||
                  []


                const cover =
                  images[0]


                const rates =
                  room.rate_plans ||
                  []


                const activeRates =
                  rates.filter(
                    (rate) =>
                      rate.is_active !== false
                  )


                return (
                  <article
                    key={
                      room.id
                    }
                    className="hotel-rate-room"
                  >


                    <div className="hotel-rate-room__header">


                      <div className="hotel-rate-room__room">


                        <div className="hotel-rate-room__image">

                          {cover?.image_url ? (

                            <img
                              src={
                                cover.image_url
                              }
                              alt={
                                room.name
                              }
                            />

                          ) : (

                            <BedDouble
                              size={24}
                              strokeWidth={1.6}
                            />

                          )}

                        </div>


                        <div>

                          <span>
                            Habitación
                          </span>

                          <h2>
                            {room.name}
                          </h2>

                          <small>

                            {activeRates.length}

                            {' '}

                            {activeRates.length === 1
                              ? 'tarifa activa'
                              : 'tarifas activas'
                            }

                          </small>

                        </div>

                      </div>


                      <button
                        type="button"
                        className="hotel-primary-button"
                        onClick={() =>
                          navigate(
                            `/tarifas/nueva?roomId=${room.id}`
                          )
                        }
                      >

                        <CirclePlus
                          size={17}
                          strokeWidth={1.8}
                        />

                        Agregar tarifa

                      </button>

                    </div>


                    {rates.length === 0 ? (

                      <div className="hotel-rate-room__empty">

                        <Clock3
                          size={24}
                          strokeWidth={1.6}
                        />


                        <div>

                          <strong>
                            Sin tarifas todavía
                          </strong>

                          <p>
                            Agrega una duración y
                            su precio para comenzar.
                          </p>

                        </div>

                      </div>

                    ) : (

                      <div className="hotel-rate-list">


                        {rates.map(
                          (rate) => (

                            <div
                              key={
                                rate.id
                              }
                              className={[
                                'hotel-rate-row',

                                !rate.is_active
                                  ? 'is-inactive'
                                  : ''
                              ].join(' ')}
                            >


                              <div className="hotel-rate-row__duration">


                                <div className="hotel-rate-row__icon">

                                  <Clock3
                                    size={19}
                                    strokeWidth={1.7}
                                  />

                                </div>


                                <div>

                                  <strong>
                                    {rate.name}
                                  </strong>

                                  <span>
                                    {formatDuration(
                                      rate.duration_minutes
                                    )}
                                  </span>

                                </div>

                              </div>


                              <div className="hotel-rate-row__price">

                                <span>
                                  Precio base
                                </span>

                                <strong>
                                  {formatPrice(
                                    rate
                                  )}
                                </strong>

                              </div>


                              <div className="hotel-rate-row__status">

                                <span
                                  className={[
                                    'hotel-rate-status',

                                    rate.is_active
                                      ? 'is-active'
                                      : ''
                                  ].join(' ')}
                                >

                                  {rate.is_active
                                    ? 'Activa'
                                    : 'Inactiva'
                                  }

                                </span>

                              </div>


                              <div className="hotel-rate-row__actions">


                                <button
                                  type="button"
                                  title="Precios especiales"
                                  aria-label="Precios especiales"
                                  onClick={() =>
                                    navigate(
                                      `/tarifas/${rate.id}/reglas`
                                    )
                                  }
                                >

                                  <CalendarDays
                                    size={17}
                                    strokeWidth={1.7}
                                  />

                                </button>


                                <button
                                  type="button"
                                  title="Editar tarifa"
                                  aria-label="Editar tarifa"
                                  onClick={() =>
                                    navigate(
                                      `/tarifas/${rate.id}/editar`
                                    )
                                  }
                                >

                                  <Pencil
                                    size={17}
                                    strokeWidth={1.7}
                                  />

                                </button>


                                <button
                                  type="button"
                                  title={
                                    rate.is_active
                                      ? 'Desactivar tarifa'
                                      : 'Activar tarifa'
                                  }
                                  aria-label={
                                    rate.is_active
                                      ? 'Desactivar tarifa'
                                      : 'Activar tarifa'
                                  }
                                  disabled={
                                    actionLoading ===
                                    rate.id
                                  }
                                  onClick={() =>
                                    toggleRate(
                                      rate
                                    )
                                  }
                                >

                                  <Power
                                    size={17}
                                    strokeWidth={1.7}
                                  />

                                </button>


                                <button
                                  type="button"
                                  className="is-danger"
                                  title="Eliminar tarifa"
                                  aria-label="Eliminar tarifa"
                                  disabled={
                                    actionLoading ===
                                    rate.id
                                  }
                                  onClick={() =>
                                    deleteRate(
                                      rate
                                    )
                                  }
                                >

                                  <Trash2
                                    size={17}
                                    strokeWidth={1.7}
                                  />

                                </button>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                    )}


                    <button
                      type="button"
                      className="hotel-rate-room__open-room"
                      onClick={() =>
                        navigate(
                          `/habitaciones/${room.id}`
                        )
                      }
                    >

                      Ver habitación

                      <ChevronRight
                        size={16}
                        strokeWidth={1.8}
                      />

                    </button>

                  </article>
                )
              }
            )}

          </section>

        )}


        {onboardingAction && (

          <section className="hotel-onboarding-page-footer">

            <div className="hotel-onboarding-page-footer__copy">

              <span>
                {onboardingAction.eyebrow}
              </span>

              <strong>
                {onboardingAction.title}
              </strong>

            </div>


            <button
              type="button"
              className="hotel-setup-primary-button"
              onClick={() =>
                navigate(
                  onboardingAction.route
                )
              }
            >

              {onboardingAction.buttonLabel}

            </button>

          </section>

        )}

      </main>

    </div>
  )
}