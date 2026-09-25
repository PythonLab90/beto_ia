const DEFAULT_CHATBOT_ORIGIN = 'http://localhost:3000';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'beto:fetch-moodle-resource') {
        (async () => {
            try {
                const targetUrl = message.url;
                if (!targetUrl) throw new Error('No se especificó la URL del recurso.');
                const response = await fetch(targetUrl, { credentials: 'include' });
                if (!response.ok) {
                    throw new Error(`El recurso respondió con estado ${response.status}. Verifica que la sesión de UNEMI esté activa.`);
                }
                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                const finalUrl = response.url;
                if (contentType.includes('text/html')) {
                    const html = await response.text();
                    // Extraer título
                    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
                    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Recurso Moodle';
                    
                    // Limpiar HTML básico para extraer texto limpio del recurso
                    const cleanText = html
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 15000);

                    // Buscar enlaces incrustados de YouTube, Google Drive, OneDrive, etc.
                    const externalLinks = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
                        .map(m => m[1])
                        .filter(u => !u.includes('capacitaciondocente.unemi.edu.ec/theme') && !u.includes('/pix/'))
                        .slice(0, 20);

                    const iframeSrcs = [...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi)]
                        .map(m => m[1])
                        .slice(0, 10);

                    sendResponse({
                        success: true,
                        title,
                        url: finalUrl,
                        text: cleanText,
                        externalLinks,
                        iframeSrcs
                    });
                } else {
                    sendResponse({
                        success: true,
                        title: 'Archivo adjunto de Moodle',
                        url: finalUrl,
                        text: `El recurso es un archivo descargable de tipo ${contentType}.`,
                        isBinary: true
                    });
                }
            } catch (err) {
                sendResponse({ error: err.message || 'Error al obtener el recurso de Moodle.' });
            }
        })();
        return true;
    }

    if (message?.type !== 'beto:download-and-summarize-video') return;

    (async () => {
        try {
            const chatbotOrigin = message.chatbotOrigin || DEFAULT_CHATBOT_ORIGIN;
            const targetUrl = new URL(message.video.url);

            // 1. Intentar descargar el recurso usando la sesión del navegador del estudiante
            let mediaUrl = targetUrl.href;
            let response = await fetch(mediaUrl, { credentials: 'include' });

            if (!response.ok) {
                throw new Error(`Moodle respondió ${response.status}. Inicia sesión en UNEMI y vuelve a intentarlo.`);
            }

            const contentType = (response.headers.get('content-type') || '').toLowerCase();

            // Si Moodle devolvió una página HTML en lugar de un archivo de video directo, buscamos el video incrustado
            if (contentType.includes('text/html')) {
                const htmlText = await response.text();
                
                // Buscar etiquetas <video src="..."> o <source src="..."> o links a .mp4 / .webm
                const mediaMatch = htmlText.match(/<source[^>]+src=["']([^"']+\.(?:mp4|webm|m4a|mp3)[^"']*)["']/i) ||
                                   htmlText.match(/<video[^>]+src=["']([^"']+\.(?:mp4|webm|m4a|mp3)[^"']*)["']/i) ||
                                   htmlText.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|m4a|mp3)(?:\?[^\s"'<>]*)?/i);

                if (mediaMatch && mediaMatch[1] || (mediaMatch && mediaMatch[0])) {
                    const resolvedMediaUrl = new URL(mediaMatch[1] || mediaMatch[0], targetUrl.origin).href;
                    const mediaResponse = await fetch(resolvedMediaUrl, { credentials: 'include' });
                    if (mediaResponse.ok && (mediaResponse.headers.get('content-type') || '').includes('video')) {
                        response = mediaResponse;
                    }
                } else {
                    // Si el reproductor usa DRM o iframe protegido (ej. Kaltura/Teams), resumimos el contenido estructurado de la clase
                    const chatResponse = await fetch(`${chatbotOrigin}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [
                                {
                                    role: 'user',
                                    content: `Actúa como un secretario ejecutivo y analista académico experto. Elabora un informe largo, completo y bien desarrollado sobre la clase "${message.video.title || message.pageTitle}" usando todo el contenido disponible. No hagas un resumen superficial ni inventes información; si un dato no aparece escribe "No especificado". Distingue entre hechos encontrados, decisiones, propuestas y recomendaciones. Usa Markdown profesional y entrega exactamente estas secciones:\n\n# Resumen ejecutivo\nExplica el propósito, contexto y resultado general.\n\n## Temas tratados en detalle\nDesarrolla cada tema con contexto, ideas principales, argumentos y conclusión.\n\n## Puntos importantes y hallazgos\nIncluye datos, conceptos, problemas, riesgos, avances y oportunidades.\n\n## Decisiones y conclusiones\nUsa una tabla: Decisión | Motivo o contexto | Impacto | Estado.\n\n## Tareas y compromisos\nUsa una tabla: Tarea | Responsable | Fecha límite | Prioridad | Estado.\n\n## Riesgos, bloqueos y oportunidades\nExplica qué puede afectar los resultados y qué oportunidades existen.\n\n## Preguntas y asuntos pendientes\nIncluye dudas, información faltante y temas por confirmar.\n\n## Mejoras y recomendaciones\nPropón mejoras concretas para procesos, comunicación, coordinación, calidad y resultados. Usa una tabla: Mejora sugerida | Problema que resuelve | Beneficio esperado | Prioridad | Esfuerzo estimado | Primer paso. Separa claramente lo encontrado de tus sugerencias.\n\n## Plan de seguimiento\nOrganiza acciones para 24 horas, 7 días y 30 días.\n\n## Indicadores sugeridos\nPropón métricas para comprobar si las mejoras funcionan.\n\n## Preguntas de repaso\nIncluye preguntas útiles para estudiar.\n\n## Conclusión\nCierra con una síntesis profesional lista para compartir.\n\nContenido disponible de la clase en Moodle:\n${message.pageText}`
                                }
                            ]
                        })
                    }).then(res => res.json());

                    if (chatResponse.reply) {
                        sendResponse({
                            filename: message.video.title || message.pageTitle,
                            summary: `ℹ️ *Video incrustado en el aula virtual de UNEMI*\n\n${chatResponse.reply}`,
                            transcript: message.pageText
                        });
                        return;
                    }
                }
            }

            const blob = await response.blob();
            if (blob.size > 500 * 1024 * 1024) {
                throw new Error('El archivo de la clase supera el límite de 500 MB.');
            }

            const form = new FormData();
            form.append('video', blob, message.video.title || 'video-moodle.mp4');

            const result = await fetch(`${chatbotOrigin}/api/transcribe-video`, {
                method: 'POST',
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: form
            }).then(res => res.json());

            sendResponse(result);
        } catch (error) {
            sendResponse({ error: error.message || 'No se pudo procesar la clase con la sesión activa.' });
        }
    })();
    return true;
});