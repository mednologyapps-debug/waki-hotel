import {
  ArrowLeft,
  CircleDollarSign,
  Clock3,
  Save
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate,
  useSearchParams
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import { supabase }
  from '../lib/supabase'


export default function HotelRateCreatePage() {
  const navigate =
    useNavigate()

  const [
    searchParams
  ] =
    useSearchParams()

  const roomId =
    searchParams.get(
      'roomId'
    )


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

  const [room, setRoom] =
    useState(null)


  const [form, setForm] =
    useState({
      name: '',
      duration_hours: 3,
      base_price: '',
      is_active: true
    })


  useEffect(() => {
    loadContext()
  }, [roomId])


  async function loadContext() {
    try {
      setLoading(true)
      setErrorMessage('')


      if (!roomId) {
        throw new Error(
          'Selecciona una habitación.'
        )
      }


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
        data: profileData
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


      const {
        data: hotelData
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
            name
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

    } catch (error) {
      console.error(
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos preparar la tarifa.'
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


      if (!room?.id) {
        throw new Error(
          'No pudimos identificar la habitación.'
        )
      }


      const hours =
        Number(
          form.duration_hours
        )


      const price =
        Number(
          form.base_price
        )


      if (
        !hours ||
        hours <= 0
      ) {
        throw new Error(
          'Ingresa una duración válida.'
        )
      }


      if (
        !price ||
        price <= 0
      ) {
        throw new Error(
          'Ingresa un precio válido.'
        )
      }


      const {
        data: lastRate
      } =
        await supabase
          .from('rate_plans')
          .select(`
            display_order
          `)
          .eq(
            'room_type_id',
            room.id
          )
          .order(
            'display_order',
            {
              ascending:
                false
            }
          )
          .limit(1)
          .maybeSingle()


      const nextOrder =
        Number(
          lastRate
            ?.display_order || 0
        ) + 1


      const name =
        form.name.trim() ||
        `${hours} horas`


      const {
        error: insertError
      } =
        await supabase
          .from('rate_plans')
          .insert({
            room_type_id:
              room.id,

            name,

            duration_minutes:
              Math.round(
                hours * 60
              ),

            base_price:
              price,

            currency:
              'PEN',

            is_active:
              Boolean(
                form.is_active
              ),

            display_order:
              nextOrder
          })


      if (insertError) {
        throw insertError
      }


      navigate(
        '/tarifas',
        {
          replace: true
        }
      )

    } catch (error) {
      console.error(
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos crear la tarifa.'
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
          Preparando tarifa...
        </p>

      </div>
    )
  }


  return (
    <div className="hotel-portal">

      <HotelSidebar
        activeKey="tarifas"
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
              '/tarifas'
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a tarifas

        </button>


        <header className="room-edit-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Tarifas
            </span>

            <h1>
              Nueva tarifa
            </h1>

            <p>
              Configura una duración y precio
              para {room?.name}.
            </p>

          </div>

        </header>


        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        <form
          className="hotel-rate-form-layout"
          onSubmit={
            handleSubmit
          }
        >

          <section className="room-edit-card">

            <div className="room-edit-card__heading">

              <div className="room-edit-card__heading-icon">

                <CircleDollarSign
                  size={21}
                  strokeWidth={1.7}
                />

              </div>

              <div>

                <h2>
                  Precio por duración
                </h2>

                <p>
                  El huésped verá esta opción
                  al reservar.
                </p>

              </div>

            </div>


            <div className="room-form-grid">


              <label className="room-form-field room-form-field--full">

                <span>
                  Nombre de la tarifa
                </span>

                <input
                  type="text"
                  placeholder="Ej. Tarifa 3 horas"
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'name',
                      event.target.value
                    )
                  }
                />

                <small>
                  Es opcional. Si lo dejas vacío,
                  WAKI usará la duración como nombre.
                </small>

              </label>


              <label className="room-form-field">

                <span>
                  Duración
                </span>

                <div className="room-input-suffix">

                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={
                      form.duration_hours
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'duration_hours',
                        event.target.value
                      )
                    }
                  />

                  <span>
                    horas
                  </span>

                </div>

              </label>


              <label className="room-form-field">

                <span>
                  Precio base
                </span>

                <div className="room-input-prefix">

                  <span>
                    S/
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={
                      form.base_price
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'base_price',
                        event.target.value
                      )
                    }
                  />

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
                Una tarifa activa estará disponible
                para ser usada en WAKI.
              </p>


              <label className="room-status-toggle">

                <div>

                  <strong>
                    Tarifa activa
                  </strong>

                  <span>
                    Disponible para reservas
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
                      event.target.checked
                    )
                  }
                />


                <span className="room-status-toggle__control" />

              </label>

            </div>


            <div className="hotel-rate-preview">

              <span>
                Vista rápida
              </span>

              <Clock3
                size={22}
                strokeWidth={1.7}
              />

              <strong>
                {
                  Number(
                    form.duration_hours || 0
                  )
                } h
              </strong>

              <p>
                S/{' '}
                {
                  Number(
                    form.base_price || 0
                  ).toFixed(2)
                }
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
                  '/tarifas'
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
                : 'Crear tarifa'}

            </button>

          </div>

        </form>

      </main>

    </div>
  )
}