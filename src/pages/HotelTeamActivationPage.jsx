import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import {
  supabase
} from '../lib/supabase'

import wakiLogo
  from '../assets/waki_logo_blanco.png'


export default function HotelTeamActivationPage() {
  const navigate =
    useNavigate()

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [ready, setReady] =
    useState(false)

  const [password, setPassword] =
    useState('')

  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [showPassword, setShowPassword] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')


  useEffect(() => {
    initializeInvite()
  }, [])


  async function initializeInvite() {
    try {
      setLoading(true)
      setErrorMessage('')


      const params =
        new URLSearchParams(
          window.location.search
        )

      const code =
        params.get(
          'code'
        )


      if (code) {
        const {
          error
        } =
          await supabase
            .auth
            .exchangeCodeForSession(
              code
            )


        if (error) {
          throw error
        }
      }


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


      if (!session) {
        throw new Error(
          'La invitación no es válida, ya venció o fue utilizada.'
        )
      }


      setReady(true)

    } catch (error) {
      console.error(
        'Error validando invitación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos validar la invitación.'
      )

    } finally {
      setLoading(false)
    }
  }


  async function handleActivate(
    event
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage('')


      if (
        password.length <
        8
      ) {
        throw new Error(
          'La contraseña debe tener al menos 8 caracteres.'
        )
      }


      if (
        password !==
        confirmPassword
      ) {
        throw new Error(
          'Las contraseñas no coinciden.'
        )
      }


      const {
        error
      } =
        await supabase
          .auth
          .updateUser({
            password
          })


      if (error) {
        throw error
      }


      const {
        data: accessData,
        error: accessError
      } =
        await supabase
          .rpc(
            'get_my_hotel_access'
          )


      if (accessError) {
        throw accessError
      }


      const access =
        Array.isArray(
          accessData
        )
          ? accessData[0]
          : null


      if (
        access?.staff_role ===
        'admin'
      ) {
        navigate(
          '/dashboard',
          {
            replace: true
          }
        )

        return
      }


      if (
        access?.staff_role ===
        'reception'
      ) {
        navigate(
          '/reservas',
          {
            replace: true
          }
        )

        return
      }


      navigate(
        '/login',
        {
          replace: true
        }
      )

    } catch (error) {
      console.error(
        'Error activando cuenta:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos activar tu cuenta.'
      )

    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="hotel-team-activation">

      <div className="hotel-team-activation__brand">

        <img
          src={wakiLogo}
          alt="WAKI"
        />

        <span>
          HOTEL
        </span>

      </div>


      <section className="hotel-team-activation__card">

        {loading ? (

          <>

            <div className="screen-loader__spinner" />

            <p>
              Validando invitación...
            </p>

          </>

        ) : errorMessage &&
          !ready ? (

          <>

            <h1>
              Invitación no disponible
            </h1>

            <p>
              {errorMessage}
            </p>

            <button
              type="button"
              className="hotel-primary-button"
              onClick={() =>
                navigate(
                  '/login'
                )
              }
            >
              Ir al inicio de sesión
            </button>

          </>

        ) : (

          <form
            onSubmit={
              handleActivate
            }
          >

            <div className="hotel-team-activation__icon">

              <Check
                size={22}
                strokeWidth={2}
              />

            </div>


            <span className="hotel-dashboard-eyebrow">
              INVITACIÓN A WAKI HOTEL
            </span>

            <h1>
              Crea tu contraseña
            </h1>

            <p>
              Tu acceso al equipo del hotel
              ya está preparado. Define una
              contraseña para continuar.
            </p>


            {errorMessage && (

              <div className="hotel-dashboard-error">
                {errorMessage}
              </div>

            )}


            <label>

              <span>
                Contraseña
              </span>

              <div className="hotel-team-activation__input">

                <LockKeyhole
                  size={18}
                  strokeWidth={1.8}
                />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={
                    password
                  }
                  minLength={8}
                  required
                  autoComplete="new-password"
                  disabled={
                    saving
                  }
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                >

                  {showPassword ? (

                    <EyeOff
                      size={18}
                      strokeWidth={1.8}
                    />

                  ) : (

                    <Eye
                      size={18}
                      strokeWidth={1.8}
                    />

                  )}

                </button>

              </div>

            </label>


            <label>

              <span>
                Repite tu contraseña
              </span>

              <div className="hotel-team-activation__input">

                <LockKeyhole
                  size={18}
                  strokeWidth={1.8}
                />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={
                    confirmPassword
                  }
                  minLength={8}
                  required
                  autoComplete="new-password"
                  disabled={
                    saving
                  }
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                />

              </div>

            </label>


            <button
              type="submit"
              className="hotel-primary-button hotel-team-activation__submit"
              disabled={
                saving
              }
            >

              {
                saving
                  ? 'Activando...'
                  : 'Activar mi acceso'
              }

            </button>

          </form>

        )}

      </section>

    </div>
  )
}
