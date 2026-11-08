# Percha&Co

Tienda de ropa y productos con catálogo en Google Sheets, contacto por WhatsApp y portal de vendedores con acceso por código de un solo uso.

## Puesta en marcha

Requiere Node.js 18 o superior.

    npm install
    npm run dev      # probar en local (abrir la dirección que muestra la terminal)
    npm run build    # genera la carpeta dist/ para publicar

El despliegue web publica `dist/` mediante GitHub Actions (`.github/workflows/deploy.yml`) al hacer push a `main`.

## Estructura del proyecto

- `src/App.jsx`: catálogo, búsqueda, categorías, destacados, favoritos, detalle de producto, tema claro/oscuro y navegación general.
- `src/RegistroVendedor.jsx`: formulario de alta de vendedores, planes, destaque y adjunto de DNI/NIE.
- `src/PortalVendedor.jsx`: acceso de vendedores por OTP y envío de productos con imágenes.
- `src/Legal.jsx`: aviso legal, privacidad, cookies y términos para vendedores.
- `src/config.js`: datos de la tienda, contacto, redes, datos legales y URL del API.
- `src/styles.css`: estilos responsive y temas.
- `apps-script/Code.gs`: backend de Google Apps Script (catálogo, registro, OTP, productos, imágenes y automatizaciones).
- `apps-script/ProductImageUploader.html`: diálogo de carga de imágenes que se abre desde la hoja.
- `.github/workflows/deploy.yml`: compilación y publicación de `dist/` en InfinityFree.

## Configuración

- Datos de la tienda (nombre, WhatsApp, moneda, correo y URL del API): `src/config.js`.
- Datos legales del titular: `OWNER` en `src/config.js`. Mientras estén vacíos, los textos legales muestran `[COMPLETAR]`.
- Redes sociales: `SOCIAL` en `src/config.js`. Vacío = "próximamente".
- Los productos se cargan desde la API de Google Apps Script configurada como `PRODUCTS_API_URL` en `src/config.js`.
- Propiedades de Apps Script: `STORE_OWNER_EMAIL` (propietario que puede proteger `Image_URL` y usar las acciones de tienda; si falta, se usa `STORE_CONTACT_EMAIL`), `DNI_FOLDER_ID`, `MAX_REGISTROS_POR_EMAIL` (3 por defecto), `MAX_REGISTROS_GLOBALES_HORA` (20 por defecto) y `TEMP_IMAGE_RETENTION_HOURS` (24 por defecto para la limpieza de imágenes temporales).
- Valores fijos en `apps-script/Code.gs`: `STORE_CONTACT_EMAIL` (`patoog58@gmail.com`) para respuestas y avisos internos, `STORE_WHATSAPP_NUMBER` y `BIZUM_PHONE_NUMBER`. `STORE_CONTACT_EMAIL` no se lee de las propiedades del script: crear una propiedad con ese nombre no cambia el correo; hay que editar la constante en el código.

## Despliegue

Frontend:

1. Ejecutar `npm run build`.
2. Hacer push a `main`. GitHub Actions compila y publica `dist/` por FTP en InfinityFree.

Backend de Apps Script:

1. Copiar `apps-script/Code.gs` y `apps-script/ProductImageUploader.html` al proyecto vinculado a la hoja.
2. Configurar las propiedades del script indicadas en este README (`STORE_OWNER_EMAIL`, `DNI_FOLDER_ID` y, si se desea, los límites de registro y `TEMP_IMAGE_RETENTION_HOURS`). El correo de contacto `STORE_CONTACT_EMAIL` es una constante de `Code.gs`, no una propiedad del script.
3. Implementar el proyecto como aplicación web y mantener la URL de implementación en `PRODUCTS_API_URL`.
4. Ejecutar `configurarActivadoresPercha` desde la cuenta propietaria y autorizar los permisos.

## Formato del catálogo

El endpoint público debe devolver un arreglo JSON con `id`, `name`, `price`, `category`, `description`, `images` y `sizes`.

- `images`: rutas locales de `public/`, URLs completas o referencias `drive:<ID>` que se resuelven con `?action=imagen` en Apps Script. Hasta 3 fotos por publicación normal y 5 para el producto destacado activo; la primera es la que se ve en la tarjeta. Sin fotos se muestra un recuadro con la inicial.
- `sizes`: solo ropa, por ejemplo `["S", "M", "L"]`. Si el producto tiene talles, hay que elegir uno antes de escribir por WhatsApp y el talle va en el mensaje.
- `category`: `ropa` o `productos`.
- Paginación: 12 productos por página con botones Anterior / números / Siguiente, sin recargar.
- Favoritos: se guardan en el navegador de cada visitante (`localStorage`, clave `percha-favoritos`). No cambies el `id` de un producto ya publicado; los favoritos de productos borrados se ignoran.

## Seguridad del registro y de la hoja

### Unicidad del correo

El alta rechaza un correo que ya tenga una solicitud o cuenta abierta en `VENDEDORES_MKP`. La comparación no distingue mayúsculas de minúsculas y tiene en cuenta el apóstrofo de texto que se añade al neutralizar fórmulas.

- En Gmail y Googlemail se ignoran las etiquetas `+...` y los puntos de la parte local: `nombre+1@gmail.com`, `nombre@gmail.com`, `nom.bre@gmail.com` y `nombre@googlemail.com` cuentan como el mismo correo. El correo original se conserva para enviar la confirmación, el OTP y los avisos, que llegan a la misma bandeja.
- En otros dominios solo se normalizan mayúsculas/minúsculas y espacios; no se eliminan puntos ni etiquetas `+`, porque no todos los proveedores las tratan igual.
- Se consideran cerradas las filas con `Estado_Revision` en `Rechazado`, con `Estado_pago` en `Rechazado` o `Cancelado`, o con `Fecha_Cancelacion` informada. Esas filas no bloquean volver a solicitar el alta.
- Las solicitudes pendientes, las cuentas activas y las que todavía no se han cancelado sí bloquean un nuevo alta con el mismo correo.
- La comprobación se ejecuta dentro del bloqueo de Apps Script, así que dos altas simultáneas no pueden crear dos filas abiertas con el mismo correo.
- Si ya existen varias cuentas activas con el mismo correo por datos antiguos, el acceso OTP no envía código y registra el problema en los registros; la tienda debe dejar una sola cuenta activa.

### Protección antiabuso del registro público

El formulario de alta incluye un campo trampa oculto llamado `website`. Una persona no lo ve ni lo completa; si llega completado, el backend devuelve una respuesta de éxito simulada sin guardar la solicitud ni enviar correos.

Además, el servidor aplica dos límites antes de guardar cada alta:

- **3 solicitudes por correo cada 24 horas:** si en las últimas 24 horas ya hay 3 filas en `VENDEDORES_MKP` con el mismo `Email`, la siguiente solicitud con ese correo se rechaza. Es un límite de solicitudes, no de vendedores activos. Cuenta todas las filas, incluso las que luego se rechacen o cancelen, para evitar reintentos abusivos. Pasadas 24 horas desde las solicitudes anteriores, el correo puede volver a intentarlo. En Gmail/Googlemail se aplica la misma canonicalización de alias, así que `+n` y puntos no amplían el cupo.
- **20 solicitudes globales por hora:** entre todos los correos, no se aceptan más de 20 altas en una ventana móvil de 60 minutos. Es un límite de ritmo, no un cupo de vendedores. No afecta a vendedores ya registrados, al acceso por OTP, a la publicación de productos ni a las compras.

La comprobación de unicidad se ejecuta antes que estos límites. El límite por correo queda como defensa adicional para datos antiguos o para intentos que no lleguen a crear una fila; el límite global sigue protegiendo el alta frente a picos de tráfico.

Los límites se calculan leyendo la columna `Fecha_Registro` de `VENDEDORES_MKP` y se ejecutan con `LockService`, de modo que dos solicitudes simultáneas no pueden saltarse el control. No se usa CAPTCHA.

Valores configurables con propiedades de Apps Script:

- `MAX_REGISTROS_POR_EMAIL`: por defecto `3`.
- `MAX_REGISTROS_GLOBALES_HORA`: por defecto `20`.

Ambas deben ser números enteros positivos; si no existen o el valor no es un entero positivo, se usa el valor por defecto. `TEMP_IMAGE_RETENTION_HOURS` es independiente: debe ser un número positivo y se usa tal cual, sin redondearlo.

### Neutralización de fórmulas en las hojas

Los textos que escribe el usuario se guardan como texto aunque empiecen con `=`, `+`, `-` o `@`, para que Google Sheets no los interprete como fórmulas.

- Se aplica al `Nombre` y al `Email` de las altas en `VENDEDORES_MKP`.
- También a las justificaciones y datos de `SOLICITUDES_CAMBIO_IMAGENES`, incluidos los nombres de archivos de imagen, y a los motivos escritos desde las acciones de rechazo o suspensión.
- El mecanismo antepone un apóstrofo de texto para que Sheets no lo interprete como fórmula. Al comparar correos, el backend ignora ese apóstrofo inicial, por lo que la búsqueda de cuentas y el flujo OTP siguen funcionando.
- Los nombres de archivos de imagen nuevos que empiezan con esos símbolos se guardan con un prefijo `_`.
- Los campos de producto (nombre, descripción y talles) ya se rechazan en el servidor si empiezan con esos símbolos.

### Manejo de errores en la API

Los endpoints `doGet` y `doPost` separan los errores esperados de validación de los fallos internos:

- Los errores de validación se crean con `validacionError_(mensaje)`. El cliente recibe el mensaje seguro y específico, por ejemplo un correo mal escrito o un código OTP caducado.
- Cualquier error no marcado como validación se considera interno: se registra con `console.error` y el cliente recibe siempre `No se pudo completar la solicitud. Inténtalo de nuevo más tarde.`
- Así no se exponen mensajes de Google Sheets, Drive, correo, configuraciones faltantes ni trazas internas.
- Al añadir una validación nueva en un endpoint público, hay que lanzarla con `validacionError_`. Los errores internos deben seguir usando `new Error` para quedar fuera de la respuesta pública.

### Avisos de rechazo al vendedor

Cuando se rechaza una cuenta o se suspende un producto, el backend guarda el motivo cuando el flujo lo proporciona y avisa al vendedor por correo. El aviso se envía al correo original registrado en `VENDEDORES_MKP` (no al correo canónico usado para comparar alias) y usa `STORE_CONTACT_EMAIL` como `replyTo`.

- **Columnas nuevas:** `Motivo_Rechazo` y `Fecha_Aviso_Rechazo` se crean automáticamente en `VENDEDORES_MKP` y en la hoja del catálogo. `Fecha_Aviso_Rechazo` actúa como marca de aviso enviado para no repetir correos.
- **Rechazo manual de una cuenta:** selecciona la fila del vendedor en `VENDEDORES_MKP` y usa `Percha & Co. > Rechazar vendedor seleccionado`. Pide un motivo de 10 a 500 caracteres, guarda el motivo neutralizado, deja `Activo` en `no`, `Estado_Revision` en `Rechazado`, `Estado_Destaque` en `Cancelado` y completa `Fecha_Cancelacion` si estaba vacía. Después envía el aviso.
- **Suspensión manual de un producto:** selecciona la fila del producto en el catálogo y usa `Percha & Co. > Suspender producto seleccionado`. Pide un motivo de 10 a 500 caracteres, lo guarda neutralizado, pone `Activo` en `Suspendido` y envía el aviso al vendedor del producto.
- **Portal del vendedor:** los productos suspendidos muestran debajo de su estado el motivo registrado. Si no hay uno guardado, se muestra «El producto no cumple los requisitos de la tienda.».
- **Cambios directos en la hoja:** si la tienda pone `Estado_Revision` en `Rechazado` o `Estado_pago` en `Rechazado`/`Cancelado`, el activador de edición ajusta la cuenta y envía el aviso. Si pone `Activo` en `Suspendido` en el catálogo, envía el aviso de producto. En estos casos usa `Motivo_Rechazo` si ya existe. Si está vacío, aplica estos textos:
  - `Estado_Revision=Rechazado`: «La solicitud no cumple los requisitos de la tienda.»
  - `Estado_pago=Rechazado`: «El pago no fue validado.»
  - `Estado_pago=Cancelado`: «La solicitud se canceló antes de completar el pago.» y asunto «Solicitud cancelada - Percha&Co».
  - `Activo=Suspendido`: «El producto no cumple los requisitos de la tienda.»
  - Último fallback si no hay ningún motivo: «No se indicó un motivo concreto. Responde a este correo para revisarlo.»
- **Suspensión por edición directa:** poner `Activo` en `Suspendido` no pide ni guarda un motivo nuevo; usa el `Motivo_Rechazo` existente o el texto genérico anterior.
- **Solicitudes caducadas:** una solicitud de pago con `Estado_pago = pendiente_pago` y `Fecha_Limite_Pago` vencida se cancela con el motivo «No se registró el pago dentro de las 24 horas. La plaza de destaque queda libre.» y se avisa al vendedor con el asunto «Solicitud cancelada - Percha&Co».
- **Aviso único:** si `Fecha_Aviso_Rechazo` ya tiene valor, el backend no vuelve a enviar el correo. Para reenviar un aviso, borra esa celda y vuelve a ejecutar la acción o el cambio de estado. Si el envío falla, la fecha no se marca y se puede reintentar.
- **Aprobaciones:** al aprobar o reactivar una cuenta, o al quitar un producto de `Suspendido`, se limpian `Motivo_Rechazo` y `Fecha_Aviso_Rechazo` para que un rechazo posterior pueda generar un aviso nuevo.
- **Correos:** el rechazo de cuenta usa el asunto «Tu solicitud de vendedor no ha sido aprobada - Percha&Co» y el de producto «Producto no publicado en Percha&Co». Ambos incluyen el motivo disponible o, si no lo hay, un motivo genérico; el nombre del vendedor o producto se incluye cuando está disponible.

### Limpieza de imágenes temporales

La carga de imágenes de productos usa archivos temporales en la carpeta privada `IMAGENES_PRODUCTOS`. El proceso horario `procesarAutomatizacionesCadaHora` ejecuta `limpiarCargasTemporalesAbandonadas` para retirar los archivos que ya no pueden usarse.

- **Antigüedad:** por defecto se borran los archivos de imagen con más de 24 horas. Se puede cambiar con la propiedad de Apps Script `TEMP_IMAGE_RETENTION_HOURS`; debe ser un número positivo. Si no existe o no es válido, se usan 24 horas.
- **Qué se revisa:** archivos de imagen directamente en `IMAGENES_PRODUCTOS` y archivos dentro de las subcarpetas cuyo nombre empieza por `SOLICITUD_`. Solo se consideran JPG, PNG, GIF y WebP; los archivos que no son imagen no se tocan.
- **Qué se protege:** los IDs de imagen referenciados en `Catalogo.Image_URL`, incluidas las referencias `drive:<ID>`, las URLs de Drive y los enlaces dentro de texto enriquecido, y los IDs de `SOLICITUDES_CAMBIO_IMAGENES` con estado `Pendiente` en `IDs_Propuestas`. Esos archivos no se borran aunque hayan caducado.
- **Resultado:** cada archivo se envía a la papelera con `setTrashed(true)`. La función registra cuántas imágenes se eliminaron y cuántas fallaron; un fallo en un archivo no detiene la limpieza de los demás.
- **Ejecución manual:** `Percha & Co. > Limpiar imágenes temporales` ejecuta la misma limpieza desde la hoja. El activador horario la ejecuta después de vencimientos, aprobaciones, avisos y borrado de DNI.
- **Límite de seguridad:** la limpieza no borra carpetas ni imágenes que sigan referenciadas por el catálogo o por propuestas pendientes. Si una imagen antigua se usa en una fila del catálogo con un formato de URL no reconocido, puede no quedar protegida y ser eliminada; conviene revisar los formatos de `Image_URL` antes de confiar en la limpieza.

### Eliminaciones puntuales de archivos

Además de la limpieza horaria, el backend borra archivos en estos flujos concretos:

- **Cancelar una carga de producto:** `cancelarCargaProductoVendedor` mueve a la papelera las imágenes temporales de esa carga y elimina su registro de caché (`Code.gs:345`).
- **Descartar imágenes seleccionadas:** `eliminarImagenesCarga` mueve a la papelera las imágenes temporales validadas y limpia su caché (`Code.gs:1681`).
- **Fallo de alta después de subir el DNI:** si `registrarVendedor` falla después de guardar el documento, intenta borrar el DNI con `setTrashed(true)`; si esa limpieza también falla, registra el error (`Code.gs:1924`).
- **Fallo al aplicar una solicitud de imágenes:** si `aplicarSolicitudImagenSeleccionada` falla después de copiar las propuestas, borra las copias recién creadas en `IMAGENES_PRODUCTOS` (`Code.gs:1078`). No borra las propuestas originales ni las imágenes anteriores del producto; las imágenes anteriores que dejen de estar referenciadas las retirará la limpieza periódica después del plazo.
- **DNI de cuentas canceladas:** `borrarDocumentosCancelados_` borra el archivo de `ID_ARCHIVO_DNI` cuando han pasado 30 días desde `Fecha_Cancelacion` y después vacía la celda (`Code.gs:2553`).

## Estado del trabajo

### Cambios recientes (8 de noviembre de 2026)

- Se añadieron límites antiabuso al registro público y un campo trampa oculto, sin CAPTCHA.
- Se neutralizan los textos que podrían ejecutarse como fórmulas en Google Sheets.
- Los errores de validación devuelven mensajes seguros y los errores internos ya no exponen detalles técnicos al cliente.
- El registro impide correos duplicados abiertos y el acceso OTP bloquea el envío si detecta varias cuentas activas con el mismo correo.
- Los alias de Gmail/Googlemail con `+n` o puntos se tratan como el mismo correo para evitar cuentas duplicadas.
- Se añadieron las columnas `Motivo_Rechazo` y `Fecha_Aviso_Rechazo` y avisos por correo al rechazar una cuenta, cancelar un pago o suspender un producto.
- Se añadieron las acciones de menú `Rechazar vendedor seleccionado` y `Suspender producto seleccionado`, con motivo obligatorio de 10 a 500 caracteres.
- El portal del vendedor muestra el motivo de los productos suspendidos, incluido el motivo genérico si la hoja no contiene uno.
- Se añadió la limpieza horaria de imágenes temporales abandonadas, con retención configurable de 24 horas por defecto y protección de imágenes publicadas o pendientes de aprobación.
- La documentación de uso, configuración, despliegue y seguridad se consolidó en este README; se eliminó `LEEME.md`.

### Hecho en React

- Se añadió el formulario de alta de vendedores integrado con el catálogo actual, sin `react-router-dom`.
- La tienda enlaza a una página de planes antes del formulario. Freemium abre con el destaque desactivado; Plus y Pro abren con un mes de destaque preseleccionado, que se puede revisar o cambiar antes de enviar.
- El formulario ofrece Freemium (gratis), Plus (9,99 €/mes) y Pro (14,99 €/mes), más las opciones de destaque; los importes mostrados incluyen IVA.
- Se valida en el navegador el DNI/NIE en PDF, JPG o PNG, hasta 5 MB. La validación del servidor sigue siendo obligatoria.
- Se añadieron los términos para vendedores y la información de privacidad relativa al documento identificativo.
- El registro incluye un campo trampa oculto y límites antiabuso en el servidor: 3 solicitudes por correo cada 24 horas y 20 solicitudes globales por hora. También rechaza un correo que ya tenga una solicitud abierta. Los límites se pueden ajustar con las propiedades de Apps Script `MAX_REGISTROS_POR_EMAIL` y `MAX_REGISTROS_GLOBALES_HORA`; no se usa CAPTCHA.
- La compilación de producción (`npm.cmd run build`) pasó.

### Código de Apps Script preparado

El archivo [`apps-script/Code.gs`](./apps-script/Code.gs) contiene el backend de la tienda y del portal de vendedores:

- `doGet` para productos, imágenes de productos y consulta de disponibilidad del destaque.
- Menú `Percha & Co. > Cargar imágenes del producto`: hasta 3 fotos por publicación y hasta 5 si es el producto destacado activo del vendedor. La tienda principal puede agregar o reemplazar imágenes dentro de ese límite. Los vendedores identificados por su correo solo pueden enviar fotos y una justificación; se guardan en `SOLICITUDES_CAMBIO_IMAGENES` sin cambiar el catálogo. La tienda principal puede aprobar una solicitud seleccionando su fila y usando `Aplicar solicitud seleccionada`. La carpeta raíz privada `IMAGENES_PRODUCTOS` contiene subcarpetas de propuestas separadas por vendedor; al aprobar una solicitud, las imágenes se copian al área privada de la tienda antes de publicarse.
- Menú `Percha & Co. > Rechazar vendedor seleccionado`: pide un motivo de 10 a 500 caracteres, marca la cuenta como rechazada, cancela el destaque y avisa al vendedor. Menú `Percha & Co. > Suspender producto seleccionado`: pide un motivo, deja el producto en `Suspendido` y avisa al vendedor. Ambos usan `Motivo_Rechazo` y `Fecha_Aviso_Rechazo`.
- Menú `Percha & Co. > Limpiar imágenes temporales`: ejecuta manualmente la limpieza de imágenes abandonadas de `IMAGENES_PRODUCTOS` y sus subcarpetas `SOLICITUD_*`.
- `Percha & Co. > Proteger columna de imágenes` limita también la edición manual de `Image_URL` al propietario configurado. Define la propiedad de Apps Script `STORE_OWNER_EMAIL` con el correo de la tienda principal antes de ejecutar esta opción; si no está definida, se usa `STORE_CONTACT_EMAIL`.
- La hoja del catálogo se reconoce por sus encabezados, aunque su pestaña se llame `Catalogo`, `Inventario` o `index.html`.
- Respuesta de catálogo compatible con React; solo devuelve productos publicados (`Activo`, `Activo_Auto` y el valor `si` usado en la fila de prueba).
- Las imágenes de Drive se sirven únicamente cuando pertenecen a productos publicados; la carpeta de documentos DNI no se expone.
- Alta de vendedor, validación de datos y archivo DNI restringido en `DNI_VENDEDORES`.
- Al recibir un alta, se manda la confirmación al vendedor y un aviso a `STORE_CONTACT_EMAIL` (`patoog58@gmail.com`). Al aprobar una cuenta se manda una única bienvenida y se registra su fecha en `Fecha_Bienvenida`; las columnas `Estado_Revision`, `Fecha_Bienvenida`, `Fecha_Cancelacion`, `Motivo_Rechazo` y `Fecha_Aviso_Rechazo` se crean automáticamente en `VENDEDORES_MKP`. La tienda puede reenviar la bienvenida desde el menú seleccionando la fila del vendedor.
- Las cuentas Freemium no rechazadas se aprueban automáticamente a las 48 horas del registro; la tienda puede rechazarlas antes poniendo `Estado_Revision` en `Rechazado`. Los planes de pago requieren que el pago se marque como `Aprobado`. Al rechazar una cuenta o cancelar un pago se envía un aviso con el motivo disponible o con un motivo genérico si la celda `Motivo_Rechazo` está vacía; `Fecha_Aviso_Rechazo` evita duplicados y se limpia al aprobar o reactivar.
- Área web `Acceso vendedores`: acceso con código de un solo uso enviado al correo de una cuenta aprobada (10 minutos, máximo 5 intentos por código y 5 envíos cada 6 horas); la sesión dura 6 horas. Los envíos se cuentan por buzón canónico, así que los alias de Gmail/Googlemail no amplían el límite. Las mutaciones se autorizan con el token de sesión, no con un ID de vendedor que envíe el navegador.
- El formulario de productos valida los campos y las fotos en el servidor, respeta los límites de 5/10/20 productos por plan y guarda los nuevos listados como `Pendiente`. Las publicaciones se aprueban manualmente o automáticamente tras 48 horas; las imágenes solo se sirven al público cuando la publicación esté activa. Permite hasta 3 fotos normalmente y hasta 5 al destacar una publicación elegible. Si la tienda pone `Activo` en `Suspendido`, no se pide ni se guarda un motivo nuevo: se usa el `Motivo_Rechazo` existente o, si está vacío, el texto «El producto no cumple los requisitos de la tienda.»; después se avisa al vendedor. Al cambiarlo de nuevo a un estado distinto de `Suspendido` se limpian los avisos anteriores.
- Reserva de destaque bajo bloqueo de Apps Script, caducidad de solicitudes pagadas a las 24 horas, activación manual al registrar el pago y renovación manual.
- Aprobación automática de productos pendientes tras 48 horas, avisos de renovación, borrado del DNI de solicitudes canceladas tras 30 días y limpieza de imágenes temporales abandonadas. La limpieza usa `TEMP_IMAGE_RETENTION_HOURS` (24 horas por defecto) y protege las imágenes del catálogo y las propuestas pendientes.
- `borrarDocumentosCancelados_` elimina de Drive el archivo indicado en `ID_ARCHIVO_DNI` cuando han pasado 30 días desde `Fecha_Cancelacion`, y después vacía esa celda. Es una eliminación de archivos distinta de la limpieza de imágenes temporales.
- Los textos del registro (nombre y correo) y las justificaciones de cambio de imágenes se neutralizan al escribirse en la hoja: si empiezan con `=`, `+`, `-` o `@`, se guardan como texto para que no se ejecuten como fórmula.
- `doGet` y `doPost` separan los errores de validación, que devuelven un mensaje seguro, de los errores internos, que devuelven un mensaje genérico y se registran solo en el servidor.
- El alta comprueba la unicidad del correo dentro del bloqueo y el acceso OTP solo entrega código cuando hay exactamente una cuenta activa que coincida.
- Para comparar correos, los alias de Gmail/Googlemail (`+n` y puntos) se reducen al mismo buzón; para enviar correos se conserva la dirección original registrada.

### Riesgos y mejoras pendientes

Estos puntos están identificados en el código actual y todavía no están corregidos:

- **Aprobación automática de vendedores Freemium:** una solicitud pendiente no rechazada se activa automáticamente después de 48 horas. La validación del archivo comprueba su formato y firma, pero no demuestra la identidad del solicitante. Si se requiere verificación humana, hay que retirar esta aprobación automática y mantener la cuenta pendiente hasta que la tienda la apruebe.
- **Pruebas y configuración operativa:** no hay pruebas automatizadas dentro del repositorio para Apps Script; las comprobaciones de esta iteración se hicieron con simulaciones temporales fuera del proyecto. La última nota de continuidad indica que no se confirmó la instalación de los activadores; hay que verificarlo en el proyecto vinculado a la hoja. Preparar una prueba controlada del recorrido completo (alta, aprobación, OTP, publicación, imágenes, rechazo y limpieza) con datos sintéticos, sin documentos personales reales.
- **Copias de seguridad y recuperación:** definir y probar cómo restaurar la hoja y recuperar las carpetas de Drive de vendedores e imágenes ante borrados accidentales o fallos de configuración.
- **Datos legales:** los datos del titular (`OWNER`) siguen vacíos en `src/config.js`. Completar y revisar los textos legales y la conservación de DNI/NIE antes de continuar recogiendo documentos.
- **Alias de correo en otros proveedores:** la canonicalización automática de `+n` y puntos se limita a Gmail/Googlemail. En otros dominios no se aplica para no unir buzones que el proveedor podría tratar como distintos y permitir accesos OTP cruzados. Si se detecta abuso con otro proveedor, revisar sus reglas y ampliar la lista solo para dominios verificados.

### Pendiente antes de producción

1. Sincronizar y desplegar `Code.gs` y `ProductImageUploader.html` en el proyecto de Apps Script vinculado a la hoja. Configura `STORE_OWNER_EMAIL` y, si quieres cambiar la retención de imágenes temporales, `TEMP_IMAGE_RETENTION_HOURS` (24 por defecto). Recarga la hoja y ejecuta `Percha & Co. > Proteger columna de imágenes` con la cuenta propietaria. Esto prepara carpetas privadas para vendedores aprobados y protege `Image_URL`; autoriza los accesos solicitados. Vuelve a ejecutar la opción al aprobar un vendedor nuevo.
2. `VENDEDORES_MKP` debe tener estos encabezados, escritos exactamente así, además de los campos actuales: `Estado_Destaque`, `Fecha_Limite_Pago`, `Fecha_Pago`, `Fecha_Fin_Destaque`, `Aviso_Renovacion`, `Fecha_Cancelacion`, `ID_Producto_Destacado`, `Motivo_Rechazo` y `Fecha_Aviso_Rechazo`. `Catalogo` debe conservar `Producto`, `Precio Venta`, `Image_URL`, `ID`, `Categoria`, `Descripcion`, `Talles`, `Activo`, `ID_Vendedor`, `Fecha_Subida`, `Motivo_Rechazo` y `Fecha_Aviso_Rechazo`. Las columnas de rechazo se crean automáticamente, pero conviene comprobar que aparecen con esos nombres. Comprueba también que no haya varias filas abiertas con el mismo `Email`; se consideran cerradas las que tienen `Estado_Revision=Rechazado`, `Estado_pago=Rechazado` o `Cancelado`, o `Fecha_Cancelacion` informada. En Gmail/Googlemail, las variantes con `+n` o puntos cuentan como el mismo correo. Las altas nuevas ya lo impiden, pero los datos duplicados antiguos deben resolverse manualmente.
3. Confirmar que `DNI_FOLDER_ID` existe en las propiedades del script y que la carpeta `DNI_VENDEDORES` sigue restringida.
4. Ejecutar `probarCatalogoPublico`, `probarDisponibilidadDestaque` y `verificarCarpetaDni` en Apps Script. Probar también `limpiarCargasTemporalesAbandonadas` con archivos sintéticos y comprobar que conserva las imágenes del catálogo y las propuestas pendientes. No probar altas con DNI real hasta validar una prueba sintética controlada.
5. Ejecutar `configurarActivadoresPercha` una vez desde la cuenta propietaria y autorizar los permisos requeridos. El activador de edición es instalable (necesario para correo); el activador horario procesa vencimientos, aprobaciones de vendedores Freemium y productos, avisos de rechazo, borrado de DNI y limpieza de imágenes temporales.
6. Revisar la respuesta del correo y completar las instrucciones concretas de Bizum. El script no inventa el número de Bizum.
7. El portal requiere el correo registrado del vendedor aprobado para entregar el código. Los productos nuevos enviados por vendedores quedan `Pendiente`; para aprobar uno manualmente, cambia su columna `Activo` a `Activo` en el catálogo. Para no publicarlo, usa `Percha & Co. > Suspender producto seleccionado` y escribe el motivo, o pon `Activo` en `Suspendido` después de rellenar `Motivo_Rechazo`; el vendedor recibirá un aviso. Si no se revisa, el proceso horario lo aprueba automáticamente a las 48 horas. Esto es distinto de las solicitudes para cambiar imágenes de un producto existente: esas se guardan en `SOLICITUDES_CAMBIO_IMAGENES` y se aplican seleccionando la solicitud y usando `Aplicar solicitud seleccionada`.
8. Revisar los textos legales y la política de conservación con asesoramiento apropiado antes de publicar la recogida de DNI/NIE.
9. Solo después de validar el backend, actualizar el despliegue web de Apps Script y hacer una prueba de integración sin datos personales.

La web depende de que Apps Script publique `?action=productos`, `?action=imagen`, `?action=disponibilidadDestaque` y las acciones POST de registro, acceso y productos. Desplegar ambas partes y comprobar el flujo OTP con una cuenta de prueba aprobada.