const http = require('http');
const fs = require('fs');
const path = require('path');

// Auto-load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = val;
            }
        }
    });
}

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const root = __dirname;

function send(response, status, data, contentType = 'application/json') {
    response.writeHead(status, { 'Content-Type': `${contentType}; charset=utf-8` });
    response.end(contentType === 'application/json' ? JSON.stringify(data) : data);
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', (chunk) => body += chunk);
        request.on('end', () => resolve(body));
        request.on('error', reject);
    });
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (request.method === 'POST' && pathname === '/api/transcribe-video-url') {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            send(response, 500, { error: 'Falta configurar GROQ_API_KEY en el servidor.' });
            return;
        }

        try {
            const body = JSON.parse(await readBody(request));
            const videoUrl = String(body.url || '');
            const title = String(body.title || 'Video de clase');

            if (/unemi\.edu\.ec|kaltura|panopto|microsoftstream/i.test(videoUrl)) {
                send(response, 400, {
                    error: `🔒 El recurso "${title}" pertenece al aula virtual institucional de UNEMI y requiere autenticación activa. Por favor ábrelo en tu navegador y utiliza las opciones de subida de video o pegado de transcripción.`
                });
                return;
            }

            send(response, 400, {
                error: `🔒 El recurso "${title}" requiere acceso institucional o no permite descarga pública directa. Puedes descargarlo en tu navegador con tu sesión de UNEMI y subirlo con el botón 🎥 de Beto.`
            });
        } catch (err) {
            send(response, 400, { error: 'Solicitud de video no válida.' });
        }
        return;
    }

    if (request.method === 'POST' && pathname === '/api/chat') {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            send(response, 500, { error: 'Falta configurar GROQ_API_KEY en el servidor o en un archivo .env.' });
            return;
        }

        try {
            const body = JSON.parse(await readBody(request));
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    Authorization: `Bearer ${apiKey}`
                },

                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'Eres Beto, un asistente académico inteligente orientado a estudiantes universitarios de UNEMI. Responde siempre en español, de forma clara, motivadora y estructurada. Puedes generar y redactar documentos, guías, tareas, resúmenes, exámenes de práctica y horarios para exportar a Word (.docx), PDF (.pdf), Excel (.xlsx) o Texto (.txt). Cuando el estudiante solicite un documento, reporte o tabla de datos, estructura tu respuesta impecablemente con Markdown (usa encabezados # y ##, viñetas estructuradas y tablas en formato | Columna 1 | Columna 2 |) para que se puedan convertir directamente con un clic a los distintos formatos. Cuando pida una presentación, usa # Presentación: título y entre 8 y 10 bloques ## Diapositiva N: título. Entrega contenido académico sustancial, no frases decorativas ni un resumen superficial: incluye contexto, definición de conceptos, antecedentes, causas, proceso, ejemplos concretos, aplicaciones, comparación de perspectivas, evidencias disponibles, limitaciones, riesgos, recomendaciones accionables y conclusión. Cada diapositiva debe tener 4 a 7 viñetas específicas y explicativas de una o dos frases completas. Distribuye la información sin repetirla y adapta la profundidad al tema solicitado. No inventes datos, fuentes, fechas ni cifras; si una información no está disponible escribe "No especificado". No uses tablas dentro de las diapositivas. Cuando recibas un contexto de un curso de Moodle, identifica el título de la materia, la sección actual y las actividades principales. Si el estudiante te pide explicar la clase, haz un resumen claro con conceptos clave, pasos y preguntas de repaso. Si detectas un enlace a un video de UNEMI o Drive privado, aclara amablemente que requiere su sesión institucional y explícale las opciones para procesar la transcripción o subir el video. Nunca inventes calificaciones ni envíes tareas sin confirmación.'
                        },
                        ...(Array.isArray(body.messages) ? body.messages : [])
                    ]
                })
            });
            const data = await groqResponse.json();
            if (!groqResponse.ok) {
                send(response, groqResponse.status, { error: data.error?.message || 'Error de Groq.' });
                return;
            }
            send(response, 200, { reply: data.choices?.[0]?.message?.content || '' });
        } catch (error) {
            send(response, 400, { error: 'La solicitud no es válida.' });
        }
        return;
    }

    const requestedPath = pathname === '/' ? '/pagina.html' : pathname;
    const filePath = path.join(root, requestedPath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
        send(response, 404, { error: 'No encontrado.' });
        return;
    }

    const extension = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
    send(response, 200, fs.readFileSync(filePath), types[extension] || 'application/octet-stream');
});

server.listen(PORT, () => {
    console.log(`Beto disponible en http://localhost:${PORT}`);
});

