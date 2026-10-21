const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BROWSER_STATE_DIR = path.join(__dirname, '..', '.beto_browser_state');

function ensureStateDir() {
    if (!fs.existsSync(BROWSER_STATE_DIR)) {
        fs.mkdirSync(BROWSER_STATE_DIR, { recursive: true });
    }
}

function getStorageStatePath(domainKey = 'default') {
    ensureStateDir();
    const safeKey = domainKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(BROWSER_STATE_DIR, `state_${safeKey}.json`);
}

function extractDomainKey(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch (_) {
        return 'default';
    }
}

class NavegadorAsistido {
    constructor() {
        this.browser = null;
        this.currentContext = null;
        this.currentPage = null;
        this.activeSession = null;
    }

    async abrirPagina(url, opciones = {}) {
        const { headless = false, timeout = 45000, domainKey = null } = opciones;
        const targetDomain = domainKey || extractDomainKey(url);
        const stateFile = getStorageStatePath(targetDomain);

        if (!this.browser) {
            this.browser = await chromium.launch({
                headless,
                args: ['--disable-blink-features=AutomationControlled']
            });
        }

        const contextOptions = {
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };

        if (fs.existsSync(stateFile)) {
            try {
                contextOptions.storageState = stateFile;
            } catch (_) {}
        }

        this.currentContext = await this.browser.newContext(contextOptions);
        this.currentPage = await this.currentContext.newPage();

        let response = null;
        try {
            response = await this.currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout });
        } catch (err) {
            return {
                ok: false,
                url,
                error: `No se pudo cargar la página: ${err.message}`
            };
        }

        const currentUrl = this.currentPage.url();
        const title = await this.currentPage.title();

        const authDetection = await this.detectarRequisitosAutenticacion(this.currentPage);

        this.activeSession = {
            url: currentUrl,
            initialUrl: url,
            domainKey: targetDomain,
            title,
            requiresAuth: authDetection.requiresAuth,
            authType: authDetection.type,
            status: response ? response.status() : 200
        };

        return {
            ok: true,
            ...this.activeSession,
            details: authDetection.details
        };
    }

    async detectarRequisitosAutenticacion(page) {
        if (!page) return { requiresAuth: false };

        const url = page.url().toLowerCase();
        const isAuthUrl = url.includes('/login') || url.includes('auth') || url.includes('signin') || url.includes('saml') || url.includes('cas/');

        const hasPasswordInput = await page.locator('input[type="password"]').count() > 0;
        const hasCaptcha = await page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .cf-turnstile').count() > 0;
        const hasMfa = await page.locator('text=/doble factor|two-factor|código de verificación|authenticator|enviado un código/i').count() > 0;

        let authType = null;
        if (hasMfa) authType = 'mfa';
        else if (hasCaptcha) authType = 'captcha';
        else if (hasPasswordInput || isAuthUrl) authType = 'login_requerido';

        return {
            requiresAuth: Boolean(authType),
            type: authType,
            details: {
                hasPasswordInput,
                hasCaptcha,
                hasMfa,
                currentUrl: page.url()
            }
        };
    }

    async guardarEstadoSesion(domainKey) {
        if (!this.currentContext) return false;
        try {
            const key = domainKey || this.activeSession?.domainKey || 'default';
            const stateFile = getStorageStatePath(key);
            await this.currentContext.storageState({ path: stateFile });
            return true;
        } catch (err) {
            console.error('Error al guardar sesión de navegador:', err.message);
            return false;
        }
    }

    async leerContenidoVisible(maxChars = 20000) {
        if (!this.currentPage) {
            throw new Error('No hay ninguna página abierta en el navegador.');
        }

        const title = await this.currentPage.title();
        const url = this.currentPage.url();

        const authCheck = await this.detectarRequisitosAutenticacion(this.currentPage);
        if (authCheck.requiresAuth) {
            return {
                ok: false,
                requiresAuth: true,
                authType: authCheck.type,
                url,
                title,
                message: 'La página actual requiere que inicies sesión en la ventana oficial del navegador.'
            };
        }

        const rawText = await this.currentPage.evaluate(() => {
            const el = document.querySelector('#region-main, main, article, [role="main"]') || document.body;
            if (!el) return '';

            const clone = el.cloneNode(true);
            const toRemove = clone.querySelectorAll('script, style, noscript, nav, footer, header, svg');
            toRemove.forEach(n => n.remove());

            return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
        });

        const safeText = (rawText || '').slice(0, maxChars);

        return {
            ok: true,
            title,
            url,
            texto: safeText,
            length: safeText.length
        };
    }

    async cerrar() {
        if (this.currentPage) {
            try { await this.currentPage.close(); } catch (_) {}
            this.currentPage = null;
        }
        if (this.currentContext) {
            try { await this.currentContext.close(); } catch (_) {}
            this.currentContext = null;
        }
        if (this.browser) {
            try { await this.browser.close(); } catch (_) {}
            this.browser = null;
        }
        this.activeSession = null;
    }
}

module.exports = {
    NavegadorAsistido,
    extractDomainKey,
    getStorageStatePath
};
