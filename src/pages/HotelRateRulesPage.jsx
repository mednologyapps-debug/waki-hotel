import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CirclePlus,
  Pencil,
  Power,
  Trash2
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


const dayLabels = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom'
}


export default function HotelRateRulesPage() {
  const navigate =
    useNavigate()

  const { rateId } =
    useParams()

  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [rate, setRate] =
    useState(null)

  const [rules, setRules] =
    useState([])


  useEffect(() => {
    loadPage()
  }, [rateId])


  async function loadPage() {
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
          'No encontramos esta tarifa dentro de tu hotel.'
        )
      }


      setRate(
        rateData
      )


      await loadRules()

    } catch (error) {
      console.error(
        'Error cargando reglas:',
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos cargar los precios especiales.'
      )

    } finally {
      setLoading(false)
    }
  }


  async function loadRules() {
    const {
      data,
      error
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
          priority,
          is_active,
          created_at
        `)
        .eq(
          'rate_plan_id',
          rateId
        )
        .order(
          'priority',
          {
            ascending: false
          }
        )
        .order(
          'created_at',
          {
            ascending: true
          }
        )


    if (error) {
      throw error
    }


    setRules(
      data || []
    )
  }


  function formatDuration(minutes) {
    const value =
      Number(
        minutes || 0
      )

    if (
      value % 60 === 0
    ) {
      return `${value / 60} h`
    }

    return `${value} min`
  }


  function formatPrice(
    value,
    currency = 'PEN'
  ) {
    return new Intl.NumberFormat(
      'es-PE',
      {
        style: 'currency',
        currency
      }
    ).format(
      Number(
        value || 0
      )
    )
  }


  function formatTime(value) {
    if (!value) {
      return null
    }

    return value
      .slice(
        0,
        5
      )
  }


  function getDaysText(days) {
    if (
      !Array.isArray(days) ||
      days.length === 0
    ) {
      return 'Todos los días'
    }


    const sorted =
      [...days].sort(
        (a, b) =>
          Number(a) -
          Number(b)
      )


    if (
      sorted.join(',') ===
      '1,2,3,4,5'
    ) {
      return 'Lunes a viernes'
    }


    if (
      sorted.join(',') ===
      '6,7'
    ) {
      return 'Fin de semana'
    }


    if (
      sorted.join(',') ===
      '1,2,3,4,5,6,7'
    ) {
      return 'Todos los días'
    }


    return sorted
      .map(
        (day) =>
          dayLabels[day]
      )
      .join(', ')
  }


  async function toggleRule(
    rule
  ) {
    try {
      setActionLoading(
        rule.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .from('rate_rules')
          .update({
            is_active:
              !rule.is_active
          })
          .eq(
            'id',
            rule.id
          )
          .eq(
            'rate_plan_id',
            rateId
          )


      if (error) {
        throw error
      }


      await loadRules()


      setSuccessMessage(
        rule.is_active
          ? 'El precio especial fue desactivado.'
          : 'El precio especial fue activado.'
      )

    } catch (error) {
      console.error(
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos actualizar el precio especial.'
      )

    } finally {
      setActionLoading(
        null
      )
    }
  }


  async function deleteRule(
    rule
  ) {
    const confirmed =
      window.confirm(
        `¿Quieres eliminar "${rule.name}"?`
      )


    if (!confirmed) {
      return
    }


    try {
      setActionLoading(
        rule.id
      )

      setErrorMessage('')
      setSuccessMessage('')


      const {
        error
      } =
        await supabase
          .from('rate_rules')
          .delete()
          .eq(
            'id',
            rule.id
          )
          .eq(
            'rate_plan_id',
            rateId
          )


      if (error) {
        throw error
      }


      await loadRules()


      setSuccessMessage(
        'El precio especial se eliminó correctamente.'
      )

    } catch (error) {
      console.error(
        error
      )

      setErrorMessage(
        error?.message ||
        'No pudimos eliminar el precio especial.'
      )

    } finally {
      setActionLoading(
        null
      )
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
          Cargando precios especiales...
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


        <header className="rate-rules-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Precios especiales
            </span>

            <h1>
              {rate?.name}
            </h1>

            <p>
              {rate?.room_types?.name}
              {' · '}
              {formatDuration(
                rate?.duration_minutes
              )}
              {' · '}
              Precio base{' '}
              {formatPrice(
                rate?.base_price,
                rate?.currency
              )}
            </p>

          </div>


          <button
            type="button"
            className="hotel-primary-button"
            onClick={() =>
              navigate(
                `/tarifas/${rateId}/reglas/nueva`
              )
            }
          >

            <CirclePlus
              size={18}
              strokeWidth={1.8}
            />

            Agregar precio especial

          </button>

        </header>


        {errorMessage && (
          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>
        )}


        {successMessage && (
          <div className="hotel-dashboard-success">
            {successMessage}
          </div>
        )}


        <section className="rate-rules-guide">

          <div className="rate-rules-guide__icon">

            <CalendarDays
              size={22}
              strokeWidth={1.7}
            />

          </div>


          <div>

            <strong>
              Mantén tu precio base y crea excepciones
            </strong>

            <p>
              Por ejemplo, puedes cobrar un precio distinto
              los sábados y domingos sin modificar la tarifa
              normal de la habitación.
            </p>

          </div>

        </section>


        {rules.length === 0 ? (

          <section className="hotel-empty-state">

            <div className="hotel-empty-state__icon">

              <CircleDollarSign
                size={34}
                strokeWidth={1.6}
              />

            </div>

            <h2>
              Esta tarifa no tiene precios especiales
            </h2>

            <p>
              El precio base se aplicará todos los días.
              Puedes agregar una excepción cuando lo necesites.
            </p>


            <button
              type="button"
              className="hotel-primary-button"
              onClick={() =>
                navigate(
                  `/tarifas/${rateId}/reglas/nueva`
                )
              }
            >

              <CirclePlus
                size={18}
                strokeWidth={1.8}
              />

              Agregar precio especial

            </button>

          </section>

        ) : (

          <section className="rate-rule-list">

            {rules.map(
              (rule) => (

                <article
                  key={
                    rule.id
                  }
                  className={[
                    'rate-rule-card',
                    !rule.is_active
                      ? 'is-inactive'
                      : ''
                  ].join(' ')}
                >

                  <div className="rate-rule-card__main">

                    <div className="rate-rule-card__icon">

                      <CalendarDays
                        size={21}
                        strokeWidth={1.7}
                      />

                    </div>


                    <div>

                      <span className="rate-rule-card__type">
                        Precio especial
                      </span>

                      <h2>
                        {rule.name}
                      </h2>

                      <div className="rate-rule-card__meta">

                        <span>
                          {getDaysText(
                            rule.days_of_week
                          )}
                        </span>


                        {rule.start_time &&
                        rule.end_time && (

                          <>
                            <span className="rate-rule-card__separator">
                              ·
                            </span>

                            <span className="rate-rule-card__time">

                              <Clock3
                                size={14}
                                strokeWidth={1.7}
                              />

                              {formatTime(
                                rule.start_time
                              )}
                              {' – '}
                              {formatTime(
                                rule.end_time
                              )}

                            </span>
                          </>

                        )}

                      </div>

                    </div>

                  </div>


                  <div className="rate-rule-card__price">

                    <span>
                      Precio especial
                    </span>

                    <strong>
                      {formatPrice(
                        rule.price,
                        rate?.currency
                      )}
                    </strong>

                    <small>
                      Base:{' '}
                      {formatPrice(
                        rate?.base_price,
                        rate?.currency
                      )}
                    </small>

                  </div>


                  <div className="rate-rule-card__state">

                    <span
                      className={[
                        'hotel-rate-status',
                        rule.is_active
                          ? 'is-active'
                          : ''
                      ].join(' ')}
                    >
                      {rule.is_active
                        ? 'Activa'
                        : 'Inactiva'}
                    </span>

                  </div>


                  <div className="rate-rule-card__actions">

                    <button
                      type="button"
                      title="Editar"
                      onClick={() =>
                        navigate(
                          `/tarifas/${rateId}/reglas/${rule.id}/editar`
                        )
                      }
                    >

                      <Pencil
                        size={17}
                        strokeWidth={1.7}
                      />

                    </button>


                    <button
                      type="button"
                      title={
                        rule.is_active
                          ? 'Desactivar'
                          : 'Activar'
                      }
                      disabled={
                        actionLoading ===
                        rule.id
                      }
                      onClick={() =>
                        toggleRule(
                          rule
                        )
                      }
                    >

                      <Power
                        size={17}
                        strokeWidth={1.7}
                      />

                    </button>


                    <button
                      type="button"
                      className="is-danger"
                      title="Eliminar"
                      disabled={
                        actionLoading ===
                        rule.id
                      }
                      onClick={() =>
                        deleteRule(
                          rule
                        )
                      }
                    >

                      <Trash2
                        size={17}
                        strokeWidth={1.7}
                      />

                    </button>

                  </div>

                </article>

              )
            )}

          </section>

        )}

      </main>

    </div>
  )
}