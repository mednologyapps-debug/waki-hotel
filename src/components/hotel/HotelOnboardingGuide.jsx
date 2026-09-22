import {
  BedDouble,
  Building2,
  Camera,
  Check,
  CircleDollarSign,
  Clock3,
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

import {
  supabase
} from '../../lib/supabase'


export default function HotelOnboardingGuide({
  roomId = null,
  refreshKey = 0
}) {
  const navigate =
    useNavigate()


  const [loading, setLoading] =
    useState(true)

  const [hotel, setHotel] =
    useState(null)

  const [onboarding, setOnboarding] =
    useState(null)

  const [firstRoomId, setFirstRoomId] =
    useState(null)


  useEffect(() => {
    loadOnboarding()
  }, [
    roomId,
    refreshKey
  ])


  /* =========================================================
     CARGAR ONBOARDING
     ========================================================= */

  async function loadOnboarding() {
    try {
      setLoading(true)


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
        return
      }


      /* =====================================================
         HOTEL ASIGNADO
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
        return
      }


      const targetHotelId =
        staffData.hotel_id


      /* =====================================================
         CARGA EN PARALELO
         HOTEL + ONBOARDING + PRIMERA HABITACIÓN
         ===================================================== */

      const [
        hotelResult,
        onboardingResult,
        roomsResult
      ] =
        await Promise.all([

          /* HOTEL */

          supabase
            .from('hotels')
            .select(`
              id,
              name,
              approval_status,
              rejection_reason,
              submitted_at
            `)
            .eq(
              'id',
              targetHotelId
            )
            .maybeSingle(),


          /* ONBOARDING */

          supabase
            .rpc(
              'get_hotel_onboarding_status',
              {
                target_hotel_id:
                  targetHotelId
              }
            ),


          /* PRIMERA HABITACIÓN ACTIVA */

          supabase
            .from('room_types')
            .select(`
              id,
              display_order
            `)
            .eq(
              'hotel_id',
              targetHotelId
            )
            .eq(
              'is_active',
              true
            )
            .order(
              'display_order',
              {
                ascending: true
              }
            )
            .limit(1)

        ])


      /* =====================================================
         VALIDAR HOTEL
         ===================================================== */

      if (
        hotelResult.error
      ) {
        throw hotelResult.error
      }


      if (
        !hotelResult.data
      ) {
        return
      }


      /* =====================================================
         VALIDAR ONBOARDING
         ===================================================== */

      if (
        onboardingResult.error
      ) {
        throw onboardingResult.error
      }


      /* =====================================================
         VALIDAR HABITACIONES
         ===================================================== */

      if (
        roomsResult.error
      ) {
        throw roomsResult.error
      }


      /* =====================================================
         GUARDAR RESULTADOS
         ===================================================== */

      setHotel(
        hotelResult.data
      )


      setOnboarding(
        onboardingResult.data
      )


      setFirstRoomId(
        roomsResult
          .data
          ?.[0]
          ?.id ||
        null
      )

    } catch (error) {
      console.error(
        'Error cargando onboarding:',
        error
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     PASOS
     ========================================================= */

  const steps =
    useMemo(
      () => [
        {
          key:
            'hotel',

          number:
            1,

          title:
            'Información del hotel',

          description:
            'Completa los datos generales, dirección y contacto.',

          icon:
            Building2,

          complete:
            Boolean(
              onboarding
                ?.info_complete
            )
        },

        {
          key:
            'rooms',

          number:
            2,

          title:
            'Habitaciones',

          description:
            'Agrega las habitaciones que publicarás en WAKI.',

          icon:
            BedDouble,

          complete:
            Boolean(
              onboarding
                ?.rooms_complete
            )
        },

        {
          key:
            'photos',

          number:
            3,

          title:
            'Fotografías',

          description:
            'Sube fotos para que tu hotel luzca mejor.',

          icon:
            Camera,

          complete:
            Boolean(
              onboarding
                ?.photos_complete
            )
        },

        {
          key:
            'rates',

          number:
            4,

          title:
            'Tarifas',

          description:
            'Configura precios y duración de estadía.',

          icon:
            CircleDollarSign,

          complete:
            Boolean(
              onboarding
                ?.rates_complete
            )
        },

        {
          key:
            'review',

          number:
            5,

          title:
            'Enviar a revisión',

          description:
            'Cuando todo esté listo podrás enviarlo a revisión.',

          icon:
            Send,

          complete:
            [
              'pending_review',
              'approved'
            ]
              .includes(
                hotel
                  ?.approval_status
              )
        }
      ],
      [
        onboarding,
        hotel
      ]
    )


  /* =========================================================
     PROGRESO
     ========================================================= */

  const completedSteps =
    steps
      .filter(
        (step) =>
          step.complete
      )
      .length


  const progressPercent =
    completedSteps *
    20


  /* =========================================================
     PASO ACTUAL REAL
     ========================================================= */

  const currentPendingStep =
    steps.find(
      (step) =>
        !step.complete
    )


  const currentPendingKey =
    currentPendingStep
      ?.key ||
    null


  /* =========================================================
     NAVEGACIÓN ENTRE PASOS
     ========================================================= */

  function navigateToStep(
    stepKey
  ) {
    switch (
      stepKey
    ) {

      /* =====================================================
         INFORMACIÓN HOTEL
         ===================================================== */

      case 'hotel':

        navigate(
          '/mi-hotel'
        )

        break


      /* =====================================================
         HABITACIONES
         ===================================================== */

      case 'rooms':

        navigate(
          '/habitaciones'
        )

        break


      /* =====================================================
         FOTOGRAFÍAS
         ===================================================== */

      case 'photos':

        if (
          roomId
        ) {
          navigate(
            `/habitaciones/${roomId}/fotos`
          )

          break
        }


        if (
          firstRoomId
        ) {
          navigate(
            `/habitaciones/${firstRoomId}/fotos`
          )
        }

        break


      /* =====================================================
         TARIFAS
         ===================================================== */

      case 'rates':

        navigate(
          '/tarifas'
        )

        break


      /* =====================================================
         REVISIÓN
         ===================================================== */

      case 'review':

        navigate(
          '/mi-hotel/revision'
        )

        break


      default:
        break
    }
  }


  /* =========================================================
     SKELETON
     Se muestra inmediatamente para reservar el espacio.
     ========================================================= */

  if (
    loading
  ) {
    return (
      <section
        className="waki-onboarding-guide"
        aria-hidden="true"
      >


        {/* =================================================
            PROGRESO SKELETON
            ================================================= */}

        <div className="waki-onboarding-guide__header">

          <div />


          <div className="waki-onboarding-guide__progress">

            <span
              style={{
                opacity:
                  0.45
              }}
            >
              Cargando progreso...
            </span>


            <div>

              <i
                style={{
                  width:
                    '0%',
                  opacity:
                    0.35
                }}
              />

            </div>

          </div>

        </div>


        {/* =================================================
            PASOS SKELETON
            ================================================= */}

        <div className="waki-onboarding-guide__steps">


          {[
            'Información del hotel',
            'Habitaciones',
            'Fotografías',
            'Tarifas',
            'Enviar a revisión'
          ]
            .map(
              (
                label,
                index
              ) => (

                <div
                  key={
                    label
                  }
                  className="waki-onboarding-guide__step"
                  style={{
                    cursor:
                      'default',
                    opacity:
                      0.55
                  }}
                >


                  {index !== 0 && (

                    <span className="waki-onboarding-guide__connector" />

                  )}


                  <span className="waki-onboarding-guide__number">

                    {index + 1}

                  </span>


                  <span className="waki-onboarding-guide__step-copy">

                    <strong>
                      {label}
                    </strong>


                    <small>
                      Cargando estado...
                    </small>

                  </span>

                </div>

              )
            )}

        </div>

      </section>
    )
  }


  /* =========================================================
     SIN DATOS
     ========================================================= */

  if (
    !hotel ||
    !onboarding
  ) {
    return null
  }


  /* =========================================================
     HOTEL APROBADO
     ========================================================= */

  if (
    hotel.approval_status ===
    'approved'
  ) {
    return null
  }


  /* =========================================================
     HOTEL SUSPENDIDO
     ========================================================= */

  if (
    hotel.approval_status ===
    'suspended'
  ) {
    return null
  }


  /* =========================================================
     HOTEL EN REVISIÓN
     ========================================================= */

  if (
    hotel.approval_status ===
    'pending_review'
  ) {
    return (
      <section className="waki-onboarding-reviewing">


        <div className="waki-onboarding-reviewing__icon">

          <Clock3
            size={21}
            strokeWidth={1.7}
          />

        </div>


        <div>

          <strong>
            Tu hotel está en revisión
          </strong>


          <p>
            WAKI ya recibió tu configuración.
            Te avisaremos cuando la revisión
            haya finalizado.
          </p>

        </div>

      </section>
    )
  }


  /* =========================================================
     DRAFT / REJECTED
     ========================================================= */

  return (
    <section className="waki-onboarding-guide">


      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="waki-onboarding-guide__header">


        <div>

          <span className="waki-onboarding-guide__eyebrow">
            Configuración inicial
          </span>


          <h2>
            Configura tu hotel
          </h2>


          <p>
            Te acompañamos paso a paso hasta
            que tu hotel esté listo para WAKI.
          </p>

        </div>


        {/* =================================================
            PROGRESO
            ================================================= */}

        <div className="waki-onboarding-guide__progress">

          <span>

            {progressPercent}% completado

          </span>


          <div>

            <i
              style={{
                width:
                  `${progressPercent}%`
              }}
            />

          </div>

        </div>

      </div>


      {/* =====================================================
          STEPPER
          ===================================================== */}

      <div className="waki-onboarding-guide__steps">


        {steps.map(
          (
            step,
            index
          ) => {

            const isCurrent =
              step.key ===
              currentPendingKey


            return (
              <button
                key={
                  step.key
                }
                type="button"
                className={[
                  'waki-onboarding-guide__step',

                  step.complete
                    ? 'is-complete'
                    : '',

                  isCurrent
                    ? 'is-current'
                    : ''
                ].join(' ')}
                onClick={() =>
                  navigateToStep(
                    step.key
                  )
                }
              >


                {/* =========================================
                    CONECTOR
                    ========================================= */}

                {index !== 0 && (

                  <span className="waki-onboarding-guide__connector" />

                )}


                {/* =========================================
                    CÍRCULO
                    ========================================= */}

                <span className="waki-onboarding-guide__number">

                  {step.complete ? (

                    <Check
                      size={15}
                      strokeWidth={2.4}
                    />

                  ) : (

                    step.number

                  )}

                </span>


                {/* =========================================
                    TEXTO
                    ========================================= */}

                <span className="waki-onboarding-guide__step-copy">

                  <strong>
                    {step.title}
                  </strong>


                  <small>
                    {step.description}
                  </small>

                </span>

              </button>
            )
          }
        )}

      </div>

    </section>
  )
}