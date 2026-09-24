import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck
} from 'lucide-react'

import {
  supabase
} from '../lib/supabase'

import wakiLogo from '../assets/waki_logo_full.png'
import wakiMascot from '../assets/waki_admin_access.png'


export default function HotelResetPasswordPage() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')


  useEffect(() => {
    initializeRecovery()

    const {
      data: authListener
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === 'PASSWORD_RECOVERY' &&
          session?.user
        ) {
          setHasRecoverySession(true)
          setCheckingLink(false)
        }
      }
    )

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [])


  async function initializeRecovery() {
    try {
      setCheckingLink(true)
      setErrorMessage('')

      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(
            code
          )

        if (error) {
          throw error
        }

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.user) {
        setHasRecoverySession(false)

        setErrorMessage(
          'Este enlace no es válido o ya expiró. Solicita uno nuevo.'
        )

        return
      }

      setHasRecoverySession(true)

    } catch (error) {
      console.error(
        'Error validando recuperación:',
        error
      )

      setHasRecoverySession(false)

      setErrorMessage(
        'Este enlace no es válido o ya expiró. Solicita uno nuevo.'
      )

    } finally {
      setCheckingLink(false)
    }
  }


  async function handleSubmit(event) {
    event.preventDefault()

    if (password.length < 8) {
      setErrorMessage(
        'La contraseña debe tener al menos 8 caracteres.'
      )
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        'Las contraseñas no coinciden.'
      )
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')

      const { error } =
        await supabase.auth.updateUser({
          password
        })

      if (error) {
        throw error
      }

      setSuccess(true)

      await supabase.auth.signOut()

    } catch (error) {
      console.error(
        'Error actualizando contraseña:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos actualizar tu contraseña.'
      )

    } finally {
      setLoading(false)
    }
  }


  if (checkingLink) {
    return (
      <div className="waki-hotel-auth-loading">
        <div className="waki-hotel-auth-spinner" />

        <p>
          Validando enlace...
        </p>
      </div>
    )
  }


  return (
    <main className="waki-hotel-login">

      <section className="waki-hotel-login__left">

        <div className="waki-hotel-login__decor-circle waki-hotel-login__decor-circle--top" />
        <div className="waki-hotel-login__decor-circle waki-hotel-login__decor-circle--bottom" />

        <span className="waki-hotel-login__sparkle waki-hotel-login__sparkle--one">
          ✦
        </span>

        <span className="waki-hotel-login__sparkle waki-hotel-login__sparkle--two">
          ✦
        </span>

        <div className="waki-hotel-login__left-content">

          <div className="waki-hotel-login__mascot-wrapper">
            <img
              src={wakiMascot}
              alt="WAKI Hotel"
              className="waki-hotel-login__mascot"
            />
          </div>

          <div className="waki-hotel-login__welcome">
            <h1>
              Protege tu cuenta
            </h1>

            <p>
              Crea una nueva contraseña para
              continuar usando WAKI Hotel.
            </p>
          </div>

        </div>

        <p className="waki-hotel-login__copyright">
          © 2026 WAKI. Todos los derechos reservados.
        </p>

      </section>


      <section className="waki-hotel-login__right">

        <div className="waki-hotel-login-card">

          <div className="waki-hotel-login-card__brand">

            <img
              src={wakiLogo}
              alt="WAKI"
              className="waki-hotel-login-card__logo"
            />

            <span className="waki-hotel-login-card__hotel-badge">
              HOTEL
            </span>

          </div>


          {success ? (
            <div className="waki-hotel-recovery-success">

              <div className="waki-hotel-recovery-success__icon">
                <Check size={29} strokeWidth={2} />
              </div>

              <span className="hotel-dashboard-eyebrow">
                CONTRASEÑA ACTUALIZADA
              </span>

              <h2>
                Todo listo
              </h2>

              <p>
                Tu nueva contraseña ya está activa.
                Inicia sesión nuevamente para continuar.
              </p>

              <button
                type="button"
                className="waki-hotel-login-submit"
                onClick={() =>
                  navigate('/login', { replace: true })
                }
              >
                Iniciar sesión
              </button>

            </div>
          ) : !hasRecoverySession ? (
            <div className="waki-hotel-recovery-success">

              <div className="waki-hotel-recovery-success__icon is-error">
                <LockKeyhole size={27} strokeWidth={1.8} />
              </div>

              <h2>
                Enlace no disponible
              </h2>

              <p>
                {errorMessage}
              </p>

              <button
                type="button"
                className="waki-hotel-login-submit"
                onClick={() =>
                  navigate(
                    '/recuperar-contrasena',
                    { replace: true }
                  )
                }
              >
                Solicitar otro enlace
              </button>

            </div>
          ) : (
            <>
              <div className="waki-hotel-login-card__heading">

                <h2>
                  Crea tu nueva contraseña
                </h2>

                <p>
                  Usa al menos 8 caracteres y
                  evita reutilizar una contraseña anterior.
                </p>

              </div>


              <form
                onSubmit={handleSubmit}
                className="waki-hotel-login-form"
              >

                <label className="waki-hotel-login-field">

                  <span>
                    Nueva contraseña
                  </span>

                  <div className="waki-hotel-login-field__control">

                    <LockKeyhole size={19} strokeWidth={1.8} />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="waki-hotel-password-button"
                      onClick={() =>
                        setShowPassword(
                          (current) => !current
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={19} strokeWidth={1.8} />
                      ) : (
                        <Eye size={19} strokeWidth={1.8} />
                      )}
                    </button>

                  </div>

                </label>


                <label className="waki-hotel-login-field">

                  <span>
                    Confirmar contraseña
                  </span>

                  <div className="waki-hotel-login-field__control">

                    <LockKeyhole size={19} strokeWidth={1.8} />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      placeholder="Repite tu contraseña"
                      autoComplete="new-password"
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                    />

                  </div>

                </label>


                {errorMessage && (
                  <div className="waki-hotel-login-error">
                    {errorMessage}
                  </div>
                )}


                <button
                  type="submit"
                  className="waki-hotel-login-submit"
                  disabled={loading}
                >
                  {loading
                    ? 'Guardando...'
                    : 'Guardar nueva contraseña'}
                </button>

              </form>
            </>
          )}


          <div className="waki-hotel-login-card__security">

            <ShieldCheck size={16} strokeWidth={1.7} />

            <span>
              Acceso seguro para hoteles autorizados
            </span>

          </div>

        </div>

      </section>

    </main>
  )
}
 