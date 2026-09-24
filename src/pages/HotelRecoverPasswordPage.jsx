import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Send,
  ShieldCheck
} from 'lucide-react'

import { supabase } from '../lib/supabase'

import wakiMascot from '../assets/waki_admin_access.png'
import wakiPasswordRecovery
  from '../assets/waki_password_recovery.png'


export default function HotelRecoverPasswordPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sent, setSent] = useState(false)


  async function handleSubmit(event) {
    event.preventDefault()

    const normalizedEmail =
      email.trim().toLowerCase()

    if (!normalizedEmail) {
      setErrorMessage(
        'Ingresa tu correo electrónico.'
      )

      return
    }

    try {
      setLoading(true)
      setErrorMessage('')

      const redirectTo =
        `${window.location.origin}/restablecer-contrasena`

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo
          }
        )

      if (error) {
        throw error
      }

      setSent(true)

    } catch (error) {
      console.error(
        'Error solicitando recuperación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos enviar el correo de recuperación.'
      )

    } finally {
      setLoading(false)
    }
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
              Recupera tu acceso
            </h1>

            <p>
              Te ayudamos a volver a tu cuenta
              de WAKI Hotel de forma segura.
            </p>

          </div>

        </div>


        <p className="waki-hotel-login__copyright">
          © 2026 WAKI. Todos los derechos reservados.
        </p>

      </section>


      <section className="waki-hotel-login__right">

        <div className="waki-hotel-login-card">

          <button
            type="button"
            className="waki-hotel-auth-back"
            onClick={() =>
              navigate(
                '/login'
              )
            }
          >
            <ArrowLeft
              size={17}
              strokeWidth={1.8}
            />

            Volver
          </button>


          {!sent ? (
            <>

              <div className="waki-hotel-login-card__heading">

                <h2>
                  ¿Olvidaste tu contraseña?
                </h2>

                <p>
                  Ingresa el correo de tu cuenta y
                  te enviaremos un enlace para crear
                  una nueva contraseña.
                </p>

              </div>


              <form
                onSubmit={handleSubmit}
                className="waki-hotel-login-form"
              >

                <label className="waki-hotel-login-field">

                  <span>
                    Correo electrónico
                  </span>

                  <div className="waki-hotel-login-field__control">

                    <Mail
                      size={19}
                      strokeWidth={1.8}
                    />

                    <input
                      type="email"
                      value={email}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      onChange={(event) =>
                        setEmail(
                          event.target.value
                        )
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

                  <Send
                    size={17}
                    strokeWidth={1.8}
                  />

                  {loading
                    ? 'Enviando...'
                    : 'Enviar enlace'}

                </button>

              </form>

            </>
          ) : (
            <div className="waki-hotel-recovery-success">

              <div className="waki-hotel-recovery-illustration">
                <img
                  src={wakiPasswordRecovery}
                  alt="Llamita WAKI enviando un correo seguro"
                />
              </div>

              <span className="waki-hotel-recovery-eyebrow">
                REVISA TU CORREO
              </span>

              <h2>
                Te enviamos un enlace
              </h2>

              <p>
                Si el correo ingresado corresponde
                a una cuenta WAKI, recibirás un enlace
                para crear una nueva contraseña.
              </p>

              <button
                type="button"
                className="waki-hotel-login-submit"
                onClick={() =>
                  navigate(
                    '/login'
                  )
                }
              >
                Volver al inicio de sesión
              </button>

            </div>
          )}


          <div className="waki-hotel-login-card__security">

            <ShieldCheck
              size={16}
              strokeWidth={1.7}
            />

            <span>
              Acceso seguro para hoteles autorizados
            </span>

          </div>

        </div>

      </section>

    </main>
  )
}
