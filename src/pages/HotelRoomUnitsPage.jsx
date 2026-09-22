import {
  ArrowLeft,
  BedDouble,
  Building2,
  Check,
  CirclePlus,
  DoorOpen,
  Pencil,
  Power,
  Save,
  X
} from 'lucide-react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import {
  supabase
} from '../lib/supabase'


export default function HotelRoomUnitsPage() {
  const navigate =
    useNavigate()

  const {
    roomId
  } =
    useParams()


  /* =========================================================
     ESTADOS GENERALES
     ========================================================= */

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [actionLoadingId, setActionLoadingId] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [room, setRoom] =
    useState(null)

  const [units, setUnits] =
    useState([])

  const [editingId, setEditingId] =
    useState(null)


  /* =========================================================
     FORM CREAR
     ========================================================= */

  const [form, setForm] =
    useState({
      unit_code: '',
      display_name: '',
      floor: ''
    })


  /* =========================================================
     FORM EDITAR
     ========================================================= */

  const [editForm, setEditForm] =
    useState({
      unit_code: '',
      display_name: '',
      floor: ''
    })


  /* =========================================================
     CARGA INICIAL
     ========================================================= */

  useEffect(() => {
    loadInitialData()
  }, [roomId])


  /* =========================================================
     MENSAJE TEMPORAL
     ========================================================= */

  useEffect(() => {
    if (!successMessage) {
      return undefined
    }


    const timeout =
      window.setTimeout(
        () => {
          setSuccessMessage('')
        },
        3500
      )


    return () => {
      window.clearTimeout(
        timeout
      )
    }
  }, [successMessage])


  /* =========================================================
     CARGA INICIAL
     SOLO AQUÍ MOSTRAMOS LOADER DE PÁGINA COMPLETA
     ========================================================= */

  async function loadInitialData() {
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
            district,
            province
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
         TIPO DE HABITACIÓN
         ===================================================== */

      const {
        data: roomData,
        error: roomError
      } =
        await supabase
          .from('room_types')
          .select(`
            id,
            hotel_id,
            name,
            description,
            inventory_count,
            is_active
          `)
          .eq(
            'id',
            roomId
          )
          .eq(
            'hotel_id',
            staffData.hotel_id
          )
          .maybeSingle()


      if (roomError) {
        throw roomError
      }


      if (!roomData) {
        throw new Error(
          'No encontramos esta habitación.'
        )
      }


      setRoom(
        roomData
      )


      /* =====================================================
         HABITACIONES FÍSICAS
         ===================================================== */

      const {
        data: unitsData,
        error: unitsError
      } =
        await supabase
          .from('room_units')
          .select(`
            id,
            room_type_id,
            unit_code,
            display_name,
            floor,
            is_active,
            is_system_generated,
            display_order,
            created_at,
            updated_at
          `)
          .eq(
            'room_type_id',
            roomId
          )
          .order(
            'display_order',
            {
              ascending: true
            }
          )
          .order(
            'created_at',
            {
              ascending: true
            }
          )


      if (unitsError) {
        throw unitsError
      }


      setUnits(
        unitsData || []
      )

    } catch (error) {
      console.error(
        'Error cargando unidades:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar las habitaciones físicas.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     CREAR HABITACIÓN FÍSICA
     SIN RECARGAR LA PÁGINA
     ========================================================= */

  async function createUnit(
    event
  ) {
    event.preventDefault()


    const unitCode =
      form.unit_code
        .trim()


    if (!unitCode) {
      setErrorMessage(
        'Ingresa el número o código de la habitación.'
      )

      return
    }


    try {
      setSaving(true)

      setErrorMessage('')
      setSuccessMessage('')


      const nextOrder =
        units.length > 0
          ? Math.max(
              ...units.map(
                (unit) =>
                  Number(
                    unit.display_order ||
                    0
                  )
              )
            ) + 1
          : 1


      const {
        data: createdUnit,
        error
      } =
        await supabase
          .from('room_units')
          .insert({
            room_type_id:
              roomId,

            unit_code:
              unitCode,

            display_name:
              form.display_name
                .trim() ||
              null,

            floor:
              form.floor
                .trim() ||
              null,

            is_active:
              true,

            is_system_generated:
              false,

            display_order:
              nextOrder
          })
          .select(`
            id,
            room_type_id,
            unit_code,
            display_name,
            floor,
            is_active,
            is_system_generated,
            display_order,
            created_at,
            updated_at
          `)
          .single()


      if (error) {
        if (
          error.code ===
          '23505'
        ) {
          throw new Error(
            'Ya existe una habitación con ese número o código.'
          )
        }

        throw error
      }


      /* =====================================================
         ACTUALIZAR SOLO STATE LOCAL
         ===================================================== */

      setUnits(
        (currentUnits) =>
          [
            ...currentUnits,
            createdUnit
          ]
            .sort(
              (a, b) =>
                Number(
                  a.display_order ||
                  0
                ) -
                Number(
                  b.display_order ||
                  0
                )
            )
      )


      setRoom(
        (currentRoom) =>
          currentRoom
            ? {
                ...currentRoom,

                inventory_count:
                  units.filter(
                    (unit) =>
                      unit.is_active
                  ).length + 1
              }
            : currentRoom
      )


      setForm({
        unit_code: '',
        display_name: '',
        floor: ''
      })


      setSuccessMessage(
        `Habitación ${createdUnit.unit_code} agregada correctamente.`
      )

    } catch (error) {
      console.error(
        'Error creando unidad:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos agregar la habitación física.'
      )

    } finally {
      setSaving(false)
    }
  }


  /* =========================================================
     INICIAR EDICIÓN
     ========================================================= */

  function startEditing(
    unit
  ) {
    setEditingId(
      unit.id
    )


    setEditForm({
      unit_code:
        unit.unit_code ||
        '',

      display_name:
        unit.display_name ||
        '',

      floor:
        unit.floor ||
        ''
    })


    setErrorMessage('')
    setSuccessMessage('')
  }


  /* =========================================================
     CANCELAR EDICIÓN
     ========================================================= */

  function cancelEditing() {
    setEditingId(
      null
    )


    setEditForm({
      unit_code: '',
      display_name: '',
      floor: ''
    })
  }


  /* =========================================================
     GUARDAR EDICIÓN
     SIN RECARGAR TODA LA PÁGINA
     ========================================================= */

  async function saveUnit(
    unit
  ) {
    const unitCode =
      editForm.unit_code
        .trim()


    if (!unitCode) {
      setErrorMessage(
        'Ingresa el número o código de la habitación.'
      )

      return
    }


    try {
      setActionLoadingId(
        unit.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        data: updatedUnit,
        error
      } =
        await supabase
          .from('room_units')
          .update({
            unit_code:
              unitCode,

            display_name:
              editForm.display_name
                .trim() ||
              null,

            floor:
              editForm.floor
                .trim() ||
              null,

            is_system_generated:
              false
          })
          .eq(
            'id',
            unit.id
          )
          .select(`
            id,
            room_type_id,
            unit_code,
            display_name,
            floor,
            is_active,
            is_system_generated,
            display_order,
            created_at,
            updated_at
          `)
          .single()


      if (error) {
        if (
          error.code ===
          '23505'
        ) {
          throw new Error(
            'Ya existe una habitación con ese número o código.'
          )
        }

        throw error
      }


      /* =====================================================
         SOLO ACTUALIZAMOS ESTA TARJETA
         ===================================================== */

      setUnits(
        (currentUnits) =>
          currentUnits.map(
            (currentUnit) =>
              currentUnit.id ===
              updatedUnit.id
                ? updatedUnit
                : currentUnit
          )
      )


      setEditingId(
        null
      )


      setEditForm({
        unit_code: '',
        display_name: '',
        floor: ''
      })


      setSuccessMessage(
        `Habitación ${updatedUnit.unit_code} actualizada correctamente.`
      )

    } catch (error) {
      console.error(
        'Error actualizando unidad:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos guardar los cambios.'
      )

    } finally {
      setActionLoadingId(
        null
      )
    }
  }


  /* =========================================================
     ACTIVAR / DESACTIVAR
     SIN RECARGAR LA PÁGINA
     ========================================================= */

  async function toggleUnit(
    unit
  ) {
    try {
      setActionLoadingId(
        unit.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const newStatus =
        !unit.is_active


      const {
        data: updatedUnit,
        error
      } =
        await supabase
          .from('room_units')
          .update({
            is_active:
              newStatus
          })
          .eq(
            'id',
            unit.id
          )
          .select(`
            id,
            room_type_id,
            unit_code,
            display_name,
            floor,
            is_active,
            is_system_generated,
            display_order,
            created_at,
            updated_at
          `)
          .single()


      if (error) {
        throw error
      }


      /* =====================================================
         SOLO ACTUALIZAR ESTA UNIDAD
         ===================================================== */

      setUnits(
        (currentUnits) =>
          currentUnits.map(
            (currentUnit) =>
              currentUnit.id ===
              updatedUnit.id
                ? updatedUnit
                : currentUnit
          )
      )


      const updatedActiveCount =
        units.reduce(
          (
            total,
            currentUnit
          ) => {

            if (
              currentUnit.id ===
              unit.id
            ) {
              return (
                total +
                (
                  newStatus
                    ? 1
                    : 0
                )
              )
            }


            return (
              total +
              (
                currentUnit.is_active
                  ? 1
                  : 0
              )
            )
          },
          0
        )


      setRoom(
        (currentRoom) =>
          currentRoom
            ? {
                ...currentRoom,

                inventory_count:
                  updatedActiveCount
              }
            : currentRoom
      )


      setSuccessMessage(
        newStatus
          ? `Habitación ${unit.unit_code} activada.`
          : `Habitación ${unit.unit_code} desactivada.`
      )

    } catch (error) {
      console.error(
        'Error cambiando estado:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos actualizar la habitación.'
      )

    } finally {
      setActionLoadingId(
        null
      )
    }
  }


  /* =========================================================
     MÉTRICAS
     ========================================================= */

  const counts =
    useMemo(
      () => ({
        total:
          units.length,

        active:
          units.filter(
            (unit) =>
              unit.is_active
          ).length,

        pendingSetup:
          units.filter(
            (unit) =>
              unit.is_system_generated
          ).length
      }),
      [
        units
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


  /* =========================================================
     LOADER GLOBAL
     SOLO PRIMERA CARGA
     ========================================================= */

 if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tus habitaciones..."
      subtitle="Estamos organizando tu inventario WAKI"
    />
  )
}


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">

      <HotelSidebar
        activeKey="habitaciones"

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


      <main className="hotel-dashboard hotel-room-units-page">

        {/* =================================================
            VOLVER
            ================================================= */}

        <button
          type="button"
          className="hotel-back-button"
          onClick={() =>
            navigate(
              '/habitaciones'
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a habitaciones

        </button>


        {/* =================================================
            HEADER
            ================================================= */}

        <header className="hotel-room-units-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Habitaciones físicas
            </span>

            <h1>
              {room?.name}
            </h1>

            <p>
              Identifica cada habitación física de esta
              categoría para que WAKI pueda administrar
              reservas y extensiones de horario correctamente.
            </p>

          </div>


          <div className="hotel-room-units-header__count">

            <DoorOpen
              size={20}
              strokeWidth={1.7}
            />

            <div>

              <strong>
                {counts.active}
              </strong>

              <span>
                unidades activas
              </span>

            </div>

          </div>

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
              size={17}
              strokeWidth={2}
            />

            {successMessage}

          </div>

        )}


        {/* =================================================
            PENDIENTES DE CONFIGURAR
            ================================================= */}

        {counts.pendingSetup > 0 && (

          <section className="hotel-room-units-notice">

            <div className="hotel-room-units-notice__icon">

              <Building2
                size={21}
                strokeWidth={1.7}
              />

            </div>


            <div>

              <strong>
                Configura tus habitaciones reales
              </strong>

              <p>

                WAKI creó temporalmente{' '}

                {counts.pendingSetup}

                {' '}

                {
                  counts.pendingSetup === 1
                    ? 'unidad'
                    : 'unidades'
                }

                {' '}según el inventario que ya
                tenías. Reemplaza códigos como
                AUTO-1 por el número real de
                habitación, por ejemplo 201.

              </p>

            </div>

          </section>

        )}


        {/* =================================================
            AGREGAR
            ================================================= */}

        <section className="hotel-room-unit-create">

          <div className="hotel-room-unit-create__heading">

            <div className="hotel-room-unit-create__icon">

              <CirclePlus
                size={21}
                strokeWidth={1.8}
              />

            </div>


            <div>

              <strong>
                Agregar habitación física
              </strong>

              <p>
                Cada unidad representa un cuarto real
                disponible para reservar.
              </p>

            </div>

          </div>


          <form
            className="hotel-room-unit-form"
            onSubmit={
              createUnit
            }
          >

            <label>

              <span>
                Número o código *
              </span>

              <input
                type="text"
                value={
                  form.unit_code
                }
                placeholder="Ej. 201"
                disabled={
                  saving
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      unit_code:
                        event.target.value
                    })
                  )
                }
              />

            </label>


            <label>

              <span>
                Nombre interno
              </span>

              <input
                type="text"
                value={
                  form.display_name
                }
                placeholder="Ej. Suite 201"
                disabled={
                  saving
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      display_name:
                        event.target.value
                    })
                  )
                }
              />

            </label>


            <label>

              <span>
                Piso
              </span>

              <input
                type="text"
                value={
                  form.floor
                }
                placeholder="Ej. Piso 2"
                disabled={
                  saving
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      floor:
                        event.target.value
                    })
                  )
                }
              />

            </label>


            <button
              type="submit"
              className="hotel-primary-button"
              disabled={
                saving
              }
            >

              {saving ? (

                <span className="hotel-inline-spinner" />

              ) : (

                <CirclePlus
                  size={17}
                  strokeWidth={1.8}
                />

              )}

              {saving
                ? 'Agregando...'
                : 'Agregar habitación'
              }

            </button>

          </form>

        </section>


        {/* =================================================
            LISTADO
            ================================================= */}

        <section className="hotel-room-units-list">

          <div className="hotel-room-units-list__heading">

            <div>

              <span>
                INVENTARIO FÍSICO
              </span>

              <h2>
                Habitaciones configuradas
              </h2>

            </div>


            <div className="hotel-room-units-summary">

              <span>
                {counts.total} totales
              </span>

              <span>
                {counts.active} activas
              </span>

            </div>

          </div>


          {units.length === 0 ? (

            <div className="hotel-room-units-empty">

              <BedDouble
                size={31}
                strokeWidth={1.5}
              />

              <strong>
                No hay habitaciones físicas configuradas
              </strong>

              <p>
                Agrega la primera unidad para que
                WAKI pueda asignarla a las reservas.
              </p>

            </div>

          ) : (

            <div className="hotel-room-units-grid">

              {units.map(
                (unit) => {

                  const editing =
                    editingId ===
                    unit.id


                  const actionLoading =
                    actionLoadingId ===
                    unit.id


                  return (
                    <article
                      key={
                        unit.id
                      }
                      className={
                        `hotel-room-unit-card ${
                          unit.is_active
                            ? ''
                            : 'is-inactive'
                        } ${
                          actionLoading
                            ? 'is-saving'
                            : ''
                        }`
                      }
                    >

                      {editing ? (

                        <>

                          <div className="hotel-room-unit-edit">

                            <label>

                              <span>
                                Número o código
                              </span>

                              <input
                                value={
                                  editForm
                                    .unit_code
                                }
                                disabled={
                                  actionLoading
                                }
                                onChange={(event) =>
                                  setEditForm(
                                    (current) => ({
                                      ...current,

                                      unit_code:
                                        event.target.value
                                    })
                                  )
                                }
                              />

                            </label>


                            <label>

                              <span>
                                Nombre interno
                              </span>

                              <input
                                value={
                                  editForm
                                    .display_name
                                }
                                disabled={
                                  actionLoading
                                }
                                onChange={(event) =>
                                  setEditForm(
                                    (current) => ({
                                      ...current,

                                      display_name:
                                        event.target.value
                                    })
                                  )
                                }
                              />

                            </label>


                            <label>

                              <span>
                                Piso
                              </span>

                              <input
                                value={
                                  editForm
                                    .floor
                                }
                                disabled={
                                  actionLoading
                                }
                                onChange={(event) =>
                                  setEditForm(
                                    (current) => ({
                                      ...current,

                                      floor:
                                        event.target.value
                                    })
                                  )
                                }
                              />

                            </label>

                          </div>


                          <div className="hotel-room-unit-card__actions">

                            <button
                              type="button"
                              className="is-save"
                              disabled={
                                actionLoading
                              }
                              onClick={() =>
                                saveUnit(
                                  unit
                                )
                              }
                            >

                              {actionLoading ? (

                                <span className="hotel-inline-spinner" />

                              ) : (

                                <Save
                                  size={16}
                                  strokeWidth={1.8}
                                />

                              )}

                              {actionLoading
                                ? 'Guardando...'
                                : 'Guardar'
                              }

                            </button>


                            <button
                              type="button"
                              disabled={
                                actionLoading
                              }
                              onClick={
                                cancelEditing
                              }
                            >

                              <X
                                size={16}
                                strokeWidth={1.8}
                              />

                              Cancelar

                            </button>

                          </div>

                        </>

                      ) : (

                        <>

                          <div className="hotel-room-unit-card__top">

                            <div className="hotel-room-unit-card__door">

                              <DoorOpen
                                size={22}
                                strokeWidth={1.7}
                              />

                            </div>


                            <div className="hotel-room-unit-card__status">

                              <span
                                className={
                                  unit.is_active
                                    ? 'is-active'
                                    : 'is-inactive'
                                }
                              >

                                {unit.is_active
                                  ? (
                                    <>
                                      <Check
                                        size={12}
                                        strokeWidth={2}
                                      />

                                      Activa
                                    </>
                                  )
                                  : 'Inactiva'
                                }

                              </span>

                            </div>

                          </div>


                          <div className="hotel-room-unit-card__copy">

                            <span>
                              Habitación
                            </span>

                            <h3>
                              {unit.unit_code}
                            </h3>


                            <p>

                              {unit.display_name ||
                                room?.name
                              }

                            </p>


                            {unit.floor && (

                              <small>
                                {unit.floor}
                              </small>

                            )}


                            {unit.is_system_generated && (

                              <div className="hotel-room-unit-card__auto">

                                Pendiente de configurar

                              </div>

                            )}

                          </div>


                          <div className="hotel-room-unit-card__actions">

                            <button
                              type="button"
                              disabled={
                                actionLoading
                              }
                              onClick={() =>
                                startEditing(
                                  unit
                                )
                              }
                            >

                              <Pencil
                                size={16}
                                strokeWidth={1.7}
                              />

                              Editar

                            </button>


                            <button
                              type="button"
                              disabled={
                                actionLoading
                              }
                              onClick={() =>
                                toggleUnit(
                                  unit
                                )
                              }
                            >

                              {actionLoading ? (

                                <span className="hotel-inline-spinner" />

                              ) : (

                                <Power
                                  size={16}
                                  strokeWidth={1.7}
                                />

                              )}

                              {actionLoading
                                ? 'Actualizando...'
                                : (
                                    unit.is_active
                                      ? 'Desactivar'
                                      : 'Activar'
                                  )
                              }

                            </button>

                          </div>

                        </>

                      )}

                    </article>
                  )
                }
              )}

            </div>

          )}

        </section>

      </main>

    </div>
  )
}