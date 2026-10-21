# Extensión Beto para Moodle

Esta extensión es para una prueba local. No modifica el código de Moodle: agrega Beto solamente en el navegador donde está instalada.

## Instalar en Chrome o Edge

1. Abre `edge://extensions` en Edge o `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta `beto-extension` del proyecto.
5. Abre el Moodle de UNEMI donde probarás Beto e inicia sesión.
6. Recarga la página del curso.

La extensión funciona en subdominios de `unemi.edu.ec`. Para probar cambios locales, vuelve a `edge://extensions`, pulsa **Actualizar** en Beto y recarga Moodle.

Aparecerá el botón azul `B` abajo a la derecha. Haz clic para abrir el asistente. Puedes arrastrar la barra azul superior para moverlo y la esquina inferior derecha para cambiar su tamaño.

## Avisos gratuitos de entrega

1. Abre un curso de Moodle y abre Beto.
2. Pulsa **Avisos: no** en la barra de Beto y permite las notificaciones de la extensión si Chrome las solicita.
3. Beto programa un aviso local tres días antes de la fecha de entrega; si faltan menos de tres días al activarlo, avisa al poco tiempo. Al pulsar el aviso se abre la tarea.

Los avisos solo se programan cuando Moodle muestra una tarea pendiente y una fecha de entrega reconocible. Se guardan en este navegador; no usan WhatsApp, números telefónicos ni un servicio de pago. Chrome debe estar abierto para que aparezcan.

## Crear una presentación

Abre Beto desde Moodle y solicita una presentación indicando el tema. Beto puede generar las diapositivas, buscar imágenes en Internet relacionadas con cada tema, mostrar la vista previa y exportar la presentación a PDF o PowerPoint.

Ejemplo: `Crea una presentación de 8 diapositivas sobre redes neuronales artificiales, con contenido académico, imágenes específicas por diapositiva y referencias.`

## Resumir un video privado de Moodle

1. Inicia sesión normalmente en Moodle con tu correo institucional.
2. Abre la página del recurso o video dentro de Moodle.
3. Abre Beto y escribe: `Resume este video de la página.`
4. La extensión usa tu sesión activa para obtener el video y enviarlo al servidor de transcripción.

La contraseña nunca se envía a Beto. El video debe aparecer como un elemento de video descargable en la página y no superar 500 MB. Si Moodle usa un reproductor externo protegido, será necesario descargar el video desde Moodle y usar el botón de subida de Beto.

## Importante

Para probar los cambios locales en PowerShell, inicia el servidor de Beto desde la carpeta del proyecto con `npm.cmd start`. La extensión se conecta a `http://localhost:3000/`, igual que la versión local de `pagina.html`. Mantén el servidor abierto durante las pruebas y recarga Moodle después de actualizar la extensión.

Para que todos los estudiantes vean Beto sin instalar la extensión, hace falta agregar la integración en Moodle mediante un bloque HTML, el tema o un plugin con permisos administrativos.
