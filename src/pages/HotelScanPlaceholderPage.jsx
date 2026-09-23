import {
  QrCode,
  LogOut
} from 'lucide-react'

import {
  supabase
} from '../lib/supabase'


export default function HotelScanPlaceholderPage() {
  return (
    <div className="hotel-scan-placeholder">

      <section className="hotel-scan-placeholder__card">

        <div className="hotel-scan-placeholder__icon">

          <QrCode
            size={31}
            strokeWidth={1.7}
          />

        </div>

        <span className="hotel-dashboard-eyebrow">
          WAKI HOTEL
        </span>

        <h1>
          Escáner QR
        </h1>

        <p>
          Tu acceso está configurado
          correctamente. En el siguiente
          módulo activaremos aquí el
          escáner exclusivo para recepción
          y personal de acceso.
        </p>

        <button
          type="button"
          className="hotel-secondary-button"
          onClick={async () => {
            await supabase
              .auth
              .signOut()

            window.location
              .replace(
                '/login'
              )
          }}
        >

          <LogOut
            size={18}
            strokeWidth={1.8}
          />

          Cerrar sesión

        </button>

      </section>

    </div>
  )
}
