import { useEffect, useMemo, useState } from 'react'
import { API_URL } from './config.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const SESSION_KEY = 'percha-seller-session'

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer la imagen.'))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}

async function post(action, data = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion: action, ...data }),
  })
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
  const result = await response.json()
  if (result.status !== 'success') throw new Error(result.message || 'No se pudo completar la solicitud.')
  return result
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export default function PortalVendedor({ onBack }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) || '' } catch { return '' }
  })
  const [seller, setSeller] = useState(null)
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', price: '', category: 'ropa', description: '', sizes: '', featured: false })
  const [files, setFiles] = useState([])
  const [uploadedImages, setUploadedImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const maxImages = form.featured && seller?.canFeature ? 5 : 3
  const imageLabel = useMemo(
    () => files.length ? files.map((file) => file.name).join(', ') : 'Todavía no seleccionaste imágenes.',
    [files],
  )

  const loadProducts = async (activeToken) => {
    const result = await post('listarProductosVendedor', { token: activeToken })
    setSeller(result)
    setProducts(result.products || [])
  }

  useEffect(() => {
    if (!token) return
    let active = true
    post('listarProductosVendedor', { token })
      .then((result) => {
        if (!active) return
        setSeller(result)
        setProducts(result.products || [])
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* el acceso sigue en memoria */ }
        setToken('')
      })
    return () => { active = false }
  }, [token])

  const requestCode = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const result = await post('solicitarCodigoAccesoVendedor', { email })
      setCodeRequested(true)
      setNotice(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await post('verificarCodigoAccesoVendedor', { email, code })
      try { sessionStorage.setItem(SESSION_KEY, result.token) } catch { /* el token queda en memoria */ }
      setToken(result.token)
      setCode('')
      setNotice('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const updateFiles = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    setError('')
    setNotice('')
    if (selectedFiles.length > maxImages) {
      setFiles([])
      event.target.value = ''
      setError(`Este producto admite hasta ${maxImages} imágenes.`)
      return
    }
    const invalidFile = selectedFiles.find((file) =>
      !ACCEPTED_IMAGES.includes(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES
    )
    if (invalidFile) {
      setFiles([])
      event.target.value = ''
      setError('Usa imágenes JPG, PNG, GIF o WebP de hasta 5 MB cada una.')
      return
    }
    setFiles(selectedFiles)
    setUploadedImages([])
  }

  const submitProduct = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!files.length) {
      setError('Añade al menos una imagen del producto.')
      return
    }
    if (files.length > maxImages) {
      setError(`Este producto admite hasta ${maxImages} imágenes con la opción seleccionada.`)
      return
    }
    if (form.category === 'ropa' && !form.sizes.trim()) {
      setError('Indica los talles disponibles para la ropa.')
      return
    }

    setLoading(true)
    try {
      const completedUploads = []
      for (const [index, file] of files.entries()) {
        const key = fileKey(file)
        let uploaded = uploadedImages.find((item) => item.key === key)
        if (!uploaded) {
          setNotice(`Subiendo imagen ${index + 1} de ${files.length}…`)
          const dataUrl = await readDataUrl(file)
          const result = await post('subirImagenProductoVendedor', {
            token,
            file: {
              name: file.name,
              mimeType: file.type,
              base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
            },
          })
          uploaded = { key, id: result.id, token: result.token }
          completedUploads.push(uploaded)
          setUploadedImages((current) => [...current.filter((item) => item.key !== key), uploaded])
        }
      }

      const images = files.map((file) => {
        const uploaded = uploadedImages.find((item) => item.key === fileKey(file)) ||
          completedUploads.find((item) => item.key === fileKey(file))
        if (!uploaded) throw new Error('No se pudo preparar una de las imágenes. Inténtalo otra vez.')
        return { id: uploaded.id, token: uploaded.token }
      })
      setNotice('Enviando el producto para revisión…')
      await post('crearProductoVendedor', {
        token,
        product: {
          name: form.name,
          price: form.price,
          category: form.category,
          description: form.description,
          sizes: form.category === 'ropa' ? form.sizes.split(',').map((size) => size.trim()).filter(Boolean) : [],
          featured: form.featured,
          images,
        },
      })
      await loadProducts(token)
      setForm({ name: '', price: '', category: 'ropa', description: '', sizes: '', featured: false })
      setFiles([])
      setUploadedImages([])
      const input = document.getElementById('seller-product-images')
      if (input) input.value = ''
      setNotice('Producto enviado. Quedó pendiente de revisión antes de publicarse.')
    } catch (requestError) {
      setError(requestError.message)
      setNotice('')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      if (uploadedImages.length) {
        await post('cancelarCargaProductoVendedor', {
          token,
          images: uploadedImages.map(({ id, token: uploadToken }) => ({ id, token: uploadToken })),
        })
      }
    } catch (requestError) {
      console.error('No se pudieron retirar imágenes temporales.', requestError)
    }
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* cerrar sesión en memoria igualmente */ }
    setToken('')
    setSeller(null)
    setProducts([])
    setUploadedImages([])
    setFiles([])
    setError('')
    setNotice('')
  }

  return (
    <main className="seller-registration seller-portal">
      <button className="link registration-back" type="button" onClick={onBack}>← Volver a la tienda</button>
      <h2>Área de vendedor</h2>
      <p className="registration-intro">Accede con el correo aprobado. Enviaremos un código de un solo uso; nunca pedimos tu DNI para iniciar sesión.</p>

      {!token ? (
        <form className="registration-form" onSubmit={codeRequested ? verifyCode : requestCode}>
          <label className="registration-field">
            <span>Correo de tu cuenta de vendedor</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading || codeRequested} />
          </label>
          {codeRequested && (
            <label className="registration-field">
              <span>Código de 6 dígitos</span>
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </label>
          )}
          {error && <p className="registration-message is-error" role="alert">{error}</p>}
          {notice && <p className="registration-message is-success" role="status">{notice}</p>}
          <button className="registration-submit" type="submit" disabled={loading}>
            {loading ? 'Un momento…' : codeRequested ? 'Acceder' : 'Enviar código de acceso'}
          </button>
          {codeRequested && <button className="link" type="button" onClick={() => { setCodeRequested(false); setCode(''); setNotice('') }}>Usar otro correo</button>}
        </form>
      ) : (
        <>
          {seller && (
            <section className="seller-portal-summary" aria-label="Resumen de la cuenta">
              <div><strong>{seller.count} de {seller.limit}</strong><span>productos del plan {seller.plan}</span></div>
              <button className="link" type="button" onClick={signOut}>Cerrar sesión</button>
            </section>
          )}
          <form className="registration-form" onSubmit={submitProduct}>
            <h3>Nuevo producto</h3>
            <p className="registration-note">Los productos se publican tras la revisión de la tienda; si no se revisan, se aprueban automáticamente a las 48 horas.</p>
            <label className="registration-field">
              <span>Nombre del producto</span>
              <input value={form.name} maxLength="100" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="registration-field">
              <span>Precio (€)</span>
              <input type="number" min="0" max="100000" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} required />
            </label>
            <label className="registration-field">
              <span>Categoría</span>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, sizes: event.target.value === 'ropa' ? current.sizes : '' }))}>
                <option value="ropa">Ropa</option>
                <option value="productos">Productos</option>
              </select>
            </label>
            {form.category === 'ropa' && (
              <label className="registration-field">
                <span>Talles disponibles</span>
                <input value={form.sizes} maxLength="200" placeholder="S, M, L, XL" onChange={(event) => setForm((current) => ({ ...current, sizes: event.target.value }))} required />
                <small className="registration-note">Separa los talles con comas.</small>
              </label>
            )}
            <label className="registration-field">
              <span>Descripción</span>
              <textarea rows="4" maxLength="1000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            {seller?.canFeature && (
              <label className="registration-consent">
                <input type="checkbox" checked={form.featured} onChange={(event) => {
                  const featured = event.target.checked
                  setForm((current) => ({ ...current, featured }))
                  if (!featured && files.length > MAX_IMAGE_BYTES) setFiles([])
                }} />
                <span>Marcar este producto como mi producto destacado (hasta 5 imágenes).</span>
              </label>
            )}
            <label className="registration-field">
              <span>Imágenes (hasta {maxImages}; JPG, PNG, GIF o WebP, 5 MB cada una)</span>
              <input id="seller-product-images" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={updateFiles} />
              <small className="registration-note">{imageLabel}</small>
            </label>
            {error && <p className="registration-message is-error" role="alert">{error}</p>}
            {notice && <p className="registration-message is-success" role="status">{notice}</p>}
            <button className="registration-submit" type="submit" disabled={loading || !seller || seller.count >= seller.limit}>
              {loading ? 'Enviando…' : seller && seller.count >= seller.limit ? 'Límite del plan alcanzado' : 'Enviar a revisión'}
            </button>
          </form>
          <section className="seller-products" aria-labelledby="seller-products-title">
            <h3 id="seller-products-title">Mis productos</h3>
            {products.length ? (
              <ul>{products.map((product, index) => <li key={`${product.name}-${index}`}><span>{product.name}</span><strong>{product.status}</strong></li>)}</ul>
            ) : <p className="registration-note">Todavía no enviaste productos.</p>}
          </section>
        </>
      )}
    </main>
  )
}
