import {
  ArrowLeft,
  CircleDollarSign,
  Save
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import { supabase }
  from '../lib/supabase'


export default function HotelRateEditPage() {
  const navigate =
    useNavigate()

  const {
    rateId
  } =
    useParams()


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

  const [rate, setRate] =
    useState(null)


  const [form, setForm] =
    useState({
      name: '',
      duration_hours: '',
      base_price: '',
      is_active: true
    })


  useEffect(() => {
    loadRate()
  }, [rateId])


  async function loadRate() {
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
        data: rateData,
        error: rateError
      } =
        await supabase
          .from('rate_plans')
          .select(`
            id,
            name,
            duration_minutes,
            base_price,
            currency,
            is_active,

            room_types!inner (
              id,
              hotel_id,
              name
            )
          `)
          .eq(
            'id',
            rateId
          )
          .eq(
            'room_types.hotel_id',
            staffData.hotel_id
          )
          .maybeSingle()


      if (rateError) {
        throw rateError
      }


      if (!rateData) {
        throw new Error(
          'No encontramos esta tarifa.'
        )
      }


      setRate(
        rateData
      )


      setForm({
        name:
          rateData.name || '',

        duration_hours:
          Number(
            rateData.duration_minutes
          ) / 60,

        base_price:
          rateData.base_price,

        is_active:
          rateData.is_active !== false
      })

    } catch (error) {
      console.error(
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar la tarifa.'
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
        error
      } =
        await supabase
          .from('rate_plans')
          .update({
            name:
              form.name.trim() ||
              `${hours} horas`,

            duration_minutes:
              Math.round(
                hours * 60
              ),

            base_price:
              price,

            is_active:
              Boolean(
                form.is_active
              )
          })
          .eq(
            'id',
            rateId
          )


      if (error) {
        throw error
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
          Cargando tarifa...
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
              Editar tarifa
            </h1>

            <p>
              {
                rate?.room_types
                  ?.name
              }
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
                  Información de la tarifa
                </h2>

                <p>
                  Modifica duración o precio.
                </p>

              </div>

            </div>


            <div className="room-form-grid">


              <label className="room-form-field room-form-field--full">

                <span>
                  Nombre
                </span>

                <input
                  type="text"
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
                  Precio
                </span>

                <div className="room-input-prefix">

                  <span>
                    S/
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
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
                Estado
              </h3>

              <p>
                Puedes desactivar temporalmente
                esta tarifa.
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

          </aside>


          <div className="room-edit-actions">

            <button
              type="button"
              className="hotel-secondary-button"
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
                : 'Guardar cambios'}

            </button>

          </div>

        </form>

      </main>

    </div>
  )
}