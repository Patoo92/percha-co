import { STORE_NAME, BRAND, CONTACT_EMAIL, OWNER } from './config.js'

const v = (x) => x || '[COMPLETAR]'

export const LEGAL_TITLES = {
  aviso: 'Aviso legal',
  privacidad: 'Política de privacidad',
  cookies: 'Política de cookies',
  vendedores: 'Términos y condiciones para vendedores',
}

export function LegalText({ doc }) {
  if (doc === 'vendedores') return (
    <>
      <p>Estos términos regulan el alta de vendedores y la publicación de productos en {STORE_NAME}. Responsable del servicio: {v(OWNER.name)}. Contacto: {CONTACT_EMAIL}.</p>
      <h3>Servicio y ventas</h3>
      <p>{STORE_NAME} ofrece un catálogo y un espacio de contacto entre vendedores y compradores. La compraventa, el pago del producto, la entrega y las condiciones se acuerdan directamente entre las partes; {STORE_NAME} no recibe ni custodia los productos ni procesa el pago de esas compraventas. Los pagos de los planes y destaques de la plataforma se gestionan por Bizum según las instrucciones recibidas.</p>
      <p>El vendedor es responsable de la exactitud de sus datos y anuncios, de la legalidad y estado de los artículos, de disponer de los derechos necesarios sobre las imágenes y de atender a los compradores. Nada de estos términos limita derechos u obligaciones que no puedan excluirse legalmente.</p>
      <h3>Planes y publicaciones</h3>
      <ul>
        <li>Freemium: hasta 5 productos activos, sin coste.</li>
        <li>Plus: hasta 10 productos activos, 9,99 € al mes.</li>
        <li>Pro: hasta 20 productos activos, 14,99 € al mes.</li>
      </ul>
      <p>Los precios indicados incluyen IVA. Cada publicación corresponde a un producto; se admiten hasta 3 fotos por publicación y hasta 5 para el producto destacado. El sistema puede impedir nuevas publicaciones al alcanzar el límite del plan.</p>
      <h3>Destaques</h3>
      <p>El destaque es opcional y adicional al plan: 1 semana por 1,99 €, 2 semanas por 2,99 €, 3 semanas por 4,99 € o mes completo por 9,99 €, IVA incluido. El mes completo termina en la misma fecha del mes siguiente. El cupo máximo es de cinco vendedores destacados simultáneamente. La solicitud reserva plaza durante 24 horas; si no se registra el pago dentro de ese plazo, se cancela. El período contratado corre desde la verificación del pago. Cada vendedor puede mostrar un único producto destacado; una vez publicado como destacado, no se puede sustituir por otro. La renovación añade una semana por 1,99 €, sujeta a la disponibilidad del cupo.
      </p>
      <h3>Revisión y moderación</h3>
      <p>Las publicaciones comienzan como pendientes. Podemos revisarlas y activarlas antes; si no hay una decisión manual, podrán activarse automáticamente tras 48 horas. Podemos retirar o suspender publicaciones o cuentas que infrinjan estos términos o la normativa aplicable y notificaremos la medida al contacto facilitado. Si un producto sigue pendiente o el vendedor detecta un problema, puede contactar con {CONTACT_EMAIL}.</p>
      <p>El vendedor puede contactar con {CONTACT_EMAIL} para consultas sobre una decisión de moderación. La moderación no sustituye la responsabilidad del vendedor sobre sus anuncios ni las obligaciones legales de la plataforma.</p>
    </>
  )
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
      <p>Esta política explica cómo tratamos los datos de quienes visitan la tienda y compran, y de los vendedores que solicitan publicar productos en {STORE_NAME}.</p>

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
      <p><b>Datos:</b> tu nombre comercial, WhatsApp, correo electrónico, la información de tus productos e imágenes y el documento identificativo (DNI/NIE) que aportes para verificar tu identidad y prevenir perfiles falsos y fraudes.</p>
      <p><b>Finalidades y base legal:</b></p>
      <ul>
        <li>Tramitar tu solicitud, gestionar la cuenta y verificar tu identidad: medidas precontractuales y gestión de la relación acordada contigo.</li>
        <li>Publicar tus productos mostrando tu nombre y tu WhatsApp para que los compradores te contacten: tu consentimiento, que nos das por escrito antes de publicar.</li>
        <li>Gestionar la relación contigo, comunicarnos sobre tus publicaciones y atender reclamaciones: la relación acordada contigo y, cuando corresponda, obligación legal.</li>
      </ul>
      <p><b>Documento identificativo:</b> el DNI/NIE se guarda en una carpeta de Google Drive con acceso restringido al titular autorizado de {STORE_NAME}; no se publica ni se entrega a los compradores. Se conserva mientras la cuenta esté activa y se elimina al cerrar la cuenta. Si la solicitud se rechaza o cancela, se elimina en un máximo de 30 días. Conservaremos solo los datos que debamos mantener por una obligación legal o para gestionar reclamaciones.</p>
      <p><b>Obligatoriedad:</b> darnos tu nombre y tu WhatsApp es necesario para publicar. Sin esos datos no podemos publicar tus productos.</p>
      <p><b>Retirada del consentimiento:</b> puedes retirarlo en cualquier momento escribiendo a {CONTACT_EMAIL}, sin que eso afecte a lo tratado antes. Dejaremos de mostrar tu nombre, tu número y tus productos.</p>

      <h3>Para todos</h3>
      <p><b>Destinatarios:</b> el nombre, WhatsApp, productos e imágenes publicados son visibles para los visitantes de la tienda; el DNI/NIE no lo es. Los datos se guardan en servicios de Google (hoja de cálculo y almacenamiento), que nos prestan el servicio. El acceso a los documentos identificativos está restringido. No los cedemos a otros terceros salvo obligación legal. La conversación por WhatsApp se rige también por las condiciones de esa plataforma.</p>
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
