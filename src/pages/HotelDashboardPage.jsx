import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  PackageOpen
} from 'lucide-react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import HotelSidebar from '../components/hotel/HotelSidebar'

import { supabase } from '../lib/supabase'


export default function HotelDashboardPage() {
  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [roomTypes, setRoomTypes] =
    useState([])


  useEffect(() => {
    loadDashboard()
  }, [])


  async function loadDashboard() {
    try {
      setLoading(true)
      setErrorMessage('')


      /* =========================================
         SESIÓN
      ========================================= */

      const {
        data: {
          session
        },
        error: sessionError
      } = await supabase.auth.getSession()


      if (sessionError) {
        throw sessionError
      }


      if (!session?.user) {
        throw new Error(
          'No encontramos una sesión activa.'
        )
      }


      /* =========================================
         PERFIL
      ========================================= */

      const {
        data: profileData,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          account_status
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


      /* =========================================
         HOTEL STAFF
      ========================================= */

      const {
        data: hotelStaff,
        error: staffError
      } = await supabase
        .from('hotel_staff')
        .select(`
          hotel_id,
          staff_role,
          is_active
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


      if (!hotelStaff?.hotel_id) {
        throw new Error(
          'Esta cuenta no tiene una sede asignada.'
        )
      }


      /* =========================================
         HOTEL
      ========================================= */

      const {
        data: hotelData,
        error: hotelError
      } = await supabase
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
          hotelStaff.hotel_id
        )
        .maybeSingle()


      if (hotelError) {
        throw hotelError
      }


      setHotel(
        hotelData
      )


      /* =========================================
         HABITACIONES
      ========================================= */

      const {
        data: roomsData,
        error: roomsError
      } = await supabase
        .from('room_types')
        .select(`
          id,
          name,
          inventory_count,
          is_active,
          display_order,

          rate_plans (
            id,
            is_active
          ),

          room_type_images (
            id,
            image_url,
            is_cover,
            display_order
          )
        `)
        .eq(
          'hotel_id',
          hotelStaff.hotel_id
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


      setRoomTypes(
        roomsData || []
      )

    } catch (error) {
      console.error(
        'Error cargando dashboard:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar la información del hotel.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================
     ESTADÍSTICAS
  ========================================= */

  const stats = useMemo(() => {
    const roomTypeCount =
      roomTypes.length


    const inventory =
      roomTypes.reduce(
        (total, room) =>
          total +
          Number(
            room.inventory_count || 0
          ),
        0
      )


    const rateCount =
      roomTypes.reduce(
        (total, room) =>
          total +
          (
            room.rate_plans
              ?.filter(
                (rate) =>
                  rate.is_active !== false
              )
              .length || 0
          ),
        0
      )


    const photoCount =
      roomTypes.reduce(
        (total, room) =>
          total +
          (
            room.room_type_images
              ?.length || 0
          ),
        0
      )


    return {
      roomTypeCount,
      inventory,
      rateCount,
      photoCount
    }
  }, [roomTypes])


  /* =========================================
     IMAGEN HOTEL
  ========================================= */

  const hotelImage = useMemo(() => {
    const allImages =
      roomTypes.flatMap(
        (room) =>
          room.room_type_images || []
      )


    const cover =
      allImages.find(
        (image) =>
          image.is_cover
      )


    return (
      cover?.image_url ||
      allImages[0]?.image_url ||
      null
    )
  }, [roomTypes])


  /* =========================================
     PROGRESO
  ========================================= */

  const setup = useMemo(() => {
    const hotelComplete =
      Boolean(
        hotel?.name &&
        hotel?.district
      )


    const roomsComplete =
      stats.roomTypeCount > 0


    const ratesComplete =
      stats.rateCount > 0


    const reviewComplete =
      hotel?.approval_status ===
      'approved'


    const steps = [
      hotelComplete,
      roomsComplete,
      ratesComplete,
      reviewComplete
    ]


    const completed =
      steps.filter(Boolean).length


    return {
      hotelComplete,
      roomsComplete,
      ratesComplete,
      reviewComplete,
      percentage:
        Math.round(
          (
            completed /
            steps.length
          ) * 100
        )
    }
  }, [
    hotel,
    stats
  ])


  /* =========================================
     LABEL STATUS
  ========================================= */

  const approvalLabel =
    {
      draft: 'Borrador',
      pending_review:
        'En revisión',
      approved:
        'Aprobado',
      rejected:
        'Requiere cambios',
      suspended:
        'Suspendido'
    }[
      hotel?.approval_status
    ] || 'Sin estado'


  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')


  /* =========================================
     LOADING
  ========================================= */

  if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tu resumen..."
      subtitle="Cargando la operación de tu hotel"
    />
  )
}


  return (
    <div className="hotel-portal">

      <HotelSidebar
        activeKey="resumen"
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


        {/* =====================================
            CABECERA
        ===================================== */}

        <header className="hotel-dashboard-header">

          <div className="hotel-dashboard-header__copy">

            <span className="hotel-dashboard-eyebrow">
              Resumen
            </span>

            <h1>
              Hola, bienvenido
            </h1>

            <p>
              Revisa y administra tu hotel
              desde un solo lugar.
            </p>

          </div>


          <div className="hotel-dashboard-property">

            <div className="hotel-dashboard-property__visual">

              {hotelImage ? (
                <img
                  src={hotelImage}
                  alt={
                    hotel?.name ||
                    'Hotel'
                  }
                />
              ) : (
                <Building2
                  size={23}
                  strokeWidth={1.7}
                />
              )}

            </div>


            <div>

              <strong>
                {hotel?.name ||
                  'Mi hotel'}
              </strong>

              <span>
                {hotelLocation ||
                  'Lima, Perú'}
              </span>

            </div>

          </div>

        </header>


        {/* =====================================
            ERROR
        ===================================== */}

        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        {/* =====================================
            ESTADO
        ===================================== */}

        <section className="hotel-status-banner">

          <div className="hotel-status-banner__icon">

            <CheckCircle2
              size={24}
              strokeWidth={1.8}
            />

          </div>


          <div className="hotel-status-banner__copy">

            <span>
              Estado de publicación
            </span>

            <strong>
              {approvalLabel}
            </strong>

            <p>
              {hotel?.approval_status === 'approved'
                ? 'Tu hotel está publicado y disponible para operar en WAKI.'
                : 'Completa la configuración para continuar con el proceso de publicación.'
              }
            </p>

          </div>


          <button
            type="button"
            className="hotel-outline-button"
          >
            Ver estado
          </button>

        </section>


        {/* =====================================
            KPI
        ===================================== */}

        <section className="hotel-kpi-grid">

          <article className="hotel-kpi-card">

            <div className="hotel-kpi-card__icon">

              <BedDouble
                size={22}
                strokeWidth={1.7}
              />

            </div>

            <div className="hotel-kpi-card__content">

              <span>
                Tipos de habitación
              </span>

              <strong>
                {stats.roomTypeCount}
              </strong>

            </div>

          </article>


          <article className="hotel-kpi-card">

            <div className="hotel-kpi-card__icon">

              <PackageOpen
                size={22}
                strokeWidth={1.7}
              />

            </div>

            <div className="hotel-kpi-card__content">

              <span>
                Inventario total
              </span>

              <strong>
                {stats.inventory}
              </strong>

            </div>

          </article>


          <article className="hotel-kpi-card">

            <div className="hotel-kpi-card__icon">

              <CircleDollarSign
                size={22}
                strokeWidth={1.7}
              />

            </div>

            <div className="hotel-kpi-card__content">

              <span>
                Tarifas configuradas
              </span>

              <strong>
                {stats.rateCount}
              </strong>

            </div>

          </article>


          <article className="hotel-kpi-card">

            <div className="hotel-kpi-card__icon">

              <CalendarDays
                size={22}
                strokeWidth={1.7}
              />

            </div>

            <div className="hotel-kpi-card__content">

              <span>
                Reservas hoy
              </span>

              <strong>
                —
              </strong>

              <small>
                Próximamente
              </small>

            </div>

          </article>

        </section>


        {/* =====================================
            GRID PRINCIPAL
        ===================================== */}

        <section className="hotel-dashboard-grid">


          {/* CONFIGURACIÓN */}

          <article className="hotel-setup-card">

            <div className="hotel-setup-card__heading">

              <div>

                <span className="hotel-dashboard-eyebrow">
                  Configura tu hotel
                </span>

                <h2>
                  Prepara tu oferta para recibir nuevas reservas
                </h2>

                <p>
                  Sigue estos pasos. Te indicaremos qué debes
                  completar en cada momento.
                </p>

              </div>


              <div className="hotel-setup-card__percentage">

                <strong>
                  {setup.percentage}%
                </strong>

                <span>
                  completado
                </span>

              </div>

            </div>


            <div className="hotel-progress">

              <span
                style={{
                  width:
                    `${setup.percentage}%`
                }}
              />

            </div>


            <div className="hotel-step-grid">

              <SetupStep
                number="1"
                title="Datos del hotel"
                description="Información general, contacto y ubicación."
                complete={
                  setup.hotelComplete
                }
              />

              <SetupStep
                number="2"
                title="Habitaciones"
                description="Tipos, inventario y fotografías."
                complete={
                  setup.roomsComplete
                }
              />

              <SetupStep
                number="3"
                title="Tarifas"
                description="Duraciones y precios."
                complete={
                  setup.ratesComplete
                }
              />

              <SetupStep
                number="4"
                title="Revisión"
                description="Revisa y envía tu información a WAKI."
                complete={
                  setup.reviewComplete
                }
              />

            </div>


            <button
              type="button"
              className="hotel-primary-button"
            >

              Continuar configuración

              <ArrowRight
                size={18}
                strokeWidth={1.8}
              />

            </button>

          </article>


          {/* PERFIL HOTEL */}

          <aside className="hotel-profile-card">

            <div className="hotel-profile-card__heading">

              <span className="hotel-dashboard-eyebrow">
                Tu hotel en WAKI
              </span>

              <h3>
                {hotel?.name ||
                  'Mi hotel'}
              </h3>

            </div>


            <div className="hotel-profile-card__image">

              {hotelImage ? (
                <img
                  src={hotelImage}
                  alt={
                    hotel?.name ||
                    'Hotel'
                  }
                />
              ) : (
                <div className="hotel-profile-card__image-empty">

                  <Building2
                    size={35}
                    strokeWidth={1.5}
                  />

                  <span>
                    Agrega una fotografía
                  </span>

                </div>
              )}

            </div>


            <div className="hotel-profile-card__info">

              <div>

                <MapPin
                  size={18}
                  strokeWidth={1.7}
                />

                <span>
                  {hotelLocation ||
                    'Lima, Perú'}
                </span>

              </div>


              <div>

                <Camera
                  size={18}
                  strokeWidth={1.7}
                />

                <span>
                  Fotografías
                </span>

                <strong>
                  {stats.photoCount}
                </strong>

              </div>


              <div>

                <CheckCircle2
                  size={18}
                  strokeWidth={1.7}
                />

                <span>
                  Estado
                </span>

                <strong>
                  {approvalLabel}
                </strong>

              </div>

            </div>


            <div className="hotel-next-step">

              <strong>
                Siguiente paso
              </strong>

              <p>
                Revisa tus habitaciones,
                fotografías y tarifas para
                mantener tu oferta actualizada.
              </p>

            </div>

          </aside>

        </section>

      </main>

    </div>
  )
}


/* =====================================================
   STEP
===================================================== */

function SetupStep({
  number,
  title,
  description,
  complete
}) {
  return (
    <button
      type="button"
      className={[
        'hotel-step',
        complete
          ? 'is-complete'
          : ''
      ].join(' ')}
    >

      <span className="hotel-step__number">

        {complete ? (
          <Check
            size={16}
            strokeWidth={2}
          />
        ) : (
          number
        )}

      </span>


      <span className="hotel-step__content">

        <strong>
          {title}
        </strong>

        <small>
          {description}
        </small>

      </span>


      <ArrowRight
        className="hotel-step__arrow"
        size={17}
        strokeWidth={1.8}
      />

    </button>
  )
}