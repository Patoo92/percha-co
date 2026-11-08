import { useEffect, useState } from 'react'
import { API_URL } from './config.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const PLAN_PRICES = { Freemium: 0, Plus: 9.99, Pro: 14.99 }
const FEATURED_PRICES = { Ninguno: 0, '1_Semana': 1.99, '2_Semanas': 2.99, '3_Semanas': 4.99, '1_Mes': 9.99 }
const FEATURED_OPTIONS = [
  ['Ninguno', 'Sin destaque'],
  ['1_Semana', '1 semana — 1,99 €'],
  ['2_Semanas', '2 semanas — 2,99 €'],
  ['3_Semanas', '3 semanas — 4,99 €'],
  ['1_Mes', 'Mes completo — 9,99 €'],
]

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer el documento seleccionado.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el documento seleccionado.'))
    reader.readAsDataURL(file)
  })
}

export default function RegistroVendedor({ initialPlan, initialDestaque, onVolver, onPortal, onLegal }) {
  const [form, setForm] = useState({
    nombre: '',
    whatsapp: '',
    email: '',
    plan: initialPlan,
    destaque: initialDestaque,
    consentimiento: false,
  })
  const [documento, setDocumento] = useState(null)
  const [featuredAvailability, setFeaturedAvailability] = useState('loading')
  const [availabilityMessage, setAvailabilityMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deliveryWarning, setDeliveryWarning] = useState('')

  useEffect(() => {
    let active = true
    const url = new URL(API_URL)
    url.searchParams.set('action', 'disponibilidadDestaque')

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
        return response.json()
      })
      .then((result) => {
        if (result.status !== 'success' || typeof result.disponible !== 'boolean') {
          throw new Error(result.message || 'Respuesta de disponibilidad no válida.')
        }
        if (!active) return
        if (result.disponible) {
          setFeaturedAvailability('available')
        } else {
          setFeaturedAvailability('full')
          setForm((current) => ({ ...current, destaque: 'Ninguno' }))
          setAvailabilityMessage('El cupo de destaques está completo por ahora.')
        }
      })
      .catch((requestError) => {
        console.error('No se pudo consultar el cupo de destacados.', requestError)
        if (!active) return
        setFeaturedAvailability('error')
        setForm((current) => ({ ...current, destaque: 'Ninguno' }))
        setAvailabilityMessage('No se pudo confirmar el cupo. Puedes continuar sin destaque.')
      })

    return () => { active = false }
  }, [])

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setError('')
    setSuccess('')
    setDeliveryWarning('')
  }

  const updateDocument = (event) => {
    const file = event.target.files?.[0]
    setError('')
    setSuccess('')
    setDeliveryWarning('')
    if (!file) {
      setDocumento(null)
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setDocumento(null)
      event.target.value = ''
      setError('El documento debe estar en formato PDF, JPG o PNG.')
      return
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setDocumento(null)
      event.target.value = ''
      setError('El documento debe pesar más de 0 y como máximo 5 MB.')
      return
    }
    setDocumento(file)
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setDeliveryWarning('')

    if (!documento) {
      setError('Adjunta una imagen o PDF de tu DNI/NIE.')
      return
    }
    if (form.destaque !== 'Ninguno' && featuredAvailability !== 'available') {
      setError('El cupo de destaque no está disponible. Actualiza la página o continúa sin destaque.')
      return
    }

    setLoading(true)
    try {
      const dataUrl = await readFile(documento)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          accion: 'registrarVendedor',
          ...form,
          documento: { mimeType: documento.type, base64: dataUrl },
        }),
      })
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`)

      const result = await response.json()
      if (result.status !== 'success' || typeof result.idVendedor !== 'string') {
        throw new Error(result.message || 'El servidor no pudo completar el registro.')
      }

      setSuccess(`Solicitud enviada. Tu ID de vendedor es ${result.idVendedor}.`)
      const deliveryWarnings = []
      if (result.emailEnviado !== true) {
        deliveryWarnings.push('No se pudo enviar el correo de confirmación al vendedor.')
      }
      if (result.avisoTiendaEnviado !== true) {
        deliveryWarnings.push('No se pudo avisar a la tienda; el alta quedó guardada y debe revisarse en la hoja.')
      }
      setDeliveryWarning(deliveryWarnings.join(' '))
      setDocumento(null)
      setForm({
        nombre: '',
        whatsapp: '',
        email: '',
        plan: initialPlan,
        destaque: featuredAvailability === 'available' ? initialDestaque : 'Ninguno',
        consentimiento: false,
      })
      const input = document.getElementById('registro-documento')
      if (input) input.value = ''
    } catch (requestError) {
      console.error('No se pudo completar el registro de vendedor.', requestError)
      setError(requestError.message || 'No se pudo completar el registro. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const total = PLAN_PRICES[form.plan] + FEATURED_PRICES[form.destaque]
  const featuredDisabled = featuredAvailability !== 'available'

  return (
    <main className="seller-registration">
      <button className="link registration-back" type="button" onClick={onVolver}>← Volver a la tienda</button>
      <h2>Vende en Percha&amp;Co</h2>
      <p className="registration-intro">
        Crea tu perfil de vendedor y elige el plan que mejor se adapte a tu catálogo.{' '}
        ¿Ya tienes cuenta? <button className="link" type="button" onClick={onPortal}>Accede al portal de vendedores</button>.
      </p>

      <form className="registration-form" onSubmit={submit}>
        <label className="registration-field">
          <span>Nombre comercial o de vendedor</span>
          <input name="nombre" type="text" autoComplete="organization" maxLength="100" value={form.nombre} onChange={updateForm} required />
        </label>

        <label className="registration-field">
          <span>WhatsApp de contacto</span>
          <input name="whatsapp" type="tel" autoComplete="tel" maxLength="30" value={form.whatsapp} onChange={updateForm} placeholder="+34 600 000 000" required />
        </label>

        <label className="registration-field">
          <span>Correo electrónico</span>
          <input name="email" type="email" autoComplete="email" maxLength="254" value={form.email} onChange={updateForm} required />
        </label>

        <label className="registration-field">
          <span>Plan de productos</span>
          <select name="plan" value={form.plan} onChange={updateForm}>
            <option value="Freemium">Freemium — hasta 5 productos — Gratis</option>
            <option value="Plus">Plus — hasta 10 productos — 9,99 €/mes</option>
            <option value="Pro">Pro — hasta 20 productos — 14,99 €/mes</option>
          </select>
        </label>

        <label className="registration-field">
          <span>Destaque en la tienda</span>
          <select
            name="destaque"
            value={form.destaque}
            onChange={updateForm}
            disabled={featuredDisabled}
            aria-describedby="featured-availability"
          >
            {FEATURED_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <small id="featured-availability" className={featuredAvailability === 'full' ? 'registration-note is-full' : 'registration-note'}>
            {featuredAvailability === 'loading' && 'Consultando el cupo de destaque…'}
            {availabilityMessage}
            {featuredAvailability === 'available' && 'Una tarjeta por vendedor. El período comienza al verificar el pago. IVA incluido.'}
          </small>
        </label>

        <label className="registration-field">
          <span>DNI/NIE (PDF, JPG o PNG; máximo 5 MB)</span>
          <input
            id="registro-documento"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={updateDocument}
            required
          />
          <small className="registration-note">Se usa para verificar la identidad del vendedor. No se publica en la tienda.</small>
        </label>

        <label className="registration-consent">
          <input name="consentimiento" type="checkbox" checked={form.consentimiento} onChange={updateForm} required />
          <span>
            He leído y acepto los{' '}
            <button className="link" type="button" onClick={() => onLegal('vendedores')}>Términos y condiciones para vendedores</button>
            {' '}y la{' '}
            <button className="link" type="button" onClick={() => onLegal('privacidad')}>Política de privacidad</button>.
          </span>
        </label>

        <p className="registration-total">
          Total inicial: <strong>{money.format(total)}</strong>
          <small>IVA incluido. Los planes Plus y Pro son mensuales; el destaque se añade al plan.</small>
        </p>

        {error && <p className="registration-message is-error" role="alert">{error}</p>}
        {success && <p className="registration-message is-success" role="status">{success}</p>}
        {deliveryWarning && <p className="registration-message is-error" role="alert">{deliveryWarning}</p>}

        <button className="registration-submit" type="submit" disabled={loading || featuredAvailability === 'loading'}>
          {loading ? 'Enviando solicitud…' : 'Enviar solicitud'}
        </button>
      </form>
    </main>
  )
}
