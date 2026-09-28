(() => {
    'use strict';

    const CHATBOT_ORIGIN = 'https://beto-ia-6.onrender.com';
    const ROOT_ID = 'beto-extension-root';
    let iframe;
    let lastContext = '';
    let updateTimer;

    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
        <button id="beto-extension-button" type="button" title="Abrir Asistente Beto IA">
            <span class="beto-btn-glow"></span>
            <span class="beto-btn-text">B</span>
        </button>
        <div id="beto-extension-panel" hidden>
            <div id="beto-extension-header">
                <span id="beto-extension-drag">✨ Beto <small>Mover</small></span>
                <span id="beto-extension-status">Conectando...</span>
                <button id="beto-extension-reminders" type="button" title="Activar recordatorios de entregas" aria-pressed="false">Avisos: no</button>
                <button id="beto-extension-compact" type="button" title="Reducir tamaño">−</button>
                <button id="beto-extension-close" type="button" title="Cerrar Beto">&times;</button>
            </div>
            <div id="beto-extension-resize" title="Cambiar tamaño"></div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #${ROOT_ID} { all: initial; }
        #${ROOT_ID} * { box-sizing: border-box; }
        #beto-extension-button {
            position: fixed;
            right: 24px;
            bottom: 24px;
            width: 66px;
            height: 66px;
            border: 3px solid #ffffff;
            border-radius: 50%;
            background: linear-gradient(135deg, #1e40af, #2563eb, #3b82f6);
            color: #ffffff;
            font: 700 32px 'Plus Jakarta Sans', Arial, sans-serif;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(37, 99, 235, 0.45);
            z-index: 2147483647;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #beto-extension-button:hover {
            transform: scale(1.1) rotate(4deg);
            box-shadow: 0 14px 38px rgba(37, 99, 235, 0.6);
        }
        .beto-btn-glow {
            position: absolute;
            inset: -40%;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
            animation: betoGlowPulse 3s ease-in-out infinite alternate;
        }
        @keyframes betoGlowPulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.3); opacity: 1; }
        }
        .beto-btn-text {
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        #beto-extension-panel {
            position: fixed;
            right: 20px;
            bottom: 102px;
            width: min(650px, calc(100vw - 28px));
            height: min(770px, calc(100vh - 120px));
            min-height: 300px;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(16px);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(255,255,255,0.8) inset;
            z-index: 2147483646;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }
        #beto-extension-header {
            height: 46px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 12px 0 16px;
            background: linear-gradient(135deg, #1e40af, #2563eb);
            color: #ffffff;
            font: 600 14px Arial, sans-serif;
            user-select: none;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        #beto-extension-drag { flex: 1; cursor: move; touch-action: none; font-weight: 700; }
        #beto-extension-drag small { margin-left: 6px; opacity: .75; font-weight: 400; font-size: 11px; }
        #beto-extension-panel iframe { display: block; width: 100%; height: calc(100% - 46px); border: 0; }
        #beto-extension-close, #beto-extension-compact, #beto-extension-reminders {
            width: 30px;
            height: 30px;
            border: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            color: #ffffff;
            font: 20px Arial, sans-serif;
            line-height: 28px;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        #beto-extension-reminders { width: auto; min-width: 70px; padding: 0 7px; border-radius: 6px; font: 600 11px Arial, sans-serif; }
        #beto-extension-reminders[aria-pressed="true"] { background: #86efac; color: #0f172a; }
        #beto-extension-close:hover { background: rgba(239, 68, 68, 0.85); }
        #beto-extension-compact:hover { background: rgba(255, 255, 255, 0.4); }
        #beto-extension-reminders:hover { background: rgba(255, 255, 255, 0.4); }
        #beto-extension-reminders[aria-pressed="true"]:hover { background: #bbf7d0; }
        #beto-extension-status {
            padding: 3px 9px;
            border-radius: 12px;
            background: #f59e0b;
            color: #0f172a;
            font: 700 11px Arial, sans-serif;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        #beto-extension-resize { position: absolute; right: 0; bottom: 0; width: 24px; height: 24px; cursor: nwse-resize; touch-action: none; z-index: 2; }
        #beto-extension-resize::after { content: ''; position: absolute; right: 6px; bottom: 6px; width: 10px; height: 10px; border-right: 2.5px solid #64748b; border-bottom: 2.5px solid #64748b; }
        @media (max-width: 600px) {
            #beto-extension-button { right: 14px; bottom: 14px; width: 58px; height: 58px; font-size: 28px; }
            #beto-extension-panel { right: 8px; bottom: 82px; width: calc(100vw - 16px); height: min(78vh, 640px); }
        }
    `;
    document.documentElement.append(style, root);

    const button = root.querySelector('#beto-extension-button');
    const panel = root.querySelector('#beto-extension-panel');
    const close = root.querySelector('#beto-extension-close');
    const compact = root.querySelector('#beto-extension-compact');
    const reminders = root.querySelector('#beto-extension-reminders');
    const dragHandle = root.querySelector('#beto-extension-drag');
    const resizeHandle = root.querySelector('#beto-extension-resize');
    const status = root.querySelector('#beto-extension-status');
    let dragState = null;
    let resizeState = null;
    let savedSize = null;

    function isLoginPage() {
        return location.pathname.includes('/login/') || !!document.querySelector('#username, input[name="username"]');
    }

    function createFrame() {
        if (iframe) return;
        const url = new URL(`${CHATBOT_ORIGIN}/`);
        url.searchParams.set('betoParentOrigin', window.location.origin);
        url.searchParams.set('betoEmbed', '1');
        iframe = document.createElement('iframe');
        iframe.title = 'Asistente Beto IA';
        iframe.src = url.href;
        iframe.addEventListener('load', () => {
            status.textContent = 'Beto conectado';
            status.style.background = '#86efac';
            sendContext(true);
            [300, 1000, 2500].forEach(delay => setTimeout(() => sendContext(true), delay));
        });
        iframe.addEventListener('error', () => {
            status.textContent = 'No se pudo cargar Beto';
            status.style.background = '#fca5a5';
        });
        panel.append(iframe);
    }

    function textOf(element) {
        return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function parseDeadline(activity) {
        if (!activity) return null;
        const dueElement = activity.querySelector('[data-region="activity-dates"], .activity-dates, [class*="due"], [class*="deadline"]');
        if (!dueElement) return null;

        const dateTime = dueElement.querySelector('time[datetime]')?.getAttribute('datetime');
        if (dateTime) {
            const timestamp = Date.parse(dateTime);
            if (Number.isFinite(timestamp)) return timestamp;
        }

        const dueText = textOf(dueElement);
        if (!/fecha|venc|vence|entrega|\bdue\b|deadline/i.test(dueText)) return null;
        const labeledText = dueText.match(/(?:fecha\s*(?:l[ií]mite|de entrega)|vencimiento|vence|entrega\s*hasta|due(?:\s*date)?|deadline)\s*:?\s*(.*)/i)?.[1] || dueText;
        const dateMatch = labeledText.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
            || labeledText.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
            || labeledText.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b/i);
        if (!dateMatch) return null;

        let year;
        let month;
        let day;
        if (/^\d{4}$/.test(dateMatch[1])) {
            [, year, month, day] = dateMatch;
        } else if (/^\d{1,2}$/.test(dateMatch[2]) && /^\d{4}$/.test(dateMatch[3])) {
            [, day, month, year] = dateMatch;
        } else {
            const monthNames = {
                enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
                julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
                noviembre: 10, diciembre: 11
            };
            [, day, month, year] = dateMatch;
            month = monthNames[month.toLowerCase()];
            if (month === undefined) return null;
        }

        const timeMatch = labeledText.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i);
        let hour = timeMatch ? Number(timeMatch[1]) : 23;
        const minute = timeMatch ? Number(timeMatch[2]) : 59;
        if (timeMatch?.[3]) {
            const isPm = /^p/i.test(timeMatch[3]);
            hour = hour % 12 + (isPm ? 12 : 0);
        }

        const dueDate = new Date(Number(year), Number(month), Number(day), hour, minute);
        if (dueDate.getFullYear() !== Number(year) || dueDate.getMonth() !== Number(month) || dueDate.getDate() !== Number(day)) return null;
        return dueDate.getTime();
    }

    function updateDeadlineReminders(context) {
        const hostname = location.hostname;
        const isUnemiSite = hostname === 'unemi.edu.ec' || hostname.endsWith('.unemi.edu.ec');
        if (!isUnemiSite || !chrome?.runtime?.sendMessage) return;
        chrome.runtime.sendMessage({
            type: 'beto:update-deadline-reminders',
            tasks: context.course.tasks
        }, () => { void chrome.runtime.lastError; });
    }

    function getContext() {
        const root = document.body;
        const bodyText = textOf(root).slice(0, 40000);
        const siteDescription = document.querySelector('meta[name="description"], meta[property="og:description"]')?.content?.trim().slice(0, 1000) || '';

        const courseTitleEl = document.querySelector('.page-header-headings h1, .coursename, a[href*="/course/view.php"]');
        const courseTitle = courseTitleEl ? textOf(courseTitleEl).slice(0, 200) : '';

        const currentSectionEl = document.querySelector('.section.current .sectionname, .page-header-headings h2');
        const currentSection = currentSectionEl ? textOf(currentSectionEl).slice(0, 200) : '';

        const activityTitleEl = document.querySelector('.activity-header h1, .activity-header .activityname, #page-header h1, #region-main h1');
        const activityTitle = activityTitleEl ? textOf(activityTitleEl).slice(0, 200) : document.title.slice(0, 200);

        const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
            .map(element => ({ nivel: Number(element.tagName.slice(1)), texto: textOf(element).slice(0, 300) }))
            .filter(item => item.texto);
        const links = [...document.querySelectorAll('a[href]')]
            .map(element => ({ texto: textOf(element).slice(0, 300), url: element.href }))
            .filter(item => item.texto && item.url)
            .slice(0, 300);
        const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')]
            .map(element => textOf(element) || element.value || element.getAttribute('aria-label') || '')
            .map(texto => texto.slice(0, 200))
            .filter(Boolean)
            .filter((texto, index, all) => all.indexOf(texto) === index)
            .slice(0, 120)
            .map(texto => ({ texto }));
        const tables = [...root.querySelectorAll('table')]
            .slice(0, 20)
            .map(table => ({
                caption: table.querySelector('caption') ? textOf(table.querySelector('caption')).slice(0, 200) : '',
                rows: [...table.querySelectorAll('tr')]
                    .slice(0, 30)
                    .map(row => [...row.querySelectorAll('th, td')]
                        .slice(0, 12)
                        .map(cell => textOf(cell).slice(0, 200)))
                    .filter(row => row.length)
            }))
            .filter(table => table.rows.length);
        const images = [...root.querySelectorAll('img')]
            .map(image => {
                let url = image.currentSrc || image.src || '';
                try {
                    const parsedUrl = new URL(url, location.href);
                    parsedUrl.search = '';
                    parsedUrl.hash = '';
                    url = parsedUrl.href;
                } catch (_) {}
                return {
                    descripcion: (image.getAttribute('alt') || image.getAttribute('title') || '').trim().slice(0, 300),
                    url
                };
            })
            .filter(image => image.descripcion || image.url)
            .slice(0, 100);
        const videos = links
            .filter(item => /drive\.google|docs\.google|youtube\.com|youtu\.be|vimeo\.com|kaltura|panopto|microsoftstream|\.(mp4|webm|mov)(\?|$)/i.test(item.url))
            .map(item => ({ titulo: item.texto, url: item.url, requiereAutenticacion: /unemi\.edu\.ec|drive\.google|kaltura|panopto/i.test(item.url) }))
            .slice(0, 40);
        const embeddedVideos = [...document.querySelectorAll('video[src], video source[src]')]
            .map(element => ({ titulo: element.closest('video')?.getAttribute('title') || document.title, url: element.currentSrc || element.src || element.getAttribute('src'), requiereAutenticacion: false }))
            .filter(item => item.url)
            .slice(0, 20);
        const tareas = [...document.querySelectorAll('a[href]')]
            .map(element => {
                const titulo = textOf(element).slice(0, 300);
                const url = element.href;
                if (!titulo || !/tarea|actividad|evaluaci[oó]n|quiz|cuestionario|entrega|foro|examen|diapositiva|material|recurso/i.test(`${titulo} ${url}`)) return null;

                const actividad = element.closest('.activity-item, li.activity, .activity') || element.parentElement;
                const indicadores = actividad
                    ? [...actividad.querySelectorAll('.activity-completion, .completion-info, .completioninfo, [data-region="completion-info"], [data-region="completionstatus"], [class*="submissionstatus"], [class*="submission-status"]')]
                    : [];
                const statusText = indicadores.map(indicador => textOf(indicador)).filter(Boolean).join(' ').slice(0, 300);
                const classNames = `${actividad?.className || ''} ${indicadores.map(indicador => indicador.className || '').join(' ')}`;
                const completionData = indicadores.map(indicador => indicador.getAttribute('data-completion')).find(Boolean)
                    || actividad?.getAttribute('data-completion');
                let statusFromData = '';
                if (completionData) {
                    try {
                        const data = JSON.parse(completionData);
                        if (data.state !== null && data.state !== '' && Number.isInteger(Number(data.state)) && data.hascompletion !== false) {
                            statusFromData = Number(data.state) === 0 ? 'pending' : 'completed';
                        }
                    } catch (_) {}
                }

                const statusSource = `${statusText} ${classNames}`.toLowerCase();
                const status = statusFromData
                    || (/no\s+(?:se\s+ha\s+)?(?:hech[oa]|completad[oa]|enviado|entregado)|por hacer|pendiente|sin (?:entregar|enviar)|incomplet[oa]|completion_incomplete|to do|not\s+(?:completed|submitted|done|attempted)|no submission/i.test(statusSource)
                        ? 'pending'
                        : /completad[oa]|finalizad[oa]|realizad[oa]|hech[oa]|entregad[oa]|enviad[oa](?:\s+para\s+calificar)?|aprobado|completion_complete|badge-success|\bdone\b|\bcompleted\b|\bsubmitted\b|\bfinished\b|\bpassed\b/i.test(statusSource)
                            ? 'completed'
                            : 'unknown');

                return { titulo, url, status, statusText, dueAt: parseDeadline(actividad) };
            })
            .filter(Boolean)
            .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
            .slice(0, 100);
        const fechas = [...new Set((bodyText.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóú]+(?:\s+de\s+\d{4})?)\b/gi) || []).slice(0, 40))];

        const onLogin = isLoginPage();

        return {
            site: { origin: location.origin, hostname: location.hostname, url: location.href, title: document.title, description: siteDescription, isLoginPage: onLogin },
            page: { text: bodyText, headings, links, buttons, tables, images, videos: [...videos, ...embeddedVideos].slice(0, 40) },
            course: { title: courseTitle, section: currentSection, activity: activityTitle, tasks: tareas, dates: fechas },
            metadata: { language: document.documentElement.lang || null, updatedAt: new Date().toISOString() }
        };
    }

    function sendContext(force = false) {
        const context = getContext();
        updateDeadlineReminders(context);
        if (!iframe?.contentWindow) return;
        const signature = JSON.stringify([context.site.url, context.course, context.page.text, context.page.headings, context.page.links]);
        if (!force && signature === lastContext) return;
        lastContext = signature;
        iframe.contentWindow.postMessage({ type: 'beto:page-context', version: 1, context }, CHATBOT_ORIGIN);
    }

    function scheduleContext() {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(() => sendContext(), 150);
    }

    function setRemindersButton(enabled) {
        reminders.dataset.enabled = String(enabled);
        reminders.setAttribute('aria-pressed', String(enabled));
        reminders.textContent = enabled ? 'Avisos: sí' : 'Avisos: no';
        reminders.title = enabled ? 'Desactivar recordatorios de entregas' : 'Activar recordatorios de entregas';
    }

    chrome.runtime.sendMessage({ type: 'beto:get-deadline-reminders-state' }, response => {
        if (!chrome.runtime.lastError && response) setRemindersButton(response.enabled);
    });
    reminders.addEventListener('click', () => {
        const enabled = reminders.dataset.enabled !== 'true';
        reminders.disabled = true;
        chrome.runtime.sendMessage({ type: 'beto:set-deadline-reminders', enabled }, response => {
            reminders.disabled = false;
            if (chrome.runtime.lastError || !response?.success) {
                status.textContent = 'Avisos no disponibles';
                status.style.background = '#fca5a5';
                return;
            }
            setRemindersButton(enabled);
            if (enabled) updateDeadlineReminders(getContext());
        });
    });

    // Auto-completado de credenciales guardadas en Moodle
    function fillLoginForm(username, password, submit = false) {
        const userEl = document.querySelector('#username, input[name="username"]');
        const passEl = document.querySelector('#password, input[name="password"]');
        if (userEl && username) {
            userEl.value = username;
            userEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (passEl && password) {
            passEl.value = password;
            passEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (submit) {
            const submitBtn = document.querySelector('#loginbtn, input[type="submit"], button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            } else if (userEl?.form) {
                userEl.form.submit();
            }
        }
    }

    // Al cargar la página de login, comprobar si hay credenciales guardadas
    if (isLoginPage()) {
        try {
            if (chrome?.storage?.local) {
                chrome.storage.local.get(['beto_username', 'beto_password', 'beto_autofill'], (items) => {
                    if (items?.beto_username && items?.beto_password) {
                        fillLoginForm(items.beto_username, items.beto_password, !!items.beto_autofill);
                    }
                });
            }
        } catch (_) {}
    }

    function movePanel(event) {
        if (!dragState) return;
        const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, event.clientX - dragState.offsetX));
        const top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, event.clientY - dragState.offsetY));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function resizePanel(event) {
        if (!resizeState) return;
        const bounds = panel.getBoundingClientRect();
        const width = Math.max(280, Math.min(window.innerWidth - bounds.left, event.clientX - bounds.left));
        const height = Math.max(280, Math.min(window.innerHeight - bounds.top, event.clientY - bounds.top));
        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
    }

    dragHandle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const bounds = panel.getBoundingClientRect();
        dragState = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
        dragHandle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    });
    dragHandle.addEventListener('pointermove', movePanel);
    dragHandle.addEventListener('pointerup', () => { dragState = null; });
    dragHandle.addEventListener('pointercancel', () => { dragState = null; });
    resizeHandle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        resizeState = true;
        resizeHandle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    });
    resizeHandle.addEventListener('pointermove', resizePanel);
    resizeHandle.addEventListener('pointerup', () => { resizeState = null; });
    resizeHandle.addEventListener('pointercancel', () => { resizeState = null; });
    window.addEventListener('resize', () => {
        if (!panel.hidden && panel.style.left) movePanel({ clientX: panel.offsetLeft, clientY: panel.offsetTop });
    });

    button.addEventListener('click', () => {
        panel.hidden = false;
        button.hidden = true;
        createFrame();
    });
    close.addEventListener('click', () => {
        panel.hidden = true;
        button.hidden = false;
    });
    compact.addEventListener('click', () => {
        if (panel.dataset.compact === 'true') {
            panel.style.width = savedSize?.width || '';
            panel.style.height = savedSize?.height || '';
            panel.dataset.compact = 'false';
            compact.textContent = '−';
            compact.title = 'Reducir tamaño';
            return;
        }
        const bounds = panel.getBoundingClientRect();
        savedSize = { width: `${Math.round(bounds.width)}px`, height: `${Math.round(bounds.height)}px` };
        panel.style.width = window.innerWidth <= 600 ? 'calc(100vw - 32px)' : '380px';
        panel.style.height = window.innerWidth <= 600 ? 'min(70vh, 480px)' : '480px';
        panel.dataset.compact = 'true';
        compact.textContent = '□';
        compact.title = 'Restaurar tamaño';
    });

    window.addEventListener('message', event => {
        if (event.source !== iframe?.contentWindow) return;
        const origin = event.origin;
        if (event.data?.type === 'beto:ready') sendContext(true);

        // Rellenar datos de inicio de sesión
        if (event.data?.type === 'beto:fill-credentials') {
            const { username, password, submit, save } = event.data;
            fillLoginForm(username, password, submit);
            if (save && chrome?.storage?.local) {
                chrome.storage.local.set({
                    beto_username: username,
                    beto_password: password,
                    beto_autofill: true
                });
            }
            return;
        }

        // Obtener recurso Moodle en segundo plano
        if (event.data?.type === 'beto:request-moodle-resource') {
            const { requestId, url } = event.data;
            chrome.runtime.sendMessage({
                type: 'beto:fetch-moodle-resource',
                url
            }, result => {
                iframe.contentWindow.postMessage({
                    type: 'beto:moodle-resource-result',
                    requestId,
                    result
                }, origin);
            });
            return;
        }

        if (event.data?.type !== 'beto:request-video-summary') return;
        const video = event.data.video;
        if (!video?.url) return;
        status.textContent = 'Procesando clase...';
        status.style.background = '#fde68a';
        chrome.runtime.sendMessage({
            type: 'beto:download-and-summarize-video',
            video,
            chatbotOrigin: origin,
            pageTitle: document.title,
            pageText: (document.querySelector('#region-main, [role="main"], #content') || document.body).innerText.slice(0, 10000)
        }, result => {
            iframe.contentWindow.postMessage({ type: 'beto:video-summary-result', requestId: event.data.requestId, result }, origin);
            status.textContent = result?.error ? 'Revisar video' : 'Beto conectado';
            status.style.background = result?.error ? '#fca5a5' : '#86efac';
        });
    });

    if (document.body) {
        new MutationObserver(scheduleContext).observe(document.body, { subtree: true, childList: true, characterData: true });
    }
    window.addEventListener('popstate', scheduleContext);
    window.addEventListener('hashchange', scheduleContext);
    scheduleContext();
})();
