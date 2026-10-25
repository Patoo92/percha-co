# Tienda con WhatsApp

Requisitos: Node.js 18 o superior.

    npm install
    npm run dev      # probar en local (abrir la dirección que muestra la terminal)
    npm run build    # genera la carpeta dist/ para publicar

- Datos de la tienda (nombre, WhatsApp, moneda): src/config.js
- Productos: se cargan desde la API de Google Apps Script configurada como `PRODUCTS_API_URL` en `src/config.js`.
  El endpoint público debe devolver un arreglo JSON con los campos `id`, `name`, `price`, `category`,
  `description`, `images` y `sizes`. Las imágenes admiten rutas locales de `public/`, URLs completas
  o referencias `drive:<ID>` que se resuelven usando `?action=imagen` en Apps Script.
- Fotos: public/img/. Hasta 5 por producto; la primera es la que se ve en la tarjeta:
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
