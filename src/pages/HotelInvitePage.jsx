import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import wakiLogo from '../assets/waki_logo_full.png'
import wakiPasswordRecovery from '../assets/waki_password_recovery.png'
import '../hotel-invite.css'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function onlyNumbers(value) {
  return String(value || '').replace(/\D/g, '')
}

export default function HotelInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirmedSession, setConfirmedSession] = useState(false)

  const [legalName, setLegalName] = useState('')
  const [ruc, setRuc] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] =
    useState(false)

  const [resendingEmail, setResendingEmail] =
    useState(false)

  const pendingClaimKey = token
    ? `waki_hotel_claim_${token}`
    : ''

  useEffect(() => {
    loadInvite()
  }, [token])

  async function loadInvite() {
    try {
      setLoading(true)
      setErrorMessage('')

      if (!token) {
        throw new Error('La invitación no es válida.')
      }

      const { data, error } = await supabase.rpc(
        'get_sales_hotel_invite',
        {
          target_invite_token: token
        }
      )

      if (error) throw error

      setInvite(data)

      if (data?.hotel_name && !legalName) {
        setLegalName(data.hotel_name)
      }

      if (data?.contact_phone && !phone) {
        setPhone(data.contact_phone)
      }

      await tryCompletePendingClaim(data)
    } catch (error) {
      console.error('Error cargando invitación:', error)

      setErrorMessage(
        error?.message ||
        'No pudimos cargar esta invitación.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function tryCompletePendingClaim(inviteData) {
    if (!pendingClaimKey || !inviteData?.valid) return

    let pendingData = null

    try {
      const raw = window.localStorage.getItem(pendingClaimKey)

      pendingData = raw
        ? JSON.parse(raw)
        : null
    } catch {
      pendingData = null
    }

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.user) return

    const sessionEmail =
      session.user.email?.trim()?.toLowerCase()

    const inviteEmail =
      inviteData.contact_email?.trim()?.toLowerCase()

    if (!sessionEmail || sessionEmail !== inviteEmail) {
      if (!pendingData) return
      setErrorMessage(
        'La sesión activa no corresponde al correo de esta invitación.'
      )

      return
    }

    if (!session.user.email_confirmed_at) return
    setConfirmedSession(true)
    if (!pendingData) {
      setShowForm(true)
      return
    }
    setAwaitingEmailConfirmation(true)
    try {
      await claimInvite(pendingData, inviteData)
    } catch {
      setAwaitingEmailConfirmation(false)
      setShowForm(true)
    }
  }

  async function claimInvite(claimData, currentInvite = invite) {
    try {
      setSubmitting(true)
      setErrorMessage('')
      setSuccessMessage('')

      const quickInvite = currentInvite?.source === 'quick'
      const { data, error } = await supabase.rpc(
        quickInvite ? 'claim_quick_hotel_invitation' : 'claim_sales_hotel_invite',
        quickInvite
          ? {
              p_token: token,
              p_legal_name: claimData.legalName,
              p_ruc: claimData.ruc,
              p_phone: claimData.phone
            }
          : {
              target_invite_token: token,
              target_legal_name: claimData.legalName,
              target_ruc: claimData.ruc,
              target_phone: claimData.phone
            }
      )

      if (error) throw error

      if (pendingClaimKey) {
        window.localStorage.removeItem(pendingClaimKey)
      }

      navigate('/mi-hotel', { replace: true })

      return data
    } catch (error) {
      console.error('Error reclamando invitación:', error)

      let message =
        error?.message ||
        'No pudimos activar el acceso del hotel.'

      if (message.includes('RUC_ALREADY_REGISTERED')) {
        message =
          'Este RUC ya se encuentra registrado en WAKI.'
      }

      if (message.includes('INVITE_EMAIL_MISMATCH')) {
        message =
          'Debes activar esta invitación usando el mismo correo al que fue enviada.'
      }

      if (message.includes('INVITE_ALREADY_CLAIMED')) {
        message =
          'Esta invitación ya fue utilizada.'
      }

      if (message.includes('INVITE_EXPIRED')) {
        message =
          'Esta invitación venció. Solicita un nuevo enlace a tu asesor WAKI.'
      }

      setErrorMessage(message)
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendConfirmation() {
    try {
      setResendingEmail(true)
      setErrorMessage('')
      setSuccessMessage('')

      const redirectTo =
        `${window.location.origin}/invitacion/${token}`

      const { error } =
        await supabase.auth.resend({
          type: 'signup',
          email: invite.contact_email,
          options: {
            emailRedirectTo: redirectTo
          }
        })

      if (error) throw error

      setSuccessMessage(
        `Reenviamos el correo de confirmación a ${invite.contact_email}. Revisa también Spam o Promociones.`
      )
    } catch (error) {
      console.error(
        'Error reenviando confirmación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos reenviar el correo de confirmación.'
      )
    } finally {
      setResendingEmail(false)
    }
  }


  async function handleCreateAccount(event) {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    const cleanLegalName = legalName.trim()
    const cleanRuc = onlyNumbers(ruc)
    const cleanPhone = phone.trim()

    if (!cleanLegalName) {
      setErrorMessage('Ingresa la razón social.')
      return
    }

    if (cleanRuc.length !== 11) {
      setErrorMessage('El RUC debe tener 11 dígitos.')
      return
    }

    if (!cleanPhone) {
      setErrorMessage('Ingresa un teléfono de contacto.')
      return
    }

    if (!confirmedSession && password.length < 8) {
      setErrorMessage(
        'La contraseña debe tener al menos 8 caracteres.'
      )
      return
    }

    if (!confirmedSession && password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.')
      return
    }

    const claimData = {
      legalName: cleanLegalName,
      ruc: cleanRuc,
      phone: cleanPhone
    }

    try {
      setSubmitting(true)

      if (pendingClaimKey) {
        window.localStorage.setItem(
          pendingClaimKey,
          JSON.stringify(claimData)
        )
      }

      const {
        data: { session: existingSession }
      } = await supabase.auth.getSession()

      const inviteEmail =
        invite?.contact_email
          ?.trim()
          ?.toLowerCase()

      if (existingSession?.user) {
        const currentEmail =
          existingSession.user.email
            ?.trim()
            ?.toLowerCase()

        if (currentEmail !== inviteEmail) {
          await supabase.auth.signOut()
        } else {
          await claimInvite(claimData)
          return
        }
      }

      if (confirmedSession) {
        setConfirmedSession(false)
        setErrorMessage('Tu sesión venció. Ingresa tu contraseña para continuar.')
        return
      }

      /*
       * Primero intentamos iniciar sesión.
       * Si el correo ya existe y la contraseña es correcta,
       * vinculamos la invitación directamente y NO hacemos signup.
       */
      const {
        data: loginData
      } = await supabase.auth.signInWithPassword({
        email: invite.contact_email,
        password
      })

      if (loginData?.session?.user) {
        await claimInvite(claimData)
        return
      }

      const redirectTo =
        `${window.location.origin}/invitacion/${token}`

      /*
       * Si el login falló, intentamos crear una cuenta nueva.
       * Supabase puede ocultar que el correo ya existe y devolver
       * una respuesta "exitosa" sin identidad nueva.
       */
      const {
        data: authData,
        error: authError
      } = await supabase.auth.signUp({
        email: invite.contact_email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: invite.contact_name
          }
        }
      })

      if (authError) {
        throw authError
      }

      if (authData?.session?.user) {
        await claimInvite(claimData)
        return
      }

      const identities =
        authData?.user?.identities

      const createdNewIdentity =
        Array.isArray(identities)
          ? identities.length > 0
          : false

      if (!createdNewIdentity) {
        if (pendingClaimKey) {
          window.localStorage.removeItem(
            pendingClaimKey
          )
        }

        setErrorMessage(
          'Este correo ya tiene una cuenta WAKI. Usa la contraseña actual de esa cuenta para vincular esta invitación. Si no la recuerdas, recupérala desde el inicio de sesión.'
        )

        return
      }

      setAwaitingEmailConfirmation(true)

      setSuccessMessage(
        `Te enviamos un correo a ${invite.contact_email}. Confirma tu correo para continuar con la configuración de tu hotel.`
      )
    } catch (error) {
      console.error('Error creando acceso:', error)

      setErrorMessage(
        error?.message ||
        'No pudimos crear el acceso.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="hotel-invite-loading">
        <div className="hotel-invite-spinner" />
        <p>Validando invitación...</p>
      </main>
    )
  }

  const isValid = Boolean(invite?.valid)

  const alreadyClaimed =
    invite?.claimed ||
    invite?.status === 'claimed'

  return (
    <main className="hotel-invite-page">
      <section className="hotel-invite-card">
        {!awaitingEmailConfirmation && (
          <div className="hotel-invite-brand">
            <img
              src={wakiLogo}
              alt="WAKI"
            />

            <span>HOTEL</span>
          </div>
        )}

        {alreadyClaimed ? (
          <div className="hotel-invite-invalid">
            <CheckCircle2
              size={35}
              strokeWidth={1.5}
            />

            <h1>
              Invitación ya utilizada
            </h1>

            <p>
              Este hotel ya tiene un acceso
              activado en WAKI.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate('/login')
              }
            >
              Ir al portal hotel
            </button>
          </div>
        ) : !isValid ? (
          <div className="hotel-invite-invalid">
            <ShieldCheck
              size={35}
              strokeWidth={1.5}
            />

            <h1>
              Invitación no disponible
            </h1>

            <p>
              {errorMessage ||
                'Solicita a tu asesor WAKI un nuevo enlace de afiliación.'}
            </p>
          </div>
        ) : awaitingEmailConfirmation ? (
          <div className="hotel-invite-confirmation">
            <img
              src={wakiPasswordRecovery}
              alt="WAKI enviando el correo de confirmación"
              className="hotel-invite-confirmation__image"
            />

            <h1>
              Confirma tu correo
            </h1>

            <p>
              {successMessage}
            </p>

            {errorMessage && (
              <div className="hotel-invite-inline-error">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              className="hotel-invite-resend"
              disabled={resendingEmail}
              onClick={handleResendConfirmation}
            >
              {resendingEmail
                ? 'Reenviando...'
                : 'Reenviar correo'}
            </button>
          </div>
        ) : showForm ? (
          <>
            <div className="hotel-invite-heading">
              <h1>
                {confirmedSession ? 'Completa los datos del hotel' : 'Crea tu acceso'}
              </h1>

              <p>
                Completa los datos legales mínimos
                para activar el portal de tu hotel.
              </p>
            </div>

            <form
              className="hotel-invite-form"
              onSubmit={handleCreateAccount}
            >
              <label className="hotel-invite-field">
                <span>
                  Correo de acceso
                </span>

                <div className="hotel-invite-field__control is-readonly">
                  <Mail
                    size={18}
                    strokeWidth={1.8}
                  />

                  <input
                    type="email"
                    value={
                      invite.contact_email ||
                      ''
                    }
                    readOnly
                  />
                </div>
              </label>

              <label className="hotel-invite-field">
                <span>
                  Razón social
                </span>

                <div className="hotel-invite-field__control">
                  <FileText
                    size={18}
                    strokeWidth={1.8}
                  />

                  <input
                    type="text"
                    value={legalName}
                    placeholder="Razón social del negocio"
                    onChange={(event) =>
                      setLegalName(
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <div className="hotel-invite-form-grid">
                <label className="hotel-invite-field">
                  <span>RUC</span>

                  <div className="hotel-invite-field__control">
                    <FileText
                      size={18}
                      strokeWidth={1.8}
                    />

                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      value={ruc}
                      placeholder="11 dígitos"
                      onChange={(event) =>
                        setRuc(
                          onlyNumbers(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>
                </label>

                <label className="hotel-invite-field">
                  <span>
                    Teléfono
                  </span>

                  <div className="hotel-invite-field__control">
                    <Phone
                      size={18}
                      strokeWidth={1.8}
                    />

                    <input
                      type="tel"
                      value={phone}
                      placeholder="Teléfono de contacto"
                      onChange={(event) =>
                        setPhone(
                          event.target.value
                        )
                      }
                    />
                  </div>
                </label>
              </div>

              {!confirmedSession && (
                <>
              <label className="hotel-invite-field">
                <span>
                  Contraseña
                </span>

                <div className="hotel-invite-field__control">
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
                    value={password}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    className="hotel-invite-password-toggle"
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

              <label className="hotel-invite-field">
                <span>
                  Confirmar contraseña
                </span>

                <div className="hotel-invite-field__control">
                  <LockKeyhole
                    size={18}
                    strokeWidth={1.8}
                  />

                  <input
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    value={confirmPassword}
                    autoComplete="new-password"
                    placeholder="Repite tu contraseña"
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    className="hotel-invite-password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) =>
                          !current
                      )
                    }
                  >
                    {showConfirmPassword ? (
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

                </>
              )}

              {errorMessage && (
                <div className="hotel-invite-inline-error">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="hotel-invite-inline-success">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                className="hotel-invite-primary"
                disabled={submitting}
              >
                {submitting
                  ? 'Creando acceso...'
                  : confirmedSession ? 'Continuar al portal' : 'Crear acceso'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="hotel-invite-heading">
              <h1>
                Activa tu hotel en WAKI
              </h1>

              <p>
                Has sido invitado para continuar
                la afiliación de este establecimiento.
              </p>
            </div>

            <div className="hotel-invite-hotel">
              <div className="hotel-invite-hotel__icon">
                <Building2
                  size={22}
                  strokeWidth={1.7}
                />
              </div>

              <div className="hotel-invite-hotel__content">
                <strong>
                  {invite?.hotel_name}
                </strong>

                <div className="hotel-invite-hotel__district">
                  <MapPin
                    size={14}
                    strokeWidth={1.8}
                  />

                  <span>
                    {invite?.district ||
                      'Ubicación por completar'}
                  </span>
                </div>

                {invite?.address && (
                  <p className="hotel-invite-hotel__address">
                    {invite.address}
                  </p>
                )}
              </div>
            </div>

            <div className="hotel-invite-details">
              <div>
                <span>
                  Responsable
                </span>

                <strong>
                  {invite?.contact_name}
                </strong>
              </div>

              <div>
                <span>
                  Correo
                </span>

                <strong>
                  {invite?.contact_email}
                </strong>
              </div>

              <div className="hotel-invite-details__wide">
                <CalendarClock
                  size={17}
                  strokeWidth={1.8}
                />

                <div>
                  <span>
                    Invitación válida hasta
                  </span>

                  <strong>
                    {formatDate(
                      invite?.invite_expires_at
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="hotel-invite-primary"
              onClick={() =>
                setShowForm(true)
              }
            >
              Crear acceso
            </button>
          </>
        )}
      </section>
    </main>
  )
}
