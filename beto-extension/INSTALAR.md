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

## Registrar un correo para avisos

1. Abre Beto y pulsa **Correo** en el encabezado.
2. Escribe tu dirección, acepta recibir recordatorios y pulsa **Enviar confirmación**.
3. Abre el mensaje de Beto y confirma la dirección desde el enlace. El enlace vence en 24 horas.

Beto no lee tu bandeja ni obtiene el correo desde Moodle. El registro queda pendiente hasta que se confirma. Para enviar el mensaje, configura las variables SMTP de `.env.example`; con Gmail usa una contraseña de aplicación, nunca la contraseña normal. En Render, configura estos valores como secretos y define `PUBLIC_BASE_URL` con el dominio público. No subas credenciales a Git.

El servidor Node guarda los registros en `EMAIL_REMINDERS_FILE`. En producción debe apuntar a almacenamiento persistente; el disco temporal de un servicio gratuito puede perderlos al reiniciarse. Esta función registra y confirma el correo; el envío automático de recordatorios de tareas por email requiere además programar el envío de vencimientos.

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

La extensión utiliza el servidor público de Render en `https://beto-ia-4.onrender.com/`. El servicio gratuito puede tardar unos segundos en despertar después de un periodo sin uso.

Para que todos los estudiantes vean Beto sin instalar la extensión, hace falta agregar la integración en Moodle mediante un bloque HTML, el tema o un plugin con permisos administrativos.
