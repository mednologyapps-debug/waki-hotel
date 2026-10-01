import {

  useEffect,

  useState

} from 'react'



import {

  Navigate,

  useNavigate

} from 'react-router-dom'



import {
  ArrowRight,
  CheckCircle2,
  Clock3
} from 'lucide-react'



import WakiGlobalLoader

  from './common/WakiGlobalLoader'



import HotelSidebar

  from './hotel/HotelSidebar'



import {

  supabase

} from '../lib/supabase'

import wakiNoReservas
  from '../assets/waki_no_reservas.png'





export default function ProtectedHotelRoute({

  children,



  allowedRoles = [

    'admin'

  ],



  requireApprovedHotel =

    false

}) {

  const navigate =

    useNavigate()





  const [

    initialLoading,

    setInitialLoading

  ] =

    useState(true)





  const [

    session,

    setSession

  ] =

    useState(null)





  const [

    staffRole,

    setStaffRole

  ] =

    useState(null)





  const [

    hotelApprovalStatus,

    setHotelApprovalStatus

  ] =

    useState(null)





  const [

    hotelAccess,

    setHotelAccess

  ] =

    useState(null)





  const [

    accessError,

    setAccessError

  ] =

    useState('')





  /* =====================================================

     CARGA DE ACCESO

  ===================================================== */



  useEffect(() => {

    let mounted =

      true





    async function loadAccess(

      currentSession,

      {

        showLoader = false

      } = {}

    ) {

      try {

        if (showLoader) {

          setInitialLoading(

            true

          )

        }





        setAccessError('')





        if (

          !currentSession?.user

        ) {

          if (mounted) {

            setSession(null)

            setStaffRole(null)

            setHotelAccess(null)

            setHotelApprovalStatus(

              null

            )

          }



          return

        }





        if (mounted) {

          setSession(

            currentSession

          )

        }





        /* =========================================

           ACCESO DEL HOTEL

        ========================================= */



        const {

          data: accessData,

          error: accessRpcError

        } =

          await supabase

            .rpc(

              'get_my_hotel_access'

            )





        if (!mounted) {

          return

        }





        if (accessRpcError) {

          throw accessRpcError

        }





        const accessRows =

          Array.isArray(

            accessData

          )

            ? accessData

            : []





        const activeAccess =

          accessRows[0] ||

          null





        if (

          !activeAccess?.hotel_id ||

          !activeAccess?.staff_role

        ) {

          setStaffRole(null)

          setHotelAccess(null)

          setHotelApprovalStatus(

            null

          )





          setAccessError(

            'Esta cuenta no tiene acceso activo a un hotel.'

          )





          return

        }





        setStaffRole(

          activeAccess.staff_role

        )





        setHotelAccess(

          activeAccess

        )





        /* =========================================

           ESTADO DEL HOTEL

        ========================================= */



        if (

          requireApprovedHotel

        ) {

          const {

            data: hotelData,

            error: hotelError

          } =

            await supabase

              .from('hotels')

              .select(`

                id,

                approval_status

              `)

              .eq(

                'id',

                activeAccess.hotel_id

              )

              .maybeSingle()





          if (!mounted) {

            return

          }





          if (hotelError) {

            throw hotelError

          }





          setHotelApprovalStatus(

            hotelData

              ?.approval_status ||

            null

          )



        } else {

          setHotelApprovalStatus(

            null

          )

        }



      } catch (error) {

        console.error(

          'Error validando acceso del hotel:',

          error

        )





        if (!mounted) {

          return

        }





        setAccessError(

          error?.message ||

          'No pudimos validar el acceso a este hotel.'

        )



      } finally {

        if (

          mounted &&

          showLoader

        ) {

          setInitialLoading(

            false

          )

        }

      }

    }





    /* =========================================

       SESIÓN INICIAL

    ========================================= */



    async function initializeAccess() {

      try {

        const {

          data: {

            session:

              currentSession

          },

          error:

            sessionError

        } =

          await supabase

            .auth

            .getSession()





        if (!mounted) {

          return

        }





        if (

          sessionError ||

          !currentSession

        ) {

          setSession(null)

          setStaffRole(null)

          setHotelAccess(null)

          setHotelApprovalStatus(

            null

          )

          setInitialLoading(

            false

          )



          return

        }





        await loadAccess(

          currentSession,

          {

            showLoader: true

          }

        )



      } catch (error) {

        console.error(

          'Error inicializando acceso:',

          error

        )





        if (!mounted) {

          return

        }





        setSession(null)

        setStaffRole(null)

        setHotelAccess(null)

        setHotelApprovalStatus(

          null

        )

        setInitialLoading(

          false

        )

      }

    }





    initializeAccess()





    /* =========================================

       CAMBIOS DE AUTH

    ========================================= */



    const {

      data: {

        subscription

      }

    } =

      supabase

        .auth

        .onAuthStateChange(

          (

            event,

            newSession

          ) => {



            if (!mounted) {

              return

            }





            if (

              event ===

              'SIGNED_OUT'

            ) {

              setSession(null)

              setStaffRole(null)

              setHotelAccess(null)

              setHotelApprovalStatus(

                null

              )

              setAccessError('')

              setInitialLoading(

                false

              )



              return

            }





            /*

             \* Evitamos desmontar toda

             \* la interfaz al refrescar

             \* silenciosamente el token.

             */

            if (

              event ===

              'TOKEN_REFRESHED'

            ) {

              if (newSession) {

                setSession(

                  newSession

                )

              }



              return

            }





            /*

             \* Si cambia el usuario,

             \* volvemos a validar.

             */

            if (

              event ===

                'SIGNED_IN' ||

              event ===

                'USER_UPDATED'

            ) {

              if (newSession) {

                loadAccess(

                  newSession,

                  {

                    showLoader: false

                  }

                )

              }



              return

            }





            if (newSession) {

              setSession(

                newSession

              )

            }

          }

        )





    return () => {

      mounted =

        false





      subscription

        .unsubscribe()

    }



  }, [

    requireApprovedHotel

  ])





  /* =====================================================

     LOADING

  ===================================================== */



  if (initialLoading) {

    return (

      <WakiGlobalLoader

        title="Validando tu acceso..."

        subtitle="Estamos preparando tu portal WAKI"

        fullScreen

      />

    )

  }





  /* =====================================================

     SIN SESIÓN

  ===================================================== */



  if (!session) {

    return (

      <Navigate

        to="/login"

        replace

      />

    )

  }





  /* =====================================================

     ERROR DE ACCESO

  ===================================================== */



  if (

    accessError ||

    !staffRole

  ) {

    return (

      <div className="hotel-access-state">



        <div className="hotel-access-state__card">



          <span className="hotel-access-state__eyebrow">

            WAKI HOTEL

          </span>





          <h1>

            Acceso no disponible

          </h1>





          <p>

            {

              accessError ||

              'Tu acceso al hotel no está activo.'

            }

          </p>





          <button

            type="button"

            className="hotel-primary-button"

            onClick={

              async () => {

                await supabase

                  .auth

                  .signOut()





                window.location

                  .replace(

                    '/login'

                  )

              }

            }

          >

            Cerrar sesión

          </button>



        </div>



      </div>

    )

  }





  /* =====================================================

     VALIDACIÓN DE ROL

  ===================================================== */



  if (

    !allowedRoles.includes(

      staffRole

    )

  ) {

    if (

      staffRole ===

      'reception'

    ) {

      return (

        <Navigate

          to="/reservas"

          replace

        />

      )

    }





    if (

      staffRole ===

      'scanner'

    ) {

      return (

        <Navigate

          to="/scan"

          replace

        />

      )

    }





    return (

      <Navigate

        to="/login"

        replace

      />

    )

  }





  /* =====================================================

     HOTEL NO APROBADO

     PANTALLA WAKI

  ===================================================== */



  if (

    requireApprovedHotel &&

    hotelApprovalStatus !==

      'approved'

  ) {

    const hotelName =

      hotelAccess?.hotel_name ||

      'Mi hotel'





    const hotelLocation =

      [

        hotelAccess?.hotel_district,

        hotelAccess?.hotel_province

      ]

        .filter(Boolean)

        .join(', ') ||

      'Lima, Perú'





    const statusContent =

      getHotelBlockedStatusContent(

        hotelApprovalStatus

      )





    return (

      <div className="hotel-portal">



        <HotelSidebar

          activeKey="reservas"

          hotelName={

            hotelName

          }

          hotelLocation={

            hotelLocation

          }

        />





        <main className="hotel-locked-page">



          {/* =====================================

              CABECERA

          ===================================== */}



          <header className="hotel-locked-header">



            <div>



              <span className="hotel-dashboard-eyebrow">

                Reservas

              </span>





              <h1>

                Gestiona tus reservas

              </h1>





              <p>

                Este módulo estará disponible

                cuando tu hotel esté habilitado

                para operar en WAKI.

              </p>



            </div>



          </header>





          {/* =====================================

              CONTENIDO

          ===================================== */}



          <section className="hotel-locked-card">



            <div className="hotel-locked-card__visual">

              <img
                src={wakiNoReservas}
                alt="WAKI - Reservas aún no disponibles"
                className="hotel-locked-card__illustration"
              />

            </div>



            <div className="hotel-locked-card__content">



              <span className="hotel-locked-card__eyebrow">

                MÓDULO BLOQUEADO

              </span>





              <h2>

                Reservas aún no disponibles

              </h2>





              <p>

                {statusContent.description}

              </p>





              <div className="hotel-locked-status">



                <div className="hotel-locked-status__icon">



                  <Clock3

                    size={19}

                    strokeWidth={1.8}

                  />



                </div>





                <div>



                  <span>

                    Estado actual

                  </span>



                  <strong>

                    {statusContent.label}

                  </strong>



                </div>



              </div>





              <div className="hotel-locked-info">



                <CheckCircle2

                  size={20}

                  strokeWidth={1.8}

                />





                <p>

                  Cuando tu hotel esté aprobado,

                  este módulo se habilitará

                  automáticamente. No tendrás que

                  realizar ninguna activación

                  adicional.

                </p>



              </div>





              <div className="hotel-locked-actions">



                {staffRole ===

                'admin' && (

                  <button

                    type="button"

                    className="hotel-primary-button hotel-locked-primary"

                    onClick={() =>

                      navigate(

                        statusContent.actionRoute

                      )

                    }

                  >

                    {

                      statusContent.actionLabel

                    }



                    <ArrowRight

                      size={18}

                      strokeWidth={1.8}

                    />

                  </button>

                )}





                {staffRole ===

                'admin' && (

                  <button

                    type="button"

                    className="hotel-outline-button hotel-locked-secondary"

                    onClick={() =>

                      navigate(

                        '/dashboard'

                      )

                    }

                  >

                    Volver al resumen

                  </button>

                )}





                {staffRole !==

                'admin' && (

                  <button

                    type="button"

                    className="hotel-primary-button hotel-locked-primary"

                    onClick={

                      async () => {

                        await supabase

                          .auth

                          .signOut()





                        navigate(

                          '/login',

                          {

                            replace: true

                          }

                        )

                      }

                    }

                  >

                    Cerrar sesión

                  </button>

                )}



              </div>



            </div>



          </section>





          {/* =====================================

              EXPLICACIÓN

          ===================================== */}



          <section className="hotel-locked-steps">



            <div className="hotel-locked-steps__heading">



              <span className="hotel-dashboard-eyebrow">

                ¿Qué falta?

              </span>





              <h2>

                Activa Reservas en tres pasos

              </h2>



            </div>





            <div className="hotel-locked-steps__grid">



              <article>



                <span>

                  1

                </span>



                <div>



                  <strong>

                    Completa tu hotel

                  </strong>



                  <p>

                    Revisa información,

                    habitaciones, fotografías

                    y tarifas.

                  </p>



                </div>



              </article>





              <article>



                <span>

                  2

                </span>



                <div>



                  <strong>

                    Envía a revisión

                  </strong>



                  <p>

                    WAKI verificará que tu

                    configuración esté lista

                    para operar.

                  </p>



                </div>



              </article>





              <article>



                <span>

                  3

                </span>



                <div>



                  <strong>

                    Empieza a recibir reservas

                  </strong>



                  <p>

                    Una vez aprobado,

                    Reservas quedará disponible

                    automáticamente.

                  </p>



                </div>



              </article>



            </div>



          </section>



        </main>



      </div>

    )

  }





  /* =====================================================

     ACCESO PERMITIDO

  ===================================================== */



  return children

}





/* =====================================================

   CONTENIDO SEGÚN ESTADO

\===================================================== */



function getHotelBlockedStatusContent(

  approvalStatus

) {

  switch (approvalStatus) {



    case 'pending_review':

      return {

        label:

          'En revisión',



        description:

          'Tu hotel ya fue enviado a revisión. Nuestro equipo está validando la configuración antes de habilitar la operación de reservas.',



        actionLabel:

          'Ver estado de revisión',



        actionRoute:

          '/mi-hotel/revision'

      }





    case 'rejected':

      return {

        label:

          'Requiere cambios',



        description:

          'La revisión encontró información que necesita ser actualizada. Realiza las correcciones indicadas y vuelve a enviar tu hotel.',



        actionLabel:

          'Revisar observaciones',



        actionRoute:

          '/mi-hotel/revision'

      }





    case 'suspended':

      return {

        label:

          'Suspendido',



        description:

          'La operación de este hotel se encuentra temporalmente suspendida. El módulo de reservas permanecerá bloqueado mientras dure este estado.',



        actionLabel:

          'Ver estado',



        actionRoute:

          '/mi-hotel/revision'

      }





    case 'draft':

    default:

      return {

        label:

          'Borrador',



        description:

          'Completa la configuración de tu hotel y envíala a revisión. Reservas se habilitará cuando WAKI apruebe tu establecimiento.',



        actionLabel:

          'Continuar configuración',



        actionRoute:

          '/dashboard'

      }

  }

}