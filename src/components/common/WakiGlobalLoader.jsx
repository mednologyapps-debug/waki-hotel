import wakiLoader1
  from '../../assets/loader/waki-loader-1.png'

import wakiLoader2
  from '../../assets/loader/waki-loader-2.png'

import wakiLoader3
  from '../../assets/loader/waki-loader-3.png'

import wakiLoader4
  from '../../assets/loader/waki-loader-4.png'


export default function WakiGlobalLoader({
  title = 'Preparando tu experiencia WAKI...',
  subtitle = 'Todo estará listo en un momento',
  fullScreen = true
}) {
  return (
    <div
      className={
        fullScreen
          ? 'waki-global-loader waki-global-loader--fullscreen'
          : 'waki-global-loader'
      }
      role="status"
      aria-live="polite"
      aria-label={title}
    >

      <div className="waki-global-loader__content">

        {/* ================================================
            ILUSTRACIÓN
            ================================================ */}

        <div className="waki-global-loader__visual">

          {/* halo trasero */}

          <div className="waki-global-loader__halo">

            <div className="waki-global-loader__ring" />

          </div>


          {/* frames */}

          <div className="waki-global-loader__frames">

            <img
              src={wakiLoader1}
              alt=""
              className="
                waki-global-loader__frame
                waki-global-loader__frame--1
              "
              aria-hidden="true"
            />

            <img
              src={wakiLoader2}
              alt=""
              className="
                waki-global-loader__frame
                waki-global-loader__frame--2
              "
              aria-hidden="true"
            />

            <img
              src={wakiLoader3}
              alt=""
              className="
                waki-global-loader__frame
                waki-global-loader__frame--3
              "
              aria-hidden="true"
            />

            <img
              src={wakiLoader4}
              alt=""
              className="
                waki-global-loader__frame
                waki-global-loader__frame--4
              "
              aria-hidden="true"
            />

          </div>


          {/* destellos */}

          <span className="waki-loader-sparkle waki-loader-sparkle--1">
            ✦
          </span>

          <span className="waki-loader-sparkle waki-loader-sparkle--2">
            ✦
          </span>

          <span className="waki-loader-sparkle waki-loader-sparkle--3">
            ✦
          </span>

        </div>


        {/* ================================================
            TEXTO
            ================================================ */}

        <div className="waki-global-loader__copy">

          <strong>
            {title}
          </strong>

          {subtitle && (

            <p>
              {subtitle}
            </p>

          )}

        </div>


        {/* ================================================
            PROGRESO VISUAL
            ================================================ */}

        <div className="waki-global-loader__progress">

          <span />

        </div>

      </div>

    </div>
  )
}