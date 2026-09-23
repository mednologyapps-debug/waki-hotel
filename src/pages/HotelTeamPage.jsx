import {
  Check,
  ChevronDown,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  supabase
} from '../lib/supabase'

import teamMemberAddedImage
  from '../assets/team-member-added.png'


const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Administrador',
    description:
      'Acceso completo al portal del hotel, incluyendo Equipo.'
  },
  {
    value: 'reception',
    label: 'Recepción',
    description:
      'Puede consultar reservas y validar accesos mediante QR.'
  },
  {
    value: 'scanner',
    label: 'Escáner',
    description:
      'Acceso exclusivo para validar QR y documentos.'
  }
]


function getRoleMeta(
  role
) {
  return (
    ROLE_OPTIONS.find(
      (item) =>
        item.value ===
        role
    ) ||
    ROLE_OPTIONS[2]
  )
}


function getInitials(
  name
) {
  const parts =
    String(
      name ||
      ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean)


  if (!parts.length) {
    return 'WK'
  }


  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase()
  }


  return (
    parts[0][0] +
    parts[
      parts.length - 1
    ][0]
  ).toUpperCase()
}


export default function HotelTeamPage() {
  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [successModal, setSuccessModal] =
    useState(null)

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [team, setTeam] =
    useState([])

  const [createOpen, setCreateOpen] =
    useState(false)

  const [editingMember, setEditingMember] =
    useState(null)

  const [form, setForm] =
    useState({
      full_name: '',
      email: '',
      staff_role:
        'reception'
    })


  useEffect(() => {
    loadPage()
  }, [])


  const activeCount =
    useMemo(
      () =>
        team.filter(
          (member) =>
            member.is_active
        ).length,
      [team]
    )


  const adminCount =
    useMemo(
      () =>
        team.filter(
          (member) =>
            member.is_active &&
            member.staff_role ===
              'admin'
        ).length,
      [team]
    )


  async function loadPage(
    showLoader = true
  ) {
    try {
      if (showLoader) {
        setLoading(true)
      }

      setErrorMessage('')


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


      const [
        profileResult,
        accessResult
      ] =
        await Promise.all([
          supabase
            .from('profiles')
            .select(`
              id,
              full_name
            `)
            .eq(
              'id',
              session.user.id
            )
            .maybeSingle(),

          supabase
            .rpc(
              'get_my_hotel_access'
            )
        ])


      if (
        profileResult.error
      ) {
        throw profileResult.error
      }


      if (
        accessResult.error
      ) {
        throw accessResult.error
      }


      const accessRows =
        Array.isArray(
          accessResult.data
        )
          ? accessResult.data
          : []


      const adminAccess =
        accessRows.find(
          (item) =>
            item.staff_role ===
            'admin'
        )


      if (
        !adminAccess?.hotel_id
      ) {
        throw new Error(
          'Solo un administrador del hotel puede gestionar el equipo.'
        )
      }


      setProfile(
        profileResult.data
      )


      const {
        data: hotelData,
        error: hotelError
      } =
        await supabase
          .from('hotels')
          .select(`
            id,
            name,
            district,
            province
          `)
          .eq(
            'id',
            adminAccess.hotel_id
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


      const {
        data: teamData,
        error: teamError
      } =
        await supabase
          .rpc(
            'get_hotel_team',
            {
              target_hotel_id:
                adminAccess.hotel_id
            }
          )


      if (teamError) {
        throw teamError
      }


      setTeam(
        Array.isArray(
          teamData
        )
          ? teamData
          : []
      )

    } catch (error) {
      console.error(
        'Error cargando equipo:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar el equipo.'
      )

    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }


  function resetForm() {
    setForm({
      full_name: '',
      email: '',
      staff_role:
        'reception'
    })
  }


  function openCreate() {
    setSuccessMessage('')
    setSuccessModal(null)
    setErrorMessage('')
    resetForm()
    setCreateOpen(true)
  }


  function closeCreate() {
    if (
      actionLoading ===
      'create'
    ) {
      return
    }

    setCreateOpen(false)
    resetForm()
  }


  async function handleCreate(
    event
  ) {
    event.preventDefault()

    try {
      setActionLoading(
        'create'
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        data,
        error
      } =
        await supabase
          .functions
          .invoke(
            'create-hotel-staff',
            {
              body: {
                full_name:
                  form.full_name,
                email:
                  form.email,
                staff_role:
                  form.staff_role
              }
            }
          )


      if (error) {
        throw error
      }


      if (
        data?.error
      ) {
        throw new Error(
          data.detail ||
          data.error
        )
      }


      setCreateOpen(
        false
      )

      resetForm()


      setSuccessModal({
        fullName:
          form.full_name,

        role:
          getRoleMeta(
            form.staff_role
          ).label,

        invitationSent:
          Boolean(
            data?.invitation_sent
          )
      })


      await loadPage(
        false
      )

    } catch (error) {
      console.error(
        'Error creando miembro:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos agregar al miembro.'
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


  async function handleRoleChange(
    member,
    newRole
  ) {
    if (
      member.staff_role ===
      newRole
    ) {
      return
    }


    try {
      setActionLoading(
        `role-${member.staff_id}`
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .rpc(
            'update_hotel_team_member_role',
            {
              target_staff_id:
                member.staff_id,
              target_role:
                newRole
            }
          )


      if (error) {
        throw error
      }


      setTeam(
        (current) =>
          current.map(
            (item) =>
              item.staff_id ===
              member.staff_id
                ? {
                    ...item,
                    staff_role:
                      newRole,
                    updated_at:
                      new Date()
                        .toISOString()
                  }
                : item
          )
      )


      setEditingMember(
        null
      )

      setSuccessMessage(
        'Rol actualizado correctamente.'
      )

    } catch (error) {
      console.error(
        'Error actualizando rol:',
        error
      )

      const message =
        String(
          error?.message ||
          ''
        )


      setErrorMessage(
        message.includes(
          'HOTEL_MUST_KEEP_ONE_ADMIN'
        )
          ? 'El hotel debe conservar al menos un administrador activo.'
          : (
              message ||
              'No pudimos actualizar el rol.'
            )
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


  async function handleToggleActive(
    member
  ) {
    const nextActive =
      !member.is_active


    const actionLabel =
      nextActive
        ? 'reactivar'
        : 'suspender'


    if (
      !window.confirm(
        `¿Deseas ${actionLabel} el acceso de ${member.full_name}?`
      )
    ) {
      return
    }


    try {
      setActionLoading(
        `active-${member.staff_id}`
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .rpc(
            'set_hotel_team_member_active',
            {
              target_staff_id:
                member.staff_id,
              target_is_active:
                nextActive
            }
          )


      if (error) {
        throw error
      }


      setTeam(
        (current) =>
          current.map(
            (item) =>
              item.staff_id ===
              member.staff_id
                ? {
                    ...item,
                    is_active:
                      nextActive,
                    updated_at:
                      new Date()
                        .toISOString()
                  }
                : item
          )
      )


      setSuccessMessage(
        nextActive
          ? 'Acceso reactivado correctamente.'
          : 'Acceso suspendido correctamente.'
      )

    } catch (error) {
      console.error(
        'Error cambiando acceso:',
        error
      )

      const message =
        String(
          error?.message ||
          ''
        )


      setErrorMessage(
        message.includes(
          'CANNOT_SUSPEND_SELF'
        )
          ? 'No puedes suspender tu propio acceso.'
          : message.includes(
              'HOTEL_MUST_KEEP_ONE_ADMIN'
            )
            ? 'El hotel debe conservar al menos un administrador activo.'
            : (
                message ||
                'No pudimos actualizar el acceso.'
              )
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


  if (loading) {
    return (
      <WakiGlobalLoader
        title="Cargando equipo..."
        subtitle="Estamos preparando los accesos de tu hotel"
        fullScreen
      />
    )
  }


  return (
    <div className="hotel-portal">

      <HotelSidebar
        activeKey="equipo"
        hotelName={
          hotel?.name ||
          'Mi hotel'
        }
        hotelLocation={
          [
            hotel?.district,
            hotel?.province
          ]
            .filter(Boolean)
            .join(', ') ||
          'Lima, Perú'
        }
      />


      <main className="hotel-dashboard hotel-team-page">

        <header className="hotel-team-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              GESTIÓN DE ACCESOS
            </span>

            <h1>
              Equipo
            </h1>

            <p>
              Administra quién puede ingresar
              al portal y qué funciones puede
              utilizar.
            </p>

          </div>


          <button
            type="button"
            className="hotel-primary-button hotel-team-add"
            onClick={
              openCreate
            }
          >

            <Plus
              size={18}
              strokeWidth={2}
            />

            Agregar miembro

          </button>

        </header>


        {errorMessage && (

          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>

        )}


        <section className="hotel-team-summary">

          <article>

            <div className="hotel-team-summary__icon">
              <UsersRound
                size={20}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <span>
                Miembros
              </span>

              <strong>
                {team.length}
              </strong>
            </div>

          </article>


          <article>

            <div className="hotel-team-summary__icon is-green">
              <Check
                size={20}
                strokeWidth={2}
              />
            </div>

            <div>
              <span>
                Activos
              </span>

              <strong>
                {activeCount}
              </strong>
            </div>

          </article>


          <article>

            <div className="hotel-team-summary__icon is-dark">
              <ShieldCheck
                size={20}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <span>
                Administradores
              </span>

              <strong>
                {adminCount}
              </strong>
            </div>

          </article>

        </section>


        <section className="hotel-team-panel">

          <div className="hotel-team-panel__heading">

            <div>

              <h2>
                Miembros del hotel
              </h2>

              <p>
                Los accesos suspendidos conservan
                su historial y trazabilidad.
              </p>

            </div>

          </div>


          {team.length === 0 ? (

            <div className="hotel-team-empty">

              <UsersRound
                size={31}
                strokeWidth={1.6}
              />

              <h3>
                Aún no hay miembros
              </h3>

              <p>
                Agrega al personal que utilizará
                WAKI en esta sede.
              </p>

            </div>

          ) : (

            <div className="hotel-team-list">

              {team.map(
                (member) => {

                  const roleMeta =
                    getRoleMeta(
                      member.staff_role
                    )

                  const isEditing =
                    editingMember
                      ?.staff_id ===
                    member.staff_id


                  return (
                    <article
                      key={
                        member.staff_id
                      }
                      className={[
                        'hotel-team-member',
                        !member.is_active
                          ? 'is-suspended'
                          : ''
                      ].join(' ')}
                    >

                      <div className="hotel-team-member__identity">

                        <div className="hotel-team-avatar">
                          {
                            getInitials(
                              member.full_name
                            )
                          }
                        </div>


                        <div className="hotel-team-member__copy">

                          <strong>
                            {
                              member.full_name
                            }
                          </strong>

                          <span>

                            <Mail
                              size={13}
                              strokeWidth={1.8}
                            />

                            {
                              member.email ||
                              'Correo no disponible'
                            }

                          </span>

                        </div>

                      </div>


                      <div className="hotel-team-member__role">

                        <span className="hotel-team-field-label">
                          Rol
                        </span>


                        {isEditing ? (

                          <div className="hotel-team-role-editor">

                            <div className="hotel-team-select-wrap">

                              <select
                                defaultValue={
                                  member.staff_role
                                }
                                id={
                                  `team-role-${member.staff_id}`
                                }
                                disabled={
                                  Boolean(
                                    actionLoading
                                  )
                                }
                              >

                                {ROLE_OPTIONS.map(
                                  (role) => (

                                    <option
                                      key={
                                        role.value
                                      }
                                      value={
                                        role.value
                                      }
                                    >
                                      {
                                        role.label
                                      }
                                    </option>

                                  )
                                )}

                              </select>

                              <ChevronDown
                                size={15}
                                strokeWidth={1.8}
                              />

                            </div>


                            <button
                              type="button"
                              className="hotel-team-role-save"
                              disabled={
                                Boolean(
                                  actionLoading
                                )
                              }
                              onClick={() => {

                                const select =
                                  document
                                    .getElementById(
                                      `team-role-${member.staff_id}`
                                    )

                                handleRoleChange(
                                  member,
                                  select.value
                                )
                              }}
                            >
                              Guardar
                            </button>


                            <button
                              type="button"
                              className="hotel-team-role-cancel"
                              disabled={
                                Boolean(
                                  actionLoading
                                )
                              }
                              onClick={() =>
                                setEditingMember(
                                  null
                                )
                              }
                            >
                              Cancelar
                            </button>

                          </div>

                        ) : (

                          <>

                            <strong>
                              {
                                roleMeta.label
                              }
                            </strong>

                            <small>
                              {
                                roleMeta.description
                              }
                            </small>

                          </>

                        )}

                      </div>


                      <div className="hotel-team-member__status">

                        <span className="hotel-team-field-label">
                          Estado
                        </span>

                        <span
                          className={[
                            'hotel-team-status',
                            member.is_active
                              ? 'is-active'
                              : 'is-suspended'
                          ].join(' ')}
                        >

                          <i />

                          {
                            member.is_active
                              ? 'Activo'
                              : 'Suspendido'
                          }

                        </span>

                      </div>


                      <div className="hotel-team-member__actions">

                        <button
                          type="button"
                          className="hotel-team-edit-button"
                          disabled={
                            Boolean(
                              actionLoading
                            ) ||
                            isEditing
                          }
                          onClick={() =>
                            setEditingMember(
                              member
                            )
                          }
                        >
                          Editar rol
                        </button>


                        <button
                          type="button"
                          className={
                            member.is_active
                              ? 'hotel-team-suspend-button'
                              : 'hotel-team-reactivate-button'
                          }
                          disabled={
                            Boolean(
                              actionLoading
                            )
                          }
                          onClick={() =>
                            handleToggleActive(
                              member
                            )
                          }
                        >

                          {
                            actionLoading ===
                            `active-${member.staff_id}`
                              ? 'Procesando...'
                              : member.is_active
                                ? 'Suspender'
                                : 'Reactivar'
                          }

                        </button>

                      </div>

                    </article>
                  )
                }
              )}

            </div>

          )}

        </section>


        {successModal && (

          <div
            className="hotel-team-success-modal-overlay"
            role="presentation"
          >

            <section
              className="hotel-team-success-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hotel-team-success-title"
            >

              <button
                type="button"
                className="hotel-team-success-modal__close"
                aria-label="Cerrar"
                onClick={() =>
                  setSuccessModal(
                    null
                  )
                }
              >

                <X
                  size={20}
                  strokeWidth={1.8}
                />

              </button>


              <img
                src={
                  teamMemberAddedImage
                }
                alt=""
                className="hotel-team-success-modal__image"
              />


              <span className="hotel-dashboard-eyebrow">
                NUEVO MIEMBRO
              </span>


              <h2 id="hotel-team-success-title">
                ¡Se sumó una nueva llamita al equipo!
              </h2>


              <p>
                <strong>
                  {
                    successModal
                      .fullName
                  }
                </strong>
                {' '}
                fue agregado como
                {' '}
                <strong>
                  {
                    successModal
                      .role
                  }
                </strong>
                .
              </p>


              <p className="hotel-team-success-modal__note">

                {
                  successModal
                    .invitationSent
                    ? 'Le enviamos una invitación por correo para que active su acceso a WAKI Hotel.'
                    : 'Este correo ya tenía una cuenta WAKI, así que podrá iniciar sesión con sus credenciales existentes.'
                }

              </p>


              <button
                type="button"
                className="hotel-primary-button hotel-team-success-modal__button"
                onClick={() =>
                  setSuccessModal(
                    null
                  )
                }
              >
                Entendido
              </button>

            </section>

          </div>

        )}


        {createOpen && (

          <div
            className="hotel-team-modal-overlay"
            role="presentation"
          >

            <section
              className="hotel-team-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hotel-team-modal-title"
            >

              <header className="hotel-team-modal__header">

                <div>

                  <span className="hotel-dashboard-eyebrow">
                    NUEVO ACCESO
                  </span>

                  <h2 id="hotel-team-modal-title">
                    Agregar miembro
                  </h2>

                </div>


                <button
                  type="button"
                  className="hotel-team-modal__close"
                  aria-label="Cerrar"
                  disabled={
                    actionLoading ===
                    'create'
                  }
                  onClick={
                    closeCreate
                  }
                >

                  <X
                    size={20}
                    strokeWidth={1.8}
                  />

                </button>

              </header>


              <form
                onSubmit={
                  handleCreate
                }
                className="hotel-team-form"
              >

                <label>

                  <span>
                    Nombre completo
                  </span>

                  <div className="hotel-team-input-wrap">

                    <UserRound
                      size={17}
                      strokeWidth={1.8}
                    />

                    <input
                      type="text"
                      value={
                        form.full_name
                      }
                      placeholder="Ej. María López"
                      required
                      autoComplete="name"
                      disabled={
                        actionLoading ===
                        'create'
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            full_name:
                              event
                                .target
                                .value
                          })
                        )
                      }
                    />

                  </div>

                </label>


                <label>

                  <span>
                    Correo
                  </span>

                  <div className="hotel-team-input-wrap">

                    <Mail
                      size={17}
                      strokeWidth={1.8}
                    />

                    <input
                      type="email"
                      value={
                        form.email
                      }
                      placeholder="persona@hotel.com"
                      required
                      autoComplete="email"
                      disabled={
                        actionLoading ===
                        'create'
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            email:
                              event
                                .target
                                .value
                          })
                        )
                      }
                    />

                  </div>

                </label>


                <label>

                  <span>
                    Rol
                  </span>

                  <div className="hotel-team-select-wrap is-form">

                    <select
                      value={
                        form.staff_role
                      }
                      disabled={
                        actionLoading ===
                        'create'
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            staff_role:
                              event
                                .target
                                .value
                          })
                        )
                      }
                    >

                      {ROLE_OPTIONS.map(
                        (role) => (

                          <option
                            key={
                              role.value
                            }
                            value={
                              role.value
                            }
                          >
                            {
                              role.label
                            }
                          </option>

                        )
                      )}

                    </select>

                    <ChevronDown
                      size={16}
                      strokeWidth={1.8}
                    />

                  </div>

                </label>


                <div className="hotel-team-role-preview">

                  <ShieldCheck
                    size={20}
                    strokeWidth={1.8}
                  />

                  <div>

                    <strong>
                      {
                        getRoleMeta(
                          form.staff_role
                        ).label
                      }
                    </strong>

                    <p>
                      {
                        getRoleMeta(
                          form.staff_role
                        ).description
                      }
                    </p>

                  </div>

                </div>


                <div className="hotel-team-form__actions">

                  <button
                    type="button"
                    className="hotel-secondary-button"
                    disabled={
                      actionLoading ===
                      'create'
                    }
                    onClick={
                      closeCreate
                    }
                  >
                    Cancelar
                  </button>


                  <button
                    type="submit"
                    className="hotel-primary-button"
                    disabled={
                      actionLoading ===
                      'create'
                    }
                  >

                    {
                      actionLoading ===
                      'create'
                        ? 'Enviando...'
                        : 'Enviar invitación'
                    }

                  </button>

                </div>

              </form>

            </section>

          </div>

        )}

      </main>

    </div>
  )
}
