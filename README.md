# Percha&Co

## Estado del trabajo

### Hecho en React

- Se añadió el formulario de alta de vendedores integrado con el catálogo actual, sin `react-router-dom`.
- La tienda enlaza a una página de planes antes del formulario. Freemium abre con el destaque desactivado; Plus y Pro abren con un mes de destaque preseleccionado, que se puede revisar o cambiar antes de enviar.
- El formulario ofrece Freemium (gratis), Plus (9,99 €/mes) y Pro (14,99 €/mes), más las opciones de destaque; los importes mostrados incluyen IVA.
- Se valida en el navegador el DNI/NIE en PDF, JPG o PNG, hasta 5 MB. La validación del servidor sigue siendo obligatoria.
- Se añadieron los términos para vendedores y la información de privacidad relativa al documento identificativo.
- La compilación de producción (`npm.cmd run build`) pasó.

### Código de Apps Script preparado

El archivo [`apps-script/Code.gs`](./apps-script/Code.gs) contiene el backend de la tienda y del portal de vendedores:

- `doGet` para productos, imágenes de productos y consulta de disponibilidad del destaque.
- Menú `Percha & Co. > Cargar imágenes del producto`: hasta 3 fotos por publicación y hasta 5 si es el producto destacado activo del vendedor. La tienda principal puede agregar o reemplazar imágenes dentro de ese límite. Los vendedores identificados por su correo solo pueden enviar fotos y una justificación; se guardan en `SOLICITUDES_CAMBIO_IMAGENES` sin cambiar el catálogo. La tienda principal puede aprobar una solicitud seleccionando su fila y usando `Aplicar solicitud seleccionada`. La carpeta raíz privada `IMAGENES_PRODUCTOS` contiene subcarpetas de propuestas separadas por vendedor; al aprobar una solicitud, las imágenes se copian al área privada de la tienda antes de publicarse.
- `Percha & Co. > Proteger columna de imágenes` limita también la edición manual de `Image_URL` al propietario configurado. Define la propiedad de Apps Script `STORE_OWNER_EMAIL` con el correo de la tienda principal antes de ejecutar esta opción; si no está definida, se usa `STORE_CONTACT_EMAIL`.
- La hoja del catálogo se reconoce por sus encabezados, aunque su pestaña se llame `Catalogo`, `Inventario` o `index.html`.
- Respuesta de catálogo compatible con React; solo devuelve productos publicados (`Activo`, `Activo_Auto` y el valor `si` usado en la fila de prueba).
- Las imágenes de Drive se sirven únicamente cuando pertenecen a productos publicados; la carpeta de documentos DNI no se expone.
- Alta de vendedor, validación de datos y archivo DNI restringido en `DNI_VENDEDORES`.
- Al recibir un alta, se manda la confirmación al vendedor y un aviso a `STORE_CONTACT_EMAIL` (`patoog58@gmail.com`). Al aprobar una cuenta se manda una única bienvenida y se registra su fecha en `Fecha_Bienvenida`; las columnas `Estado_Revision` y `Fecha_Bienvenida` se crean automáticamente en `VENDEDORES_MKP`. La tienda puede reenviar la bienvenida desde el menú seleccionando la fila del vendedor.
- Las cuentas Freemium no rechazadas se aprueban automáticamente a las 48 horas del registro; la tienda puede rechazarlas antes poniendo `Estado_Revision` en `Rechazado`. Los planes de pago requieren que el pago se marque como `Aprobado`.
- Área web `Acceso vendedores`: acceso con código de un solo uso enviado al correo de una cuenta aprobada (10 minutos, máximo 5 intentos por código y 5 envíos cada 6 horas); la sesión dura 6 horas. Las mutaciones se autorizan con el token de sesión, no con un ID de vendedor que envíe el navegador.
- El formulario de productos valida los campos y las fotos en el servidor, respeta los límites de 5/10/20 productos por plan y guarda los nuevos listados como `Pendiente`. Las publicaciones se aprueban manualmente o automáticamente tras 48 horas; las imágenes solo se sirven al público cuando la publicación esté activa. Permite hasta 3 fotos normalmente y hasta 5 al destacar una publicación elegible.
- Reserva de destaque bajo bloqueo de Apps Script, caducidad de solicitudes pagadas a las 24 horas, activación manual al registrar el pago y renovación manual.
- Aprobación automática de productos pendientes tras 48 horas, avisos de renovación y borrado del DNI de solicitudes canceladas tras 30 días.

### Pendiente antes de producción

1. Sincronizar y desplegar `Code.gs` y `ProductImageUploader.html` en el proyecto de Apps Script vinculado a la hoja. Configura `STORE_OWNER_EMAIL`, recarga la hoja y ejecuta `Percha & Co. > Proteger columna de imágenes` con la cuenta propietaria. Esto prepara carpetas privadas para vendedores aprobados y protege `Image_URL`; autoriza los accesos solicitados. Vuelve a ejecutar la opción al aprobar un vendedor nuevo.
2. `VENDEDORES_MKP` debe tener estos encabezados, escritos exactamente así, además de los campos actuales: `Estado_Destaque`, `Fecha_Limite_Pago`, `Fecha_Pago`, `Fecha_Fin_Destaque`, `Aviso_Renovacion`, `Fecha_Cancelacion` e `ID_Producto_Destacado`. `Catalogo` debe conservar `Producto`, `Precio Venta`, `Image_URL`, `ID`, `Categoria`, `Descripcion`, `Talles`, `Activo`, `ID_Vendedor` y `Fecha_Subida`.
3. Confirmar que `DNI_FOLDER_ID` existe en las propiedades del script y que la carpeta `DNI_VENDEDORES` sigue restringida.
4. Ejecutar `probarCatalogoPublico`, `probarDisponibilidadDestaque` y `verificarCarpetaDni` en Apps Script. No probar altas con DNI real hasta validar una prueba sintética controlada.
5. Ejecutar `configurarActivadoresPercha` una vez desde la cuenta propietaria y autorizar los permisos requeridos. El activador de edición es instalable (necesario para correo); el activador horario procesa vencimientos y aprobaciones de vendedores Freemium y productos.
6. Revisar la respuesta del correo y completar las instrucciones concretas de Bizum. El script no inventa el número de Bizum.
7. El portal requiere el correo registrado del vendedor aprobado para entregar el código. Los productos enviados se revisan en el catálogo, donde se puede cambiar `Activo` de `Pendiente` a `Activo` para aprobar inmediatamente o a `Suspendido` para no publicarlo.
8. Revisar los textos legales y la política de conservación con asesoramiento apropiado antes de publicar la recogida de DNI/NIE.
9. Solo después de validar el backend, actualizar el despliegue web de Apps Script y hacer una prueba de integración sin datos personales.

La web depende de que Apps Script publique `?action=productos`, `?action=imagen`, `?action=disponibilidadDestaque` y las acciones POST de registro, acceso y productos. Desplegar ambas partes y comprobar el flujo OTP con una cuenta de prueba aprobada.