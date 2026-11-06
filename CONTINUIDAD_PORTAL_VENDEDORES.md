# Continuidad: portal de vendedores

Actualizado: 6 de noviembre de 2026

## Publicado

- Portal web publicado en InfinityFree mediante GitHub Actions. El despliegue `Deploy to InfinityFree`, ejecución #11, terminó correctamente.
- Commit publicado: `a38e087` (`Publish seller product portal`).
- El portal está integrado en la tienda bajo **Acceso vendedores**. El vendedor solicita un código usando el correo de su cuenta aprobada y activa; el código vence a los 10 minutos.
- Backend de Apps Script publicado en la versión 20, conservando la URL de implementación configurada en `src/config.js`.
- El texto del correo de bienvenida se ajustó con escapes Unicode. El propietario confirmó la recepción de una bienvenida; la captura mostraba caracteres acentuados incorrectos antes de este ajuste.
- La compilación de producción pasó antes del despliegue. El árbol de trabajo quedó limpio después de publicar.

## Incidencia pendiente: el código de acceso no llega

El propietario informó que una cuenta activada no recibió el correo con el código para entrar al portal. La captura de la hoja muestra más de una fila con el mismo nombre y direcciones de correo diferentes. No se deben copiar direcciones ni otros datos personales a este documento o a registros de depuración.

Lo observado:

- Había una ejecución `doPost` del despliegue web que terminó como **Completada**. Eso confirma que Apps Script procesó una petición, pero no confirma que se haya encontrado una cuenta elegible ni que Gmail haya aceptado el mensaje.
- El portal responde deliberadamente con un mensaje genérico, también cuando no encuentra una cuenta activa elegible.
- El código solo envía el mensaje si el correo normalizado coincide con una fila de `VENDEDORES_MKP` cuya columna `Activo` sea `si`, `sí`, `true` o `activo`, y cuyo `Estado_pago` sea `Aprobado` o `No_requerido`.
- En la solicitud al usuario para confirmar qué dirección y qué mensaje mostró el portal se canceló el formulario. La causa exacta sigue sin verificarse.

Próximos pasos para retomar:

1. Pedir al vendedor que indique en privado cuál de sus filas aprobadas corresponde a la cuenta, y cotejar exactamente el correo usado en el portal (incluido cualquier alias `+...`). No solicitar ni compartir DNI.
2. Confirmar con el vendedor el texto que muestra el portal tras pulsar **Enviar código** y la hora aproximada del intento.
3. Revisar Spam y Todos los correos, buscando el asunto **Tu código de acceso a Percha&Co**.
4. Correlacionar ese horario con las ejecuciones de Apps Script. Una ejecución `doPost` completada no basta para atribuir éxito al envío.
5. Si el correo coincide y no llega, reproducir de forma controlada y revisar cuota/permisos de `MailApp` y errores de ejecución. No registrar OTP, DNI ni direcciones completas en logs.

No se han hecho cambios adicionales para esta incidencia ni se ha enviado un correo de prueba.

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
