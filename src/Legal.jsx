import { STORE_NAME, BRAND, CONTACT_EMAIL, OWNER } from './config.js'

const v = (x) => x || '[COMPLETAR]'

export const LEGAL_TITLES = { aviso: 'Aviso legal', privacidad: 'Política de privacidad', cookies: 'Política de cookies' }

export function LegalText({ doc }) {
  if (doc === 'aviso') return (
    <>
      <p>Información del titular de este sitio web, según el artículo 10 de la Ley 34/2002 (LSSI-CE):</p>
      <ul>
        <li>Titular: {v(OWNER.name)} (nombre comercial: {BRAND})</li>
        <li>NIF: {v(OWNER.nif)}</li>
        <li>Domicilio: {v(OWNER.address)}</li>
        <li>Correo electrónico: {CONTACT_EMAIL}</li>
      </ul>
      <p>{STORE_NAME} muestra un catálogo de productos. La compra se acuerda por contacto directo con el titular a través de WhatsApp o correo electrónico.</p>
      <p>Los contenidos de este sitio (diseño, textos e imágenes) pertenecen a {BRAND}, salvo indicación en contrario. No pueden reproducirse sin autorización.</p>
      <p>Consultas y reclamaciones: {CONTACT_EMAIL}.</p>
    </>
  )
  if (doc === 'privacidad') return (
    <>
      <p><b>Responsable:</b> {v(OWNER.name)}, NIF {v(OWNER.nif)}, {v(OWNER.address)}. Contacto: {CONTACT_EMAIL}.</p>
      <p><b>Qué datos tratamos:</b> este sitio no tiene formularios ni cuentas. Solo tratamos los datos que nos envíes tú al escribirnos por WhatsApp (tu número de teléfono y el contenido del mensaje) o por correo electrónico. Tu lista de favoritos se guarda solo en tu navegador y no la recibimos, salvo que nos la envíes tú por WhatsApp.</p>
      <p><b>Para qué:</b> responder tus consultas, atender tu pedido y gestionar posibles reclamaciones.</p>
      <p><b>Base legal:</b> tu consentimiento al contactarnos y la aplicación de medidas precontractuales o la ejecución del contrato que pidas.</p>
      <p><b>Destinatarios:</b> no cedemos tus datos a terceros salvo obligación legal. La conversación por WhatsApp se rige también por las condiciones de esa plataforma.</p>
      <p><b>Conservación:</b> mientras sea necesario para atender tu consulta o pedido y durante los plazos legales aplicables.</p>
      <p><b>Tus derechos:</b> acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad. Escribinos a {CONTACT_EMAIL}. Si crees que no tratamos bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
    </>
  )
  return (
    <>
      <p>Este sitio web <b>no instala cookies propias ni de terceros</b> con fines de análisis, publicidad o seguimiento.</p>
      <p>Guarda en tu navegador (localStorage), solo en tu dispositivo: la elección que hagas en el aviso de cookies y, si los marcas, tu lista de favoritos. Esta información no se envía a ningún servidor. Sirve para no volver a preguntarte y para recordar tus favoritos.</p>
      <p>Al pulsar "Escribir por WhatsApp" se abre WhatsApp, que tiene sus propias políticas de privacidad y cookies.</p>
      <p>Si en el futuro se añaden cookies que requieran tu consentimiento (por ejemplo, de analítica), se te pedirá antes de instalarlas. Puedes borrar estos datos desde los ajustes de tu navegador.</p>
    </>
  )
}
