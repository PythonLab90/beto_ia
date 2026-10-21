const { createPresentation } = require('./presentaciones');

let input = '';
let size = 0;
const limit = 262144;

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
    size += Buffer.byteLength(chunk, 'utf8');
    if (size > limit) {
        process.exitCode = 1;
        process.stdin.destroy();
        return;
    }
    input += chunk;
});

process.stdin.on('end', async () => {
    if (size > limit) {
        process.stderr.write(`${JSON.stringify({ error: 'La solicitud supera el límite de 256 KB.', clientError: true })}\n`);
        return;
    }
    try {
        const payload = JSON.parse(input || '{}');
        const { buffer } = await createPresentation(payload);
        process.stdout.write(buffer);
    } catch (error) {
        process.stderr.write(`${JSON.stringify({
            error: error.message || 'No se pudo generar el PowerPoint.',
            clientError: error instanceof SyntaxError || error.statusCode === 400
        })}\n`);
        process.exitCode = 1;
    }
});
