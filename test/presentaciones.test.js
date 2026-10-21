const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createPresentation, validatePresentation, THEMES } = require('../presentaciones');

const example = {
    title: 'Prueba de generación',
    template: 'academico',
    slides: [
        { title: 'Introducción', points: ['Objetivo: Presentar conceptos clave'] },
        { title: 'Ideas principales', points: ['Concepto: Una explicación breve', 'Aplicación: Un ejemplo práctico'] }
    ]
};

test('genera un archivo PPTX válido con portada y diapositivas editables', async () => {
    const { buffer: file } = await createPresentation(example);
    assert.ok(Buffer.isBuffer(file));
    assert.equal(file.subarray(0, 2).toString(), 'PK');
    assert.ok(file.includes(Buffer.from('ppt/slides/slide1.xml')));
    assert.ok(file.includes(Buffer.from('ppt/slides/slide2.xml')));
});

test('genera archivos PPTX con las siete plantillas', async () => {
    for (const template of Object.keys(THEMES)) {
        const { buffer: file } = await createPresentation({ ...example, template });
        assert.ok(Buffer.isBuffer(file), `${template} debe producir un Buffer`);
        assert.equal(file.subarray(0, 2).toString(), 'PK');
    }
});

test('interpreta tablas Markdown y gráficos con datos explícitos', async () => {
    const { buffer: file } = await createPresentation({
        ...example,
        slides: [
            { title: 'Presentación', points: ['Objetivo: Comparar información'] },
            { title: 'Tabla comparativa', points: ['| Concepto | Uso |', '| IA | Análisis |'] },
            { title: 'Gráfico de indicadores', points: ['A: 12', 'B: 18', 'C: 9'] }
        ]
    });
    assert.ok(file.includes(Buffer.from('ppt/slides/slide3.xml')));
    assert.ok(file.includes(Buffer.from('ppt/charts/chart1.xml')));
});

test('selecciona gráficos de barras, líneas y sectores a partir del título', async () => {
    for (const title of ['Gráfico comparativo', 'Gráfico de línea temporal', 'Gráfico circular por sectores']) {
        const { buffer } = await createPresentation({
            ...example,
            slides: [
                { title: 'Introducción', points: ['Objetivo: Mostrar datos'] },
                { title, points: ['A: 12', 'B: 18', 'C: 9'] }
            ]
        });
        assert.match(buffer.toString('latin1'), /ppt\/charts\/chart\d+\.xml/, `${title} debe incluir un gráfico editable`);
    }
});

test('el puente Node del backend produce gráficos y tablas en el archivo descargable', () => {
    const payload = {
        title: 'Django PPTX Five Slides',
        template: 'tecnologico',
        includeImages: false,
        slides: [
            { title: 'Introduction', points: ['Objective: Test generation'] },
            { title: 'Fundamentals', points: ['Concept: Editable PPTX'] },
            { title: 'Comparison table', points: ['| Option | Benefit |', '| A | Editable |'] },
            { title: 'Grafico results', points: ['A: 10', 'B: 20'] },
            { title: 'Conclusions', points: ['Result: Valid file'] }
        ]
    };
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'generar_pptx.js')], {
        input: JSON.stringify(payload),
        maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(result.status, 0, result.stderr.toString());
    assert.match(result.stdout.toString('latin1'), /ppt\/charts\/chart\d+\.xml/);
    assert.match(result.stdout.toString('latin1'), /ppt\/slides\/slide5\.xml/);
});

test('rechaza entradas incompletas, formatos incorrectos y exceso de diapositivas', () => {
    assert.throws(() => validatePresentation({ ...example, title: '' }), /título/);
    assert.throws(() => validatePresentation({ ...example, slides: [] }), /entre 1 y 25/);
    assert.throws(() => validatePresentation({
        ...example,
        slides: Array.from({ length: 26 }, (_, index) => ({ title: `Slide ${index}`, points: ['Punto'] }))
    }), /entre 1 y 25/);
});
