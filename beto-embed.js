(function () {
    'use strict';

    const script = document.currentScript;
    const config = window.BetoEmbedConfig || {};
    const options = {
        chatbotUrl: config.chatbotUrl || script?.dataset.chatbotUrl || script?.src.replace(/\/beto-embed\.js(?:\?.*)?$/, '/') || '/',
        iframeId: config.iframeId || script?.dataset.iframeId || 'betoChatbot',
        allowedOrigins: normalizeOrigins(config.allowedOrigins || script?.dataset.allowedOrigins || ''),
        maxTextLength: Number(config.maxTextLength || script?.dataset.maxTextLength || 12000),
        debounceMs: Number(config.debounceMs || script?.dataset.debounceMs || 500),
        iframeTitle: config.iframeTitle || script?.dataset.iframeTitle || 'Asistente Beto'
    };
    const state = { iframe: null, timer: null, lastSignature: '', historyPatched: false };

    function normalizeOrigins(value) {
        const values = Array.isArray(value) ? value : String(value).split(',');
        return values.map(item => item.trim()).filter(Boolean).map(item => {
            try { return new URL(item, window.location.href).origin; } catch (_) { return ''; }
        }).filter(origin => origin && origin !== 'null');
    }

    function cleanText(value, maxLength) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function isVisible(element) {
        if (!(element instanceof Element)) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function isExcluded(element) {
        return element.closest('script, style, noscript, template, svg, iframe, canvas, form, input, textarea, select, option, [aria-hidden="true"], [data-beto-ignore]');
    }

    function isVideoUrl(url) {
        return /(?:drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be|vimeo\.com|kaltura|panopto|microsoftstream|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?))/i.test(url);
    }

    function extractPageContext() {
        const root = document.querySelector('#region-main, [role="main"], #content') || document.body;
        if (!root) return null;

        // Moodle specific metadata extraction
        const courseTitleEl = document.querySelector('.page-header-headings h1, .coursename, a[href*="/course/view.php"]');
        const courseTitle = courseTitleEl ? cleanText(courseTitleEl.innerText, 200) : '';

        const currentSectionEl = document.querySelector('.section.current .sectionname, .sectionname, .page-header-headings h2');
        const currentSection = currentSectionEl ? cleanText(currentSectionEl.innerText, 200) : '';

        const text = cleanText(
            Array.from(root.querySelectorAll('*'))
                .filter(element => isVisible(element) && !isExcluded(element))
                .filter(element => !element.querySelector('*:not(script):not(style):not(svg)'))
                .map(element => element.innerText || element.textContent || '')
                .join(' '),
            options.maxTextLength
        );

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .filter(element => isVisible(element) && !isExcluded(element))
            .map(element => ({ nivel: Number(element.tagName.slice(1)), texto: cleanText(element.innerText, 300) }))
            .filter(item => item.texto);

        const enlaces = Array.from(document.querySelectorAll('a[href]'))
            .filter(element => isVisible(element) && !isExcluded(element))
            .map(element => ({
                texto: cleanText(element.innerText || element.getAttribute('aria-label'), 300),
                url: element.href
            }))
            .filter(item => item.texto && item.url)
            .filter((item, index, all) => all.findIndex(other => other.texto === item.texto && other.url === item.url) === index)
            .slice(0, 100);

        const botones = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]'))
            .filter(element => isVisible(element) && !isExcluded(element))
            .map(element => ({ texto: cleanText(element.innerText || element.value || element.getAttribute('aria-label'), 200) }))
            .filter(item => item.texto)
            .filter((item, index, all) => all.findIndex(other => other.texto === item.texto) === index)
            .slice(0, 60);

        const videos = Array.from(document.querySelectorAll('a[href], video[src], video source[src], iframe[src]'))
            .filter(element => isVisible(element) && !element.closest('form, [data-beto-ignore]'))
            .map(element => {
                const url = element.href || element.src || element.getAttribute('src');
                const titulo = cleanText(element.innerText || element.getAttribute('title') || element.getAttribute('aria-label') || element.closest('.activity')?.querySelector('.instancename')?.innerText, 300);
                const isAuthRequired = /unemi\.edu\.ec|drive\.google|kaltura|panopto|microsoftstream/i.test(url);
                return {
                    titulo: titulo || 'Video de Clase',
                    url,
                    requiereAutenticacion: isAuthRequired
                };
            })
            .filter(item => item.url && isVideoUrl(item.url))
            .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
            .slice(0, 40);

        // Moodle activities & dates
        const tareas = Array.from(document.querySelectorAll('.activity, .activityinstance, a[href*="/mod/"]'))
            .filter(element => isVisible(element))
            .map(element => {
                const link = element.tagName === 'A' ? element : element.querySelector('a[href]');
                return link ? {
                    titulo: cleanText(element.innerText || link.innerText, 200),
                    url: link.href
                } : null;
            })
            .filter(Boolean)
            .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
            .slice(0, 60);

        const fechasText = cleanText(document.body.innerText, 20000);
        const fechas = Array.from(new Set(fechasText.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóú]+\s+(?:hasta|de)\s+\d{4}|\d{1,2}:\d{2})\b/gi) || [])).slice(0, 30);

        const isLoginPage = window.location.pathname.includes('/login/') || !!document.querySelector('#username, input[name="username"]');

        return {
            site: {
                origin: window.location.origin,
                hostname: window.location.hostname,
                url: window.location.href,
                title: cleanText(document.title, 300),
                isLoginPage
            },
            course: {
                title: courseTitle,
                section: currentSection,
                tasks: tareas,
                dates: fechas
            },
            page: { text, headings, links: enlaces, buttons: botones, videos },
            metadata: {
                language: document.documentElement.lang || null,
                updatedAt: new Date().toISOString()
            }
        };
    }

    function sendPageContext(force = false) {
        if (!state.iframe?.contentWindow) return;
        const context = extractPageContext();
        if (!context) return;
        const signature = JSON.stringify([context.site.url, context.course?.title, context.course?.section, context.page.text, context.page.videos]);
        if (!force && signature === state.lastSignature) return;
        state.lastSignature = signature;
        const targetOrigin = new URL(options.chatbotUrl, window.location.href).origin;
        state.iframe.contentWindow.postMessage({ type: 'beto:page-context', version: 1, context }, targetOrigin);
        state.iframe.contentWindow.postMessage({
            tipo: 'contexto-curso',
            contenido: {
                curso: context.course.title,
                seccion: context.course.section,
                texto: context.page.text,
                enlaces: context.page.links,
                videos: context.page.videos,
                tareas: context.course.tasks,
                fechas: context.course.dates
            }
        }, targetOrigin);
    }

    function scheduleContextUpdate() {
        window.clearTimeout(state.timer);
        state.timer = window.setTimeout(sendPageContext, options.debounceMs);
    }

    function createIframe() {
        let iframe = document.getElementById(options.iframeId);
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = options.iframeId;
            const chatbotUrl = new URL(options.chatbotUrl, window.location.href);
            chatbotUrl.searchParams.set('betoParentOrigin', window.location.origin);
            iframe.src = chatbotUrl.toString();
            iframe.title = options.iframeTitle;
            iframe.loading = 'lazy';
            iframe.setAttribute('data-beto-iframe', 'true');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:640px;height:760px;max-width:100vw;max-height:100vh;border:0;z-index:2147483647;background:transparent;';
            document.body.appendChild(iframe);
        } else if (iframe.src) {
            const existingUrl = new URL(iframe.src, window.location.href);
            existingUrl.searchParams.set('betoParentOrigin', window.location.origin);
            iframe.src = existingUrl.toString();
        }
        state.iframe = iframe;
        iframe.addEventListener('load', () => {
            scheduleContextUpdate();
            window.setTimeout(() => sendPageContext(true), 100);
        }, { once: false });
        return iframe;
    }

    function installNavigationObserver() {
        ['pushState', 'replaceState'].forEach(method => {
            const original = window.history[method];
            window.history[method] = function () {
                const result = original.apply(this, arguments);
                scheduleContextUpdate();
                return result;
            };
        });
        window.addEventListener('popstate', scheduleContextUpdate);
        window.addEventListener('hashchange', scheduleContextUpdate);

        const observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => !mutation.target.closest?.('[data-beto-iframe]'))) scheduleContextUpdate();
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'aria-label', 'title', 'class', 'style'] });
    }

    window.extractPageContext = extractPageContext;
    window.sendPageContext = sendPageContext;
    window.addEventListener('message', event => {
        if (event.source !== state.iframe?.contentWindow) return;
        if (event.data?.type === 'beto:ready') {
            if (options.allowedOrigins.length && !options.allowedOrigins.includes(event.origin)) return;
            sendPageContext(true);
        } else if (event.data?.type === 'beto:fill-credentials') {
            const { username, password, submit } = event.data;
            const userEl = document.querySelector('#username, input[name="username"]');
            const passEl = document.querySelector('#password, input[name="password"]');
            if (userEl && username) userEl.value = username;
            if (passEl && password) passEl.value = password;
            if (submit) {
                const submitBtn = document.querySelector('#loginbtn, input[type="submit"], button[type="submit"]');
                if (submitBtn) submitBtn.click();
                else if (userEl?.form) userEl.form.submit();
            }
        }
    });

    function start() {
        if (!document.body) return window.addEventListener('DOMContentLoaded', start, { once: true });
        createIframe();
        installNavigationObserver();
        scheduleContextUpdate();
    }

    start();
})();