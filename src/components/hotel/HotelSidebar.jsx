import {
  BedDouble,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  UsersRound,
  X
} from 'lucide-react'

import {
  useEffect,
  useMemo,
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
    roles: [
      'admin'
    ]
  },
  {
    key: 'hotel',
    label: 'Mi hotel',
    icon: Building2,
    route: '/mi-hotel',
    roles: [
      'admin'
    ]
  },
  {
    key: 'reservas',
    label: 'Reservas',
    icon: CalendarDays,
    route: '/reservas',
    roles: [
      'admin',
      'reception'
    ]
  },
  {
    key: 'habitaciones',
    label: 'Habitaciones',
    icon: BedDouble,
    route: '/habitaciones',
    roles: [
      'admin'
    ]
  },
  {
    key: 'tarifas',
    label: 'Tarifas',
    icon: CircleDollarSign,
    route: '/tarifas',
    roles: [
      'admin'
    ]
  },
  {
    key: 'equipo',
    label: 'Equipo',
    icon: UsersRound,
    route: '/equipo',
    roles: [
      'admin'
    ]
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

  const [staffRole, setStaffRole] =
    useState('admin')

  const [mobileOpen, setMobileOpen] =
    useState(false)


  const visibleMenuItems =
    useMemo(
      () =>
        menuItems.filter(
          (item) =>
            item.roles.includes(
              staffRole
            )
        ),
      [staffRole]
    )


  useEffect(() => {
    loadSidebarData()
  }, [])


  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow =
        ''

      return undefined
    }


    document.body.style.overflow =
      'hidden'


    function handleEscape(
      event
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        setMobileOpen(
          false
        )
      }
    }


    window.addEventListener(
      'keydown',
      handleEscape
    )


    return () => {
      document.body.style.overflow =
        ''

      window.removeEventListener(
        'keydown',
        handleEscape
      )
    }
  }, [mobileOpen])


  async function loadSidebarData() {
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
        data: accessData,
        error: accessError
      } =
        await supabase
          .rpc(
            'get_my_hotel_access'
          )


      if (accessError) {
        throw accessError
      }


      const access =
        Array.isArray(
          accessData
        )
          ? accessData[0]
          : null


      if (!access?.hotel_id) {
        return
      }


      setStaffRole(
        access.staff_role ||
        'admin'
      )


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
            access.hotel_id
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
                      room.display_order ||
                      0
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
              a.display_order ||
              0
            ) -
            Number(
              b.display_order ||
              0
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
        'Error cargando sidebar:',
        error
      )
    }
  }


  function goTo(
    route
  ) {
    setMobileOpen(
      false
    )

    navigate(
      route
    )
  }


  async function handleLogout() {
    setMobileOpen(
      false
    )

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
    <>

      <header className="hotel-mobile-nav">

        <div className="hotel-mobile-nav__brand">

          <img
            src={wakiLogo}
            alt="WAKI"
          />

          <span>
            HOTEL
          </span>

        </div>


        <button
          type="button"
          className="hotel-mobile-nav__toggle"
          aria-label={
            mobileOpen
              ? 'Cerrar menú'
              : 'Abrir menú'
          }
          aria-expanded={
            mobileOpen
          }
          onClick={() =>
            setMobileOpen(
              (current) =>
                !current
            )
          }
        >

          {mobileOpen ? (

            <X
              size={23}
              strokeWidth={1.9}
            />

          ) : (

            <Menu
              size={24}
              strokeWidth={1.9}
            />

          )}

        </button>

      </header>


      <button
        type="button"
        className={[
          'hotel-mobile-drawer-overlay',
          mobileOpen
            ? 'is-open'
            : ''
        ].join(' ')}
        aria-label="Cerrar menú"
        onClick={() =>
          setMobileOpen(
            false
          )
        }
      />


      <aside
        className={[
          'hotel-sidebar',
          'hotel-sidebar--reference',
          mobileOpen
            ? 'is-mobile-open'
            : ''
        ].join(' ')}
        style={{
          '--waki-sidebar-background':
            `url(${wakiSidebarBackground})`
        }}
      >

        <div className="hotel-sidebar-ref__top">

          <div className="hotel-sidebar-ref__brand">

            <img
              src={wakiLogo}
              alt="WAKI"
            />

            <span>
              HOTEL
            </span>

          </div>


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


          <nav className="hotel-sidebar-ref__menu">

            {visibleMenuItems.map(
              (item) => {

                const Icon =
                  item.icon


                return (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    className={[
                      'hotel-sidebar-ref__item',

                      activeKey ===
                      item.key
                        ? 'is-active'
                        : ''
                    ].join(' ')}
                    onClick={() =>
                      goTo(
                        item.route
                      )
                    }
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

    </>
  )
}
