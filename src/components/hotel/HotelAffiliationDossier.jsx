import { Building2, CheckCircle2, Clock3, CreditCard, FileText, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const INITIAL = {
  bank_name: '', account_type: 'corriente', account_number: '',
  cci: '', account_holder: '', holder_ruc: ''
}
const BUCKET = 'hotel-affiliations'

export default function HotelAffiliationDossier({ hotelId, approved = false, onReadyChange }) {
  const [form, setForm] = useState(INITIAL)
  const [dossier, setDossier] = useState(null)
  const [offer, setOffer] = useState(null)
  const [preview, setPreview] = useState(null)
  const [openedPath, setOpenedPath] = useState(null)
  const [generatingContract, setGeneratingContract] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const autoOfferRequested = useRef(null)

  async function load() {
    if (!hotelId) return
    const [{ data, error: issue }, contract] = await Promise.all([
      supabase.rpc('hotel_dossier_control', { p_hotel: hotelId }),
      supabase.rpc('hotel_contract_offer', { p_hotel: hotelId })
    ])
    if (issue) { setError('No se pudo obtener el expediente de afiliación.'); return }
    setDossier(data)
    setOffer(contract.data)
    if (contract.error) setError('No se pudo consultar el contrato de afiliación.')
    if (!approved && !contract.data?.document_path && !data.signed_contract_path && autoOfferRequested.current !== hotelId) {
      autoOfferRequested.current = hotelId
      setGeneratingContract(true)
      const { error: generationError } = await supabase.functions.invoke('hotel-contract-offer', { body: { hotel_id: hotelId } })
      setGeneratingContract(false)
      if (generationError) {
        setError('No se pudo preparar el contrato. Revisa que la invitación tenga razón social, RUC y plan comercial, o contacta a WAKI.')
      } else {
        const { data: refreshedOffer, error: refreshError } = await supabase.rpc('hotel_contract_offer', { p_hotel: hotelId })
        if (refreshError) setError('El contrato se generó, pero no pudimos mostrarlo. Actualiza esta página.')
        else setOffer(refreshedOffer)
      }
    }
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

  async function acceptContract() {
    if (!offer?.document_path || openedPath !== offer.document_path || busy) return
    setBusy('contract'); setError(''); setMessage('')
    try {
      const { error: issue } = await supabase.rpc('hotel_contract_offer', {
        p_hotel: hotelId, p_action: 'accept', p_path: offer.document_path
      })
      if (issue) throw issue
      await load()
      setMessage('Tu aceptación del contrato quedó registrada.')
    } catch (issue) {
      setError(issue?.message === 'CONTRACT_VERSION_CHANGED'
        ? 'WAKI actualizó el contrato. Vuelve a abrir el PDF y revísalo.'
        : 'No se pudo registrar la aceptación. Inténtalo nuevamente.')
      if (issue?.message === 'CONTRACT_VERSION_CHANGED') await load()
    } finally { setBusy('') }
  }

  async function view(path) {
    setError('')
    setOpenedPath(null)
    setPreview(null)
    setBusy('preview')
    try {
      const { data, error: issue } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
      if (issue || !data?.signedUrl) throw issue || new Error('Missing PDF URL')
      setPreview({ path, url: data.signedUrl })
    } catch {
      setError('No se pudo abrir el archivo privado. Inténtalo nuevamente.')
    } finally { setBusy('') }
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
          <h4>Contrato de afiliación</h4>
        </div>
        <div className="waki-dossier__document">
          {offer?.accepted_at ? (
            <p role="status">Aceptación registrada el {new Date(offer.accepted_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}.</p>
          ) : offer?.document_path ? (
            <p>Abre el PDF, revisa las condiciones y confirma tu aceptación.</p>
          ) : dossier?.signed_contract_path ? (
            <p>Tu expediente ya contiene un contrato registrado.</p>
          ) : (
            <p>{generatingContract ? 'Estamos preparando el PDF de afiliación con los datos de tu hotel y el plan acordado…' : 'El contrato PDF se preparará automáticamente con la razón social, RUC y plan acordados.'}</p>
          )}
          {preview && preview.path === (offer?.document_path || dossier?.signed_contract_path) && (
            <div>
              <iframe key={preview.url} src={preview.url} title="Contrato de afiliación de WAKI"
                width="100%" height="560" referrerPolicy="no-referrer"
                onLoad={() => setOpenedPath(preview.path)} />
              <a href={preview.url} target="_blank" rel="noopener noreferrer">Abrir PDF en otra pestaña</a>
            </div>
          )}
          {(offer?.document_path || dossier?.signed_contract_path) && (
            <div className="waki-dossier__document-actions">
              <button type="button" disabled={Boolean(busy)} onClick={() => void view(offer?.document_path || dossier.signed_contract_path)}>
                <ExternalLink size={15}/> Abrir contrato PDF
              </button>
              {!readonly && offer?.document_path && !offer.accepted_at && (
                <button type="button" className="hotel-setup-primary-button" onClick={() => void acceptContract()}
                  disabled={Boolean(busy) || openedPath !== offer.document_path}>
                  {busy === 'contract' ? 'Registrando…' : 'Acepto el contrato'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
