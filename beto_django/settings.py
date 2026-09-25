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

