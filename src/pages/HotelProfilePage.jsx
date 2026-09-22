import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Save
} from 'lucide-react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import HotelSidebar
  from '../components/hotel/HotelSidebar'

import HotelOnboardingGuide
  from '../components/hotel/HotelOnboardingGuide'

import {
  supabase
} from '../lib/supabase'


export default function HotelProfilePage() {
  const navigate =
    useNavigate()


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

  const [hotelId, setHotelId] =
    useState(null)

  const [hotel, setHotel] =
    useState(null)


  const [form, setForm] =
    useState({
      name: '',
      description: '',
      address: '',
      district: '',
      province: '',
      department: '',
      phone: '',
      contact_email: '',
      whatsapp: ''
    })


  useEffect(() => {
    loadHotel()
  }, [])


  /* =========================================================
     CARGAR HOTEL
     ========================================================= */

  async function loadHotel() {
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


      setHotelId(
        staffData.hotel_id
      )


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
            description,
            address,
            district,
            province,
            department,
            country_code,
            phone,
            contact_email,
            whatsapp,
            approval_status,
            is_active,
            rejection_reason,
            submitted_at,
            reviewed_at,
            approved_at
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
          'No encontramos la información de tu hotel.'
        )
      }


      setHotel(
        hotelData
      )


      /* =====================================================
         FORMULARIO
         ===================================================== */

      setForm({
        name:
          hotelData.name ||
          '',

        description:
          hotelData.description ||
          '',

        address:
          hotelData.address ||
          '',

        district:
          hotelData.district ||
          '',

        province:
          hotelData.province ||
          '',

        department:
          hotelData.department ||
          '',

        phone:
          hotelData.phone ||
          '',

        contact_email:
          hotelData.contact_email ||
          '',

        whatsapp:
          hotelData.whatsapp ||
          ''
      })

    } catch (error) {
      console.error(
        'Error cargando hotel:',
        error
      )


      setErrorMessage(
        error?.message ||
        'No pudimos cargar la información del hotel.'
      )

    } finally {
      setLoading(false)
    }
  }


  /* =========================================================
     ACTUALIZAR CAMPO
     ========================================================= */

  function updateField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value
      })
    )
  }


  /* =========================================================
     VALIDACIÓN
     ========================================================= */

  function validateForm() {
    if (
      !form.name.trim()
    ) {
      throw new Error(
        'Ingresa el nombre del hotel.'
      )
    }


    if (
      !form.description.trim()
    ) {
      throw new Error(
        'Ingresa una descripción del hotel.'
      )
    }


    if (
      !form.address.trim()
    ) {
      throw new Error(
        'Ingresa la dirección del hotel.'
      )
    }


    if (
      !form.district.trim()
    ) {
      throw new Error(
        'Ingresa el distrito.'
      )
    }


    if (
      !form.province.trim()
    ) {
      throw new Error(
        'Ingresa la provincia.'
      )
    }


    if (
      !form.department.trim()
    ) {
      throw new Error(
        'Ingresa el departamento.'
      )
    }


    if (
      !form.phone.trim()
    ) {
      throw new Error(
        'Ingresa un teléfono de contacto.'
      )
    }


    if (
      !form.contact_email.trim()
    ) {
      throw new Error(
        'Ingresa un correo de contacto.'
      )
    }
  }


  /* =========================================================
     PAYLOAD
     ========================================================= */

  function buildPayload() {
    return {
      name:
        form.name.trim(),

      description:
        form.description.trim() ||
        null,

      address:
        form.address.trim(),

      district:
        form.district.trim(),

      province:
        form.province.trim(),

      department:
        form.department.trim(),

      phone:
        form.phone.trim(),

      contact_email:
        form.contact_email.trim() ||
        null,

      whatsapp:
        form.whatsapp.trim() ||
        null
    }
  }


  /* =========================================================
     GUARDAR
     ========================================================= */

  async function saveHotel() {
    if (!hotelId) {
      throw new Error(
        'No pudimos identificar tu hotel.'
      )
    }


    validateForm()


    const {
      data: updatedHotel,
      error
    } =
      await supabase
        .from('hotels')
        .update(
          buildPayload()
        )
        .eq(
          'id',
          hotelId
        )
        .select(`
          id,
          name,
          description,
          address,
          district,
          province,
          department,
          country_code,
          phone,
          contact_email,
          whatsapp,
          approval_status,
          is_active,
          rejection_reason,
          submitted_at,
          reviewed_at,
          approved_at
        `)
        .maybeSingle()


    if (error) {
      throw error
    }


    if (!updatedHotel) {
      throw new Error(
        'No pudimos confirmar los cambios.'
      )
    }


    setHotel(
      updatedHotel
    )


    return updatedHotel
  }


  /* =========================================================
     GUARDAR CAMBIOS
     ========================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault()


    try {
      setSaving(true)

      setErrorMessage('')
      setSuccessMessage('')


      await saveHotel()


      setSuccessMessage(
        'La información del hotel se guardó correctamente.'
      )

    } catch (error) {
      console.error(
        'Error guardando hotel:',
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


  /* =========================================================
     GUARDAR Y CONTINUAR
     ========================================================= */

  async function handleSaveAndContinue() {
    try {
      setSaving(true)

      setErrorMessage('')
      setSuccessMessage('')


      await saveHotel()


      navigate(
        '/habitaciones'
      )

    } catch (error) {
      console.error(
        'Error guardando hotel:',
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
     ONBOARDING ACTIVO
     ========================================================= */

  const onboardingIsActive =
    [
      'draft',
      'rejected'
    ]
      .includes(
        hotel?.approval_status
      )


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
  return (
    <WakiGlobalLoader
      title="Preparando tu hotel..."
      subtitle="Cargando la información de tu establecimiento"
    />
  )
}


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="hotel-portal">


      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <HotelSidebar
        activeKey="hotel"
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


      {/* =====================================================
          CONTENIDO
          ===================================================== */}

      <main className="hotel-dashboard hotel-setup-page">


        {/* =================================================
            CABECERA
            ================================================= */}

        <header className="hotel-setup-header">

          <div>

            <h1>
              Configura tu hotel
            </h1>

            <p>
              Te guiamos paso a paso para que tu hotel
              esté listo en WAKI. Es rápido y sencillo.
            </p>

          </div>


          <div className="hotel-setup-user">

            <div className="hotel-setup-user__avatar">

              {profile
                ?.full_name
                ?.charAt(0)
                ?.toUpperCase() ||
                'E'
              }

            </div>


            <div>

              <strong>

                {profile?.full_name ||
                  'Equipo WAKI'
                }

              </strong>

              <span>

                {hotel?.name ||
                  'Mi hotel'
                }

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

            {successMessage}

          </div>

        )}


        {/* =================================================
            ONBOARDING SUPERIOR
            ================================================= */}

        <HotelOnboardingGuide />


        {/* =================================================
            FORMULARIO PRINCIPAL
            ================================================= */}

        <form
          className="hotel-setup-form-card"
          onSubmit={
            handleSubmit
          }
        >


          {/* ===============================================
              ENCABEZADO FORMULARIO
              =============================================== */}

          <div className="hotel-setup-form-heading">

            <div className="hotel-setup-form-heading__icon">

              <Building2
                size={22}
                strokeWidth={1.8}
              />

            </div>


            <div>

              <h2>
                Información del hotel
              </h2>

              <p>
                Cuéntanos sobre tu hotel. Esta información
                será visible para los huéspedes en WAKI.
              </p>

            </div>

          </div>


          {/* ===============================================
              CAMPOS
              =============================================== */}

          <div className="hotel-setup-form-grid">


            {/* =============================================
                NOMBRE
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Nombre del hotel
                <em>*</em>
              </span>


              <div className="hotel-setup-input-icon">

                <Building2
                  size={17}
                  strokeWidth={1.7}
                />


                <input
                  type="text"
                  value={
                    form.name
                  }
                  placeholder="Ej. Hotel Vista Andina"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'name',
                      event.target.value
                    )
                  }
                />

              </div>


              <small>
                Así aparecerá en WAKI.
              </small>

            </label>


            {/* =============================================
                EMAIL
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Correo de contacto
                <em>*</em>
              </span>


              <div className="hotel-setup-input-icon">

                <Mail
                  size={17}
                  strokeWidth={1.7}
                />


                <input
                  type="email"
                  value={
                    form.contact_email
                  }
                  placeholder="reservas@hotel.com"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'contact_email',
                      event.target.value
                    )
                  }
                />

              </div>


              <small>
                Usaremos este correo para enviarte notificaciones.
              </small>

            </label>


            {/* =============================================
                DESCRIPCIÓN
                ============================================= */}

            <label className="hotel-setup-field hotel-setup-field--full">

              <span>
                Descripción del hotel
                <em>*</em>
              </span>


              <div className="hotel-setup-textarea-wrap">

                <textarea
                  rows="4"
                  maxLength="500"
                  value={
                    form.description
                  }
                  placeholder="Cuéntanos qué hace especial a tu hotel..."
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'description',
                      event.target.value
                    )
                  }
                />


                <span>

                  {
                    form.description
                      .length
                  }

                  /500

                </span>

              </div>


              <small>
                Una buena descripción ayuda a que más huéspedes te elijan.
              </small>

            </label>


            {/* =============================================
                DIRECCIÓN
                ============================================= */}

            <label className="hotel-setup-field hotel-setup-field--full">

              <span>
                Dirección
                <em>*</em>
              </span>


              <div className="hotel-setup-input-icon">

                <MapPin
                  size={17}
                  strokeWidth={1.7}
                />


                <input
                  type="text"
                  value={
                    form.address
                  }
                  placeholder="Av. Principal 123, Urb. Miraflores, Lima"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'address',
                      event.target.value
                    )
                  }
                />

              </div>


              <small>
                Incluye calle, número y referencia si es necesario.
              </small>

            </label>


            {/* =============================================
                DISTRITO
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Distrito
                <em>*</em>
              </span>


              <div className="hotel-setup-input-icon">

                <MapPin
                  size={16}
                  strokeWidth={1.7}
                />


                <input
                  type="text"
                  value={
                    form.district
                  }
                  placeholder="Miraflores"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'district',
                      event.target.value
                    )
                  }
                />

              </div>

            </label>


            {/* =============================================
                PROVINCIA
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Provincia
                <em>*</em>
              </span>


              <input
                type="text"
                value={
                  form.province
                }
                placeholder="Lima"
                onChange={(
                  event
                ) =>
                  updateField(
                    'province',
                    event.target.value
                  )
                }
              />

            </label>


            {/* =============================================
                DEPARTAMENTO
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Departamento
                <em>*</em>
              </span>


              <input
                type="text"
                value={
                  form.department
                }
                placeholder="Lima"
                onChange={(
                  event
                ) =>
                  updateField(
                    'department',
                    event.target.value
                  )
                }
              />

            </label>


            {/* =============================================
                TELÉFONO
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                Teléfono
                <em>*</em>
              </span>


              <div className="hotel-setup-input-icon">

                <Phone
                  size={17}
                  strokeWidth={1.7}
                />


                <input
                  type="text"
                  value={
                    form.phone
                  }
                  placeholder="+51 1 234 5678"
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'phone',
                      event.target.value
                    )
                  }
                />

              </div>


              <small>
                Número de contacto principal del hotel.
              </small>

            </label>


            {/* =============================================
                WHATSAPP
                ============================================= */}

            <label className="hotel-setup-field">

              <span>
                WhatsApp
              </span>


              <input
                type="text"
                value={
                  form.whatsapp
                }
                placeholder="+51 987 654 321"
                onChange={(
                  event
                ) =>
                  updateField(
                    'whatsapp',
                    event.target.value
                  )
                }
              />


              <small>
                Opcional. Para una comunicación más rápida con los huéspedes.
              </small>

            </label>

          </div>


          {/* ===============================================
              FOOTER FORMULARIO
              =============================================== */}

          <div className="hotel-setup-form-footer">

            <span>

              Los campos marcados con

              <em> *</em>

              {' '}

              son obligatorios.

            </span>


            <div>


              {/* ===========================================
                  GUARDAR
                  =========================================== */}

              <button
                type="submit"
                className="hotel-setup-secondary-button"
                disabled={
                  saving
                }
              >

                <Save
                  size={17}
                  strokeWidth={1.8}
                />

                {saving
                  ? 'Guardando...'
                  : 'Guardar cambios'
                }

              </button>


              {/* ===========================================
                  CONTINUAR ONBOARDING
                  =========================================== */}

              {onboardingIsActive && (

                <button
                  type="button"
                  className="hotel-setup-primary-button"
                  disabled={
                    saving
                  }
                  onClick={
                    handleSaveAndContinue
                  }
                >

                  {saving
                    ? 'Guardando...'
                    : 'Guardar y continuar'
                  }

                </button>

              )}

            </div>

          </div>

        </form>

      </main>

    </div>
  )
}