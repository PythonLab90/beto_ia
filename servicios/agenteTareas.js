const crypto = require('crypto');

const ESTADOS_TAREA = {
    PENDIENTE: 'pendiente',
    EN_EJECUCION: 'en_ejecucion',
    ESPERANDO_AUTORIZACION: 'esperando_autorizacion',
    COMPLETADA: 'completada',
    CANCELADA: 'cancelada',
    ERROR: 'error'
};

const NIVELES_ACCION = {
    LECTURA: 'lectura',
    MODIFICACION: 'modificacion',
    SENSIBLE: 'sensible'
};

class GestorTareas {
    constructor() {
        this.tareas = new Map();
    }

    crearTarea(instruccionOriginal, tipo = 'asistente_academico') {
        const id = 'task_' + crypto.randomBytes(6).toString('hex');
        const tarea = {
            id,
            instruccion: instruccionOriginal,
            tipo,
            estado: ESTADOS_TAREA.PENDIENTE,
            pasos: [],
            pasoActualIndex: 0,
            progresoPorcentaje: 0,
            solicitudAutorizacion: null,
            historialLogs: [],
            resultado: null,
            error: null,
            creadaEn: new Date().toISOString(),
            actualizadaEn: new Date().toISOString()
        };

        this.planificarPasos(tarea);
        this.tareas.set(id, tarea);
        return tarea;
    }

    planificarPasos(tarea) {
        const txt = tarea.instruccion.toLowerCase();
        const pasos = [];

        pasos.push({
            id: 'paso_1_analisis',
            titulo: 'Interpretar instrucción e identificar recursos',
            tipoAccion: NIVELES_ACCION.LECTURA,
            estado: 'pendiente'
        });

        if (txt.includes('drive.google.com') || txt.includes('drive') || txt.includes('documento')) {
            pasos.push({
                id: 'paso_verificar_drive',
                titulo: 'Verificar permisos y consultar recurso en Google Drive',
                tipoAccion: NIVELES_ACCION.LECTURA,
                estado: 'pendiente'
            });
        }

        if (txt.includes('aula virtual') || txt.includes('moodle') || txt.includes('unemi') || txt.includes('http')) {
            pasos.push({
                id: 'paso_abrir_navegador',
                titulo: 'Acceder a plataforma educativa mediante navegador asistido',
                tipoAccion: NIVELES_ACCION.LECTURA,
                estado: 'pendiente'
            });
        }

        pasos.push({
            id: 'paso_analisis_gemini',
            titulo: 'Analizar contenidos y extraer conceptos clave con Gemini',
            tipoAccion: NIVELES_ACCION.MODIFICACION,
            estado: 'pendiente'
        });

        if (txt.includes('cuestionario') || txt.includes('test') || txt.includes('examen') || txt.includes('resolver')) {
            pasos.push({
                id: 'paso_cuestionario_practica',
                titulo: 'Generar cuestionario de estudio y autoevaluación guiada',
                tipoAccion: NIVELES_ACCION.SENSIBLE,
                estado: 'pendiente',
                requiereConfirmacion: true,
                mensajeConfirmacion: 'Beto IA preparará preguntas de práctica y respuestas fundamentadas para estudiar. Recuerda que no se enviarán formularios de evaluación calificada en contra de las normas institucionales.'
            });
        } else if (txt.includes('presentación') || txt.includes('diapositiva') || txt.includes('powerpoint')) {
            pasos.push({
                id: 'paso_generar_presentacion',
                titulo: 'Elaborar estructura de presentación PowerPoint con Beto',
                tipoAccion: NIVELES_ACCION.MODIFICACION,
                estado: 'pendiente'
            });
        } else {
            pasos.push({
                id: 'paso_sintesis_academica',
                titulo: 'Elaborar síntesis, apuntes y recomendaciones de estudio',
                tipoAccion: NIVELES_ACCION.MODIFICACION,
                estado: 'pendiente'
            });
        }

        tarea.pasos = pasos;
    }

    obtenerTarea(id) {
        return this.tareas.get(id) || null;
    }

    actualizarEstado(id, nuevoEstado, meta = {}) {
        const tarea = this.tareas.get(id);
        if (!tarea) return null;

        tarea.estado = nuevoEstado;
        tarea.actualizadaEn = new Date().toISOString();
        if (meta.progreso !== undefined) tarea.progresoPorcentaje = meta.progreso;
        if (meta.resultado !== undefined) tarea.resultado = meta.resultado;
        if (meta.error !== undefined) tarea.error = meta.error;

        tarea.historialLogs.push({
            timestamp: new Date().toISOString(),
            estado: nuevoEstado,
            mensaje: meta.mensaje || `Estado cambiado a ${nuevoEstado}`
        });

        return tarea;
    }

    solicitarAutorizacion(id, { accion, nivel = NIVELES_ACCION.SENSIBLE, mensaje, detalles = {} }) {
        const tarea = this.tareas.get(id);
        if (!tarea) return null;

        tarea.estado = ESTADOS_TAREA.ESPERANDO_AUTORIZACION;
        tarea.solicitudAutorizacion = {
            id: 'auth_' + crypto.randomBytes(4).toString('hex'),
            accion,
            nivel,
            mensaje,
            detalles,
            solicitadaEn: new Date().toISOString()
        };

        tarea.historialLogs.push({
            timestamp: new Date().toISOString(),
            estado: tarea.estado,
            mensaje: `Esperando autorización para: ${mensaje}`
        });

        return tarea;
    }

    resolverAutorizacion(id, autorizada, respuestaUsuario = {}) {
        const tarea = this.tareas.get(id);
        if (!tarea || !tarea.solicitudAutorizacion) {
            return { ok: false, error: 'No hay ninguna autorización pendiente para esta tarea.' };
        }

        if (!autorizada) {
            tarea.solicitudAutorizacion = null;
            tarea.estado = ESTADOS_TAREA.CANCELADA;
            tarea.historialLogs.push({
                timestamp: new Date().toISOString(),
                estado: tarea.estado,
                mensaje: 'Acción denegada por el usuario. Tarea cancelada.'
            });
            return { ok: true, tarea, continuable: false };
        }

        tarea.solicitudAutorizacion = null;
        tarea.estado = ESTADOS_TAREA.EN_EJECUCION;
        tarea.historialLogs.push({
            timestamp: new Date().toISOString(),
            estado: tarea.estado,
            mensaje: 'Autorización concedida por el usuario. Continuando ejecución.'
        });

        return { ok: true, tarea, continuable: true };
    }

    cancelarTarea(id, motivo = 'Cancelada por el usuario.') {
        const tarea = this.tareas.get(id);
        if (!tarea) return null;

        tarea.estado = ESTADOS_TAREA.CANCELADA;
        tarea.solicitudAutorizacion = null;
        tarea.historialLogs.push({
            timestamp: new Date().toISOString(),
            estado: tarea.estado,
            mensaje: motivo
        });
        return tarea;
    }

    listarTareas() {
        return Array.from(this.tareas.values()).map(t => ({
            id: t.id,
            instruccion: t.instruccion,
            estado: t.estado,
            progresoPorcentaje: t.progresoPorcentaje,
            tieneAutorizacionPendiente: Boolean(t.solicitudAutorizacion),
            creadaEn: t.creadaEn,
            actualizadaEn: t.actualizadaEn
        }));
    }
}

const gestorGlobalTareas = new GestorTareas();

module.exports = {
    ESTADOS_TAREA,
    NIVELES_ACCION,
    GestorTareas,
    gestorGlobalTareas
};
