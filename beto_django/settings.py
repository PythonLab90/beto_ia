from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# Auto-load .env file if present
env_file = BASE_DIR / '.env'
if env_file.exists():
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip().strip("'\"")

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-change-this-key')
DEBUG = True
ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    '.ngrok-free.dev',
]

ROOT_URLCONF = 'beto_django.urls'
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]
INSTALLED_APPS = []
TEMPLATES = []
WSGI_APPLICATION = 'beto_django.wsgi.application'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-20b')

EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'false').lower() == 'true'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
EMAIL_TIMEOUT = 15
PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL', '').rstrip('/')
EMAIL_REMINDERS_DB_PATH = os.environ.get(
    'EMAIL_REMINDERS_DB_PATH',
    str(BASE_DIR / 'beto_email_reminders.sqlite3'),
)

