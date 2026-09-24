import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck
} from 'lucide-react'

import { supabase } from '../lib/supabase'

import wakiLogo from '../assets/waki_logo_full.png'
import wakiMascot from '../assets/waki_admin_access.png'

export default function HotelLoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    checkExistingSession()
  }, [])


  /* =========================================================
     RUTA SEGÚN ROL INTERNO DEL HOTEL
     ========================================================= */

  function redirectByStaffRole(staffRole) {
    if (staffRole === 'admin') {
      navigate('/dashboard', {
        replace: true
      })

      return
    }

    if (staffRole === 'reception') {
      navigate('/reservas', {
        replace: true
      })

      return
    }

    if (staffRole === 'scanner') {
      navigate('/scan', {
        replace: true
      })

      return
    }

    throw new Error(
      'Tu cuenta no tiene un rol válido dentro del hotel.'
    )
  }


  /* =========================================================
     VALIDAR ACCESO DEL USUARIO
     ========================================================= */

  async function getHotelAccessForCurrentUser() {
    const {
      data: accessData,
      error: accessError
    } = await supabase
      .rpc(
        'get_my_hotel_access'
      )

    if (accessError) {
      throw accessError
    }

    const accessRows =
      Array.isArray(accessData)
        ? accessData
        : []

    const activeAccess =
      accessRows[0] || null

    if (
      !activeAccess?.hotel_id ||
      !activeAccess?.staff_role
    ) {
      throw new Error(
        'Tu cuenta todavía no tiene un acceso activo a un hotel.'
      )
    }

    return activeAccess
  }


  /* =========================================================
     SESIÓN EXISTENTE
     ========================================================= */

  async function checkExistingSession() {
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase
        .auth
        .getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.user) {
        setCheckingSession(false)
        return
      }

      const {
        data: profile,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(`
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

      if (
        profile?.role !== 'hotel' ||
        profile?.account_status !== 'active'
      ) {
        await supabase
          .auth
          .signOut()

        setCheckingSession(false)

        return
      }

      const access =
        await getHotelAccessForCurrentUser()

      redirectByStaffRole(
        access.staff_role
      )

    } catch (error) {
      console.error(
        'Error verificando sesión:',
        error
      )

      await supabase
        .auth
        .signOut()

      setErrorMessage(
        error?.message ||
        'No pudimos validar tu acceso a WAKI Hotel.'
      )

      setCheckingSession(false)
    }
  }


  /* =========================================================
     LOGIN
     ========================================================= */

  async function handleLogin(event) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setErrorMessage(
        'Ingresa tu correo electrónico y contraseña.'
      )

      return
    }

    try {
      setLoading(true)
      setErrorMessage('')

      const {
        data: authData,
        error: authError
      } = await supabase
        .auth
        .signInWithPassword({
          email:
            email
              .trim()
              .toLowerCase(),

          password
        })

      if (authError) {
        throw authError
      }

      if (!authData?.user) {
        throw new Error(
          'No se pudo identificar al usuario.'
        )
      }

      /*
       * 1. Validamos que realmente sea
       * una cuenta activa del portal hotel.
       */

      const {
        data: profile,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(`
          id,
          role,
          account_status
        `)
        .eq(
          'id',
          authData.user.id
        )
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (!profile) {
        await supabase
          .auth
          .signOut()

        setErrorMessage(
          'No encontramos un perfil asociado a esta cuenta.'
        )

        return
      }

      if (profile.role !== 'hotel') {
        await supabase
          .auth
          .signOut()

        setErrorMessage(
          'Esta cuenta no pertenece al portal de hoteles WAKI.'
        )

        return
      }

      if (
        profile.account_status !==
        'active'
      ) {
        await supabase
          .auth
          .signOut()

        setErrorMessage(
          'Tu cuenta no se encuentra activa. Contacta con WAKI.'
        )

        return
      }

      /*
       * 2. Obtenemos la sede y el rol real
       * desde hotel_staff.
       *
       * admin     -> /dashboard
       * reception -> /reservas
       * scanner   -> /scan
       */

      const access =
        await getHotelAccessForCurrentUser()

      redirectByStaffRole(
        access.staff_role
      )

    } catch (error) {
      console.error(
        'Error al iniciar sesión:',
        error
      )

      /*
       * Si Auth llegó a iniciar sesión pero
       * falló la autorización interna, no
       * dejamos una sesión equivocada activa.
       */

      const {
        data: {
          session
        }
      } = await supabase
        .auth
        .getSession()

      if (
        session &&
        error?.message !==
          'Invalid login credentials'
      ) {
        await supabase
          .auth
          .signOut()
      }

      if (
        error?.message ===
        'Invalid login credentials'
      ) {
        setErrorMessage(
          'El correo o la contraseña son incorrectos.'
        )
      } else {
        setErrorMessage(
          error?.message ||
            'No se pudo iniciar sesión. Inténtalo nuevamente.'
        )
      }

    } finally {
      setLoading(false)
    }
  }


  if (checkingSession) {
    return (
      <div className="waki-hotel-auth-loading">
        <div className="waki-hotel-auth-spinner" />

        <p>
          Verificando acceso...
        </p>
      </div>
    )
  }

  return (
    <main className="waki-hotel-login">

      {/* =================================================
          PANEL IZQUIERDO
      ================================================= */}

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
              Bienvenido a WAKI Hotel
            </h1>

            <p>
              Gestiona tu hotel, habitaciones y tarifas
              desde un solo lugar.
            </p>

          </div>

        </div>

        <p className="waki-hotel-login__copyright">
          © 2026 WAKI. Todos los derechos reservados.
        </p>

      </section>


      {/* =================================================
          PANEL DERECHO
      ================================================= */}

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

          <div className="waki-hotel-login-card__heading">

            <h2>
              Iniciar sesión
            </h2>

            <p>
              Accede al panel de gestión de tu hotel
            </p>

          </div>

          <form
            onSubmit={handleLogin}
            className="waki-hotel-login-form"
          >

            {/* CORREO */}

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
                  placeholder="hotel@wakipe.com"
                  autoComplete="email"
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                />

              </div>

            </label>


            {/* CONTRASEÑA */}

            <label className="waki-hotel-login-field">

              <span>
                Contraseña
              </span>

              <div className="waki-hotel-login-field__control">

                <LockKeyhole
                  size={19}
                  strokeWidth={1.8}
                />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
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
                    <EyeOff
                      size={19}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Eye
                      size={19}
                      strokeWidth={1.8}
                    />
                  )}

                </button>

              </div>

            </label>


            <div className="waki-hotel-forgot-row">

              <button
                type="button"
                className="waki-hotel-forgot-button"
                onClick={() =>
                  navigate('/recuperar-contrasena')
                }
              >
                ¿Olvidaste tu contraseña?
              </button>

            </div>


            {/* ERROR */}

            {errorMessage && (
              <div className="waki-hotel-login-error">
                {errorMessage}
              </div>
            )}


            {/* BOTÓN */}

            <button
              type="submit"
              className="waki-hotel-login-submit"
              disabled={loading}
            >

              {loading
                ? 'Ingresando...'
                : 'Ingresar'}

            </button>

          </form>


          {/* PIE */}

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