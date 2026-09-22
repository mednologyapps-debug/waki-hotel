import {
  ArrowLeft,
  BedDouble,
  Building2,
  Camera,
  Check,
  CircleDollarSign,
  Clock3,
  MapPin,
  Send
} from 'lucide-react'

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


export default function HotelReviewPage() {
  const navigate =
    useNavigate()


  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [hotelId, setHotelId] =
    useState(null)

  const [onboarding, setOnboarding] =
    useState(null)

  const [rooms, setRooms] =
    useState([])


  useEffect(() => {
    loadPage()
  }, [])


  /* =========================================================
     CARGAR PÁGINA
     ========================================================= */

  async function loadPage() {
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
            description,
            address,
            district,
            province,
            department,
            phone,
            contact_email,
            whatsapp,
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
          'No encontramos la información del hotel.'
        )
      }


      setHotel(
        hotelData
      )


      /* =====================================================
         ESTADO ONBOARDING
         ===================================================== */

      const {
        data: onboardingData,
        error: onboardingError
      } =
        await supabase
          .rpc(
            'get_hotel_onboarding_status',
            {
              target_hotel_id:
                staffData.hotel_id
            }
          )


      if (onboardingError) {
        throw onboardingError
      }


      setOnboarding(
        onboardingData
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
            is_active,
            display_order,

            room_type_images (
              id,
              image_url,
              is_cover
            ),

            rate_plans (
              id,
              name,
              is_active,
              duration_minutes,
              base_price,
              currency
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
        roomsData ||
        []
      )

    } catch (error) {
      console.error(
        'Error cargando revisión:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar la revisión del hotel.'
      )

    } finally {
      setLoading(false)
    }
  }


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
     TOTAL FOTOGRAFÍAS
     ========================================================= */

  const totalPhotos =
    useMemo(
      () =>
        activeRooms.reduce(
          (
            total,
            room
          ) =>
            total +
            (
              room.room_type_images ||
              []
            ).length,
          0
        ),
      [
        activeRooms
      ]
    )


  /* =========================================================
     TOTAL TARIFAS ACTIVAS
     ========================================================= */

  const totalActiveRates =
    useMemo(
      () =>
        activeRooms.reduce(
          (
            total,
            room
          ) =>
            total +
            (
              room.rate_plans ||
              []
            )
              .filter(
                (rate) =>
                  rate.is_active !== false
              )
              .length,
          0
        ),
      [
        activeRooms
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


  const fullAddress =
    [
      hotel?.address,
      hotel?.district,
      hotel?.province,
      hotel?.department
    ]
      .filter(Boolean)
      .join(', ')


  /* =========================================================
     READY
     ========================================================= */

  const isReady =
    Boolean(
      onboarding
        ?.is_ready
    )


  /* =========================================================
     ENVIAR A REVISIÓN
     ========================================================= */

  async function handleSubmitForReview() {
    if (!hotelId) {
      return
    }


    if (!isReady) {
      setErrorMessage(
        'Todavía faltan datos para enviar el hotel a revisión.'
      )

      return
    }


    const confirmed =
      window.confirm(
        '¿Quieres enviar tu hotel a revisión? Una vez enviado, WAKI revisará la configuración antes de publicarlo.'
      )


    if (!confirmed) {
      return
    }


    try {
      setSubmitting(true)

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .rpc(
            'submit_hotel_for_review',
            {
              target_hotel_id:
                hotelId
            }
          )


      if (error) {
        throw error
      }


      setSuccessMessage(
        'Tu hotel fue enviado a revisión correctamente.'
      )


      await loadPage()

    } catch (error) {
      console.error(
        'Error enviando hotel a revisión:',
        error
      )


      if (
        error?.message
          ?.includes(
            'HOTEL_ONBOARDING_INCOMPLETE'
          )
      ) {
        setErrorMessage(
          'Todavía hay requisitos pendientes antes de enviar tu hotel.'
        )
      } else {
        setErrorMessage(
          error?.message ||
          'No pudimos enviar el hotel a revisión.'
        )
      }

    } finally {
      setSubmitting(false)
    }
  }


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="hotel-dashboard-loading">

        <div className="hotel-dashboard-loading__spinner" />

        <p>
          Preparando revisión...
        </p>

      </div>
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
        activeKey="hotel"
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

      <main className="hotel-dashboard hotel-review-page">


        {/* =================================================
            VOLVER
            ================================================= */}

        <button
          type="button"
          className="hotel-back-button"
          onClick={() =>
            navigate(
              '/tarifas'
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a tarifas

        </button>


        {/* =================================================
            HEADER
            ================================================= */}

        <header className="hotel-review-header">

          <span className="hotel-dashboard-eyebrow">
            Revisión final
          </span>

          <h1>
            Revisa tu hotel antes de enviarlo
          </h1>

          <p>
            Confirma que la información,
            habitaciones, fotografías y tarifas
            estén correctas antes de enviarlas a WAKI.
          </p>

        </header>


        {/* =================================================
            MENSAJES
            ================================================= */}

        {errorMessage && (

          <div className="hotel-dashboard-error">

            {errorMessage}

          </div>

        )}


        {successMessage && (

          <div className="hotel-dashboard-success">

            <Check
              size={18}
              strokeWidth={2}
            />

            {successMessage}

          </div>

        )}


        {/* =================================================
            ONBOARDING
            ================================================= */}

        <HotelOnboardingGuide />


        {/* =================================================
            RECHAZADO
            ================================================= */}

        {hotel?.approval_status ===
          'rejected' &&
          hotel?.rejection_reason && (

          <section className="hotel-review-rejected">

            <strong>
              Observaciones de WAKI
            </strong>

            <p>
              {hotel.rejection_reason}
            </p>

          </section>

        )}


        {/* =================================================
            RESUMEN GENERAL
            ================================================= */}

        <section className="hotel-review-summary">


          {/* INFORMACIÓN */}

          <article className="hotel-review-summary-card">

            <div className="hotel-review-summary-card__icon">

              <Building2
                size={21}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <span>
                Información del hotel
              </span>

              <strong>
                {onboarding?.info_complete
                  ? 'Completa'
                  : 'Pendiente'
                }
              </strong>

            </div>


            {onboarding?.info_complete && (

              <Check
                className="hotel-review-summary-card__check"
                size={20}
                strokeWidth={2.2}
              />

            )}

          </article>


          {/* HABITACIONES */}

          <article className="hotel-review-summary-card">

            <div className="hotel-review-summary-card__icon">

              <BedDouble
                size={21}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <span>
                Habitaciones
              </span>

              <strong>

                {activeRooms.length}

                {' '}

                {activeRooms.length === 1
                  ? 'habitación activa'
                  : 'habitaciones activas'
                }

              </strong>

            </div>


            {onboarding?.rooms_complete && (

              <Check
                className="hotel-review-summary-card__check"
                size={20}
                strokeWidth={2.2}
              />

            )}

          </article>


          {/* FOTOS */}

          <article className="hotel-review-summary-card">

            <div className="hotel-review-summary-card__icon">

              <Camera
                size={21}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <span>
                Fotografías
              </span>

              <strong>

                {totalPhotos}

                {' '}

                {totalPhotos === 1
                  ? 'fotografía'
                  : 'fotografías'
                }

              </strong>

            </div>


            {onboarding?.photos_complete && (

              <Check
                className="hotel-review-summary-card__check"
                size={20}
                strokeWidth={2.2}
              />

            )}

          </article>


          {/* TARIFAS */}

          <article className="hotel-review-summary-card">

            <div className="hotel-review-summary-card__icon">

              <CircleDollarSign
                size={21}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <span>
                Tarifas
              </span>

              <strong>

                {totalActiveRates}

                {' '}

                {totalActiveRates === 1
                  ? 'tarifa activa'
                  : 'tarifas activas'
                }

              </strong>

            </div>


            {onboarding?.rates_complete && (

              <Check
                className="hotel-review-summary-card__check"
                size={20}
                strokeWidth={2.2}
              />

            )}

          </article>

        </section>


        {/* =================================================
            DATOS DEL HOTEL
            ================================================= */}

        <section className="hotel-review-section">

          <div className="hotel-review-section__heading">

            <div>

              <span>
                Información general
              </span>

              <h2>
                {hotel?.name}
              </h2>

            </div>


            <button
              type="button"
              className="hotel-review-edit-button"
              onClick={() =>
                navigate(
                  '/mi-hotel'
                )
              }
            >
              Editar
            </button>

          </div>


          <div className="hotel-review-info-grid">


            <div>

              <span>
                Dirección
              </span>

              <strong>
                {fullAddress ||
                  'Sin dirección'
                }
              </strong>

            </div>


            <div>

              <span>
                Teléfono
              </span>

              <strong>
                {hotel?.phone ||
                  'Sin teléfono'
                }
              </strong>

            </div>


            <div>

              <span>
                Correo
              </span>

              <strong>
                {hotel?.contact_email ||
                  'Sin correo'
                }
              </strong>

            </div>


            <div>

              <span>
                WhatsApp
              </span>

              <strong>
                {hotel?.whatsapp ||
                  'No configurado'
                }
              </strong>

            </div>

          </div>


          {hotel?.description && (

            <div className="hotel-review-description">

              <span>
                Descripción
              </span>

              <p>
                {hotel.description}
              </p>

            </div>

          )}

        </section>


        {/* =================================================
            HABITACIONES
            ================================================= */}

        <section className="hotel-review-section">

          <div className="hotel-review-section__heading">

            <div>

              <span>
                Oferta
              </span>

              <h2>
                Habitaciones y tarifas
              </h2>

            </div>


            <button
              type="button"
              className="hotel-review-edit-button"
              onClick={() =>
                navigate(
                  '/habitaciones'
                )
              }
            >
              Editar
            </button>

          </div>


          <div className="hotel-review-room-list">


            {activeRooms.map(
              (room) => {

                const images =
                  room.room_type_images ||
                  []


                const cover =
                  images.find(
                    (image) =>
                      image.is_cover
                  ) ||
                  images[0]


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
                  <article
                    key={
                      room.id
                    }
                    className="hotel-review-room"
                  >


                    <div className="hotel-review-room__image">

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
                          size={28}
                          strokeWidth={1.6}
                        />

                      )}

                    </div>


                    <div className="hotel-review-room__body">

                      <div>

                        <span>
                          Habitación
                        </span>

                        <h3>
                          {room.name}
                        </h3>

                      </div>


                      <div className="hotel-review-room__meta">

                        <span>

                          <Camera
                            size={15}
                            strokeWidth={1.7}
                          />

                          {images.length}

                          {' '}

                          {images.length === 1
                            ? 'foto'
                            : 'fotos'
                          }

                        </span>


                        <span>

                          <CircleDollarSign
                            size={15}
                            strokeWidth={1.7}
                          />

                          {activeRates.length}

                          {' '}

                          {activeRates.length === 1
                            ? 'tarifa'
                            : 'tarifas'
                          }

                        </span>

                      </div>


                      {activeRates.length > 0 && (

                        <div className="hotel-review-rate-list">

                          {activeRates.map(
                            (rate) => (

                              <div
                                key={
                                  rate.id
                                }
                              >

                                <span>

                                  <Clock3
                                    size={14}
                                    strokeWidth={1.7}
                                  />

                                  {rate.name}

                                </span>


                                <strong>

                                  {new Intl.NumberFormat(
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
                                    )}

                                </strong>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  </article>
                )
              }
            )}

          </div>

        </section>


        {/* =================================================
            ESTADO FINAL
            ================================================= */}

        {hotel?.approval_status ===
        'pending_review' ? (

          <section className="hotel-review-submit hotel-review-submit--pending">

            <div className="hotel-review-submit__icon">

              <Clock3
                size={24}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <span>
                Solicitud enviada
              </span>

              <h2>
                Tu hotel está en revisión
              </h2>

              <p>
                WAKI revisará la configuración antes
                de activar la publicación del hotel.
              </p>

            </div>

          </section>

        ) : (

          <section className="hotel-review-submit">


            <div className="hotel-review-submit__copy">

              <span>
                Último paso
              </span>

              <h2>
                ¿Todo listo?
              </h2>

              <p>

                {isReady
                  ? 'Al enviar tu hotel, WAKI revisará la configuración antes de publicarlo.'
                  : 'Completa los requisitos pendientes antes de enviar tu hotel.'
                }

              </p>

            </div>


            <button
              type="button"
              className="hotel-setup-primary-button hotel-review-submit__button"
              disabled={
                submitting ||
                !isReady
              }
              onClick={
                handleSubmitForReview
              }
            >

              <Send
                size={17}
                strokeWidth={1.8}
              />

              {submitting
                ? 'Enviando...'
                : 'Enviar a revisión'
              }

            </button>

          </section>

        )}

      </main>

    </div>
  )
}