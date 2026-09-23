import {
  useEffect,
  useState
} from 'react'

import {
  Navigate
} from 'react-router-dom'

import WakiGlobalLoader
  from './common/WakiGlobalLoader'

import {
  supabase
} from '../lib/supabase'


export default function ProtectedHotelRoute({
  children,
  allowedRoles = [
    'admin'
  ]
}) {
  const [initialLoading, setInitialLoading] =
    useState(true)

  const [session, setSession] =
    useState(null)

  const [staffRole, setStaffRole] =
    useState(null)

  const [accessError, setAccessError] =
    useState('')


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
          setInitialLoading(true)
        }

        setAccessError('')


        if (!currentSession?.user) {
          if (mounted) {
            setSession(null)
            setStaffRole(null)
          }

          return
        }


        if (mounted) {
          setSession(
            currentSession
          )
        }


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

          setAccessError(
            'Esta cuenta no tiene acceso activo a un hotel.'
          )

          return
        }


        setStaffRole(
          activeAccess.staff_role
        )

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
          setInitialLoading(false)
        }
      }
    }


    async function initializeAccess() {
      try {
        const {
          data: {
            session: currentSession
          },
          error: sessionError
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
          setInitialLoading(false)

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
        setInitialLoading(false)
      }
    }


    initializeAccess()


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
              setAccessError('')
              setInitialLoading(false)

              return
            }


            /*
             * IMPORTANTE:
             *
             * Supabase puede emitir TOKEN_REFRESHED cuando
             * vuelves a una pestaña del navegador.
             *
             * Antes volvíamos a poner el loader global,
             * desmontando la página completa y dando la
             * sensación de que WAKI se recargaba.
             *
             * Ahora solo actualizamos la sesión en memoria.
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
             * Si cambia realmente el usuario o su sesión,
             * revalidamos permisos en segundo plano SIN
             * desmontar la pantalla actual.
             */
            if (
              (
                event ===
                'SIGNED_IN'
              ) ||
              (
                event ===
                'USER_UPDATED'
              )
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

  }, [])


  if (initialLoading) {
    return (
      <WakiGlobalLoader
        title="Validando tu acceso..."
        subtitle="Estamos preparando tu portal WAKI"
        fullScreen
      />
    )
  }


  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }


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
            onClick={async () => {
              await supabase
                .auth
                .signOut()

              window.location
                .replace(
                  '/login'
                )
            }}
          >
            Cerrar sesión
          </button>

        </div>

      </div>
    )
  }


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


  return children
}
