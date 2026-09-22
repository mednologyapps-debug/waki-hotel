import {
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  Save,
  UsersRound
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import HotelSidebar from '../components/hotel/HotelSidebar'

import { supabase } from '../lib/supabase'


export default function HotelRoomEditPage() {
  const navigate = useNavigate()

  const { roomId } =
    useParams()

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
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
    loadRoom()
  }, [roomId])


  async function loadRoom() {
    try {
      setLoading(true)
      setErrorMessage('')


      const {
        data: {
          session
        }
      } =
        await supabase
          .auth
          .getSession()


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
            max_guests,
            bed_type,
            size_m2,
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
          'No encontramos esta habitación dentro de tu hotel.'
        )
      }


      setForm({
        name:
          roomData.name || '',

        description:
          roomData.description || '',

        inventory_count:
          roomData.inventory_count ?? 1,

        max_guests:
          roomData.max_guests ?? 2,

        bed_type:
          roomData.bed_type || '',

        size_m2:
          roomData.size_m2 ?? '',

        is_active:
          roomData.is_active !== false
      })

    } catch (error) {
      console.error(
        'Error cargando habitación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar la habitación.'
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
      setSuccessMessage('')


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


      if (!hotelId) {
        throw new Error(
          'No pudimos identificar tu hotel.'
        )
      }


      const payload = {
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
          )
      }


      const {
        data: updatedRoom,
        error: updateError
      } =
        await supabase
          .from('room_types')
          .update(
            payload
          )
          .eq(
            'id',
            roomId
          )
          .eq(
            'hotel_id',
            hotelId
          )
          .select(`
            id
          `)
          .maybeSingle()


      if (updateError) {
        throw updateError
      }


      if (!updatedRoom) {
        throw new Error(
          'No se pudo actualizar la habitación.'
        )
      }


      setSuccessMessage(
        'Los cambios se guardaron correctamente.'
      )


      setTimeout(
        () => {
          navigate(
            `/habitaciones/${roomId}`
          )
        },
        700
      )

    } catch (error) {
      console.error(
        'Error guardando habitación:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos guardar los cambios.'
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
          Preparando formulario...
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
              `/habitaciones/${roomId}`
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a la habitación

        </button>


        <header className="room-edit-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Habitaciones
            </span>

            <h1>
              Editar habitación
            </h1>

            <p>
              Actualiza únicamente la información
              que necesites. Los cambios se
              guardarán en WAKI.
            </p>

          </div>

        </header>


        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        {successMessage && (
          <div className="hotel-dashboard-success">

            <CheckCircle2
              size={18}
              strokeWidth={1.8}
            />

            {successMessage}

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
                  Información principal
                </h2>

                <p>
                  Estos datos ayudan al huésped
                  a entender qué está reservando.
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
                  placeholder="Describe brevemente la habitación, sus características y ventajas."
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
                Estado de la habitación
              </h3>

              <p>
                Si la desactivas, dejará de
                mostrarse como disponible.
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


            <div className="room-edit-help">

              <strong>
                Antes de guardar
              </strong>

              <p>
                Verifica nombre, capacidad e
                inventario. Las fotografías y
                tarifas se administrarán por
                separado.
              </p>

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
                  `/habitaciones/${roomId}`
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
                ? 'Guardando...'
                : 'Guardar cambios'}

            </button>

          </div>

        </form>

      </main>

    </div>
  )
}