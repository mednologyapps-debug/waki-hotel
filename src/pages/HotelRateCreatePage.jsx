import {
  ArrowLeft,
  BedDouble,
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

import {
  supabase
} from '../lib/supabase'


export default function HotelRateCreatePage() {
  const navigate =
    useNavigate()

  const [
    searchParams,
    setSearchParams
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

  const [
    errorMessage,
    setErrorMessage
  ] =
    useState('')

  const [profile, setProfile] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)

  const [rooms, setRooms] =
    useState([])

  const [room, setRoom] =
    useState(null)


  const [form, setForm] =
    useState({
      name: '',
      duration_hours: 3,
      base_price: '',
      is_active: true
    })


  /* =========================================================
     CARGAR TODO SOLO UNA VEZ
     ========================================================= */

  useEffect(() => {
    loadInitialContext()
  }, [])


  /* =========================================================
     SINCRONIZAR ROOM CON URL
     SIN CONSULTAR SUPABASE NUEVAMENTE
     ========================================================= */

  useEffect(() => {
    if (
      loading ||
      rooms.length === 0
    ) {
      return
    }

    if (!roomId) {
      setRoom(null)
      return
    }

    const selectedRoom =
      rooms.find(
        (currentRoom) =>
          currentRoom.id ===
          roomId
      )

    if (selectedRoom) {
      setRoom(
        selectedRoom
      )

      setErrorMessage('')

      return
    }

    setRoom(null)

    setErrorMessage(
      'La habitación seleccionada no existe, está inactiva o no pertenece a tu hotel.'
    )

  }, [
    roomId,
    rooms,
    loading
  ])


  /* =========================================================
     CARGA INICIAL
     ========================================================= */

  async function loadInitialContext() {
    try {
      setLoading(true)
      setErrorMessage('')


      /* SESIÓN */

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


      /* PERFIL */

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


      /* STAFF */

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


      /* HOTEL */

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


      /* HABITACIONES ACTIVAS */

      const {
        data: roomsData,
        error: roomsError
      } =
        await supabase
          .from('room_types')
          .select(`
            id,
            hotel_id,
            name,
            is_active,
            display_order
          `)
          .eq(
            'hotel_id',
            staffData.hotel_id
          )
          .eq(
            'is_active',
            true
          )
          .order(
            'display_order',
            {
              ascending: true
            }
          )
          .order(
            'name',
            {
              ascending: true
            }
          )

      if (roomsError) {
        throw roomsError
      }

      const availableRooms =
        roomsData || []

      setRooms(
        availableRooms
      )


      /*
       * Si la URL ya vino con roomId,
       * seleccionamos inmediatamente
       * sin una segunda consulta.
       */

      if (roomId) {
        const initialRoom =
          availableRooms.find(
            (currentRoom) =>
              currentRoom.id ===
              roomId
          )

        if (initialRoom) {
          setRoom(
            initialRoom
          )
        } else {
          setErrorMessage(
            'La habitación seleccionada no existe, está inactiva o no pertenece a tu hotel.'
          )
        }
      }

    } catch (error) {
      console.error(
        'Error preparando tarifa:',
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


  /* =========================================================
     CAMBIAR HABITACIÓN
     SIN RECARGAR
     ========================================================= */

  function handleRoomChange(
    event
  ) {
    const selectedRoomId =
      event.target.value

    setErrorMessage('')


    if (!selectedRoomId) {
      setRoom(null)

      setSearchParams(
        {},
        {
          replace: true
        }
      )

      return
    }


    const selectedRoom =
      rooms.find(
        (currentRoom) =>
          currentRoom.id ===
          selectedRoomId
      )

    setRoom(
      selectedRoom ||
      null
    )


    /*
     * Actualizamos la URL,
     * pero NO hacemos otra carga.
     */

    setSearchParams(
      {
        roomId:
          selectedRoomId
      },
      {
        replace: true
      }
    )
  }


  /* =========================================================
     FORM
     ========================================================= */

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


  /* =========================================================
     CREAR TARIFA
     ========================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage('')


      if (!room?.id) {
        throw new Error(
          'Selecciona una habitación antes de crear la tarifa.'
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


      /* ÚLTIMO ORDEN */

      const {
        data: lastRate,
        error: lastRateError
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

      if (lastRateError) {
        throw lastRateError
      }


      const nextOrder =
        Number(
          lastRate
            ?.display_order ||
          0
        ) + 1


      const name =
        form.name.trim() ||
        `${hours} horas`


      /* INSERT */

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
        'Error creando tarifa:',
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
     SKELETON INICIAL
     ========================================================= */

  if (loading) {
    return (
      <RateCreateSkeleton />
    )
  }


  /* =========================================================
     RENDER
     ========================================================= */

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

        {/* VOLVER */}

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


        {/* HEADER */}

        <header className="room-edit-header">

          <div>

            <span className="hotel-dashboard-eyebrow">
              Tarifas
            </span>

            <h1>
              Nueva tarifa
            </h1>

            <p>

              {room ? (

                <>
                  Configura una duración y precio
                  para <strong>{room.name}</strong>.
                </>

              ) : (

                'Selecciona una habitación y configura su nueva tarifa.'

              )}

            </p>

          </div>

        </header>


        {/* ERROR */}

        {errorMessage && (

          <div className="hotel-dashboard-error">
            {errorMessage}
          </div>

        )}


        {/* SIN HABITACIONES */}

        {rooms.length === 0 ? (

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
                  Primero agrega una habitación
                </h2>

                <p>
                  Necesitas al menos un tipo de habitación
                  activo antes de crear tarifas.
                </p>

              </div>

            </div>


            <div className="room-edit-actions">

              <button
                type="button"
                className="hotel-primary-button"
                onClick={() =>
                  navigate(
                    '/habitaciones'
                  )
                }
              >
                Ir a habitaciones
              </button>

            </div>

          </section>

        ) : (

          <>

            {/* SELECTOR HABITACIÓN */}

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
                    Habitación
                  </h2>

                  <p>
                    Selecciona el tipo de habitación
                    al que pertenecerá esta tarifa.
                  </p>

                </div>

              </div>


              <div className="room-form-grid">

                <label className="room-form-field room-form-field--full">

                  <span>
                    Tipo de habitación *
                  </span>


                  <select
                    value={
                      room?.id ||
                      ''
                    }
                    disabled={
                      saving
                    }
                    onChange={
                      handleRoomChange
                    }
                  >

                    <option value="">
                      Selecciona una habitación
                    </option>


                    {rooms.map(
                      (
                        availableRoom
                      ) => (

                        <option
                          key={
                            availableRoom.id
                          }
                          value={
                            availableRoom.id
                          }
                        >
                          {availableRoom.name}
                        </option>

                      )
                    )}

                  </select>

                </label>

              </div>

            </section>


            {/* FORM */}

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

                  {/* NOMBRE */}

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
                      disabled={
                        saving
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


                  {/* DURACIÓN */}

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
                        disabled={
                          saving
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


                  {/* PRECIO */}

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
                        disabled={
                          saving
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


              {/* SIDE */}

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
                      disabled={
                        saving
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
                        form.duration_hours ||
                        0
                      )
                    } h
                  </strong>

                  <p>
                    S/{' '}
                    {
                      Number(
                        form.base_price ||
                        0
                      )
                        .toFixed(
                          2
                        )
                    }
                  </p>

                </div>

              </aside>


              {/* ACCIONES */}

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
                    saving ||
                    !room?.id
                  }
                >

                  <Save
                    size={18}
                    strokeWidth={1.8}
                  />

                  {saving
                    ? 'Guardando...'
                    : 'Crear tarifa'
                  }

                </button>

              </div>

            </form>

          </>

        )}

      </main>

    </div>
  )
}


/* =========================================================
   SKELETON
   ========================================================= */

function RateCreateSkeleton() {
  const pulse = {
    background:
      'linear-gradient(90deg, #eef0f4 25%, #f8f8fa 50%, #eef0f4 75%)',

    backgroundSize:
      '200% 100%',

    borderRadius:
      '12px'
  }


  return (
    <div
      style={{
        minHeight:
          '100vh',

        background:
          '#f8f7fc',

        padding:
          '48px'
      }}
    >

      <div
        style={{
          maxWidth:
            '1100px',

          margin:
            '0 auto'
        }}
      >

        {/* BACK */}

        <div
          style={{
            ...pulse,

            width:
              '170px',

            height:
              '18px',

            marginBottom:
              '48px'
          }}
        />


        {/* HEADER */}

        <div
          style={{
            ...pulse,

            width:
              '90px',

            height:
              '12px',

            marginBottom:
              '14px'
          }}
        />

        <div
          style={{
            ...pulse,

            width:
              '280px',

            height:
              '34px',

            marginBottom:
              '14px'
          }}
        />

        <div
          style={{
            ...pulse,

            width:
              '420px',

            maxWidth:
              '80%',

            height:
              '16px',

            marginBottom:
              '42px'
          }}
        />


        {/* SELECTOR */}

        <div
          style={{
            background:
              '#fff',

            border:
              '1px solid #ece7f4',

            borderRadius:
              '24px',

            padding:
              '28px',

            marginBottom:
              '24px'
          }}
        >

          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                '16px',

              marginBottom:
                '28px'
            }}
          >

            <div
              style={{
                ...pulse,

                width:
                  '48px',

                height:
                  '48px',

                borderRadius:
                  '16px'
              }}
            />

            <div
              style={{
                flex:
                  1
              }}
            >

              <div
                style={{
                  ...pulse,

                  width:
                    '160px',

                  height:
                    '18px',

                  marginBottom:
                    '10px'
                }}
              />

              <div
                style={{
                  ...pulse,

                  width:
                    '310px',

                  maxWidth:
                    '70%',

                  height:
                    '13px'
                }}
              />

            </div>

          </div>


          <div
            style={{
              ...pulse,

              width:
                '100%',

              height:
                '52px'
            }}
          />

        </div>


        {/* FORM */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(0, 2fr) minmax(260px, 1fr)',

            gap:
              '24px'
          }}
        >

          <div
            style={{
              background:
                '#fff',

              border:
                '1px solid #ece7f4',

              borderRadius:
                '24px',

              padding:
                '28px'
            }}
          >

            <div
              style={{
                ...pulse,

                width:
                  '210px',

                height:
                  '22px',

                marginBottom:
                  '14px'
              }}
            />

            <div
              style={{
                ...pulse,

                width:
                  '330px',

                maxWidth:
                  '80%',

                height:
                  '14px',

                marginBottom:
                  '32px'
              }}
            />


            <div
              style={{
                ...pulse,

                width:
                  '100%',

                height:
                  '52px',

                marginBottom:
                  '20px'
              }}
            />


            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  '18px'
              }}
            >

              <div
                style={{
                  ...pulse,

                  height:
                    '52px'
                }}
              />

              <div
                style={{
                  ...pulse,

                  height:
                    '52px'
                }}
              />

            </div>

          </div>


          <div>

            <div
              style={{
                background:
                  '#fff',

                border:
                  '1px solid #ece7f4',

                borderRadius:
                  '24px',

                padding:
                  '28px',

                marginBottom:
                  '20px'
              }}
            >

              <div
                style={{
                  ...pulse,

                  width:
                    '130px',

                  height:
                    '18px',

                  marginBottom:
                    '14px'
                }}
              />

              <div
                style={{
                  ...pulse,

                  width:
                    '100%',

                  height:
                    '58px'
                }}
              />

            </div>


            <div
              style={{
                background:
                  '#fff',

                border:
                  '1px solid #ece7f4',

                borderRadius:
                  '24px',

                padding:
                  '28px'
              }}
            >

              <div
                style={{
                  ...pulse,

                  width:
                    '90px',

                  height:
                    '12px',

                  marginBottom:
                    '20px'
                }}
              />

              <div
                style={{
                  ...pulse,

                  width:
                    '72px',

                  height:
                    '32px',

                  margin:
                    '0 auto 16px'
                }}
              />

              <div
                style={{
                  ...pulse,

                  width:
                    '110px',

                  height:
                    '22px',

                  margin:
                    '0 auto'
                }}
              />

            </div>

          </div>

        </div>

      </div>


      <style>
        {`
          @keyframes wakiRateSkeletonPulse {
            0% {
              background-position: 200% 0;
            }

            100% {
              background-position: -200% 0;
            }
          }

          .hotel-rate-create-skeleton-item {
            animation:
              wakiRateSkeletonPulse
              1.5s
              ease-in-out
              infinite;
          }

          @media (max-width: 768px) {
            .hotel-rate-create-skeleton-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

    </div>
  )
}