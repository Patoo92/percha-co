# Percha&Co

## Estado del trabajo

### Hecho en React

- Se añadió el formulario de alta de vendedores integrado con el catálogo actual, sin `react-router-dom`.
- El formulario ofrece Freemium (gratis), Plus (9,99 €/mes) y Pro (14,99 €/mes), más las opciones de destaque e importes acordados; los importes mostrados incluyen IVA.
- Se valida en el navegador el DNI/NIE en PDF, JPG o PNG, hasta 5 MB. La validación del servidor sigue siendo obligatoria.
- Se añadieron los términos para vendedores y la información de privacidad relativa al documento identificativo.
- La compilación de producción (`npm.cmd run build`) pasó.

### Código de Apps Script preparado

El archivo [`apps-script/Code.gs`](./apps-script/Code.gs) contiene el backend completo para revisión y posterior copia al proyecto de Apps Script:

- `doGet` para productos, imágenes de productos y consulta de disponibilidad del destaque.
- Respuesta de catálogo compatible con React; solo devuelve productos publicados (`Activo`, `Activo_Auto` y el valor `si` usado en la fila de prueba).
- Las imágenes de Drive se sirven únicamente cuando pertenecen a productos publicados; la carpeta de documentos DNI no se expone.
- Alta de vendedor, validación de datos y archivo DNI restringido en `DNI_VENDEDORES`.
- Reserva de destaque bajo bloqueo de Apps Script, caducidad de solicitudes pagadas a las 24 horas, activación manual al registrar el pago y renovación manual.
- Aprobación automática de productos tras 48 horas, avisos de renovación y borrado del DNI de solicitudes canceladas tras 30 días.

### Pendiente antes de producción

1. **No se ha pegado ni desplegado automáticamente** `apps-script/Code.gs` en Google Apps Script. Debes abrirlo desde el portátil, copiar el contenido al proyecto correcto y revisar los encabezados de `VENDEDORES_MKP` y `Catalogo`.
2. `VENDEDORES_MKP` debe tener estos encabezados, escritos exactamente así, además de los campos actuales: `Estado_Destaque`, `Fecha_Limite_Pago`, `Fecha_Pago`, `Fecha_Fin_Destaque`, `Aviso_Renovacion`, `Fecha_Cancelacion` e `ID_Producto_Destacado`. `Catalogo` debe conservar `Producto`, `Precio Venta`, `Image_URL`, `ID`, `Categoria`, `Descripcion`, `Talles`, `Activo`, `ID_Vendedor` y `Fecha_Subida`.
3. Confirmar que `DNI_FOLDER_ID` existe en las propiedades del script y que la carpeta `DNI_VENDEDORES` sigue restringida.
4. Ejecutar `probarCatalogoPublico`, `probarDisponibilidadDestaque` y `verificarCarpetaDni` en Apps Script. No probar altas con DNI real hasta validar una prueba sintética controlada.
5. Ejecutar `configurarActivadoresPercha` una vez desde la cuenta propietaria y autorizar los permisos requeridos. El activador de edición es instalable (necesario para correo); el activador horario procesa vencimientos y aprobaciones.
6. Revisar la respuesta del correo y completar las instrucciones concretas de Bizum. El script no inventa el número de Bizum.
7. La sección visual de cinco productos destacados, selección del producto destacado, subida de productos de vendedores (incluido el límite de fotos) y cierre de cuenta con borrado inmediato del DNI aún requieren implementación.
8. Revisar los textos legales y la política de conservación con asesoramiento apropiado antes de publicar la recogida de DNI/NIE.
9. Solo después de validar el backend, actualizar el despliegue web de Apps Script y hacer una prueba de integración sin datos personales.

El formulario React depende de que el despliegue de Apps Script publique `?action=productos`, `?action=imagen`, `?action=disponibilidadDestaque` y el `POST` `registrarVendedor`. No desplegar la web mientras el backend no tenga esas acciones.