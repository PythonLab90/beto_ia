const PptxGenJS = require('pptxgenjs');

const THEMES = {
    academico: { label: 'Académico y universitario', bg: 'F4F7FB', primary: '12345A', secondary: '225C91', accent: 'E6A93D', text: '1D2C44', muted: '66788E', card: 'FFFFFF' },
    tecnologico: { label: 'Tecnológico y futurista', bg: '0B1020', primary: '5B4BDB', secondary: '20C7D9', accent: '20C7D9', text: 'F2F5FF', muted: 'ADB9D5', card: '171F37' },
    empresarial: { label: 'Empresarial y corporativo', bg: 'F3F6F8', primary: '15364B', secondary: '287B78', accent: 'D1A75B', text: '203746', muted: '657784', card: 'FFFFFF' },
    minimalista: { label: 'Minimalista y elegante', bg: 'F7F5F1', primary: '282828', secondary: '686868', accent: 'B48A5A', text: '282828', muted: '77736D', card: 'FFFFFF' },
    educativo: { label: 'Educativo y didáctico', bg: 'F4F8F2', primary: '28634C', secondary: '60A568', accent: 'E8B64F', text: '244137', muted: '657D6E', card: 'FFFFFF' },
    cientifico: { label: 'Científico y estadístico', bg: 'F1F5FA', primary: '283F74', secondary: '577EC5', accent: '47B8AD', text: '24334C', muted: '687A95', card: 'FFFFFF' },
    creativo: { label: 'Creativo y visual', bg: 'FBF4F8', primary: '762F67', secondary: 'B74E89', accent: 'F29D63', text: '39273B', muted: '806D7D', card: 'FFFFFF' }
};

const WIDTH = 13.333;
const HEIGHT = 7.5;
class PresentationInputError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
    }
}

const cleanText = (value, maxLength) => String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

function validatePresentation(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new PresentationInputError('La solicitud de presentación no es válida.');
    }
    const title = cleanText(payload.title, 180);
    if (!title) throw new PresentationInputError('La presentación debe incluir un título.');
    if (!Array.isArray(payload.slides) || payload.slides.length < 1 || payload.slides.length > 25) {
        throw new PresentationInputError('La presentación debe tener entre 1 y 25 diapositivas.');
    }
    const slides = payload.slides.map((slide, index) => {
        if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
            throw new PresentationInputError(`La diapositiva ${index + 1} no es válida.`);
        }
        const slideTitle = cleanText(slide.title, 140);
        const points = Array.isArray(slide.points)
            ? slide.points.filter(point => typeof point === 'string').map(point => cleanText(point, 360)).filter(Boolean).slice(0, 8)
            : [];
        if (!slideTitle || !points.length) {
            throw new PresentationInputError(`La diapositiva ${index + 1} no tiene título o contenido.`);
        }
        let imageUrl = '';
        if (typeof slide.imageUrl === 'string') {
            try {
                const parsed = new URL(slide.imageUrl);
                if (parsed.protocol === 'https:' && parsed.hostname === 'images.unsplash.com' && !parsed.port) {
                    imageUrl = parsed.toString();
                }
            } catch (_) {}
        }
        return {
            title: slideTitle,
            points,
            imageUrl,
            imageCredit: cleanText(slide.imageCredit, 140)
        };
    });
    const theme = THEMES[payload.template] ? payload.template : 'academico';
    return { title, slides, theme, includeImages: payload.includeImages === true };
}

async function fetchUnsplashImage(url) {
    if (!url) return null;
    const parsed = new URL(url);
    parsed.searchParams.set('fm', 'jpg');
    parsed.searchParams.delete('auto');
    const response = await fetch(parsed, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const mimeType = response.headers.get('content-type')?.split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(mimeType)) return null;
    const contentLength = Number(response.headers.get('content-length') || 0);
    const maxBytes = 3 * 1024 * 1024;
    if (contentLength > maxBytes) return null;

    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        size += chunk.length;
        if (size > maxBytes) {
            await reader.cancel();
            return null;
        }
        chunks.push(chunk);
    }
    if (!size) return null;
    return `data:${mimeType};base64,${Buffer.concat(chunks).toString('base64')}`;
}

function cleanPointPrefix(text) {
    return String(text || '').replace(/^(?:Punto|Idea|Concepto|Aspecto|Elemento)?\s*\d+\s*[:.-]\s*/i, '').trim();
}

function splitPoint(point) {
    const cleaned = cleanPointPrefix(point);
    const separator = cleaned.indexOf(':');
    if (separator < 1) return { heading: cleaned, detail: '' };
    return { heading: cleaned.slice(0, separator).trim(), detail: cleaned.slice(separator + 1).trim() };
}

function parseTable(points) {
    const rows = points
        .filter(point => point.includes('|'))
        .map(point => point.split('|').map(cell => cleanText(cell, 100)).filter(Boolean))
        .filter(row => row.length >= 2 && !row.every(cell => /^:?-{2,}:?$/.test(cell)));
    if (rows.length < 2) return null;
    const width = Math.min(5, Math.max(...rows.map(row => row.length)));
    return rows.slice(0, 7).map(row => Array.from({ length: width }, (_, index) => row[index] || ''));
}

function parseChart(title, points) {
    const isChartTitle = /(gr[aá]fic|estad[ií]stic|indicador|m[eé]trica|datos cuantitativos|comparaci[oó]n|distribuci[oó]n|porcentaje|tendencia|evoluci[oó]n)/i.test(title);

    // Buscar datos con formato "Etiqueta: Número" o "Etiqueta - Número" o "Etiqueta | Número"
    const series = [];
    for (const point of points) {
        const match = String(point).match(/^(.{1,50}?)\s*[:|-]\s*(-?\d+(?:[.,]\d+)?)\s*(%|por ciento|[a-zA-Z]{1,8})?\s*$/);
        if (match) {
            const value = Number(match[2].replace(',', '.'));
            if (Number.isFinite(value)) {
                series.push({ label: cleanText(match[1], 35), value });
            }
        }
    }

    // Si tiene al menos 2 datos numéricos y el título lo sugiere O la mayoría de los puntos son números
    if (series.length >= 2 && (isChartTitle || series.length >= points.length * 0.6)) {
        const kind = /l[ií]nea|lineal|evoluci[oó]n|tendencia|tiempo/i.test(title)
            ? 'line'
            : /circular|pastel|sector|porcentaje|distribuci[oó]n|proporci[oó]n/i.test(title)
                ? 'pie'
                : 'bar';
        return { kind, series: series.slice(0, 8) };
    }

    return null;
}

function isProcessSlide(title) {
    return /(proceso|paso|fase|etapa|cronolog|l[ií]nea de tiempo|secuencia)/i.test(title);
}

function addFooter(slide, pptx, theme, page, total) {
    slide.addShape(pptx.ShapeType.line, {
        x: 0.7, y: 6.92, w: 11.93, h: 0,
        line: { color: theme.accent, transparency: 35, width: 1 }
    });
    slide.addText('BETO IA  /  PRESENTACIÓN EDITABLE', {
        x: 0.75, y: 7.02, w: 5.5, h: 0.18, fontFace: 'Aptos', fontSize: 8,
        bold: true, color: theme.muted, margin: 0, breakLine: false
    });
    slide.addText(`${String(page).padStart(2, '0')}  /  ${String(total).padStart(2, '0')}`, {
        x: 11.3, y: 7.02, w: 1.2, h: 0.18, fontFace: 'Aptos', fontSize: 8,
        bold: true, color: theme.muted, align: 'right', margin: 0
    });
}

function addCover(pptx, title, slides, theme) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.bg };
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.2, h: HEIGHT,
        line: { color: theme.primary, transparency: 100 }, fill: { color: theme.primary }
    });
    slide.addShape(pptx.ShapeType.ellipse, {
        x: 9.9, y: -1.2, w: 4.8, h: 4.8,
        line: { color: theme.accent, transparency: 100 }, fill: { color: theme.accent, transparency: 82 }
    });
    slide.addShape(pptx.ShapeType.ellipse, {
        x: 11.1, y: 4.7, w: 2.5, h: 2.5,
        line: { color: theme.secondary, transparency: 100 }, fill: { color: theme.secondary, transparency: 82 }
    });
    slide.addText('BETO IA  •  PRESENTACIÓN EDITABLE', {
        x: 0.95, y: 0.75, w: 7.5, h: 0.3, fontFace: 'Aptos', fontSize: 11,
        bold: true, charSpacing: 1.5, color: theme.secondary, margin: 0
    });
    const coverImage = slides[0]?.imageData;
    const textWidth = coverImage ? 7.5 : 10.8;
    slide.addText(title, {
        x: 0.95, y: 1.55, w: textWidth, h: 1.5, fontFace: 'Aptos Display', fontSize: 34,
        bold: true, color: theme.primary, breakLine: false, valign: 'mid', margin: 0.02, fit: 'shrink'
    });
    slide.addShape(pptx.ShapeType.rect, {
        x: 0.98, y: 3.25, w: 1.15, h: 0.07,
        line: { color: theme.accent, transparency: 100 }, fill: { color: theme.accent }
    });
    const keyPoints = slides[0]?.points.slice(0, 6) || [];
    if (keyPoints.length) {
        slide.addText('CONTENIDO PRINCIPAL', {
            x: 0.98, y: 3.65, w: 5.4, h: 0.28, fontFace: 'Aptos', fontSize: 10,
            bold: true, charSpacing: 1, color: theme.muted, margin: 0
        });
        keyPoints.forEach((item, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 0.98 + col * (coverImage ? 3.85 : 5.0);
            const y = 4.05 + row * 0.78;
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y, w: coverImage ? 3.62 : 4.65, h: 0.62, rectRadius: 0.06,
                line: { color: theme.primary, transparency: 85, width: 0.8 },
                fill: { color: theme.card, transparency: 4 }
            });
            slide.addText(item, {
                x: x + 0.17, y: y + 0.1, w: coverImage ? 3.28 : 4.3, h: 0.4, fontFace: 'Aptos',
                fontSize: 10.5, color: theme.text, margin: 0, fit: 'shrink'
            });
        });
    }
    if (coverImage) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x: 9.05, y: 1.25, w: 3.45, h: 4.95, rectRadius: 0.08,
            line: { color: theme.primary, transparency: 72, width: 1 },
            fill: { color: theme.card }
        });
        slide.addImage({ data: coverImage, x: 9.15, y: 1.35, w: 3.25, h: 4.55 });
        if (slides[0].imageCredit) {
            slide.addText(slides[0].imageCredit, {
                x: 9.2, y: 5.98, w: 3.1, h: 0.15,
                fontFace: 'Aptos', fontSize: 7.5, color: theme.muted, margin: 0, fit: 'shrink'
            });
        }
    }
    addFooter(slide, pptx, theme, 1, slides.length);
    return slide;
}

function addContentSlide(pptx, item, index, total, theme) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.bg };
    slide.addShape(pptx.ShapeType.rect, {
        x: 0.72, y: 0.49, w: 0.08, h: 0.34,
        line: { color: theme.accent, transparency: 100 }, fill: { color: theme.accent }
    });
    slide.addText(item.title, {
        x: 0.98, y: 0.43, w: 11.5, h: 0.56, fontFace: 'Aptos Display',
        fontSize: 26, bold: true,
        color: /(conclus|cierre|reflexi[oó]n final)/i.test(item.title) ? 'FFFFFF' : theme.primary,
        margin: 0.01, fit: 'shrink'
    });
    slide.addShape(pptx.ShapeType.line, {
        x: 0.98, y: 1.12, w: 1.1, h: 0,
        line: { color: theme.accent, width: 2.3 }
    });

    const table = parseTable(item.points);
    const chart = parseChart(item.title, item.points);
    if (table) {
        const tableRows = table.map((row, rowIndex) => row.map(cell => ({
            text: cell,
            options: rowIndex === 0
                ? { bold: true, color: 'FFFFFF', fill: { color: theme.primary } }
                : { color: theme.text, fill: { color: theme.card } }
        })));
        slide.addTable(tableRows, {
            x: 0.95, y: 1.55, w: 11.4, h: 4.85,
            border: { type: 'solid', color: 'D9E1EB', pt: 0.8 },
            fill: theme.card,
            color: theme.text,
            fontFace: 'Aptos',
            fontSize: 14,
            margin: 0.12,
            rowH: 0.52,
            autoFit: false,
            bold: false,
            valign: 'mid'
        });
    } else if (chart) {
        slide.addChart(pptx.ChartType[chart.kind], [{
            name: 'Valores',
            labels: chart.series.map(value => value.label),
            values: chart.series.map(value => value.value)
        }], {
            x: 1.15, y: 1.45, w: 10.9, h: 4.95,
            catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 12,
            valAxisLabelFontFace: 'Aptos', valAxisLabelFontSize: 10,
            chartColors: [theme.secondary],
            showLegend: chart.kind === 'pie', showTitle: false, showValue: true,
            showCatName: false, showValAxisTitle: false, showCatAxisTitle: false,
            showValAxis: true, showCatAxis: true, showBorder: false,
            showMajorGridLine: true, valGridLine: { color: 'D9E1EB', width: 1 },
            showLabel: true, dataLabelPosition: 'outEnd',
            layout: { x: 0.16, y: 0.08, w: 0.78, h: 0.78 }
        });
    } else if (isProcessSlide(item.title) && item.points.length >= 3) {
        const steps = item.points.slice(0, 6);
        const gap = 0.12;
        const stepW = (11.45 - gap * (steps.length - 1)) / steps.length;
        const startX = 0.94;
        const centerY = 3.45;
        slide.addShape(pptx.ShapeType.line, {
            x: startX + stepW / 2, y: centerY, w: (stepW + gap) * (steps.length - 1), h: 0,
            line: { color: theme.accent, width: 2.5, beginArrowType: 'none', endArrowType: 'triangle' }
        });
        steps.forEach((point, pointIndex) => {
            const x = startX + pointIndex * (stepW + gap);
            const { heading, detail } = splitPoint(point);
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y: 1.72, w: stepW, h: 3.85, rectRadius: 0.08,
                line: { color: theme.primary, transparency: 82, width: 0.8 },
                fill: { color: theme.card }
            });
            slide.addShape(pptx.ShapeType.ellipse, {
                x: x + stepW / 2 - 0.28, y: centerY - 0.28, w: 0.56, h: 0.56,
                line: { color: theme.bg, width: 2 },
                fill: { color: theme.secondary }
            });
            slide.addText(String(pointIndex + 1).padStart(2, '0'), {
                x: x + stepW / 2 - 0.22, y: centerY - 0.09, w: 0.44, h: 0.16,
                fontFace: 'Aptos', fontSize: 9, bold: true, color: 'FFFFFF',
                align: 'center', margin: 0
            });
            slide.addText(heading, {
                x: x + 0.12, y: 2.12, w: stepW - 0.24, h: 0.82,
                fontFace: 'Aptos Display', fontSize: 13, bold: true,
                color: theme.primary, margin: 0.02, fit: 'shrink',
                align: 'center', valign: 'mid'
            });
            if (detail) {
                slide.addText(detail, {
                    x: x + 0.12, y: 4.05, w: stepW - 0.24, h: 1.05,
                    fontFace: 'Aptos', fontSize: 10.5, color: theme.text,
                    margin: 0.02, valign: 'top', fit: 'shrink', align: 'center'
                });
            }
        });
    } else if (/(conclus|cierre|reflexi[oó]n final|referencia|bibliograf)/i.test(item.title)) {
        slide.background = { color: theme.primary };
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 9.7, y: 1.35, w: 2.7, h: 2.7,
            line: { color: theme.accent, transparency: 45, width: 2 },
            fill: { color: theme.secondary, transparency: 35 }
        });
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 10.35, y: 2.0, w: 1.4, h: 1.4,
            line: { color: theme.accent, transparency: 100 },
            fill: { color: theme.accent, transparency: 12 }
        });
        const points = item.points.slice(0, 5);
        const columns = points.length > 3 ? 2 : 1;
        const rows = Math.ceil(points.length / columns);
        const gapX = 0.2;
        const gapY = 0.16;
        const cardW = (8.15 - gapX * (columns - 1)) / columns;
        const cardH = Math.min(1.48, (4.2 - gapY * (rows - 1)) / rows);
        points.forEach((point, pointIndex) => {
            const col = pointIndex % columns;
            const row = Math.floor(pointIndex / columns);
            const x = 0.95 + col * (cardW + gapX);
            const y = 1.65 + row * (cardH + gapY);
            const { heading, detail } = splitPoint(point);
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y, w: cardW, h: cardH, rectRadius: 0.07,
                line: { color: 'FFFFFF', transparency: 82, width: 0.8 },
                fill: { color: 'FFFFFF', transparency: 89 }
            });
            slide.addText(heading, {
                x: x + 0.2, y: y + 0.16, w: cardW - 0.4, h: 0.36,
                fontFace: 'Aptos Display', fontSize: 14, bold: true,
                color: 'FFFFFF', margin: 0.02, fit: 'shrink'
            });
            if (detail) {
                slide.addText(detail, {
                    x: x + 0.2, y: y + 0.58, w: cardW - 0.4, h: cardH - 0.72,
                    fontFace: 'Aptos', fontSize: 11.5, color: 'E7EDF6',
                    margin: 0.02, valign: 'top', fit: 'shrink'
                });
            }
        });
        addFooter(slide, pptx, { ...theme, muted: 'DDE6F2' }, index + 1, total);
        return slide;
    } else if (/(introducci[oó]n|contexto|antecedentes|planteamiento|visi[oó]n general|marco)/i.test(item.title) || item.points.length === 1) {
        // Layout Editorial / Introducción sin recuadros pesados
        const points = item.points.slice(0, 3);
        const contentW = item.imageData ? 7.05 : 11.4;
        let currentY = 1.6;

        // Barra vertical decorativa de acento
        slide.addShape(pptx.ShapeType.rect, {
            x: 0.95, y: 1.6, w: 0.08, h: Math.min(4.8, points.length * 1.6),
            line: { color: theme.accent, transparency: 100 },
            fill: { color: theme.accent }
        });

        points.forEach((point) => {
            const { heading, detail } = splitPoint(point);
            if (heading && detail && heading !== detail) {
                slide.addText(heading, {
                    x: 1.25, y: currentY, w: contentW - 0.3, h: 0.45,
                    fontFace: 'Aptos Display', fontSize: 18, bold: true,
                    color: theme.primary, margin: 0.02, fit: 'shrink'
                });
                currentY += 0.5;
                slide.addText(detail, {
                    x: 1.25, y: currentY, w: contentW - 0.3, h: 1.0,
                    fontFace: 'Aptos', fontSize: 13.5, color: theme.text,
                    margin: 0.02, valign: 'top', fit: 'shrink'
                });
                currentY += 1.1;
            } else {
                slide.addText(detail || heading, {
                    x: 1.25, y: currentY, w: contentW - 0.3, h: 1.4,
                    fontFace: 'Aptos', fontSize: 14, color: theme.text,
                    margin: 0.02, valign: 'top', fit: 'shrink'
                });
                currentY += 1.5;
            }
        });

        if (item.imageData) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: 8.42, y: 1.5, w: 3.9, h: 4.75, rectRadius: 0.08,
                line: { color: theme.primary, transparency: 80, width: 0.8 },
                fill: { color: theme.card }
            });
            slide.addImage({
                data: item.imageData,
                x: 8.52, y: 1.6, w: 3.7, h: 4.35
            });
            if (item.imageCredit) {
                slide.addText(item.imageCredit, {
                    x: 8.58, y: 6.02, w: 3.55, h: 0.16,
                    fontFace: 'Aptos', fontSize: 7.5, color: theme.muted,
                    margin: 0, fit: 'shrink'
                });
            }
        }
    } else {
        const points = item.points.slice(0, 6);
        const contentW = item.imageData ? 7.05 : 11.4;
        const columns = points.length <= 2 ? 2 : points.length === 3 ? 3 : points.length === 4 ? 2 : 2;
        const rows = Math.ceil(points.length / columns);
        const gapX = 0.22;
        const gapY = 0.20;
        const cardW = (contentW - gapX * (columns - 1)) / columns;
        const cardH = Math.min(columns === 1 ? 2.4 : 2.15, (4.95 - gapY * (rows - 1)) / rows);

        const accentColors = [theme.secondary, theme.accent, '8B5CF6', '10B981', 'F43F5E'];

        points.forEach((point, pointIndex) => {
            const col = pointIndex % columns;
            const row = Math.floor(pointIndex / columns);
            const x = 0.95 + col * (cardW + gapX);
            const y = 1.48 + row * (cardH + gapY);
            const { heading, detail } = splitPoint(point);
            const cardAccent = accentColors[pointIndex % accentColors.length];

            // Tarjeta estilo Canva con borde superior de color
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y, w: cardW, h: cardH, rectRadius: 0.1,
                line: { color: 'CBD5E1', width: 0.8 },
                fill: { color: theme.card }
            });

            // Acento superior vibrante
            slide.addShape(pptx.ShapeType.rect, {
                x: x + 0.05, y, w: cardW - 0.1, h: 0.07,
                line: { color: cardAccent, transparency: 100 },
                fill: { color: cardAccent }
            });

            // Título de la tarjeta
            slide.addText(heading, {
                x: x + 0.22, y: y + 0.18, w: cardW - 0.44, h: 0.45,
                fontFace: 'Aptos Display', fontSize: 15, bold: true,
                color: theme.primary, margin: 0.02, fit: 'shrink'
            });

            // Descripción o cuerpo del punto
            if (detail) {
                slide.addText(detail, {
                    x: x + 0.22, y: y + 0.68, w: cardW - 0.44, h: cardH - 0.82,
                    fontFace: 'Aptos', fontSize: 11.5, color: theme.text,
                    margin: 0.02, valign: 'top', fit: 'shrink'
                });
            }
        });
        if (item.imageData) {
            slide.addShape(pptx.ShapeType.roundRect, {
                x: 8.42, y: 1.5, w: 3.9, h: 4.75, rectRadius: 0.08,
                line: { color: theme.primary, transparency: 80, width: 0.8 },
                fill: { color: theme.card }
            });
            slide.addImage({
                data: item.imageData,
                x: 8.52, y: 1.6, w: 3.7, h: 4.35
            });
            if (item.imageCredit) {
                slide.addText(item.imageCredit, {
                    x: 8.58, y: 6.02, w: 3.55, h: 0.16,
                    fontFace: 'Aptos', fontSize: 7.5, color: theme.muted,
                    margin: 0, fit: 'shrink'
                });
            }
        }
    }
    addFooter(slide, pptx, theme, index + 1, total);
    return slide;
}

async function createPresentation(payload) {
    const data = validatePresentation(payload);
    const theme = THEMES[data.theme];
    let imagesSkipped = 0;
    if (data.includeImages) {
        const available = data.slides.filter(slide => slide.imageUrl);
        const selected = available.slice(0, 6);
        imagesSkipped = Math.max(0, available.length - selected.length);
        await Promise.all(selected.map(async slide => {
            try {
                slide.imageData = await fetchUnsplashImage(slide.imageUrl);
            } catch (_) {
                slide.imageData = null;
            }
            if (!slide.imageData) imagesSkipped += 1;
        }));
        for (const slide of data.slides.slice(1)) {
            if (slide.imageData && (parseTable(slide.points) || parseChart(slide.title, slide.points))) {
                slide.imageData = null;
                imagesSkipped += 1;
            }
        }
    }
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Beto IA';
    pptx.subject = 'Presentación generada con Beto IA';
    pptx.title = data.title;
    pptx.lang = 'es-ES';
    pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-ES' };
    addCover(pptx, data.title, data.slides, theme);
    for (const [index, slide] of data.slides.slice(1).entries()) {
        addContentSlide(pptx, slide, index + 1, data.slides.length, theme);
    }
    return {
        buffer: await pptx.write({ outputType: 'nodebuffer' }),
        imagesSkipped
    };
}

module.exports = { createPresentation, validatePresentation, THEMES };
