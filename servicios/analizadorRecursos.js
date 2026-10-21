let generateTextFn = null;

function setGenerateTextFunction(fn) {
    generateTextFn = fn;
}

async function analizarRecursoEducativo(recurso, instruccionesUsuario = '', tipoAnalisis = 'resumen') {
    if (!recurso) {
        throw new Error('No se ha proporcionado ningún recurso para analizar.');
    }

    const { name, content, mimeType, isVideo } = recurso;

    if (!content || !content.trim()) {
        if (isVideo) {
            throw new Error(`El video "${name}" no contiene subtítulos ni transcripción procesable en Drive. Para analizarlo, sube su archivo de video o audio localmente con la opción 🎥 de Beto.`);
        }
        throw new Error(`El recurso "${name}" no tiene contenido de texto legible directamente o está vacío.`);
    }

    const systemPrompt = `Eres Beto, asistente académico universitario de UNEMI.
Tu objetivo es analizar rigurosamente el material educativo provisto y responder con base exclusiva en dicho contenido.
Reglas estrictas:
1. Nunca inventes información, datos, transcripciones ni citas.
2. Si un concepto o respuesta no figura en el material provisto, acláralo honestamente.
3. Si el usuario solicita un cuestionario de práctica, elabora preguntas de autoevaluación con respuestas justificadas basadas únicamente en el texto.
4. Mantén una redacción académica, estructurada con Markdown claro (encabezados, viñetas, tablas de ser oportuno).`;

    let userPrompt = '';
    if (tipoAnalisis === 'cuestionario') {
        userPrompt = `Analiza el siguiente material educativo extraído de "${name}" (${mimeType}):\n\n"""\n${content.slice(0, 45000)}\n"""\n\nGenera un cuestionario de práctica para estudiar este tema. Incluye:\n1. 5 preguntas clave con opciones múltiples y la respuesta correcta explicada.\n2. 3 preguntas conceptuales de desarrollo con su justificación basada en el texto.\n${instruccionesUsuario ? `Petición adicional del estudiante: ${instruccionesUsuario}` : ''}`;
    } else if (tipoAnalisis === 'conceptos') {
        userPrompt = `Analiza el siguiente material educativo de "${name}":\n\n"""\n${content.slice(0, 45000)}\n"""\n\nExtrae los conceptos fundamentales, definiciones clave, fórmulas/procedimientos principales y crea una guía de estudio rápida.`;
    } else {
        userPrompt = `Analiza el siguiente material educativo de "${name}":\n\n"""\n${content.slice(0, 45000)}\n"""\n\nElabora una síntesis completa y estructurada del material con:\n- Objetivo central del tema\n- Resumen estructurado por secciones\n- Conclusiones y recomendaciones para el examen.\n${instruccionesUsuario ? `Petición específica: ${instruccionesUsuario}` : ''}`;
    }

    if (typeof generateTextFn === 'function') {
        return await generateTextFn(
            [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemPrompt,
            0.5
        );
    }

    const { generateText } = require('../servidor');
    return await generateText(
        [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemPrompt,
        0.5
    );
}

module.exports = {
    analizarRecursoEducativo,
    setGenerateTextFunction
};
