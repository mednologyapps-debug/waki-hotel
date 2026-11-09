import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const version = '2026-10-27-hotels-v1'

export default function HotelLegalAcceptance({ hotelId, onAccepted }) {
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    supabase.rpc('hotel_affiliation_control', { p_hotel: hotelId }).then(({ data, error: issue }) => {
      if (!active) return
      const saved = !issue && Boolean(data?.accepted)
      setAccepted(saved)
      onAccepted(saved)
      setError(issue ? 'No pudimos consultar la aceptación. Puedes volver a marcar la casilla.' : '')
      setBusy(false)
    })
    return () => { active = false }
  }, [hotelId, onAccepted])

  async function accept(event) {
    if (!event.target.checked || busy || accepted) return
    setBusy(true)
    setSaving(true)
    setError('')
    const { error: issue } = await supabase.rpc('hotel_affiliation_control', {
      p_hotel: hotelId, p_action: 'accept', p_data: { version, accepted: true }
    })
    if (issue) {
      setError('No pudimos registrar tu aceptación. Vuelve a marcar la casilla.')
    } else {
      setAccepted(true)
      onAccepted(true)
    }
    setBusy(false)
    setSaving(false)
  }

  return (
    <section className="hotel-affiliation-legal" aria-busy={busy}>
      <h2>Términos para hoteles</h2>
      {accepted ? (
        <p className="hotel-affiliation-accepted" role="status">
          Aceptación registrada · <a href="https://wakipe.com/legal.html#hotels" target="_blank" rel="noreferrer">Consultar términos</a>
        </p>
      ) : (
        <label>
          <input type="checkbox" checked={saving} disabled={busy} onChange={accept} />
          Declaro que puedo representar al hotel y acepto los <a href="https://wakipe.com/legal.html#hotels" target="_blank" rel="noreferrer">términos para hoteles</a> y la <a href="https://wakipe.com/legal.html#privacy" target="_blank" rel="noreferrer">política de privacidad</a>.
        </label>
      )}
      {busy && <p role="status">{saving ? 'Registrando tu aceptación…' : 'Comprobando la aceptación…'}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
