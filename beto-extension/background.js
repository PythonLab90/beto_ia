const DEFAULT_CHATBOT_ORIGIN = 'https://beto-ia-6.onrender.com';
const REMINDERS_ENABLED_KEY = 'beto_deadline_reminders_enabled';
const REMINDERS_KEY = 'beto_deadline_reminders';
const SENT_REMINDERS_KEY = 'beto_deadline_reminders_sent';
const REMINDER_ALARM_PREFIX = 'beto-deadline-';
const REMINDER_LEAD_TIME = 3 * 24 * 60 * 60 * 1000;
const MIN_ALARM_DELAY = 30 * 1000;

function reminderId(url) {
    let hash = 2166136261;
    for (const character of url) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(36);
}

function isAllowedUnemiUrl(value) {
    try {
        const url = value instanceof URL ? value : new URL(value);
        return /^https?:$/.test(url.protocol)
            && (url.hostname === 'unemi.edu.ec' || url.hostname.endsWith('.unemi.edu.ec'));
    } catch (_) {
        return false;
    }
}

function isReminderSenderAllowed(sender) {
    return isAllowedUnemiUrl(sender.url || sender.tab?.url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'beto:get-deadline-reminders-state') {
        chrome.storage.local.get([REMINDERS_ENABLED_KEY], values => {
            sendResponse({ enabled: !!values[REMINDERS_ENABLED_KEY] });
        });
        return true;
    }

    if (message?.type === 'beto:set-deadline-reminders') {
        const enabled = Boolean(message.enabled);
        chrome.storage.local.set({ [REMINDERS_ENABLED_KEY]: enabled }, () => {
            if (enabled) {
                sendResponse({ success: true, enabled });
                return;
            }

            chrome.alarms.getAll(alarms => {
                alarms.filter(alarm => alarm.name.startsWith(REMINDER_ALARM_PREFIX))
                    .forEach(alarm => chrome.alarms.clear(alarm.name));
                chrome.storage.local.set({ [REMINDERS_KEY]: {} }, () => sendResponse({ success: true, enabled }));
            });
        });
        return true;
    }

    if (message?.type === 'beto:update-deadline-reminders') {
        if (!isReminderSenderAllowed(sender)) {
            sendResponse({ success: false });
            return;
        }

        chrome.storage.local.get([REMINDERS_ENABLED_KEY, REMINDERS_KEY, SENT_REMINDERS_KEY], values => {
            if (!values[REMINDERS_ENABLED_KEY]) {
                sendResponse({ success: true, enabled: false });
                return;
            }

            const reminders = values[REMINDERS_KEY] || {};
            const sentReminders = new Set(values[SENT_REMINDERS_KEY] || []);
            (Array.isArray(message.tasks) ? message.tasks : []).slice(0, 100).forEach(task => {
                let taskUrl;
                try {
                    taskUrl = new URL(task.url);
                    if (!isAllowedUnemiUrl(taskUrl)) return;
                } catch (_) {
                    return;
                }

                const id = reminderId(taskUrl.href);
                const alarmName = `${REMINDER_ALARM_PREFIX}${id}`;
                if (task.status === 'completed') {
                    delete reminders[id];
                    chrome.alarms.clear(alarmName);
                    return;
                }
                if (task.status !== 'pending') return;

                const dueAt = Number(task.dueAt);
                if (!Number.isFinite(dueAt) || dueAt <= Date.now()) return;
                const sentKey = `${id}:${dueAt}`;
                reminders[id] = {
                    title: String(task.titulo || 'Actividad Moodle').slice(0, 160),
                    url: taskUrl.href,
                    dueAt,
                    sentKey
                };
                if (sentReminders.has(sentKey)) return;

                const alarmTime = Math.max(Date.now() + MIN_ALARM_DELAY, dueAt - REMINDER_LEAD_TIME);
                chrome.alarms.create(alarmName, { when: alarmTime });
            });

            chrome.storage.local.set({ [REMINDERS_KEY]: reminders }, () => sendResponse({ success: true, enabled: true }));
        });
        return true;
    }
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (!alarm.name.startsWith(REMINDER_ALARM_PREFIX)) return;
    const id = alarm.name.slice(REMINDER_ALARM_PREFIX.length);
    chrome.storage.local.get([REMINDERS_ENABLED_KEY, REMINDERS_KEY, SENT_REMINDERS_KEY], values => {
        const reminders = values[REMINDERS_KEY] || {};
        const reminder = reminders[id];
        if (!values[REMINDERS_ENABLED_KEY] || !reminder || reminder.dueAt <= Date.now()) return;

        const sentReminders = new Set(values[SENT_REMINDERS_KEY] || []);
        if (sentReminders.has(reminder.sentKey)) return;
        const remainingDays = Math.ceil((reminder.dueAt - Date.now()) / (24 * 60 * 60 * 1000));
        const timeLeft = remainingDays < 1 ? 'menos de un día' : `${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}`;
        chrome.notifications.create(alarm.name, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('beto.png'),
            title: 'Entrega próxima',
            message: `Te quedan ${timeLeft} para entregar: ${reminder.title}`,
            contextMessage: 'Beto · recordatorio de Moodle',
            priority: 2
        }, () => {
            if (chrome.runtime.lastError) return;
            sentReminders.add(reminder.sentKey);
            reminders[id].notified = true;
            chrome.storage.local.set({
                [REMINDERS_KEY]: reminders,
                [SENT_REMINDERS_KEY]: [...sentReminders].slice(-300)
            });
        });
    });
});

chrome.notifications.onClicked.addListener(notificationId => {
    if (!notificationId.startsWith(REMINDER_ALARM_PREFIX)) return;
    const id = notificationId.slice(REMINDER_ALARM_PREFIX.length);
    chrome.storage.local.get([REMINDERS_KEY], values => {
        const reminder = values[REMINDERS_KEY]?.[id];
        if (reminder?.url) chrome.tabs.create({ url: reminder.url });
        chrome.notifications.clear(notificationId);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'beto:fetch-moodle-resource') {
        (async () => {
            try {
                const targetUrl = message.url;
                if (!targetUrl) throw new Error('No se especificó la URL del recurso.');
                if (!isAllowedUnemiUrl(targetUrl)) throw new Error('El recurso debe pertenecer a un sitio de UNEMI.');
                const response = await fetch(new URL(targetUrl).href, { credentials: 'include' });
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
                        .filter(u => !u.includes('.unemi.edu.ec/theme') && !u.includes('/pix/'))
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
            if (!isAllowedUnemiUrl(targetUrl)) throw new Error('El video debe pertenecer a un sitio de UNEMI.');

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