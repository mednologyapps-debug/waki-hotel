import {
  ArrowLeft,
  CalendarDays,
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
  useParams
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import { supabase }
  from '../lib/supabase'


const days = [
  {
    value: 1,
    label: 'Lun'
  },
  {
    value: 2,
    label: 'Mar'
  },
  {
    value: 3,
    label: 'Mié'
  },
  {
    value: 4,
    label: 'Jue'
  },
  {
    value: 5,
    label: 'Vie'
  },
  {
    value: 6,
    label: 'Sáb'
  },
  {
    value: 7,
    label: 'Dom'
  }
]


export default function HotelRateRuleFormPage({
  mode = 'create'
}) {
  const navigate =
    useNavigate()

  const {
    rateId,
    ruleId
  } =
    useParams()


  const isEdit =
    mode === 'edit'


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
      days_of_week: [
        6,
        7
      ],
      use_time: false,
      start_time: '18:00',
      end_time: '23:59',
      price: '',
      is_active: true
    })


  useEffect(() => {
    loadContext()
  }, [
    rateId,
    ruleId
  ])


  async function loadContext() {
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


      if (isEdit) {

        const {
          data: ruleData,
          error: ruleError
        } =
          await supabase
            .from('rate_rules')
            .select(`
              id,
              rate_plan_id,
              name,
              days_of_week,
              start_time,
              end_time,
              price,
              is_active
            `)
            .eq(
              'id',
              ruleId
            )
            .eq(
              'rate_plan_id',
              rateId
            )
            .maybeSingle()


        if (ruleError) {
          throw ruleError
        }


        if (!ruleData) {
          throw new Error(
            'No encontramos este precio especial.'
          )
        }


        setForm({
          name:
            ruleData.name || '',

          days_of_week:
            Array.isArray(
              ruleData.days_of_week
            )
              ? ruleData.days_of_week
              : [],

          use_time:
            Boolean(
              ruleData.start_time &&
              ruleData.end_time
            ),

          start_time:
            ruleData.start_time
              ? ruleData.start_time.slice(
                  0,
                  5
                )
              : '18:00',

          end_time:
            ruleData.end_time
              ? ruleData.end_time.slice(
                  0,
                  5
                )
              : '23:59',

          price:
            ruleData.price,

          is_active:
            ruleData.is_active !== false
        })

      } else {

        setForm(
          (current) => ({
            ...current,
            price:
              rateData.base_price
                ? String(
                    rateData.base_price
                  )
                : ''
          })
        )

      }

    } catch (error) {
      console.error(
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


  function toggleDay(
    day
  ) {
    setForm(
      (current) => {

        const selected =
          current
            .days_of_week
            .includes(
              day
            )


        return {
          ...current,

          days_of_week:
            selected
              ? current
                  .days_of_week
                  .filter(
                    (item) =>
                      item !== day
                  )
              : [
                  ...current.days_of_week,
                  day
                ].sort(
                  (a, b) =>
                    a - b
                )
        }
      }
    )
  }


  function selectPreset(
    preset
  ) {
    if (
      preset ===
      'weekdays'
    ) {
      updateField(
        'days_of_week',
        [
          1,
          2,
          3,
          4,
          5
        ]
      )
    }


    if (
      preset ===
      'weekend'
    ) {
      updateField(
        'days_of_week',
        [
          6,
          7
        ]
      )
    }


    if (
      preset ===
      'all'
    ) {
      updateField(
        'days_of_week',
        [
          1,
          2,
          3,
          4,
          5,
          6,
          7
        ]
      )
    }
  }


  function suggestedName() {
    const selected =
      form.days_of_week


    if (
      selected.join(',') ===
      '6,7'
    ) {
      return 'Fin de semana'
    }


    if (
      selected.join(',') ===
      '1,2,3,4,5'
    ) {
      return 'Lunes a viernes'
    }


    return 'Precio especial'
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage('')


      const price =
        Number(
          form.price
        )


      if (
        !Array.isArray(
          form.days_of_week
        ) ||
        form.days_of_week
          .length === 0
      ) {
        throw new Error(
          'Selecciona al menos un día.'
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


      if (
        form.use_time &&
        (
          !form.start_time ||
          !form.end_time
        )
      ) {
        throw new Error(
          'Completa el horario de inicio y fin.'
        )
      }


      const payload = {
        rate_plan_id:
          rateId,

        name:
          form.name.trim() ||
          suggestedName(),

        days_of_week:
          form.days_of_week,

        start_time:
          form.use_time
            ? form.start_time
            : null,

        end_time:
          form.use_time
            ? form.end_time
            : null,

        price,

        valid_from:
          null,

        valid_until:
          null,

        priority:
          10,

        is_active:
          Boolean(
            form.is_active
          )
      }


      if (isEdit) {

        const {
          error
        } =
          await supabase
            .from('rate_rules')
            .update({
              name:
                payload.name,

              days_of_week:
                payload.days_of_week,

              start_time:
                payload.start_time,

              end_time:
                payload.end_time,

              price:
                payload.price,

              is_active:
                payload.is_active
            })
            .eq(
              'id',
              ruleId
            )
            .eq(
              'rate_plan_id',
              rateId
            )


        if (error) {
          throw error
        }

      } else {

        const {
          error
        } =
          await supabase
            .from('rate_rules')
            .insert(
              payload
            )


        if (error) {
          throw error
        }

      }


      navigate(
        `/tarifas/${rateId}/reglas`,
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
        'No pudimos guardar el precio especial.'
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
          Preparando precio especial...
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
              `/tarifas/${rateId}/reglas`
            )
          }
        >

          <ArrowLeft
            size={18}
            strokeWidth={1.8}
          />

          Volver a precios especiales

        </button>


        <header className="room-edit-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Precios especiales
            </span>

            <h1>
              {isEdit
                ? 'Editar precio especial'
                : 'Nuevo precio especial'}
            </h1>

            <p>
              {rate?.room_types?.name}
              {' · '}
              {rate?.name}
            </p>

          </div>

        </header>


        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        <form
          className="rate-rule-form-layout"
          onSubmit={
            handleSubmit
          }
        >

          <section className="room-edit-card">

            <div className="room-edit-card__heading">

              <div className="room-edit-card__heading-icon">

                <CalendarDays
                  size={21}
                  strokeWidth={1.7}
                />

              </div>


              <div>

                <h2>
                  ¿Cuándo aplica?
                </h2>

                <p>
                  Selecciona los días que tendrán
                  un precio diferente.
                </p>

              </div>

            </div>


            <div className="rate-rule-presets">

              <button
                type="button"
                onClick={() =>
                  selectPreset(
                    'weekdays'
                  )
                }
              >
                Lunes a viernes
              </button>

              <button
                type="button"
                onClick={() =>
                  selectPreset(
                    'weekend'
                  )
                }
              >
                Fin de semana
              </button>

              <button
                type="button"
                onClick={() =>
                  selectPreset(
                    'all'
                  )
                }
              >
                Todos los días
              </button>

            </div>


            <div className="rate-rule-days">

              {days.map(
                (day) => (

                  <button
                    key={
                      day.value
                    }
                    type="button"
                    className={
                      form
                        .days_of_week
                        .includes(
                          day.value
                        )
                        ? 'is-selected'
                        : ''
                    }
                    onClick={() =>
                      toggleDay(
                        day.value
                      )
                    }
                  >
                    {day.label}
                  </button>

                )
              )}

            </div>


            <div className="rate-rule-divider" />


            <div className="room-form-grid">

              <label className="room-form-field room-form-field--full">

                <span>
                  Nombre
                </span>

                <input
                  type="text"
                  placeholder="Ej. Fin de semana"
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
                  Opcional. WAKI puede asignar
                  un nombre automáticamente.
                </small>

              </label>


              <label className="room-form-field room-form-field--full">

                <span>
                  Precio especial
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
                      form.price
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'price',
                        event.target.value
                      )
                    }
                  />

                </div>

              </label>

            </div>


            <div className="rate-rule-time-section">

              <label className="rate-rule-time-toggle">

                <div>

                  <Clock3
                    size={19}
                    strokeWidth={1.7}
                  />

                  <div>

                    <strong>
                      Aplicar solo en un horario
                    </strong>

                    <span>
                      Déjalo desactivado si el precio
                      aplica durante todo el día.
                    </span>

                  </div>

                </div>


                <input
                  type="checkbox"
                  checked={
                    form.use_time
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'use_time',
                      event.target.checked
                    )
                  }
                />

                <span className="room-status-toggle__control" />

              </label>


              {form.use_time && (

                <div className="rate-rule-time-fields">

                  <label className="room-form-field">

                    <span>
                      Desde
                    </span>

                    <input
                      type="time"
                      value={
                        form.start_time
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          'start_time',
                          event.target.value
                        )
                      }
                    />

                  </label>


                  <label className="room-form-field">

                    <span>
                      Hasta
                    </span>

                    <input
                      type="time"
                      value={
                        form.end_time
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          'end_time',
                          event.target.value
                        )
                      }
                    />

                  </label>

                </div>

              )}

            </div>

          </section>


          <aside className="room-edit-side">

            <div className="room-edit-side-card">

              <h3>
                Estado
              </h3>

              <p>
                Puedes dejar el precio guardado
                sin activarlo todavía.
              </p>


              <label className="room-status-toggle">

                <div>

                  <strong>
                    Precio activo
                  </strong>

                  <span>
                    Puede aplicarse en WAKI
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


            <div className="rate-rule-preview">

              <span>
                Vista rápida
              </span>

              <CircleDollarSign
                size={24}
                strokeWidth={1.7}
              />

              <strong>
                S/{' '}
                {Number(
                  form.price || 0
                ).toFixed(2)}
              </strong>

              <p>
                Precio base:{' '}
                S/{' '}
                {Number(
                  rate?.base_price || 0
                ).toFixed(2)}
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
                  `/tarifas/${rateId}/reglas`
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
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear precio especial'}

            </button>

          </div>

        </form>

      </main>

    </div>
  )
}