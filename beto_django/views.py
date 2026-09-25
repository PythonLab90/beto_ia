import json
import os
import subprocess
import tempfile
import urllib.parse
import urllib.request
import ipaddress
import socket
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from openai import OpenAI


@csrf_exempt
def chat(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido.'}, status=405)
    if not settings.GROQ_API_KEY:
        return JsonResponse({'error': 'Configura GROQ_API_KEY en el servidor.'}, status=500)

    try:
        payload = json.loads(request.body or '{}')
        messages = payload.get('messages', [])
        if not isinstance(messages, list):
            raise ValueError

        client = OpenAI(
            base_url='https://api.groq.com/openai/v1',
            api_key=settings.GROQ_API_KEY,
            default_headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
        )

        result = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'Eres Beto, un asistente académico inteligente orientado a estudiantes universitarios de UNEMI. Responde siempre en español, de forma clara, amigable y estructurada. '
                        'Puedes generar y redactar documentos, guías de estudio, resúmenes, informes, exámenes de práctica y horarios para exportar a Word (.docx), PDF (.pdf), Excel (.xlsx) o Texto (.txt). '
                        'Cuando el estudiante pida un documento o tabla, estructura tu respuesta con Markdown claro (encabezados # y ##, viñetas estructuradas y tablas en formato | Columna 1 | Columna 2 |) para que se conviertan con 1 clic a Word, PDF o Excel. '
                        'Cuando pida una presentación, usa exactamente un encabezado # Presentación: título y después entre 8 y 10 bloques ## Diapositiva N: título. Entrega contenido académico sustancial, no frases decorativas ni un resumen superficial: incluye contexto, definición de conceptos, antecedentes, causas, proceso, ejemplos concretos, aplicaciones, comparación de perspectivas, datos o evidencias disponibles, limitaciones, riesgos, recomendaciones accionables y conclusión. Cada diapositiva debe tener 4 a 7 viñetas específicas; cada viñeta debe explicar una idea en una o dos frases completas. Distribuye la información sin repetirla y adapta la profundidad al tema solicitado. No inventes datos, fuentes, fechas ni cifras; si una información no está disponible escribe "No especificado". No uses tablas dentro de las diapositivas. '
                        'Cuando recibas un contexto de una página web o curso, úsalo como fuente principal para responder. '
                        'Organiza las tareas, actividades, evaluaciones, recursos y fechas detectadas cuando el estudiante pregunte por pendientes o calendario. '
                        'Incluye enlaces de Moodle cuando estén disponibles y explica que el enlace se abrirá en la sesión institucional del estudiante. '
                        'Puedes preparar respuestas, resúmenes, ejemplos y preguntas de práctica, pero nunca envíes tareas, formularios o mensajes sin confirmación explícita. '
                        'Usa también la lista de videos y materiales audiovisuales para indicar dónde está cada recurso. '
                        'Un enlace de Drive, YouTube o video solo identifica el material: no afirmes que viste o escuchaste su contenido si no recibiste una transcripción. '
                        'No digas que no tienes acceso a Moodle si la información necesaria aparece en el contexto recibido. '
                        'Aclara únicamente cuando el dato no esté incluido en ese contexto.'
                    ),
                },
                *messages,
            ],
        )
        reply = result.choices[0].message.content or ''
        return JsonResponse({'reply': reply})
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({'error': 'La solicitud no es válida.'}, status=400)
    except Exception as error:
        return JsonResponse({'error': f'Error de Groq: {error}'}, status=502)


@csrf_exempt
def transcribe_video(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido.'}, status=405)
    if not settings.GROQ_API_KEY:
        return JsonResponse({'error': 'Configura GROQ_API_KEY en el servidor.'}, status=500)

    video = request.FILES.get('video')
    if not video:
        return JsonResponse({'error': 'Selecciona un video de clase.'}, status=400)
    allowed_extensions = {'.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'}
    extension = Path(video.name).suffix.lower()
    if extension not in allowed_extensions:
        return JsonResponse({'error': 'Formato no permitido. Usa MP4, WebM, MOV, M4V, AVI o MKV.'}, status=400)
    if video.size > 500 * 1024 * 1024:
        return JsonResponse({'error': 'El video supera el límite de 500 MB.'}, status=413)

    video_path = None
    audio_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temporary_video:
            for chunk in video.chunks():
                temporary_video.write(chunk)
            video_path = temporary_video.name
        audio_path = f'{video_path}.mp3'
        subprocess.run(
            ['ffmpeg', '-y', '-i', video_path, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=900,
        )
        client = OpenAI(
            base_url='https://api.groq.com/openai/v1',
            api_key=settings.GROQ_API_KEY,
            default_headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
        )
        with open(audio_path, 'rb') as audio_file:
            transcription = client.audio.transcriptions.create(
                model=os.environ.get('GROQ_TRANSCRIPTION_MODEL', 'whisper-large-v3-turbo'),
                file=audio_file,
                language='es',
                response_format='text',
            )
        transcript = str(transcription).strip()
        if not transcript:
            return JsonResponse({'error': 'No se encontró voz clara en el video.'}, status=422)
        summary = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'Actúa como un analista profesional de reuniones y clases. Analiza toda la transcripción, no solo el inicio. Entrega un informe largo, completo y bien desarrollado, listo para entregar o compartir; no respondas con un resumen superficial de pocas líneas. Desarrolla cada tema con contexto, argumentos, resultado y evidencia encontrada. '
                        'Responde en español con Markdown claro y no inventes nombres, fechas, cifras, decisiones ni responsables; si falta un dato escribe "No especificado". '
                        'Entrega exactamente estas secciones: # Resumen ejecutivo; ## Temas tratados en detalle; ## Puntos importantes y hallazgos; '
                        '## Decisiones tomadas con una tabla de Decisión | Motivo | Impacto; ## Tareas y compromisos con una tabla de Tarea | Responsable | Fecha límite | Prioridad | Estado; '
                        '## Riesgos, bloqueos y oportunidades; ## Preguntas y asuntos pendientes; ## Mejoras y recomendaciones con una tabla de Mejora sugerida | Problema que resuelve | Beneficio esperado | Prioridad | Esfuerzo estimado | Primer paso; '
                        '## Plan de seguimiento con acciones para 24 horas, 7 días y 30 días; ## Indicadores sugeridos; ## Conclusión. '
                        'Distingue los hechos de tus recomendaciones, señala los puntos que requieren atención y conserva cifras, plazos y citas relevantes. '
                        'El resultado debe ser profesional, detallado, accionable y listo para compartir con los asistentes.'
                    ),
                },
                {'role': 'user', 'content': f'Transcripción de la clase "{video.name}":\n\n{transcript[:60000]}'},
            ],
        ).choices[0].message.content or ''
        return JsonResponse({'filename': video.name, 'transcript': transcript, 'summary': summary})
    except FileNotFoundError:
        return JsonResponse({'error': 'FFmpeg no está instalado en el servidor.'}, status=500)
    except subprocess.CalledProcessError:
        return JsonResponse({'error': 'No se pudo extraer el audio del video.'}, status=422)
    except Exception as error:
        return JsonResponse({'error': f'No se pudo procesar el video: {error}'}, status=502)
    finally:
        for path in (video_path, audio_path):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass


def _download_public_video(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname:
        raise ValueError('Solo se permiten URLs HTTPS.')
    hostname = parsed.hostname.lower()
    
    if 'unemi.edu.ec' in hostname or 'microsoftstream' in hostname or 'panopto' in hostname or 'kaltura' in hostname:
        raise ValueError('🔒 Este video pertenece a la plataforma institucional UNEMI y requiere autenticación activa. Por favor ábrelo con tu cuenta institucional y utiliza las opciones de transcripción o subida manual de audio/video.')

    allowed_hosts = {'drive.google.com', 'docs.google.com'}
    is_direct_video = Path(parsed.path).suffix.lower() in {'.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'}
    if hostname not in allowed_hosts and not is_direct_video:
        raise ValueError('El recurso enlazado requiere sesión activa o no ofrece una descarga pública directa de video.')

    for address in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM):
        ip = ipaddress.ip_address(address[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError('La URL apunta a una red privada.')

    if hostname in allowed_hosts:
        match = __import__('re').search(r'(?:/d/|[?&]id=)([a-zA-Z0-9_-]+)', url)
        if not match:
            raise ValueError('No se encontró el ID público del archivo en Drive. Si es privado, ábrelo en tu navegador y proporciona la transcripción.')
        url = f'https://drive.google.com/uc?export=download&id={match.group(1)}'

    request = urllib.request.Request(url, headers={'User-Agent': 'BetoVideoProcessor/1.0'})
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except Exception:
        raise ValueError('No se pudo acceder al enlace del video desde el servidor. Si requiere sesión institucional, ábrelo en tu navegador y sube el archivo con el botón 🎥.')

    content_type = response.headers.get('Content-Type', '').lower()
    if 'text/html' in content_type or 'application/json' in content_type:
        raise ValueError('🔒 El enlace devolvió una página de inicio de sesión o vista previa privada de UNEMI/Drive. Ábrelo en tu navegador y sube el audio/video o pega la transcripción.')

    content_length = int(response.headers.get('Content-Length') or 0)
    if content_length > 500 * 1024 * 1024:
        raise ValueError('El video supera el límite de 500 MB.')
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temporary_video:
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > 500 * 1024 * 1024:
                raise ValueError('El video supera el límite de 500 MB.')
            temporary_video.write(chunk)
        return temporary_video.name


@csrf_exempt
def transcribe_video_url(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido.'}, status=405)
    if not settings.GROQ_API_KEY:
        return JsonResponse({'error': 'Configura GROQ_API_KEY en el servidor.'}, status=500)
    video_path = None
    audio_path = None
    try:
        payload = json.loads(request.body or '{}')
        url = str(payload.get('url') or '')
        title = str(payload.get('title') or 'Video de clase')[:200]
        video_path = _download_public_video(url)
        audio_path = f'{video_path}.mp3'
        subprocess.run(['ffmpeg', '-y', '-i', video_path, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=900)
        client = OpenAI(base_url='https://api.groq.com/openai/v1', api_key=settings.GROQ_API_KEY)
        with open(audio_path, 'rb') as audio_file:
            transcription = client.audio.transcriptions.create(model=os.environ.get('GROQ_TRANSCRIPTION_MODEL', 'whisper-large-v3-turbo'), file=audio_file, language='es', response_format='text')
        transcript = str(transcription).strip()
        summary = client.chat.completions.create(model=settings.GROQ_MODEL, messages=[
            {'role': 'system', 'content': 'Resume esta clase universitaria en español de forma pedagógica. Entrega: Resumen general, Puntos clave por tema, Conceptos importantes, y 5 Preguntas de repaso/examen.'},
            {'role': 'user', 'content': f'Transcripción de {title}:\n\n{transcript[:60000]}'},
        ]).choices[0].message.content or ''
        return JsonResponse({'filename': title, 'transcript': transcript, 'summary': summary})
    except (ValueError, json.JSONDecodeError) as error:
        return JsonResponse({'error': str(error) or 'URL no válida.'}, status=400)
    except subprocess.CalledProcessError:
        return JsonResponse({'error': 'No se pudo extraer el audio del archivo obtenido. Si el enlace requiere cuenta institucional UNEMI, descarga la clase y súbela directamente.'}, status=422)
    except Exception as error:
        return JsonResponse({'error': f'🔒 No se pudo procesar el video automático: {error}'}, status=502)
    finally:
        for path in (video_path, audio_path):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass


def pagina(request):
    return FileResponse(open(settings.BASE_DIR / 'pagina.html', 'rb'), content_type='text/html')


def embed(request):
    return FileResponse(open(settings.BASE_DIR / 'beto-embed.js', 'rb'), content_type='application/javascript')
