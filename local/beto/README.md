# Plugin local de Moodle para Beto

Este plugin agrega el asistente Beto a las páginas de Moodle de usuarios con sesión iniciada. Usa el archivo `beto-embed.js` existente en este proyecto; no requiere instalar la extensión de Chrome o Edge.

## Instalación

1. Copia la carpeta `beto` a `<moodle>/local/beto`.
2. Inicia sesión como administrador y abre **Administración del sitio > Notificaciones** para completar la instalación.
3. Abre **Administración del sitio > Plugins > Plugins locales > Beto**.
4. La URL base `https://beto-ia-14.onrender.com` viene configurada por defecto. Si el servidor cambia, actualízala en esta página y guarda los cambios.
5. Si Moodle usa una política CSP restrictiva, permite que su sitio cargue scripts e iframes desde el dominio de Beto.

El servidor debe publicar `/beto-embed.js` y `/` en esa URL. En este repositorio ambos están disponibles con el servidor Node y Django.

## Privacidad y alcance

El plugin carga Beto únicamente para usuarios autenticados que no sean invitados. La integración puede compartir con el servidor configurado el texto visible, enlaces, títulos y contexto del curso de la página para responder preguntas sobre Moodle. Configura únicamente un servidor de confianza y revisa sus políticas de privacidad. La URL vacía desactiva la integración.

El plugin no almacena credenciales de Moodle ni añade permisos/capacidades nuevos. Para retirarlo, desinstálalo desde **Administración del sitio > Plugins > Plugins locales > Gestionar plugins locales** y elimina la carpeta después de completar la desinstalación.
