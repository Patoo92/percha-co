# Continuidad: portal de vendedores

Actualizado: 8 de noviembre de 2026

## Publicado

- Portal web publicado en InfinityFree mediante GitHub Actions. El despliegue `Deploy to InfinityFree`, ejecución #11, terminó correctamente.
- Commit publicado: `a38e087` (`Publish seller product portal`).
- El portal está integrado en la tienda bajo **Acceso vendedores**. El vendedor solicita un código usando el correo de su cuenta aprobada y activa; el código vence a los 10 minutos.
- Backend de Apps Script publicado en la versión 20, conservando la URL de implementación configurada en `src/config.js`.
- El texto del correo de bienvenida se ajustó con escapes Unicode. El propietario confirmó la recepción de una bienvenida; la captura mostraba caracteres acentuados incorrectos antes de este ajuste.
- La compilación de producción pasó antes del despliegue. El árbol de trabajo quedó limpio después de publicar.

## Incidencia resuelta: el código de acceso no llegaba

El vendedor confirmó que había escrito mal el correo al solicitar el código. Tras corregirlo, recibió el OTP y pudo acceder al área de vendedor. No se guardan direcciones ni otros datos personales en esta nota.

No se requirieron cambios en el backend ni correos de prueba. Si vuelve a ocurrir, comprobar primero que el correo introducido coincida con el registrado en la hoja.

## Activadores de Apps Script

En la revisión del 6 de noviembre se observaban **0 activadores**. Se indicó al propietario cómo seleccionar y ejecutar `configurarActivadoresPercha` desde el editor de Apps Script y autorizar permisos; no quedó confirmado si llegó a ejecutarlo.

Esto afecta las automatizaciones horarias y el procesamiento instalable de ediciones, pero el código de acceso se solicita directamente mediante el endpoint web; la ausencia de esos activadores no explica por sí sola el fallo de entrega del OTP.

## Referencias del proyecto

- Aplicación: `src/PortalVendedor.jsx`
- Entrada y navegación del portal: `src/App.jsx`
- URL y configuración del backend: `src/config.js`
- Endpoints de OTP y autenticación: `apps-script/Code.gs`
- Despliegue web: `.github/workflows/deploy.yml`
- Ejecución de despliegue #11: https://github.com/Patoo92/percha-co/actions/runs/42250701079
