import {
  BedDouble,
  Building2,
  Camera,
  ChevronRight,
  CirclePlus,
  ImageIcon,
  Pencil,
  Users
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


export default function HotelRoomsPage() {
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

  const [rooms, setRooms] =
    useState([])


  useEffect(() => {
    loadRooms()
  }, [])


  /* =========================================================
     CARGAR HABITACIONES
     ========================================================= */

  async function loadRooms() {
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
            is_active
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


      /* =====================================================
         HABITACIONES
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
            description,
            inventory_count,
            max_guests,
            bed_type,
            size_m2,
            is_active,
            display_order,

            room_type_images (
              id,
              image_url,
              storage_path,
              is_cover,
              display_order
            ),

            rate_plans (
              id,
              name,
              duration_minutes,
              base_price,
              currency,
              is_active
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


      setRooms(
        roomsData || []
      )

    } catch (error) {
      console.error(
        'Error cargando habitaciones:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No se pudieron cargar las habitaciones.'
      )

    } finally {
      setLoading(false)
    }
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
     PRIMERA HABITACIÓN ACTIVA
     ========================================================= */

  const firstActiveRoom =
    activeRooms[0] ||
    rooms[0] ||
    null


  /* =========================================================
     PRIMERA HABITACIÓN SIN FOTOGRAFÍAS
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
     CTA DEL ONBOARDING
     ========================================================= */

  const onboardingAction =
    useMemo(
      () => {

        /*
          No mostramos CTA de onboarding una vez
          enviado, aprobado o suspendido.
        */

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


        /*
          Todavía no existe ninguna habitación activa.
        */

        if (
          activeRooms.length === 0
        ) {
          return null
        }


        /*
          PASO 3:
          alguna habitación todavía necesita fotos.
        */

        if (
          firstRoomWithoutPhotos
        ) {
          return {
            eyebrow:
              'Siguiente paso',

            title:
              'Completa las fotografías de tus habitaciones.',

            buttonLabel:
              'Continuar con fotografías',

            route:
              `/habitaciones/${firstRoomWithoutPhotos.id}/fotos`
          }
        }


        /*
          PASO 4:
          todas tienen fotos, pero todavía falta tarifa.
        */

        if (
          firstRoomWithoutRates
        ) {
          return {
            eyebrow:
              'Siguiente paso',

            title:
              'Las fotografías están listas. Ahora configura tus tarifas.',

            buttonLabel:
              'Continuar con tarifas',

            route:
              '/tarifas'
          }
        }


        /*
          PASO 5:
          todo está listo para revisar.
        */

        return {
          eyebrow:
            'Configuración completa',

          title:
            'Tus habitaciones están listas para la revisión.',

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
      title="Preparando tus habitaciones..."
      subtitle="Cargando el inventario de tu hotel"
    />
  )
}


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">


      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <HotelSidebar
        activeKey="habitaciones"
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


      {/* =====================================================
          CONTENIDO
          ===================================================== */}

      <main className="hotel-dashboard">


        {/* =================================================
            CABECERA
            ================================================= */}

        <header className="hotel-dashboard-header">

          <div className="hotel-dashboard-header__copy">

            <span className="hotel-dashboard-eyebrow">
              Habitaciones
            </span>

            <h1>
              Tus habitaciones
            </h1>

            <p>
              Administra los tipos de habitación
              que tus huéspedes podrán reservar.
            </p>

          </div>


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

        </header>


        {/* =================================================
            ERROR
            ================================================= */}

        {errorMessage && (

          <div className="hotel-dashboard-error">

            {errorMessage}

          </div>

        )}


        {/* =================================================
            ONBOARDING SUPERIOR
            ================================================= */}

        <HotelOnboardingGuide
          roomId={
            firstActiveRoom?.id ||
            null
          }
        />


        {/* =================================================
            RESUMEN
            ================================================= */}

        <section className="hotel-rooms-intro">

          <div className="hotel-rooms-intro__icon">

            <BedDouble
              size={24}
              strokeWidth={1.7}
            />

          </div>


          <div>

            <strong>

              {rooms.length}

              {' '}

              {rooms.length === 1
                ? 'tipo de habitación configurado'
                : 'tipos de habitación configurados'
              }

            </strong>


            <p>
              Cada tipo puede tener su propio
              inventario, fotografías y tarifas.
            </p>

          </div>

        </section>


        {/* =================================================
            SIN HABITACIONES
            ================================================= */}

        {rooms.length === 0 ? (

          <section className="hotel-empty-state">

            <div className="hotel-empty-state__icon">

              <BedDouble
                size={34}
                strokeWidth={1.6}
              />

            </div>


            <h2>
              Aún no tienes habitaciones configuradas
            </h2>


            <p>
              Agrega tu primer tipo de habitación
              para comenzar a preparar tu oferta.
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

              Agregar primera habitación

            </button>

          </section>

        ) : (

          /* =================================================
             LISTADO
             ================================================= */

          <section className="hotel-room-list">


            {rooms.map(
              (room) => {

                const images =
                  room.room_type_images ||
                  []


                const orderedImages =
                  [
                    ...images
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
                    )


                const cover =
                  orderedImages[0]


                const activeRates =
                  room.rate_plans
                    ?.filter(
                      (rate) =>
                        rate.is_active !== false
                    ) ||
                  []


                const inventory =
                  Number(
                    room.inventory_count ||
                    0
                  )


                const guests =
                  Number(
                    room.max_guests ||
                    1
                  )


                return (
                  <article
                    key={
                      room.id
                    }
                    className="hotel-room-card"
                  >


                    {/* =============================
                        IMAGEN
                        ============================= */}

                    <div className="hotel-room-card__image">

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

                        <div className="hotel-room-card__image-empty">

                          <ImageIcon
                            size={30}
                            strokeWidth={1.6}
                          />

                          <span>
                            Sin fotografía
                          </span>

                        </div>

                      )}

                    </div>


                    {/* =============================
                        CONTENIDO
                        ============================= */}

                    <div className="hotel-room-card__body">


                      {/* ===========================
                          ENCABEZADO
                          =========================== */}

                      <div className="hotel-room-card__heading">

                        <div>

                          <span className="hotel-room-card__status">

                            {room.is_active
                              ? 'Activa'
                              : 'Inactiva'
                            }

                          </span>


                          <h2>
                            {room.name}
                          </h2>


                          {room.description && (

                            <p>
                              {room.description}
                            </p>

                          )}

                        </div>


                        <button
                          type="button"
                          className="hotel-icon-button"
                          aria-label="Editar habitación"
                          title="Editar habitación"
                          onClick={() =>
                            navigate(
                              `/habitaciones/${room.id}/editar`
                            )
                          }
                        >

                          <Pencil
                            size={18}
                            strokeWidth={1.7}
                          />

                        </button>

                      </div>


                      {/* ===========================
                          DETALLES
                          =========================== */}

                      <div className="hotel-room-card__details">


                        <div>

                          <BedDouble
                            size={18}
                            strokeWidth={1.7}
                          />

                          <span>

                            {room.bed_type ||
                              'Cama no definida'
                            }

                          </span>

                        </div>


                        <div>

                          <Users
                            size={18}
                            strokeWidth={1.7}
                          />

                          <span>

                            Hasta{' '}

                            {guests}

                            {' '}

                            {guests === 1
                              ? 'huésped'
                              : 'huéspedes'
                            }

                          </span>

                        </div>


                        <div>

                          <Building2
                            size={18}
                            strokeWidth={1.7}
                          />

                          <span>

                            {inventory}

                            {' '}

                            {inventory === 1
                              ? 'habitación disponible'
                              : 'habitaciones disponibles'
                            }

                          </span>

                        </div>


                        <div>

                          <Camera
                            size={18}
                            strokeWidth={1.7}
                          />

                          <span>

                            {images.length}

                            {' '}

                            {images.length === 1
                              ? 'foto'
                              : 'fotos'
                            }

                          </span>

                        </div>

                      </div>


                      {/* ===========================
                          PIE
                          =========================== */}

                      <div className="hotel-room-card__footer">

                        <div>

                          <span>
                            Tarifas activas
                          </span>

                          <strong>
                            {activeRates.length}
                          </strong>

                        </div>
                            <button
      type="button"
      className="hotel-room-card__units"
      onClick={() =>
        navigate(
          `/habitaciones/${room.id}/unidades`
        )
      }
    >
      <Building2
        size={17}
        strokeWidth={1.8}
      />

      Habitaciones físicas
    </button>

                        <button
                          type="button"
                          className="hotel-room-card__open"
                          onClick={() =>
                            navigate(
                              `/habitaciones/${room.id}`
                            )
                          }
                        >

                          Administrar habitación

                          <ChevronRight
                            size={17}
                            strokeWidth={1.8}
                          />

                        </button>

                      </div>

                    </div>

                  </article>
                )
              }
            )}

          </section>

        )}


        {/* =================================================
            CTA INFERIOR DEL ONBOARDING
            ================================================= */}

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