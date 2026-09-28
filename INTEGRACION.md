# Integración y Arquitectura del Asistente Beto en Moodle/UNEMI

## 1. Arquitectura del Sistema

Beto utiliza una arquitectura desacoplada de 5 componentes:

```
[ Moodle UNEMI ] ──(beto-embed.js / DOM)──> [ Navegador / postMessage ]
                                                      │
                                                      ▼
                                            [ Frontend Beto (iframe) ]
                                                      │
                                           (petición HTTP / JSON)
                                                      ▼
                                           [ Backend Beto (Node/Django) ]
                                                      │
                                          ┌───────────┴───────────┐
                                          ▼                       ▼
                                [ Servicio Transcripción ]   [ Modelo IA Groq ]
                                 (Groq Whisper / FFmpeg)     (Llama 3 / GPT-oss)
```

### Distribución de Ejecución:

1. **Navegador (Client / Embed / Extensión)**:
   - Ejecuta `beto-embed.js` o la extensión de Chrome.
   - Analiza el DOM del aula virtual Moodle (`#region-main`, título del curso, sección activa, actividades, documentos y videos).
   - Mantiene la sesión institucional activa del estudiante para navegar y abrir recursos protegidos de UNEMI en nuevas pestañas.
   - Lee documentos locales (PDF con OCR, Word, Excel, texto) en memoria del navegador antes de enviar extractos.

2. **Backend de Beto (Node.js / Django)**:
   - Proporciona las APIs `/api/chat`, `/api/transcribe-video` y `/api/transcribe-video-url`.
   - Normaliza el contexto recibido del curso y construye los prompts estructurados en español.
   - Extrae el audio de los archivos subidos usando **FFmpeg** y los convierte a MP3 optimizado para voz (16kHz, mono).
   - Valida enlaces y bloquea descargas no autorizadas o intentos de evasión de credenciales en recursos privados.

3. **Plataforma Moodle (UNEMI)**:
   - Aloja el contenido académico del estudiante.
   - Integra Beto mediante la inserción de una sola línea de script en el pie de página del tema Moodle o un Bloque HTML personalizado.

4. **Servicio de Transcripción (Groq Whisper)**:
   - Procesa los fragmentos de audio enviados por el backend usando `whisper-large-v3-turbo`.
   - Retorna la transcripción literal en formato texto.

5. **Modelo de IA (Groq LLM)**:
   - Genera los resúmenes académicos, puntos clave, preguntas de repaso y explicaciones pedagógicas adaptadas al nivel universitario.

---

## 2. Instalación en Moodle

Para integrar Beto en todas las páginas de un curso de Moodle, añade el script en la configuración del tema de Moodle (**Administración del sitio > Apariencia > HTML adicional > Antes de cerrar BODY**):

```html
<script src="https://tu-servidor-beto.com/beto-embed.js" defer></script>
```

O bien, mediante un bloque HTML en la barra lateral del curso con la variante iframe:

```html
<iframe
    id="betoChatbot"
    src="https://tu-servidor-beto.com/"
    title="Asistente Beto"
    style="position:fixed;right:0;bottom:0;width:640px;height:760px;max-width:100vw;max-height:100vh;border:0;z-index:2147483647">
</iframe>
<script src="https://tu-servidor-beto.com/beto-embed.js" data-iframe-id="betoChatbot" defer></script>
```

---

## 3. Manejo de Videos e Identidad Institucional UNEMI

Cuando Beto detecta un video en la clase:
- **Videos Públicos**: Beto los procesa mediante el endpoint de transcripción.
- **Videos Institucionales (UNEMI / Drive Privado / Kaltura)**: Beto le informa al estudiante de forma clara:
  > *"🔒 Este recurso requiere tu sesión activa de UNEMI. Puedes abrirlo con tu cuenta institucional y subir la clase descargada usando el botón 🎥 de Beto o pegar su transcripción."*

---

## 4. Configuración del Servidor

Asegúrate de contar con las siguientes variables en `.env`:

```env
PORT=3000
GROQ_API_KEY=tu_groq_api_key_aqui
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

### Desplegar el servidor Node en Render

Configura el servicio conectado al repositorio con:

- **Build Command:** `npm install`
- **Start Command:** `npm start`

Para pruebas locales, `EMAIL_PROVIDER=smtp` usa las variables SMTP de `.env.example`. Los servicios Free de Render bloquean las conexiones SMTP salientes por los puertos 25, 465 y 587. Para mantener Render Free, configura `EMAIL_PROVIDER=brevo`, guarda `BREVO_API_KEY` como secreto y registra/verifica el remitente indicado en `BREVO_SENDER_EMAIL` en Brevo. La aplicación envía por su API HTTPS; `RENDER_EXTERNAL_URL` proporciona automáticamente la URL pública para el enlace de confirmación. No subas claves a Git.

El registro de correo se guarda en el archivo indicado por `EMAIL_REMINDERS_FILE`. El sistema de archivos temporal de un servicio gratuito puede perder registros al reiniciarse; para conservarlos se necesita almacenamiento persistente o una base de datos externa. Esta versión confirma el correo de registro; el envío programado de recordatorios de tareas por email todavía requiere implementarse.