import {
  ArrowLeft,
  BedDouble,
  Save,
  UsersRound
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import { supabase }
  from '../lib/supabase'


export default function HotelRoomCreatePage() {
  const navigate = useNavigate()

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [hotelId, setHotelId] =
    useState(null)

  const [form, setForm] =
    useState({
      name: '',
      description: '',
      inventory_count: 1,
      max_guests: 2,
      bed_type: '',
      size_m2: '',
      is_active: true
    })


  useEffect(() => {
    loadContext()
  }, [])


  async function loadContext() {
    try {
      setLoading(true)
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


      setHotelId(
        staffData.hotel_id
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
            staffData.hotel_id
          )
          .maybeSingle()


      if (hotelError) {
        throw hotelError
      }


      setHotel(
        hotelData
      )

    } catch (error) {
      console.error(
        'Error cargando contexto:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos preparar el formulario.'
      )

    } finally {
      setLoading(false)
    }
  }


  function updateField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value
      })
    )
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage('')


      if (!hotelId) {
        throw new Error(
          'No pudimos identificar tu hotel.'
        )
      }


      if (!form.name.trim()) {
        throw new Error(
          'Ingresa el nombre de la habitación.'
        )
      }


      if (
        Number(
          form.inventory_count
        ) < 0
      ) {
        throw new Error(
          'El inventario no puede ser negativo.'
        )
      }


      if (
        Number(
          form.max_guests
        ) < 1
      ) {
        throw new Error(
          'La habitación debe admitir al menos un huésped.'
        )
      }


      const {
        data: lastRoom
      } =
        await supabase
          .from('room_types')
          .select(`
            display_order
          `)
          .eq(
            'hotel_id',
            hotelId
          )
          .order(
            'display_order',
            {
              ascending: false
            }
          )
          .limit(1)
          .maybeSingle()


      const nextDisplayOrder =
        Number(
          lastRoom
            ?.display_order || 0
        ) + 1


      const payload = {
        hotel_id:
          hotelId,

        name:
          form.name.trim(),

        description:
          form.description.trim() ||
          null,

        inventory_count:
          Number(
            form.inventory_count
          ),

        max_guests:
          Number(
            form.max_guests
          ),

        bed_type:
          form.bed_type.trim() ||
          null,

        size_m2:
          form.size_m2 === ''
            ? null
            : Number(
                form.size_m2
              ),

        is_active:
          Boolean(
            form.is_active
          ),

        display_order:
          nextDisplayOrder
      }


      const {
        data: newRoom,
        error: insertError
      } =
        await supabase
          .from('room_types')
          .insert(
            payload
          )
          .select(`
            id
          `)
          .single()


      if (insertError) {
        throw insertError
      }


      if (!newRoom?.id) {
        throw new Error(
          'La habitación se creó, pero no pudimos identificarla.'
        )
      }


      navigate(
        `/habitaciones/${newRoom.id}/fotos`,
        {
          replace: true
        }
      )

    } catch (error) {
      console.error(
        'Error creando habitación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos crear la habitación.'
      )

    } finally {
      setSaving(false)
    }
  }


  const hotelLocation =
    [
      hotel?.district,
      hotel?.province
    ]
      .filter(Boolean)
      .join(', ')


  if (loading) {
    return (
      <div className="hotel-dashboard-loading">

        <div className="hotel-dashboard-loading__spinner" />

        <p>
          Preparando nueva habitación...
        </p>

      </div>
    )
  }


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


      <main className="hotel-dashboard">


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


        <header className="room-edit-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Habitaciones
            </span>

            <h1>
              Agregar habitación
            </h1>

            <p>
              Crea un nuevo tipo de habitación.
              Después podrás agregar fotografías
              y configurar sus tarifas.
            </p>

          </div>

        </header>


        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        <form
          className="room-edit-layout"
          onSubmit={
            handleSubmit
          }
        >


          <section className="room-edit-card">

            <div className="room-edit-card__heading">

              <div className="room-edit-card__heading-icon">

                <BedDouble
                  size={21}
                  strokeWidth={1.7}
                />

              </div>

              <div>

                <h2>
                  Información de la habitación
                </h2>

                <p>
                  Completa los datos principales.
                  Podrás modificarlos después.
                </p>

              </div>

            </div>


            <div className="room-form-grid">


              <label className="room-form-field room-form-field--full">

                <span>
                  Nombre de la habitación
                </span>

                <input
                  type="text"
                  value={
                    form.name
                  }
                  placeholder="Ej. Suite Deluxe"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'name',
                      event
                        .target
                        .value
                    )
                  }
                />

                <small>
                  Usa un nombre corto y fácil
                  de reconocer.
                </small>

              </label>


              <label className="room-form-field room-form-field--full">

                <span>
                  Descripción
                </span>

                <textarea
                  rows="5"
                  value={
                    form.description
                  }
                  placeholder="Describe brevemente la habitación y sus principales características."
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'description',
                      event
                        .target
                        .value
                    )
                  }
                />

              </label>


              <label className="room-form-field">

                <span>
                  Inventario
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.inventory_count
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'inventory_count',
                      event
                        .target
                        .value
                    )
                  }
                />

                <small>
                  Cantidad disponible de este tipo.
                </small>

              </label>


              <label className="room-form-field">

                <span>
                  Máximo de huéspedes
                </span>

                <div className="room-input-icon">

                  <UsersRound
                    size={18}
                    strokeWidth={1.7}
                  />

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.max_guests
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'max_guests',
                        event
                          .target
                          .value
                      )
                    }
                  />

                </div>

              </label>


              <label className="room-form-field">

                <span>
                  Tipo de cama
                </span>

                <select
                  value={
                    form.bed_type
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'bed_type',
                      event
                        .target
                        .value
                    )
                  }
                >

                  <option value="">
                    Selecciona una opción
                  </option>

                  <option value="Single">
                    Individual
                  </option>

                  <option value="Double">
                    Doble
                  </option>

                  <option value="Queen">
                    Queen
                  </option>

                  <option value="King">
                    King
                  </option>

                  <option value="Twin">
                    Twin
                  </option>

                  <option value="Sofa bed">
                    Sofá cama
                  </option>

                  <option value="Multiple">
                    Varias camas
                  </option>

                </select>

              </label>


              <label className="room-form-field">

                <span>
                  Tamaño de la habitación
                </span>

                <div className="room-input-suffix">

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.size_m2
                    }
                    placeholder="0"
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'size_m2',
                        event
                          .target
                          .value
                      )
                    }
                  />

                  <span>
                    m²
                  </span>

                </div>

              </label>

            </div>

          </section>


          <aside className="room-edit-side">

            <div className="room-edit-side-card">

              <h3>
                Estado inicial
              </h3>

              <p>
                Puedes crearla activa o dejarla
                desactivada mientras terminas
                su configuración.
              </p>


              <label className="room-status-toggle">

                <div>

                  <strong>
                    Habitación activa
                  </strong>

                  <span>
                    Disponible para WAKI
                  </span>

                </div>


                <input
                  type="checkbox"
                  checked={
                    form.is_active
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'is_active',
                      event
                        .target
                        .checked
                    )
                  }
                />


                <span className="room-status-toggle__control" />

              </label>

            </div>


            <div className="room-create-next-step">

              <span>
                1
              </span>

              <div>

                <strong>
                  Primero crea la habitación
                </strong>

                <p>
                  Al guardar, te llevaremos
                  automáticamente a fotografías.
                </p>

              </div>

            </div>


            <div className="room-create-next-step">

              <span>
                2
              </span>

              <div>

                <strong>
                  Agrega fotografías
                </strong>

                <p>
                  Selecciona una imagen principal
                  para mostrarla en WAKI.
                </p>

              </div>

            </div>


            <div className="room-create-next-step">

              <span>
                3
              </span>

              <div>

                <strong>
                  Configura tarifas
                </strong>

                <p>
                  Después definiremos bloques
                  de tiempo y precios.
                </p>

              </div>

            </div>

          </aside>


          <div className="room-edit-actions">

            <button
              type="button"
              className="hotel-secondary-button"
              disabled={
                saving
              }
              onClick={() =>
                navigate(
                  '/habitaciones'
                )
              }
            >
              Cancelar
            </button>


            <button
              type="submit"
              className="hotel-primary-button"
              disabled={
                saving
              }
            >

              <Save
                size={18}
                strokeWidth={1.8}
              />

              {saving
                ? 'Creando...'
                : 'Crear habitación'}

            </button>

          </div>

        </form>

      </main>

    </div>
  )
}