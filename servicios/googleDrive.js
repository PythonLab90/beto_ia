const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const TOKENS_FILE = path.join(__dirname, '..', '.beto_tokens.json');
const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
        return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getStoredTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('Error al leer tokens de Google:', err.message);
    }
    return null;
}

function saveTokens(tokens) {
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
        return true;
    } catch (err) {
        console.error('Error al guardar tokens de Google:', err.message);
        return false;
    }
}

function clearTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            fs.unlinkSync(TOKENS_FILE);
        }
        return true;
    } catch (err) {
        console.error('Error al eliminar tokens de Google:', err.message);
        return false;
    }
}

function generateAuthUrl() {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
        throw new Error('Faltan configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno (.env).');
    }
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES
    });
}

async function handleAuthCallback(code) {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
        throw new Error('Cliente OAuth no configurado.');
    }
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let profile = null;
    try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        profile = {
            email: userInfo.data.email,
            name: userInfo.data.name,
            picture: userInfo.data.picture
        };
    } catch (_) {}

    const payload = {
        tokens,
        profile,
        updatedAt: new Date().toISOString()
    };
    saveTokens(payload);
    return payload;
}

async function getAuthorizedDriveClient() {
    const oauth2Client = getOAuth2Client();
    const stored = getStoredTokens();
    if (!oauth2Client || !stored || !stored.tokens) {
        return null;
    }

    oauth2Client.setCredentials(stored.tokens);

    oauth2Client.on('tokens', (newTokens) => {
        const current = getStoredTokens() || {};
        current.tokens = { ...current.tokens, ...newTokens };
        current.updatedAt = new Date().toISOString();
        saveTokens(current);
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getAuthStatus() {
    const clientIdConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const stored = getStoredTokens();
    if (!clientIdConfigured) {
        return {
            configured: false,
            connected: false,
            message: 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env para habilitar Google Drive.'
        };
    }
    if (!stored || !stored.tokens) {
        return {
            configured: true,
            connected: false,
            message: 'No hay cuenta conectada.'
        };
    }
    return {
        configured: true,
        connected: true,
        profile: stored.profile || { email: 'Cuenta autorizada' },
        updatedAt: stored.updatedAt
    };
}

async function disconnectGoogleAccount() {
    const stored = getStoredTokens();
    const oauth2Client = getOAuth2Client();
    if (stored && stored.tokens && oauth2Client) {
        try {
            const tokenToRevoke = stored.tokens.access_token || stored.tokens.refresh_token;
            if (tokenToRevoke) {
                await oauth2Client.revokeToken(tokenToRevoke);
            }
        } catch (err) {
            console.warn('Aviso: No se pudo revocar el token en Google (posiblemente ya expiró):', err.message);
        }
    }
    clearTokens();
    return { success: true, message: 'Cuenta desconectada y credenciales locales eliminadas.' };
}

function parseDriveFileId(inputUrlOrId) {
    if (!inputUrlOrId || typeof inputUrlOrId !== 'string') return null;
    const str = inputUrlOrId.trim();

    const fileMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];

    const idParam = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam) return idParam[1];

    const docsMatch = str.match(/\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) return docsMatch[1];

    const foldersMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (foldersMatch) return foldersMatch[1];

    if (/^[a-zA-Z0-9_-]{25,50}$/.test(str) && !str.includes(' ') && !str.includes('_invalido')) {
        return str;
    }

    return null;
}

async function getDriveResource(urlOrId) {
    const fileId = parseDriveFileId(urlOrId);
    if (!fileId) {
        return {
            ok: false,
            error: 'No se pudo identificar un ID válido de Google Drive en el enlace proporcionado.'
        };
    }

    const drive = await getAuthorizedDriveClient();
    if (!drive) {
        return {
            ok: false,
            needsAuth: true,
            error: 'Beto IA no dispone de autorización para Google Drive. Conecta tu cuenta oficial de Google en los ajustes de Beto.'
        };
    }

    try {
        const metaRes = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, description, size, modifiedTime, videoMediaMetadata'
        });
        const meta = metaRes.data;

        let content = '';
        let isVideo = meta.mimeType.startsWith('video/');

        if (meta.mimeType === 'application/vnd.google-apps.document') {
            const exportRes = await drive.files.export({
                fileId,
                mimeType: 'text/plain'
            }, { responseType: 'text' });
            content = exportRes.data;
        } else if (meta.mimeType === 'application/vnd.google-apps.presentation') {
            const exportRes = await drive.files.export({
                fileId,
                mimeType: 'text/plain'
            }, { responseType: 'text' });
            content = exportRes.data;
        } else if (meta.mimeType === 'text/plain' || meta.mimeType === 'text/markdown' || meta.mimeType === 'application/json') {
            const getRes = await drive.files.get({
                fileId,
                alt: 'media'
            }, { responseType: 'text' });
            content = getRes.data;
        } else if (isVideo) {
            let captionsText = '';
            try {
                const captionsList = await drive.captions.list({ fileId });
                if (captionsList.data && captionsList.data.items && captionsList.data.items.length > 0) {
                    const captionId = captionsList.data.items[0].id;
                    const capRes = await drive.captions.get({
                        fileId,
                        captionId,
                        alt: 'media'
                    }, { responseType: 'text' });
                    captionsText = capRes.data;
                }
            } catch (_) {}

            content = captionsText || '';
        } else {
            content = `[Archivo ${meta.name} (${meta.mimeType}) disponible en Drive con tamaño ${meta.size || 'N/A'} bytes]`;
        }

        return {
            ok: true,
            fileId,
            name: meta.name,
            mimeType: meta.mimeType,
            size: meta.size,
            isVideo,
            content,
            hasContent: Boolean(content && content.trim())
        };
    } catch (err) {
        const status = err.status || err.code;
        if (status === 404 || status === 403) {
            return {
                ok: false,
                forbidden: true,
                error: `No tienes permisos de acceso en Google Drive para el archivo (HTTP ${status}). Asegúrate de compartir el archivo con la cuenta conectada.`
            };
        }
        return {
            ok: false,
            error: `Error al acceder al recurso de Drive: ${err.message}`
        };
    }
}

module.exports = {
    getOAuth2Client,
    generateAuthUrl,
    handleAuthCallback,
    getAuthStatus,
    disconnectGoogleAccount,
    getAuthorizedDriveClient,
    parseDriveFileId,
    getDriveResource,
    getStoredTokens,
    saveTokens,
    clearTokens
};
