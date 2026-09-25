# Extensión Beto para Moodle

Esta extensión es para una prueba local. No modifica el código de Moodle: agrega Beto solamente en el navegador donde está instalada.

## Instalar en Chrome o Edge

1. Abre `chrome://extensions` o `edge://extensions`.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona esta carpeta: `beto-extension`.
5. Abre `https://capacitaciondocente.unemi.edu.ec/` e inicia sesión.
6. Recarga la página.

Aparecerá el botón azul `B` abajo a la derecha. Haz clic para abrir el asistente. Puedes arrastrar la barra azul superior para moverlo y la esquina inferior derecha para cambiar su tamaño.

## Resumir un video privado de Moodle

1. Inicia sesión normalmente en Moodle con tu correo institucional.
2. Abre la página del recurso o video dentro de Moodle.
3. Abre Beto y escribe: `Resume este video de la página.`
4. La extensión usa tu sesión activa para obtener el video y enviarlo al servidor de transcripción.

La contraseña nunca se envía a Beto. El video debe aparecer como un elemento de video descargable en la página y no superar 500 MB. Si Moodle usa un reproductor externo protegido, será necesario descargar el video desde Moodle y usar el botón de subida de Beto.

## Importante

La extensión depende de que el túnel de ngrok esté encendido. Si ngrok muestra su página de advertencia, abre primero `https://recoup-outpost-poise.ngrok-free.dev/` y pulsa **Visit Site**.

Para que todos los estudiantes vean Beto sin instalar la extensión, hace falta agregar la integración en Moodle mediante un bloque HTML, el tema o un plugin con permisos administrativos.
