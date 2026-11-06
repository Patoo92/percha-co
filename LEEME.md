# Tienda con WhatsApp

Requisitos: Node.js 18 o superior.

    npm install
    npm run dev      # probar en local (abrir la dirección que muestra la terminal)
    npm run build    # genera la carpeta dist/ para publicar

- Datos de la tienda (nombre, WhatsApp, moneda): src/config.js
- Productos: se cargan desde la API de Google Apps Script configurada como `PRODUCTS_API_URL` en `src/config.js`. En la hoja, selecciona la fila y usa `Percha & Co. > Cargar imágenes del producto`. La tienda principal puede agregar o reemplazar imágenes; los vendedores registrados solo pueden enviar propuestas con una justificación, pendientes de aprobación. Ejecuta `Proteger columna de imágenes` como propietario para proteger `Image_URL` y preparar carpetas privadas por vendedor; vuelve a ejecutarlo al dar de alta a uno nuevo. Configura antes la propiedad de Apps Script `STORE_OWNER_EMAIL`. El catálogo se detecta por sus encabezados aunque la pestaña se llame `Catalogo`, `Inventario` o `index.html`.
  El endpoint público debe devolver un arreglo JSON con los campos `id`, `name`, `price`, `category`,
  `description`, `images` y `sizes`. Las imágenes admiten rutas locales de `public/`, URLs completas
  o referencias `drive:<ID>` que se resuelven usando `?action=imagen` en Apps Script.
- Las solicitudes de alta envían una confirmación al vendedor y un aviso a `STORE_CONTACT_EMAIL` (`patoog58@gmail.com`). Al aprobar una cuenta se envía una única bienvenida. Las columnas `Estado_Revision` y `Fecha_Bienvenida` se crean automáticamente. Las solicitudes Freemium no rechazadas se aprueban tras 48 horas; las de pago requieren marcar `Estado_pago` como `Aprobado`.
- El botón `Acceso vendedores` permite solicitar un código de un solo uso por correo (10 minutos, máximo 5 intentos por código y 5 envíos cada 6 horas). El portal permite enviar y consultar productos propios; las altas quedan `Pendiente` hasta su revisión o aprobación automática tras 48 horas. Límites: 5/10/20 productos por plan y hasta 3 fotos normales o 5 para un destacado elegible.
- Fotos: la plantilla guarda las fotos en Drive y enlaza las referencias en `Image_URL`; también se admiten rutas locales de `public/img/` y URLs. Hasta 3 por publicación normal y hasta 5 para el producto destacado activo del vendedor; la primera es la que se ve en la tarjeta:
  "images": ["img/remera-1.jpg", "img/remera-2.jpg"]
  Sin fotos se muestra un recuadro con la inicial.
- Talles (solo ropa): "sizes": ["S", "M", "L"]. Si el producto tiene talles, hay que elegir uno
  antes de escribir por WhatsApp y el talle va en el mensaje. Si no, se omite el campo.
- Categorías: "category": "ropa" o "category": "productos" en cada producto.
- Paginación: ver más abajo.
- Datos legales del titular (nombre, NIF, domicilio): OWNER en src/config.js. Mientras estén vacíos, los textos legales muestran [COMPLETAR].
- Redes sociales: SOCIAL en src/config.js. Vacío = "próximamente".
- Favoritos: se guardan en el navegador de cada visitante (localStorage, clave "percha-favoritos"). No cambies el "id" de un producto
  ya publicado: los favoritos guardados dejarían de coincidir. Los favoritos de productos borrados se ignoran.
- Paginación: botones Anterior / números / Siguiente; cada página muestra PAGE_SIZE productos (12) y reemplaza la grilla sin recargar.
