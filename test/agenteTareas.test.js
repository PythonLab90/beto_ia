const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDriveFileId, getAuthStatus } = require('../servicios/googleDrive');
const { GestorTareas, ESTADOS_TAREA, NIVELES_ACCION } = require('../servicios/agenteTareas');
const { extractDomainKey } = require('../servicios/navegador');

test('Google Drive ID Parser extrae correctamente IDs de múltiples formatos', () => {
    const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    assert.equal(parseDriveFileId(rawId), rawId);

    const shareUrl = 'https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J_kLmNoP/view?usp=sharing';
    assert.equal(parseDriveFileId(shareUrl), '1a2B3c4D5e6F7g8H9i0J_kLmNoP');

    const openUrl = 'https://drive.google.com/open?id=9z8y7x6w5v4u3t2s1r0q_pOnMlK';
    assert.equal(parseDriveFileId(openUrl), '9z8y7x6w5v4u3t2s1r0q_pOnMlK');

    const docUrl = 'https://docs.google.com/document/d/1XyZ_DocumentoEducativo12345/edit';
    assert.equal(parseDriveFileId(docUrl), '1XyZ_DocumentoEducativo12345');

    assert.equal(parseDriveFileId('enlace_invalido_sin_id'), null);
});

test('Google Drive Auth Status informa correctamente si faltan credenciales', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const status = await getAuthStatus();
    assert.equal(status.configured, false);
    assert.equal(status.connected, false);
});

test('Gestor de Tareas planifica pasos según instrucción y maneja estados', () => {
    const gestor = new GestorTareas();
    const tarea = gestor.crearTarea('Beto, entra a mi aula virtual y revisa el cuestionario');

    assert.equal(tarea.estado, ESTADOS_TAREA.PENDIENTE);
    assert.ok(tarea.pasos.length >= 3);

    const tieneCuestionario = tarea.pasos.some(p => p.id === 'paso_cuestionario_practica');
    assert.equal(tieneCuestionario, true);

    const tieneNavegador = tarea.pasos.some(p => p.id === 'paso_abrir_navegador');
    assert.equal(tieneNavegador, true);

    gestor.actualizarEstado(tarea.id, ESTADOS_TAREA.EN_EJECUCION, { progreso: 30 });
    assert.equal(gestor.obtenerTarea(tarea.id).estado, ESTADOS_TAREA.EN_EJECUCION);
    assert.equal(gestor.obtenerTarea(tarea.id).progresoPorcentaje, 30);
});

test('Gestor de Tareas maneja autorizaciones y bloquea acciones sensibles si son denegadas', () => {
    const gestor = new GestorTareas();
    const tarea = gestor.crearTarea('Resolver cuestionario');

    gestor.solicitarAutorizacion(tarea.id, {
        accion: 'preparar_cuestionario',
        nivel: NIVELES_ACCION.SENSIBLE,
        mensaje: '¿Deseas generar el cuestionario de estudio?'
    });

    assert.equal(gestor.obtenerTarea(tarea.id).estado, ESTADOS_TAREA.ESPERANDO_AUTORIZACION);
    assert.ok(gestor.obtenerTarea(tarea.id).solicitudAutorizacion);

    const denegado = gestor.resolverAutorizacion(tarea.id, false);
    assert.equal(denegado.continuable, false);
    assert.equal(gestor.obtenerTarea(tarea.id).estado, ESTADOS_TAREA.CANCELADA);
});

test('Extractor de dominio de navegador funciona adecuadamente', () => {
    assert.equal(extractDomainKey('https://sga.unemi.edu.ec/login'), 'sga.unemi.edu.ec');
    assert.equal(extractDomainKey('https://drive.google.com/drive/my-drive'), 'drive.google.com');
});
