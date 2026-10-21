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
                                [ Servicio Transcripción ]   [ Modelo IA Gemini ]
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

5. **Modelos de IA (Gemini y Groq)**:
   - Gemini genera primero las respuestas y presentaciones cuando sus credenciales funcionan.
   - Si Gemini no está disponible, Groq usa `GROQ_MODEL` como respaldo para el chat, presentaciones y resúmenes.
   - Groq Whisper transcribe el audio de videos.
6. **Imágenes de Unsplash**:
   - El servidor busca fotografías relacionadas con el tema de cada diapositiva y muestra la atribución del fotógrafo.

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
GROQ_API_KEY=tu_clave_de_groq
GROQ_MODEL=openai/gpt-oss-120b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-4-argon
UNSPLASH_ACCESS_KEY=tu_clave_de_unsplash
```

Configura `GEMINI_API_KEY` y `GEMINI_MODEL=gemini-4-argon` para intentar usar Gemini. Si Gemini rechaza la clave o no está disponible, Beto usa `GROQ_API_KEY` y el modelo indicado en `GROQ_MODEL` como respaldo para el chat, las presentaciones y los resúmenes. Groq también se usa para Whisper al transcribir audio. Guarda las claves en `.env` para uso local y en **Render > Environment** para producción; no se exponen al navegador.

Las presentaciones se convierten en el servidor a PowerPoint `.pptx` editable con PptxGenJS. El proyecto sirve la interfaz tanto desde Node como desde Django; ambos backends tienen la ruta de descarga y Django llama al generador Node local. Para Django también se requiere Node.js, `npm install` y acceso al paquete `pptxgenjs`.

Flujo para generar y ver un PowerPoint:
1. Inicia la aplicación que sirve la página. En el proyecto Django usa `python manage.py runserver`; si ejecutas Node, usa `npm start`.
2. En Beto escribe, por ejemplo: `Crea una presentación de 5 diapositivas sobre fútbol, con una introducción, reglas, dimensiones de la cancha y conclusión`.
3. Beto genera el contenido con Gemini (o el proveedor de respaldo configurado) y muestra la vista previa HTML de las diapositivas en la misma página.
4. En la barra de esa vista previa elige la plantilla, decide si incluir imágenes disponibles y pulsa **Generar y descargar PPTX**. El navegador descarga el archivo; ábrelo con PowerPoint o LibreOffice para ver las diapositivas editables.
5. Para verlas sin descargar, desplázate hacia abajo en esa vista previa. **Descargar PDF visual** conserva el flujo PDF existente del navegador.

Si el servidor devuelve 404 para `/api/presentacion/generar`, reinicia Django o Node después de actualizar el proyecto y verifica que Node.js esté instalado y que se haya ejecutado `npm install`. PptxGenJS no convierte a PDF; PDF sigue usando html2pdf en el navegador. **Copiar HTML**, **Copiar CSS** y sus descargas también se mantienen.

Instala las dependencias con `npm install`, inicia con `npm start` y ejecuta las pruebas de generación con `npm test`. Las claves de Gemini/Groq y la búsqueda opcional de Unsplash dependen de las cuotas y condiciones de esos proveedores; PptxGenJS no requiere una API comercial de presentaciones.
```

### Desplegar el servidor Node en Render

Configura el servicio conectado al repositorio con:

- **Build Command:** `npm install`
- **Start Command:** `npm start`

En Render, conserva **Build Command** `npm install` y **Start Command** `npm start`; no fijes `PORT`, Render la proporciona.