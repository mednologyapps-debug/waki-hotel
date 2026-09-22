import {
  useEffect,
  useState
} from 'react'

import WakiGlobalLoader
  from '../components/common/WakiGlobalLoader'


export default function WakiLoaderDemoPage() {
  const [loopKey, setLoopKey] =
    useState(0)


  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          setLoopKey(
            (current) =>
              current + 1
          )
        },
        5000
      )


    return () => {
      window.clearTimeout(
        timeout
      )
    }
  }, [loopKey])


  return (
    <div
      key={loopKey}
      className="waki-loader-video-page"
    >

      <WakiGlobalLoader
        title="Preparando tu experiencia WAKI..."
        subtitle="Todo estará listo en un momento"
        fullScreen
      />

    </div>
  )
}