import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const INITIAL = {
  bank_name: '', account_type: 'corriente', account_number: '',
  cci: '', account_holder: '', holder_ruc: ''
}
const BUCKET = 'hotel-affiliations'
const LIMIT = 10 * 1024 * 1024

export default function HotelAffiliationDossier({ hotelId, approved = false, onReadyChange }) {
  const [form, setForm] = useState(INITIAL)
  const [dossier, setDossier] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    if (!hotelId) return
    const { data, error: issue } = await supabase.rpc('hotel_dossier_control', { p_hotel: hotelId })
    if (issue) { setError('No se pudo obtener el expediente de afiliación.'); return }
    setDossier(data)
    setForm({
      bank_name: data.bank_name || '', account_type: data.account_type || 'corriente',
      account_number: data.account_number || '', cci: data.cci || '',
      account_holder: data.account_holder || '', holder_ruc: data.holder_ruc || ''
    })
    onReadyChange?.(Boolean(data.bank_ready && data.contract_ready))
  }
  useEffect(() => {
    if (hotelId) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  async function saveBank(event) {
    event.preventDefault()
    setBusy('bank'); setError(''); setMessage('')
    try {
      const { error: issue } = await supabase.rpc('hotel_dossier_control', {
        p_hotel: hotelId, p_action: 'save_bank', p_data: {
          ...form, account_number: form.account_number.replace(/\s/g,''),
          cci: form.cci.replace(/\s/g,''), holder_ruc: form.holder_ruc.replace(/\D/g,'')
        }
      })
      if (issue) throw issue
      await load()
      setMessage('Datos bancarios guardados. WAKI deberá verificar su titularidad.')
    } catch {
      setError('No fue posible guardar la cuenta. Revisa los campos y el CCI de 20 dígitos.')
    } finally { setBusy('') }
  }

  async function upload(file, kind) {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > LIMIT || file.size === 0) {
      setError('Adjunta un PDF válido de hasta 10 MB.')
      return
    }
    setBusy(kind); setError(''); setMessage('')
    try {
      const folder = kind === 'contract' ? 'contracts' : 'bank'
      const path = hotelId + '/' + folder + '/' + crypto.randomUUID() + '.pdf'
      const { error: uploadIssue } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: 'application/pdf', upsert: false, cacheControl: '0'
      })
      if (uploadIssue) throw uploadIssue
      const { error: attachIssue } = await supabase.rpc('hotel_dossier_control', {
        p_hotel: hotelId,
        p_action: kind === 'contract' ? 'attach_contract' : 'attach_bank_document',
        p_data: { path }
      })
      if (attachIssue) throw attachIssue
      await load()
      setMessage(kind === 'contract'
        ? 'Contrato firmado recibido. WAKI revisará el documento.'
        : 'Constancia bancaria recibida. WAKI revisará el documento.')
    } catch {
      setError('No se pudo registrar el PDF. Vuelve a intentarlo sin reemplazar archivos existentes.')
    } finally { setBusy('') }
  }

  async function view(path) {
    const tab = window.open('about:blank', '_blank')
    const { data, error: issue } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
    if (issue || !data?.signedUrl) {
      tab?.close()
      setError('No se pudo abrir el archivo privado.')
      return
    }
    if (tab) tab.location.replace(data.signedUrl)
    else window.location.assign(data.signedUrl)
  }

  if (!hotelId) return null
  const readonly = approved
  return (
    <section className="hotel-review-submit" style={{ display: 'block', marginTop: 20 }}>
      <div className="hotel-review-submit__copy">
        <span>Expediente comercial y bancario</span>
        <h3>Contrato firmado y cuenta de abono</h3>
        <p>Este expediente es privado: solo tu administrador de hotel y el equipo autorizado de WAKI pueden consultarlo. No se muestra a huéspedes ni al personal de recepción.</p>
      </div>
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
      {message && <p role="status" style={{ color: '#16764a' }}>{message}</p>}
      {dossier && <p>
        Contrato: <strong>{dossier.contract_ready ? (dossier.contract_verified ? 'Verificado' : 'Por verificar') : 'Pendiente'}</strong>
        {' · '}Cuenta: <strong>{dossier.bank_ready ? (dossier.bank_verified ? 'Verificada' : 'Por verificar') : 'Pendiente'}</strong>
      </p>}
      <form onSubmit={saveBank} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
        <label>Banco *
          <input required disabled={readonly || Boolean(busy)} maxLength={80} value={form.bank_name}
            onChange={e => setForm(v => ({ ...v, bank_name: e.target.value }))} placeholder="Nombre del banco" />
        </label>
        <label>Tipo de cuenta *
          <select disabled={readonly || Boolean(busy)} value={form.account_type}
            onChange={e => setForm(v => ({ ...v, account_type: e.target.value }))}>
            <option value="corriente">Corriente</option><option value="ahorros">Ahorros</option>
          </select>
        </label>
        <label>Número de cuenta *
          <input required disabled={readonly || Boolean(busy)} inputMode="numeric" pattern="[0-9]{6,30}" value={form.account_number}
            onChange={e => setForm(v => ({ ...v, account_number: e.target.value.replace(/\D/g,'') }))} />
        </label>
        <label>CCI (20 dígitos) *
          <input required disabled={readonly || Boolean(busy)} inputMode="numeric" maxLength={20} pattern="[0-9]{20}"
            value={form.cci} onChange={e => setForm(v => ({ ...v, cci: e.target.value.replace(/\D/g,'') }))} />
        </label>
        <label>Titular de la cuenta *
          <input required disabled={readonly || Boolean(busy)} maxLength={150} value={form.account_holder}
            onChange={e => setForm(v => ({ ...v, account_holder: e.target.value }))} />
        </label>
        <label>RUC del titular *
          <input required disabled={readonly || Boolean(busy)} inputMode="numeric" pattern="[0-9]{11}"
            maxLength={11} value={form.holder_ruc}
            onChange={e => setForm(v => ({ ...v, holder_ruc: e.target.value.replace(/\D/g,'') }))} />
        </label>
        {!readonly && <button className="hotel-setup-primary-button" type="submit" disabled={Boolean(busy)}>
          {busy === 'bank' ? 'Guardando...' : 'Guardar datos bancarios'}
        </button>}
      </form>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
        <label>Contrato firmado en PDF * (hasta 10 MB)
          {!readonly && <input type="file" accept="application/pdf,.pdf" disabled={Boolean(busy)}
            onChange={e => { void upload(e.target.files?.[0], 'contract'); e.target.value = '' }} />}
          {dossier?.signed_contract_path && <button type="button" onClick={() => void view(dossier.signed_contract_path)}>Ver contrato cargado</button>}
        </label>
        <label>Constancia bancaria en PDF (recomendada)
          {!readonly && <input type="file" accept="application/pdf,.pdf" disabled={Boolean(busy)}
            onChange={e => { void upload(e.target.files?.[0], 'bank'); e.target.value = '' }} />}
          {dossier?.bank_document_path && <button type="button" onClick={() => void view(dossier.bank_document_path)}>Ver constancia cargada</button>}
        </label>
      </div>
      {!readonly && <p style={{ marginTop: 10, fontSize: 13 }}>
        Para enviar el hotel a revisión se requieren los datos bancarios y el contrato firmado. El administrador global debe verificar ambos antes de aprobar.
      </p>}
    </section>
  )
}
