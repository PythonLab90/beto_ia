const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { server } = require('../servidor');

let testPort = 3099;
let testServer = null;

test.before((t, done) => {
    testServer = server.listen(testPort, () => done());
});

test.after((t, done) => {
    if (testServer) {
        testServer.close(() => done());
    } else {
        done();
    }
});

function requestJson(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: testPort,
            path,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

test('API Google Drive status responde correctamente', async () => {
    const res = await requestJson('GET', '/api/auth/google/status');
    assert.equal(res.status, 200);
    assert.ok('configured' in res.data);
    assert.ok('connected' in res.data);
});

test('API Google Drive rechaza lectura de archivo sin URL válida o permisos', async () => {
    const res = await requestJson('POST', '/api/drive/resource', { url: '' });
    assert.equal(res.status, 400);
    assert.ok(res.data.error);

    const resInvalido = await requestJson('POST', '/api/drive/resource', { url: 'https://example.com/no-drive' });
    assert.equal(resInvalido.status, 400);
});

test('API Tareas permite crear, listar, inspeccionar y autorizar/cancelar tareas', async () => {
    const createRes = await requestJson('POST', '/api/tareas/crear', {
        instruccion: 'Beto, revisa el cuestionario del aula virtual'
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.data.ok, true);
    const tareaId = createRes.data.tarea.id;
    assert.ok(tareaId);

    const listRes = await requestJson('GET', '/api/tareas');
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.tareas));
    assert.ok(listRes.data.tareas.some(t => t.id === tareaId));

    const getRes = await requestJson('GET', `/api/tareas/${tareaId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.tarea.id, tareaId);

    const cancelRes = await requestJson('POST', `/api/tareas/${tareaId}/cancelar`, {});
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.tarea.estado, 'cancelada');
});
