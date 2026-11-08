import { Building2, CheckCircle2, Clock3, CreditCard, FileText, UploadCloud, ExternalLink } from 'lucide-react'
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
  const contractStatus = !dossier?.contract_ready ? 'Pendiente' : dossier?.contract_verified ? 'Verificado' : 'Por verificar'
  const bankStatus = !dossier?.bank_ready ? 'Pendiente' : dossier?.bank_verified ? 'Verificada' : 'Por verificar'
  const contractDone = Boolean(dossier?.contract_verified)
  const bankDone = Boolean(dossier?.bank_verified)

  return (
    <section className="waki-dossier" aria-labelledby="waki-dossier-title">
      <header className="waki-dossier__header">
        <div className="waki-dossier__header-icon"><CreditCard size={21} /></div>
        <div>
          <span className="waki-dossier__eyebrow">EXPEDIENTE PRIVADO</span>
          <h3 id="waki-dossier-title">Contrato y cuenta de abono</h3>
          <p>Información protegida. Solo el administrador del hotel y WAKI pueden consultarla.</p>
        </div>
      </header>

      <div className="waki-dossier__progress">
        <div className="waki-dossier__progress-item">
          <FileText size={17} />
          <span>Contrato</span>
          <strong className={'waki-dossier__tag ' + (contractDone ? 'is-verified' : '')}>
            {contractDone && <CheckCircle2 size={13} />}
            {!contractDone && <Clock3 size={13} />}
            {contractStatus}
          </strong>
        </div>
        <div className="waki-dossier__progress-item">
          <Building2 size={17} />
          <span>Cuenta de abono</span>
          <strong className={'waki-dossier__tag ' + (bankDone ? 'is-verified' : '')}>
            {bankDone && <CheckCircle2 size={13} />}
            {!bankDone && <Clock3 size={13} />}
            {bankStatus}
          </strong>
        </div>
      </div>

      {error && <div className="waki-dossier__error" role="alert">{error}</div>}
      {message && <div className="waki-dossier__success" role="status">{message}</div>}

      <form onSubmit={saveBank} className="waki-dossier__form">
        <div className="waki-dossier__section-title">
          <CreditCard size={17}/>
          <h4>Datos bancarios</h4>
        </div>
        <div className="waki-dossier__fields">
          <label>Banco *
            <input required disabled={readonly || Boolean(busy)} maxLength={80}
              value={form.bank_name} placeholder="Nombre del banco"
              onChange={e => setForm(v => ({ ...v, bank_name: e.target.value }))}/>
          </label>
          <label>Tipo de cuenta *
            <select disabled={readonly || Boolean(busy)} value={form.account_type}
              onChange={e => setForm(v => ({ ...v, account_type: e.target.value }))}>
              <option value="corriente">Corriente</option>
              <option value="ahorros">Ahorros</option>
            </select>
          </label>
          <label>Número de cuenta *
            <input required disabled={readonly || Boolean(busy)} inputMode="numeric" pattern="[0-9]{6,30}"
              value={form.account_number} placeholder="Solo números"
              onChange={e => setForm(v => ({ ...v, account_number: e.target.value.replace(/\D/g,'') }))}/>
          </label>
          <label>CCI · 20 dígitos *
            <input required disabled={readonly || Boolean(busy)} inputMode="numeric" maxLength={20}
              pattern="[0-9]{20}" value={form.cci} placeholder="20 dígitos"
              onChange={e => setForm(v => ({ ...v, cci: e.target.value.replace(/\D/g,'') }))}/>
          </label>
          <label>Titular de la cuenta *
            <input required disabled={readonly || Boolean(busy)} maxLength={150}
              value={form.account_holder} placeholder="Nombre o razón social"
              onChange={e => setForm(v => ({ ...v, account_holder: e.target.value }))}/>
          </label>
          <label>RUC del titular *
            <input required disabled={readonly || Boolean(busy)} inputMode="numeric" pattern="[0-9]{11}" maxLength={11}
              value={form.holder_ruc} placeholder="11 dígitos"
              onChange={e => setForm(v => ({ ...v, holder_ruc: e.target.value.replace(/\D/g,'') }))}/>
          </label>
        </div>
        {!readonly && (
          <div className="waki-dossier__form-actions">
            <button className="hotel-setup-primary-button" type="submit" disabled={Boolean(busy)}>
              {busy === 'bank' ? 'Guardando...' : 'Guardar datos bancarios'}
            </button>
          </div>
        )}
      </form>

      <div className="waki-dossier__files">
        <div className="waki-dossier__section-title">
          <FileText size={17}/>
          <h4>Documentos de afiliación</h4>
        </div>
        <div className="waki-dossier__documents">
          <div className="waki-dossier__document">
            <div className="waki-dossier__document-icon"><FileText size={21}/></div>
            <strong>Contrato firmado</strong>
            <p>Adjunta el contrato en PDF (máximo 10 MB).</p>
            <div className="waki-dossier__document-actions">
              {!readonly && (
                <label className="waki-dossier__upload">
                  <UploadCloud size={15}/>{busy === 'contract' ? 'Subiendo...' : 'Subir PDF'}
                  <input type="file" accept="application/pdf,.pdf" disabled={Boolean(busy)}
                    onChange={e => { void upload(e.target.files?.[0], 'contract'); e.target.value = '' }} />
                </label>
              )}
              {dossier?.signed_contract_path && (
                <button type="button" onClick={() => void view(dossier.signed_contract_path)}>
                  <ExternalLink size={15}/> Ver documento
                </button>
              )}
              {!dossier?.signed_contract_path && readonly && <span>Sin documento cargado</span>}
            </div>
          </div>
          <div className="waki-dossier__document">
            <div className="waki-dossier__document-icon"><Building2 size={21}/></div>
            <strong>Constancia bancaria</strong>
            <p>Documento opcional que ayuda a verificar la cuenta.</p>
            <div className="waki-dossier__document-actions">
              {!readonly && (
                <label className="waki-dossier__upload">
                  <UploadCloud size={15}/>{busy === 'bank' ? 'Subiendo...' : 'Subir PDF'}
                  <input type="file" accept="application/pdf,.pdf" disabled={Boolean(busy)}
                    onChange={e => { void upload(e.target.files?.[0], 'bank'); e.target.value = '' }} />
                </label>
              )}
              {dossier?.bank_document_path && (
                <button type="button" onClick={() => void view(dossier.bank_document_path)}>
                  <ExternalLink size={15}/> Ver documento
                </button>
              )}
              {!dossier?.bank_document_path && readonly && <span>Sin documento cargado</span>}
            </div>
          </div>
        </div>
        {!readonly && <p className="waki-dossier__footnote">
          Para solicitar la aprobación, guarda tu cuenta bancaria y adjunta el contrato firmado.
          WAKI verificará ambos antes de aprobar el establecimiento.
        </p>}
      </div>
    </section>
  )
}
