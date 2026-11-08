import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock3, ShieldAlert, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HotelSidebarContents } from './HotelSidebar'
import { HotelPortalLayoutContext } from './HotelPortalLayoutContext'
import HotelPageSkeleton from '../common/HotelPageSkeleton'

const statusMeta = {
  approved: { text: 'Aprobado', icon: CheckCircle2 },
  pending_review: { text: 'En revisión', icon: Clock3 },
  draft: { text: 'En configuración', icon: Clock3 },
  rejected: { text: 'Con observaciones', icon: ShieldAlert },
  suspended: { text: 'Suspendido', icon: ShieldAlert }
}

function activeMenu(path) {
  if (path.startsWith('/mi-hotel')) return 'hotel'
  if (path.startsWith('/habitaciones')) return 'habitaciones'
  if (path.startsWith('/tarifas')) return 'tarifas'
  if (path.startsWith('/equipo')) return 'equipo'
  if (path.startsWith('/recepcion') || path.startsWith('/reservas') || path.startsWith('/disponibilidad')) return 'recepcion'
  if (path.startsWith('/scan')) return 'scanner'
  return 'resumen'
}

export default function HotelPortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [hotel, setHotel] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setSignedIn(Boolean(session?.user))
      setSessionChecked(true)
      if (!session?.user) return
      const { data: access } = await supabase.from('hotel_staff')
        .select('hotel_id')
        .eq('user_id', session.user.id).eq('is_active', true)
        .limit(1).maybeSingle()
      if (!active || !access?.hotel_id) return
      const { data: details } = await supabase.from('hotels')
        .select('id,name,district,province,approval_status')
        .eq('id', access.hotel_id).maybeSingle()
      if (active && details) setHotel(details)
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!hotel?.id) return undefined
    const channel = supabase.channel('waki-shell-hotel-'+hotel.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hotels', filter: 'id=eq.' + hotel.id },
        ({ new: updated }) => setHotel(current => current?.id === updated.id ? { ...current, ...updated } : current))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [hotel?.id])

  if (!sessionChecked) return <HotelPageSkeleton title="Abriendo Portal Hotel" />
  if (!signedIn) return <Outlet />

  const status = statusMeta[hotel?.approval_status]
  const StatusIcon = status?.icon

  return (
    <HotelPortalLayoutContext.Provider value={{ embedded: true, approvalStatus: hotel?.approval_status ?? null }}>
      <div className="hotel-portal waki-hotel-app-shell">
        <HotelSidebarContents
          activeKey={activeMenu(location.pathname)}
          hotelName={hotel?.name || 'Mi hotel'}
          hotelLocation={[hotel?.district, hotel?.province].filter(Boolean).join(', ') || 'Lima, Perú'}
        />
        <div className="waki-hotel-app-shell__center">
          <header className="waki-hotel-app-shell__bar">
            <div className="waki-hotel-app-shell__heading">
              <strong>{hotel?.name || 'WAKI Hotel'}</strong>
              <span>Panel de gestión</span>
            </div>
            {status && (
              <button type="button" className={'waki-hotel-app-shell__status is-'+hotel.approval_status}
                onClick={() => navigate('/mi-hotel/revision')}
                title="Consultar el estado y el expediente del hotel">
                <StatusIcon size={15} />
                {status.text}
                <ChevronRight size={14} />
              </button>
            )}
          </header>
          <section className="waki-hotel-app-shell__viewport" aria-label="Contenido del portal">
            <Outlet />
          </section>
        </div>
      </div>
    </HotelPortalLayoutContext.Provider>
  )
}
