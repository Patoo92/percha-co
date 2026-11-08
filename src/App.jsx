import { useEffect, useRef, useState } from 'react'
import { STORE_NAME, WHATSAPP_NUMBER, CURRENCY, BRAND, CONTACT_EMAIL, SOCIAL, PRODUCTS_API_URL } from './config.js'
import RegistroVendedor from './RegistroVendedor.jsx'
import PortalVendedor from './PortalVendedor.jsx'
import { LegalText, LEGAL_TITLES } from './Legal.jsx'

const MAX_PHOTOS = 5
const PAGE_SIZE = 12
const CATEGORIES = [['todos', 'Todos'], ['ropa', 'Ropa'], ['productos', 'Productos']]
const FAV_KEY = 'percha-favoritos'
const MAX_WA_ITEMS = 20
const SELLER_PLANS = [
  { id: 'Freemium', title: 'Freemium', limit: 'Hasta 5 productos', price: 0, featured: 'Ninguno' },
  { id: 'Plus', title: 'Plus', limit: 'Hasta 10 productos', price: 9.99, featured: '1_Mes' },
  { id: 'Pro', title: 'Pro', limit: 'Hasta 20 productos', price: 14.99, featured: '1_Mes', popular: true },
]
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: CURRENCY })
const PHONE_RE = /^\d{8,15}$/
// Si el producto tiene vendedor con un WhatsApp válido, se usa su número; si no, el de la tienda.
const sellerOf = (p) => (p && p.seller && PHONE_RE.test(String(p.seller.whatsapp))
  ? { name: String(p.seller.name || '').trim(), phone: String(p.seller.whatsapp) }
  : null)
const phoneOf = (p) => (sellerOf(p) ? sellerOf(p).phone : WHATSAPP_NUMBER)
const base = import.meta.env.BASE_URL
const DRIVE_IMAGE_PREFIX = 'drive:'

function imageUrl(src) {
  return /^(https?:\/\/|data:image\/)/i.test(src) ? src : base + src
}

function ProductImage({ src, name, alt = name }) {
  const [resolvedSrc, setResolvedSrc] = useState(() =>
    src && !src.startsWith(DRIVE_IMAGE_PREFIX) ? imageUrl(src) : ''
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setFailed(false)

    if (!src || !src.startsWith(DRIVE_IMAGE_PREFIX)) {
      setResolvedSrc(src ? imageUrl(src) : '')
      return () => { active = false }
    }

    setResolvedSrc('')
    const imageId = src.slice(DRIVE_IMAGE_PREFIX.length)
    const url = new URL(PRODUCTS_API_URL)
    url.searchParams.set('action', 'imagen')
    url.searchParams.set('id', imageId)

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
        return response.json()
      })
      .then((result) => {
        if (typeof result.dataUrl !== 'string' || !result.dataUrl.startsWith('data:image/')) {
          throw new Error(result.error || 'La respuesta no contiene una imagen válida')
        }
        if (active) setResolvedSrc(result.dataUrl)
      })
      .catch((err) => {
        console.error(`No se pudo cargar la imagen de ${name}`, err)
        if (active) setFailed(true)
      })

    return () => { active = false }
  }, [src, name])

  if (!resolvedSrc || failed) {
    return (
      <div className="ph" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
        {failed ? name.charAt(0) : ''}
      </div>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        console.error(`No se pudo mostrar la imagen de ${name}`)
        setFailed(true)
      }}
    />
  )
}

function Photo({ src, name }) {
  if (src) return <ProductImage src={src} name={name} />
  return <div className="ph" aria-hidden="true">{name.charAt(0)}</div>
}

function Heart({ on }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={on ? 'on' : ''}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function ThemeIcon({ dark }) {
  return dark ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11.5" fill="currentColor" />
      <path d="M19.2 11.6a7.2 7.2 0 0 1-10.7 6.3L4.4 19l1.1-3.9a7.2 7.2 0 1 1 13.7-3.5Z" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.7 8.2c.2-.3.3-.3.5-.3h.4c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .3-.1.5l-.4.5c-.1.1-.2.2-.1.4.3.5.7 1 1.1 1.3.5.4 1 .7 1.4.9.2.1.3.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.3.6c.2.1.3.2.3.3 0 .2-.1.8-.5 1.1-.4.4-1 .5-1.4.5-.5 0-1-.2-1.6-.4-.8-.3-1.6-.9-2.3-1.6-.7-.7-1.3-1.5-1.6-2.2-.3-.6-.4-1.1-.4-1.5 0-.5.2-.8.5-1.1Z" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SocialIcon({ name }) {
  if (name === 'WhatsApp') return <WhatsAppIcon />
  if (name === 'Instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.7" cy="7.5" r="1.1" fill="#fff" />
      </svg>
    )
  }
  if (name === 'Facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="12" fill="currentColor" />
        <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.6-1.6h1.7V3.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8h3.4Z" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path d="M7 6l10 12M17 6 7 18" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

function FavButton({ product, isFav, onToggle, inline }) {
  return (
    <button
      className={'fav' + (inline ? ' fav-inline' : '')}
      aria-pressed={isFav}
      aria-label={isFav ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}
      onClick={onToggle}
    >
      <Heart on={isFav} />
    </button>
  )
}

function Reveal({ children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`reveal${visible ? ' is-visible' : ''}`}>{children}</div>
}

function LoadingProducts() {
  return (
    <div className="loading-grid" role="status" aria-label="Cargando productos">
      {Array.from({ length: 8 }, (_, i) => (
        <div className="skeleton-card" key={i} aria-hidden="true">
          <span className="skeleton-photo" />
          <span className="skeleton-name" />
        </div>
      ))}
      <span className="sr-only">Cargando productos…</span>
    </div>
  )
}

function pageItems(cur, total) {
  const nums = [...new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…' + n)
    out.push(n)
  })
  return out
}

function Pagination({ page, total, onChange }) {
  if (total <= 1) return null
  return (
    <nav className="pager" aria-label="Paginación">
      <button className="page" disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button>
      {pageItems(page, total).map((it) =>
        typeof it === 'string' ? (
          <span key={it} className="dots" aria-hidden="true">…</span>
        ) : (
          <button key={it} className="page" aria-label={`Página ${it}`} aria-current={it === page ? 'page' : undefined} onClick={() => onChange(it)}>{it}</button>
        )
      )}
      <button className="page" disabled={page === total} onClick={() => onChange(page + 1)}>Siguiente</button>
    </nav>
  )
}

function Detail({ product, isFav, onToggleFav, onClose }) {
  const images = (product.images || []).slice(0, MAX_PHOTOS)
  const sizes = product.sizes || []
  const [idx, setIdx] = useState(0)
  const [size, setSize] = useState(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsSize = sizes.length > 0 && !size
  const seller = sellerOf(product)
  const msg = `Hola, me interesa "${product.name}"${size ? `, talle ${size}` : ''} (${money.format(product.price)}).${seller ? ` Lo vi en ${STORE_NAME}.` : ''}`
  const wa = `https://wa.me/${phoneOf(product)}?text=${encodeURIComponent(msg)}`

  return (
    <div className="overlay" onClick={onClose}>
      <article className="detail" role="dialog" aria-modal="true" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="close" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="gallery">
          <div className="detail-photo"><Photo src={images[idx]} name={product.name} /></div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((src, i) => (
                <button key={src} className="thumb" aria-label={`Ver foto ${i + 1} de ${images.length}`} aria-pressed={i === idx} onClick={() => setIdx(i)}>
                  <ProductImage src={src} name={product.name} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-body">
          <div className="title-row">
            <h2>{product.name}</h2>
            <FavButton product={product} isFav={isFav} onToggle={onToggleFav} inline />
          </div>
          <p className="price">{money.format(product.price)}</p>
          {seller && seller.name && <p className="seller">Vendido por <b>{seller.name}</b></p>}
          {product.description && <p className="desc">{product.description}</p>}
          {sizes.length > 0 && (
            <div>
              <p className="label">Talle</p>
              <div className="sizes">
                {sizes.map((s) => (
                  <button key={s} className="size" aria-pressed={s === size} onClick={() => setSize(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {needsSize ? (
            <button className="wa" disabled>Elegí un talle para escribir</button>
          ) : (
            <a className="wa" href={wa} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>
          )}
        </div>
      </article>
    </div>
  )
}

function LegalDialog({ doc, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <article className="legal" role="dialog" aria-modal="true" aria-label={LEGAL_TITLES[doc]} onClick={(e) => e.stopPropagation()}>
        <button ref={ref} className="close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{LEGAL_TITLES[doc]}</h2>
        <LegalText doc={doc} />
      </article>
    </div>
  )
}

function CookieBanner({ onInfo }) {
  const [shown, setShown] = useState(() => {
    try { return !localStorage.getItem('cookies-choice') } catch { return true }
  })
  if (!shown) return null
  const choose = (v) => {
    try { localStorage.setItem('cookies-choice', v) } catch { /* sin almacenamiento */ }
    setShown(false)
  }
  return (
    <div className="cookies" role="region" aria-label="Aviso de cookies">
      <p>Este sitio no usa cookies de análisis ni de publicidad. Guarda tus preferencias y favoritos en tu dispositivo. <button className="link" onClick={onInfo}>Política de cookies</button></p>
      <div className="cookie-actions">
        <button className="btn" onClick={() => choose('entendido')}>Entendido</button>
      </div>
    </div>
  )
}

function Footer({ onLegal }) {
  const socials = [
    { name: 'Instagram', url: SOCIAL.Instagram },
    { name: 'WhatsApp', url: `https://wa.me/${WHATSAPP_NUMBER}` },
    { name: 'X', url: SOCIAL.X },
    { name: 'Facebook', url: SOCIAL.Facebook },
  ]

  return (
    <footer className="footer">
      <div className="footer-cols">
        <section id="contacto">
          <h3>Contacto</h3>
          <p>Consultas y reclamaciones:<br /><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </section>
        <section>
          <h3>Información legal</h3>
          <ul>
            {Object.entries(LEGAL_TITLES).map(([k, t]) => (
              <li key={k}><button className="link" onClick={() => onLegal(k)}>{t}</button></li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Redes</h3>
          <ul className="social-list">
            {socials.map(({ name, url }) => (
              <li key={name}>
                {url ? (
                  <a className={`social-link social-${name.toLowerCase()}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}>
                    <SocialIcon name={name} />
                  </a>
                ) : (
                  <span className={`social-link social-${name.toLowerCase()} is-disabled`} aria-label={`${name}, próximamente`} title={`${name} próximamente`}>
                    <SocialIcon name={name} />
                    <span className="sr-only">{name}, próximamente</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="copy">© {new Date().getFullYear()} {BRAND}. Todos los derechos reservados.</p>
    </footer>
  )
}

function SellerPlans({ onBack, onChoose, onPortal }) {
  return (
    <main className="seller-plans">
      <button className="link registration-back" type="button" onClick={onBack}>← Volver a la tienda</button>
      <div className="plans-heading">
        <span className="featured-eyebrow">Crece con Percha &amp; Co.</span>
        <h2>Elige tu plan para vender</h2>
        <p>Empieza con el plan que mejor se adapte a tu catálogo. Completarás una única solicitud para cualquiera de las opciones.</p>
      </div>
      <div className="plans-grid">
        {SELLER_PLANS.map((plan) => (
          <article className={`plan-card${plan.popular ? ' is-popular' : ''}`} key={plan.id}>
            {plan.popular && <span className="plan-popular">Más elegido</span>}
            <h3>{plan.title}</h3>
            <p className="plan-limit">{plan.limit}</p>
            <p className="plan-price">{plan.price === 0 ? 'Gratis' : <>{money.format(plan.price)}<small> / mes</small></>}</p>
            <ul>
              <li>{plan.featured === 'Ninguno' ? 'Sin destaque incluido' : 'Destaque de 1 mes seleccionado'}</li>
              <li>Contacto directo con tus compradores</li>
            </ul>
            {plan.featured !== 'Ninguno' && (
              <p className="plan-first-total">
                Primer pago: {money.format(plan.price + 9.99)}
                <small> Incluye el primer mes de destaque ({money.format(9.99)}). El plan se factura mensualmente.</small>
              </p>
            )}
            {plan.featured === 'Ninguno' && <p className="plan-first-total">Sin pagos ni destaque adicional.</p>}
            <button className="plan-choose" type="button" onClick={() => onChoose(plan.id, plan.featured)}>
              Elegir {plan.title}
            </button>
          </article>
        ))}
      </div>
      <p className="plans-note">Los destaques son opcionales. En el formulario podrás revisar y cambiar tu selección antes de enviar la solicitud. Precios con IVA incluido.</p>
      <p className="plans-note">¿Ya eres vendedor? <button className="link" type="button" onClick={onPortal}>Accede al portal de vendedores</button>.</p>
    </main>
  )
}

export default function App() {
  const [vista, setVista] = useState('catalogo')
  const [sellerSelection, setSellerSelection] = useState({ plan: 'Freemium', destaque: 'Ninguno' })
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [legal, setLegal] = useState(null)
  const [favs, setFavs] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY))
      return Array.isArray(v) ? v : []
    } catch { return [] }
  })
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('percha-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const topRef = useRef(null)
  const catalogRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('percha-theme', theme) } catch { /* sin almacenamiento */ }
  }, [theme])

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch(PRODUCTS_API_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((result) => {
        if (!Array.isArray(result)) throw new Error('La respuesta del catálogo no es válida.')
        setProducts(result)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)) } catch { /* sin almacenamiento */ }
  }, [favs])

  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  const all = products || []
  const featuredProducts = all.filter((product) => product.featured).slice(0, 5)
  const favProducts = all.filter((p) => favs.includes(p.id))
  const categoryProducts = category === 'favoritos' ? favProducts : all.filter((p) => category === 'todos' || p.category === category)
  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const filtered = categoryProducts.filter((p) => !normalizedSearch || `${p.name} ${p.description || ''}`.toLocaleLowerCase('es').includes(normalizedSearch))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, totalPages)
  const shown = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  const goPage = (n) => {
    setPage(n)
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const pickCategory = (k) => { setCategory(k); setPage(1) }
  const selectMenuCategory = (k) => {
    setVista('catalogo')
    pickCategory(k)
    setMenuOpen(false)
    catalogRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const openPlans = () => {
    setVista('planes')
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openSellerPortal = () => {
    setVista('vendedor')
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const chooseSellerPlan = (plan, destaque) => {
    setSellerSelection({ plan, destaque })
    setVista('registro')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const waGroups = () => {
    const groups = new Map()
    favProducts.forEach((p) => {
      const phone = phoneOf(p)
      if (!groups.has(phone)) groups.set(phone, { phone, name: (sellerOf(p) || {}).name || '', items: [] })
      groups.get(phone).items.push(p)
    })
    return [...groups.values()].map((g) => {
      const lines = g.items.slice(0, MAX_WA_ITEMS).map((p) => `- ${p.name} (${money.format(p.price)})${(p.sizes || []).length ? ' - talle a confirmar' : ''}`)
      const extra = g.items.length > MAX_WA_ITEMS ? `\n(y ${g.items.length - MAX_WA_ITEMS} más)` : ''
      return {
        ...g,
        truncated: g.items.length > MAX_WA_ITEMS,
        url: `https://wa.me/${g.phone}?text=${encodeURIComponent(`Hola, me interesan estos productos:\n${lines.join('\n')}${extra}`)}`,
      }
    })
  }
  const favGroups = category === 'favoritos' ? waGroups() : []
  return (
    <>
      <header className="top">
        <h1 className="brand"><img src={base + 'logo.svg'} alt={STORE_NAME} /></h1>
        <div className="header-actions">
          <button className="seller-entry" onClick={openPlans}>Vende con nosotros</button>
          <button className="seller-portal-entry" onClick={openSellerPortal}>Ya soy vendedor</button>
          <button className="theme-toggle" onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} aria-pressed={theme === 'dark'}>
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen((open) => !open)}>
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        {menuOpen && (
          <nav className="mobile-nav" id="mobile-nav" aria-label="Navegación móvil">
            {CATEGORIES.map(([key, label]) => (
              <button className="nav-link" key={key} onClick={() => selectMenuCategory(key)}>{label}</button>
            ))}
            <button className="nav-link" onClick={() => selectMenuCategory('favoritos')}>Favoritos</button>
            <button className="nav-link" onClick={openPlans}>Planes para vendedores</button>
            <button className="nav-link" onClick={openSellerPortal}>Acceso para vendedores registrados</button>
            <button className="nav-link" onClick={() => { setMenuOpen(false); document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' }) }}>Contacto</button>
          </nav>
        )}
      </header>
      {vista === 'planes' ? (
        <SellerPlans onBack={() => setVista('catalogo')} onChoose={chooseSellerPlan} onPortal={openSellerPortal} />
      ) : vista === 'registro' ? (
        <RegistroVendedor
          key={`${sellerSelection.plan}-${sellerSelection.destaque}`}
          initialPlan={sellerSelection.plan}
          initialDestaque={sellerSelection.destaque}
          onVolver={() => setVista('planes')}
          onPortal={openSellerPortal}
          onLegal={setLegal}
        />
      ) : vista === 'vendedor' ? (
        <PortalVendedor onBack={() => setVista('catalogo')} />
      ) : (
      <main ref={catalogRef}>
        {vista === 'catalogo' && featuredProducts.length > 0 && (
          <section className="featured-section" aria-labelledby="featured-title">
            <div className="featured-heading">
              <span className="featured-eyebrow">Selección especial</span>
              <h2 id="featured-title">Destacados</h2>
              <p>Descubre productos seleccionados de nuestros vendedores.</p>
            </div>
            <ul className={`grid featured-grid${featuredProducts.length === 1 ? ' is-single' : ''}`}>
              {featuredProducts.map((product) => (
                <li key={product.id}>
                  <button className="card featured-card" onClick={() => setSelected(product)}>
                    <span className="featured-badge">Destacado</span>
                    <Photo src={(product.images || [])[0]} name={product.name} />
                    <span className="featured-card-info">
                      <span className="card-name">{product.name}</span>
                      <span className="featured-price">{money.format(product.price)}</span>
                      {product.seller?.name && <span className="featured-seller">Por {product.seller.name}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {products && products.length > 0 && (
          <div className="tabs" ref={topRef} role="group" aria-label="Categorías">
            {[...CATEGORIES, ['favoritos', `Favoritos (${favProducts.length})`]].map(([k, label]) => (
              <button key={k} className="tab" aria-pressed={category === k} onClick={() => pickCategory(k)}>{label}</button>
            ))}
          </div>
        )}
        {products && products.length > 0 && (
          <div className="search-wrap">
            <label className="sr-only" htmlFor="product-search">Buscar productos</label>
            <input id="product-search" className="search-input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar productos…" autoComplete="off" />
          </div>
        )}
        {error && <p className="msg">No se pudieron cargar los productos. Probá recargar la página.</p>}
        {!error && !products && <LoadingProducts />}
        {products && products.length === 0 && <p className="msg">Todavía no hay productos publicados.</p>}
        {products && products.length > 0 && filtered.length === 0 && (
          <p className="msg">{normalizedSearch ? 'No se encontraron productos para esa búsqueda.' : category === 'favoritos' ? 'Todavía no marcaste favoritos. Tocá el corazón de un producto para guardarlo acá.' : 'No hay productos en esta categoría.'}</p>
        )}
        {category === 'favoritos' && favProducts.length > 0 && (
          <div className="fav-bar">
            {favGroups.map((g) => (
              <a key={g.phone} className="wa inline" href={g.url} target="_blank" rel="noopener noreferrer">
                {favGroups.length === 1 && !g.name ? 'Enviar mi lista por WhatsApp' : `Enviar a ${g.name || STORE_NAME} (${g.items.length})`}
              </a>
            ))}
            {favGroups.some((g) => g.truncated) && <p className="note">Se envían los primeros {MAX_WA_ITEMS} productos de cada lista.</p>}
          </div>
        )}
        {shown.length > 0 && (
          <ul className="grid">
            {shown.map((p) => (
              <li key={p.id} className="card-wrap">
                <Reveal>
                  <button className="card" onClick={() => setSelected(p)}>
                    <Photo src={(p.images || [])[0]} name={p.name} />
                    <span className="card-name">{p.name}</span>
                  </button>
                  <FavButton product={p} isFav={favs.includes(p.id)} onToggle={() => toggleFav(p.id)} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={cur} total={totalPages} onChange={goPage} />
        <section className="seller-callout" aria-labelledby="seller-callout-title">
          <div>
            <span className="featured-eyebrow">Tu tienda también puede estar aquí</span>
            <h2 id="seller-callout-title">¿También quieres vender con nosotros?</h2>
            <p>Conoce los planes y encuentra el que mejor se adapte a tus productos.</p>
          </div>
          <button className="plan-choose" type="button" onClick={openPlans}>Ver planes</button>
        </section>
      </main>
      )}
      <Footer onLegal={setLegal} />
      <CookieBanner onInfo={() => setLegal('cookies')} />
      {showTop && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Volver arriba">↑</button>}
      {selected && <Detail product={selected} isFav={favs.includes(selected.id)} onToggleFav={() => toggleFav(selected.id)} onClose={() => setSelected(null)} />}
      {legal && <LegalDialog doc={legal} onClose={() => setLegal(null)} />}
    </>
  )
}
