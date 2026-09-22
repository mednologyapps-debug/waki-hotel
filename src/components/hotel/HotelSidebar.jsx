import {
  BedDouble,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Headphones,
  LayoutDashboard,
  LogOut,
  UsersRound
} from 'lucide-react'

import {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import {
  supabase
} from '../../lib/supabase'

import wakiLogo
  from '../../assets/waki_logo_blanco.png'

import wakiSidebarBackground
  from '../../assets/waki_sidebar_background_hd.png'


const menuItems = [
  {
    key: 'resumen',
    label: 'Resumen',
    icon: LayoutDashboard,
    route: '/dashboard',
    disabled: false
  },
  {
    key: 'hotel',
    label: 'Mi hotel',
    icon: Building2,
    route: '/mi-hotel',
    disabled: false
  },
  {
    key: 'reservas',
    label: 'Reservas',
    icon: CalendarDays,
    route: '/reservas',
  },
  {
    key: 'habitaciones',
    label: 'Habitaciones',
    icon: BedDouble,
    route: '/habitaciones',
    disabled: false
  },
  {
    key: 'tarifas',
    label: 'Tarifas',
    icon: CircleDollarSign,
    route: '/tarifas',
    disabled: false
  },
  {
    key: 'equipo',
    label: 'Equipo',
    icon: UsersRound,
    route: '/equipo',
    disabled: true
  }
]


export default function HotelSidebar({
  activeKey = 'resumen',
  hotelName = 'Mi hotel',
  hotelLocation = 'Lima, Perú'
}) {
  const navigate =
    useNavigate()

  const [hotelImage, setHotelImage] =
    useState(null)


  useEffect(() => {
    loadHotelImage()
  }, [])


  async function loadHotelImage() {
    try {
      const {
        data: {
          session
        }
      } =
        await supabase
          .auth
          .getSession()


      if (!session?.user) {
        return
      }


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


      if (
        staffError ||
        !staffData?.hotel_id
      ) {
        return
      }


      const {
        data: roomsData,
        error: roomsError
      } =
        await supabase
          .from('room_types')
          .select(`
            id,
            display_order,

            room_type_images (
              id,
              image_url,
              is_cover,
              display_order
            )
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


      if (roomsError) {
        throw roomsError
      }


      const images =
        (roomsData || [])
          .flatMap(
            (room) =>
              (
                room.room_type_images ||
                []
              ).map(
                (image) => ({
                  ...image,

                  roomDisplayOrder:
                    Number(
                      room.display_order || 0
                    )
                })
              )
          )


      images.sort(
        (a, b) => {

          const coverDifference =
            Number(
              Boolean(
                b.is_cover
              )
            ) -
            Number(
              Boolean(
                a.is_cover
              )
            )


          if (
            coverDifference !== 0
          ) {
            return coverDifference
          }


          const roomDifference =
            a.roomDisplayOrder -
            b.roomDisplayOrder


          if (
            roomDifference !== 0
          ) {
            return roomDifference
          }


          return (
            Number(
              a.display_order || 0
            ) -
            Number(
              b.display_order || 0
            )
          )
        }
      )


      setHotelImage(
        images[0]
          ?.image_url ||
        null
      )

    } catch (error) {
      console.error(
        'Error cargando imagen del hotel:',
        error
      )
    }
  }


  async function handleLogout() {
    await supabase
      .auth
      .signOut()


    navigate(
      '/login',
      {
        replace: true
      }
    )
  }


  return (
    <aside
      className="hotel-sidebar hotel-sidebar--reference"
      style={{
        '--waki-sidebar-background':
          `url(${wakiSidebarBackground})`
      }}
    >

      <div className="hotel-sidebar-ref__top">


        {/* =====================================================
            LOGO
            ===================================================== */}

        <div className="hotel-sidebar-ref__brand">

          <img
            src={wakiLogo}
            alt="WAKI"
          />

          <span>
            HOTEL
          </span>

        </div>


        {/* =====================================================
            HOTEL ACTUAL
            ===================================================== */}

        <div className="hotel-sidebar-ref__hotel">

          <div className="hotel-sidebar-ref__hotel-image">

            {hotelImage ? (

              <img
                src={hotelImage}
                alt={hotelName}
              />

            ) : (

              <Building2
                size={23}
                strokeWidth={1.7}
              />

            )}

          </div>


          <div className="hotel-sidebar-ref__hotel-copy">

            <strong>
              {hotelName}
            </strong>

            <span>
              {hotelLocation}
            </span>

          </div>

        </div>


        {/* =====================================================
            MENÚ
            ===================================================== */}

        <nav className="hotel-sidebar-ref__menu">

          {menuItems.map(
            (item) => {

              const Icon =
                item.icon


              return (
                <button
                  key={
                    item.key
                  }
                  type="button"
                  disabled={
                    item.disabled
                  }
                  className={[
                    'hotel-sidebar-ref__item',

                    activeKey ===
                    item.key
                      ? 'is-active'
                      : '',

                    item.disabled
                      ? 'is-disabled'
                      : ''
                  ].join(' ')}
                  onClick={() => {

                    if (
                      item.disabled
                    ) {
                      return
                    }


                    navigate(
                      item.route
                    )
                  }}
                >

                  <Icon
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>
                    {item.label}
                  </span>

                </button>
              )
            }
          )}

        </nav>


        {/* =====================================================
            AYUDA
            AHORA VA JUSTO DEBAJO DE EQUIPO
            ===================================================== */}

        <div className="hotel-sidebar-ref__help">

          <div className="hotel-sidebar-ref__help-icon">

            <Headphones
              size={21}
              strokeWidth={1.7}
            />

          </div>


          <div className="hotel-sidebar-ref__help-copy">

            <strong>
              ¿Necesitas ayuda?
            </strong>

            <p>
              Nuestro equipo está listo
              para ayudarte
            </p>


            <button
              type="button"
            >
              Contactar soporte
            </button>

          </div>

        </div>

      </div>


      {/* =====================================================
          PARTE INFERIOR
          SOLO CERRAR SESIÓN
          ===================================================== */}

      <div className="hotel-sidebar-ref__bottom">

        <button
          type="button"
          className="hotel-sidebar-ref__logout"
          onClick={
            handleLogout
          }
        >

          <LogOut
            size={20}
            strokeWidth={1.7}
          />

          <span>
            Cerrar sesión
          </span>

        </button>

      </div>

    </aside>
  )
}