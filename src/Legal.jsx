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
      <p>{STORE_NAME} muestra un catálogo de productos. La compra se acuerda por contacto directo, a través de WhatsApp o correo electrónico.</p>
      <p>Algunos productos los ofrecen vendedores independientes, que se identifican en cada producto con la indicación "Vendido por". En esos casos, la compra se acuerda directamente entre el comprador y ese vendedor, a través de su WhatsApp. Los productos sin esa indicación los ofrece el titular de este sitio.</p>
      <p>Los contenidos de este sitio (diseño, textos e imágenes) pertenecen a {BRAND}, salvo indicación en contrario. No pueden reproducirse sin autorización.</p>
      <p>Consultas y reclamaciones: {CONTACT_EMAIL}.</p>
    </>
  )
  if (doc === 'privacidad') return (
    <>
      <p><b>Responsable:</b> {v(OWNER.name)}, NIF {v(OWNER.nif)}, {v(OWNER.address)}. Contacto: {CONTACT_EMAIL}.</p>
      <p>Esta política explica cómo tratamos los datos de quienes visitan la tienda y compran, y de los vendedores que publican productos en {STORE_NAME}.</p>

      <h3>Visitantes y compradores</h3>
      <p><b>Datos:</b> este sitio no tiene formularios ni cuentas. Tratamos lo que nos envíes por WhatsApp (tu número de teléfono y el contenido del mensaje) o por correo electrónico. Al cargar la tienda, tu navegador se conecta a servicios de Google para obtener los productos y las fotos, y Google recibe tu dirección IP y datos técnicos de la conexión. Tu lista de favoritos se guarda solo en tu navegador y no la recibimos, salvo que nos la envíes tú por WhatsApp.</p>
      <p><b>Finalidades y base legal:</b></p>
      <ul>
        <li>Responder tus consultas y atender tu pedido: tu consentimiento al contactarnos y las medidas precontractuales o el contrato que pidas.</li>
        <li>Gestionar reclamaciones y cumplir obligaciones legales: obligación legal.</li>
        <li>Mostrarte el catálogo y que la tienda funcione: interés legítimo en prestar el servicio.</li>
      </ul>
      <p><b>Si el producto lo vende un vendedor independiente:</b> al escribirle por WhatsApp, tu teléfono y tu mensaje le llegan a ese vendedor, que los usa para atender tu consulta o pedido. {STORE_NAME} no recibe esa conversación ni participa en ella.</p>

      <h3>Vendedores</h3>
      <p><b>Datos:</b> tu nombre, tu número de WhatsApp y los datos de contacto que nos entregues para gestionar tu alta, además de los datos de tus productos.</p>
      <p><b>Finalidades y base legal:</b></p>
      <ul>
        <li>Publicar tus productos mostrando tu nombre y tu WhatsApp para que los compradores te contacten: tu consentimiento, que nos das por escrito antes de publicar.</li>
        <li>Gestionar la relación contigo, comunicarnos sobre tus publicaciones y atender reclamaciones: la relación acordada contigo y, cuando corresponda, obligación legal.</li>
      </ul>
      <p><b>Obligatoriedad:</b> darnos tu nombre y tu WhatsApp es necesario para publicar. Sin esos datos no podemos publicar tus productos.</p>
      <p><b>Retirada del consentimiento:</b> puedes retirarlo en cualquier momento escribiendo a {CONTACT_EMAIL}, sin que eso afecte a lo tratado antes. Dejaremos de mostrar tu nombre, tu número y tus productos.</p>

      <h3>Para todos</h3>
      <p><b>Destinatarios:</b> el nombre y el WhatsApp de los vendedores son visibles para cualquier visitante de la tienda. Los datos se guardan en servicios de Google (hoja de cálculo y almacenamiento), que nos prestan el servicio. No los cedemos a otros terceros salvo obligación legal. La conversación por WhatsApp se rige también por las condiciones de esa plataforma.</p>
      <p><b>Transferencias internacionales:</b> los servicios de Google pueden tratar datos fuera del Espacio Económico Europeo; en ese caso se aplican las garantías que prevé la normativa de protección de datos.</p>
      <p><b>Conservación:</b> los datos de consultas y pedidos, mientras sean necesarios para atenderlos y durante los plazos legales aplicables. Los datos de un vendedor, mientras esté activo; cuando se dé de baja o retire su consentimiento, dejamos de publicarlos y los conservamos solo durante los plazos legales que correspondan.</p>
      <p><b>Tus derechos:</b> acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad. Escribinos a {CONTACT_EMAIL}. Si crees que no tratamos bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
    </>
  )
  return (
    <>
      <p>Este sitio web <b>no instala cookies propias ni de terceros</b> con fines de análisis, publicidad o seguimiento.</p>
      <p>Guarda en tu navegador (localStorage), solo en tu dispositivo: la elección que hagas en el aviso de cookies y, si los marcas, tu lista de favoritos. Esta información no se envía a ningún servidor. Sirve para no volver a preguntarte y para recordar tus favoritos.</p>
      <p>Al pulsar "Escribir por WhatsApp" se abre WhatsApp, que tiene sus propias políticas de privacidad y cookies.</p>
      <p>Para mostrar los productos y las fotos, tu navegador se conecta a servicios de Google. No controlamos las cookies que esos servicios puedan usar; consulta sus políticas.</p>
      <p>Si en el futuro se añaden cookies que requieran tu consentimiento (por ejemplo, de analítica), se te pedirá antes de instalarlas. Puedes borrar estos datos desde los ajustes de tu navegador.</p>
    </>
  )
}
