import {
  ArrowLeft,
  BedDouble,
  Building2,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ImageIcon,
  Maximize2,
  Pencil,
  UsersRound
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import HotelSidebar from '../components/hotel/HotelSidebar'
import { supabase } from '../lib/supabase'


export default function HotelRoomDetailPage() {
  const navigate = useNavigate()
  const { roomId } = useParams()

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [room, setRoom] =
    useState(null)


  useEffect(() => {
    loadRoom()
  }, [roomId])


  async function loadRoom() {
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
      } = await supabase
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


      /* =========================================
         HOTEL STAFF
      ========================================= */

      const {
        data: staffData,
        error: staffError
      } = await supabase
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


      setHotel(
        hotelData
      )


      /* =========================================
         HABITACIÓN
      ========================================= */

      const {
        data: roomData,
        error: roomError
      } = await supabase
        .from('room_types')
        .select(`
          id,
          hotel_id,
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
            is_active,
            display_order
          )
        `)
        .eq(
          'id',
          roomId
        )
        .eq(
          'hotel_id',
          staffData.hotel_id
        )
        .maybeSingle()


      if (roomError) {
        throw roomError
      }


      if (!roomData) {
        throw new Error(
          'No encontramos esta habitación dentro de tu hotel.'
        )
      }


      setRoom(
        roomData
      )

    } catch (error) {
      console.error(
        'Error cargando habitación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar la habitación.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================
     UBICACIÓN HOTEL
  ========================================= */

  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')


  /* =========================================
     IMÁGENES
  ========================================= */

  const images = useMemo(() => {
    if (!room?.room_type_images) {
      return []
    }

    return [
      ...room.room_type_images
    ].sort(
      (a, b) =>
        Number(
          b.is_cover
        ) -
        Number(
          a.is_cover
        ) ||
        Number(
          a.display_order || 0
        ) -
        Number(
          b.display_order || 0
        )
    )
  }, [room])


  /* =========================================
     TARIFAS ACTIVAS
  ========================================= */

  const activeRates = useMemo(() => {
    if (!room?.rate_plans) {
      return []
    }

    return room.rate_plans
      .filter(
        (rate) =>
          rate.is_active !== false
      )
      .sort(
        (a, b) =>
          Number(
            a.display_order || 0
          ) -
          Number(
            b.display_order || 0
          )
      )
  }, [room])


  /* =========================================
     FORMATO DURACIÓN
  ========================================= */

  function formatDuration(minutes) {
    const value =
      Number(
        minutes || 0
      )


    if (!value) {
      return 'Sin duración'
    }


    if (
      value % 60 === 0
    ) {
      const hours =
        value / 60

      return `${hours} h`
    }


    return `${value} min`
  }


  /* =========================================
     FORMATO PRECIO
  ========================================= */

  function formatPrice(rate) {
    const value =
      Number(
        rate.base_price || 0
      )


    return new Intl.NumberFormat(
      'es-PE',
      {
        style: 'currency',
        currency:
          rate.currency || 'PEN'
      }
    ).format(
      value
    )
  }


  /* =========================================
     LOADING
  ========================================= */

  if (loading) {
    return (
      <div className="hotel-dashboard-loading">

        <div className="hotel-dashboard-loading__spinner" />

        <p>
          Cargando habitación...
        </p>

      </div>
    )
  }


  /* =========================================
     RENDER
  ========================================= */

  return (
    <div className="hotel-portal">

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


      <main className="hotel-dashboard">


        {/* =====================================
            VOLVER
        ===================================== */}

        <button
          type="button"
          className="hotel-back-button"
          onClick={() =>
            navigate(
              '/habitaciones'
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a habitaciones

        </button>


        {errorMessage ? (

          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>

        ) : (

          <>

            {/* =================================
                CABECERA
            ================================= */}

            <header className="room-detail-header">

              <div>

                <span className="hotel-dashboard-eyebrow">
                  Habitación
                </span>

                <h1>
                  {room?.name}
                </h1>

                <p>
                  Consulta la información,
                  fotografías y tarifas de este
                  tipo de habitación.
                </p>

              </div>


              <div className="room-detail-header__actions">


                <button
                  type="button"
                  className="hotel-secondary-button"
                  onClick={() =>
                    navigate(
                      `/habitaciones/${roomId}/fotos`
                    )
                  }
                >

                  <Camera
                    size={17}
                    strokeWidth={1.8}
                  />

                  Fotografías

                </button>


                <button
                  type="button"
                  className="hotel-primary-button"
                  onClick={() =>
                    navigate(
                      `/habitaciones/${roomId}/editar`
                    )
                  }
                >

                  <Pencil
                    size={17}
                    strokeWidth={1.8}
                  />

                  Editar habitación

                </button>

              </div>

            </header>


            {/* =================================
                GALERÍA + INFORMACIÓN
            ================================= */}

            <section className="room-detail-grid">


              {/* ===============================
                  GALERÍA
              =============================== */}

              <article className="room-detail-gallery">

                {images.length > 0 ? (

                  <>
                    <div className="room-detail-gallery__main">

                      <img
                        src={
                          images[0]
                            .image_url
                        }
                        alt={
                          room?.name
                        }
                      />

                    </div>


                    {images.length > 1 && (

                      <div className="room-detail-gallery__thumbs">

                        {images
                          .slice(
                            1,
                            5
                          )
                          .map(
                            (
                              image
                            ) => (

                              <div
                                key={
                                  image.id
                                }
                                className="room-detail-gallery__thumb"
                              >

                                <img
                                  src={
                                    image.image_url
                                  }
                                  alt={
                                    room?.name
                                  }
                                />

                              </div>

                            )
                          )}

                      </div>

                    )}

                  </>

                ) : (

                  <div className="room-detail-gallery__empty">

                    <ImageIcon
                      size={36}
                      strokeWidth={1.5}
                    />

                    <strong>
                      Sin fotografías
                    </strong>

                    <span>
                      Agrega fotografías para que
                      los huéspedes conozcan mejor
                      esta habitación.
                    </span>


                    <button
                      type="button"
                      className="hotel-primary-button"
                      onClick={() =>
                        navigate(
                          `/habitaciones/${roomId}/fotos`
                        )
                      }
                    >

                      <Camera
                        size={17}
                        strokeWidth={1.8}
                      />

                      Agregar fotografías

                    </button>

                  </div>

                )}

              </article>


              {/* ===============================
                  INFORMACIÓN
              =============================== */}

              <aside className="room-detail-summary">

                <div className="room-detail-summary__status">

                  <CheckCircle2
                    size={18}
                    strokeWidth={1.8}
                  />

                  <span>
                    {room?.is_active
                      ? 'Habitación activa'
                      : 'Habitación inactiva'}
                  </span>

                </div>


                <h2>
                  Información general
                </h2>


                <div className="room-detail-info-list">


                  <DetailRow
                    icon={
                      BedDouble
                    }
                    label="Tipo de cama"
                    value={
                      room?.bed_type ||
                      'No definido'
                    }
                  />


                  <DetailRow
                    icon={
                      UsersRound
                    }
                    label="Capacidad"
                    value={`${
                      room?.max_guests ||
                      1
                    } huéspedes`}
                  />


                  <DetailRow
                    icon={
                      Building2
                    }
                    label="Inventario"
                    value={`${
                      room?.inventory_count ||
                      0
                    } habitación${
                      Number(
                        room?.inventory_count
                      ) === 1
                        ? ''
                        : 'es'
                    }`}
                  />


                  <DetailRow
                    icon={
                      Maximize2
                    }
                    label="Tamaño"
                    value={
                      room?.size_m2
                        ? `${room.size_m2} m²`
                        : 'No definido'
                    }
                  />


                  <DetailRow
                    icon={
                      Camera
                    }
                    label="Fotografías"
                    value={
                      String(
                        images.length
                      )
                    }
                  />

                </div>

              </aside>

            </section>


            {/* =================================
                DESCRIPCIÓN
            ================================= */}

            <section className="room-detail-section">

              <div className="room-detail-section__heading">

                <div>

                  <h2>
                    Descripción
                  </h2>

                  <span>
                    Información que verá el huésped
                  </span>

                </div>

              </div>


              <p className="room-detail-description">

                {room?.description ||
                  'Todavía no se ha agregado una descripción para esta habitación.'}

              </p>

            </section>


            {/* =================================
                TARIFAS
            ================================= */}

            <section className="room-detail-section">

              <div className="room-detail-section__heading">

                <div>

                  <h2>
                    Tarifas configuradas
                  </h2>

                  <span>
                    Bloques de tiempo activos
                    para esta habitación.
                  </span>

                </div>


                <div className="room-detail-section__counter">

                  <CircleDollarSign
                    size={17}
                    strokeWidth={1.8}
                  />

                  {activeRates.length}

                </div>

              </div>


              {activeRates.length === 0 ? (

                <div className="room-rates-empty">

                  <CircleDollarSign
                    size={28}
                    strokeWidth={1.6}
                  />

                  <div>

                    <strong>
                      No hay tarifas activas
                    </strong>

                    <p>
                      Configuraremos este módulo
                      en el siguiente bloque.
                    </p>

                  </div>

                </div>

              ) : (

                <div className="room-rate-list">

                  {activeRates.map(
                    (rate) => (

                      <article
                        key={
                          rate.id
                        }
                        className="room-rate-card"
                      >

                        <div className="room-rate-card__icon">

                          <Clock3
                            size={20}
                            strokeWidth={1.7}
                          />

                        </div>


                        <div className="room-rate-card__copy">

                          <strong>
                            {rate.name}
                          </strong>

                          <span>
                            {formatDuration(
                              rate.duration_minutes
                            )}
                          </span>

                        </div>


                        <strong className="room-rate-card__price">

                          {formatPrice(
                            rate
                          )}

                        </strong>

                      </article>

                    )
                  )}

                </div>

              )}

            </section>

          </>

        )}

      </main>

    </div>
  )
}


/* =========================================================
   FILA DE INFORMACIÓN
   ========================================================= */

function DetailRow({
  icon: Icon,
  label,
  value
}) {
  return (
    <div className="room-detail-info-row">

      <div className="room-detail-info-row__icon">

        <Icon
          size={18}
          strokeWidth={1.7}
        />

      </div>


      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  )
}