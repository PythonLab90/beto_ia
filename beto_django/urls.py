from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from .views import chat, embed, pagina, presentation, presentation_images, presentation_pptx, transcribe_video, transcribe_video_url, google_auth_status, google_auth_login, google_auth_callback, google_auth_disconnect

urlpatterns = [
    path('', pagina, name='pagina'),
    path('beto-embed.js', embed, name='embed'),
    path('api/chat', chat, name='chat'),
    path('api/presentacion', presentation, name='presentation'),
    path('api/presentacion/generar', presentation_pptx, name='presentation-pptx'),
    path('api/presentacion/imagenes', presentation_images, name='presentation-images'),
    path('api/transcribe-video', transcribe_video, name='transcribe-video'),
    path('api/transcribe-video-url', transcribe_video_url, name='transcribe-video-url'),
    path('api/auth/google/status', google_auth_status, name='google-auth-status'),
    path('api/auth/google/login', google_auth_login, name='google-auth-login'),
    path('api/auth/google/callback', google_auth_callback, name='google-auth-callback'),
    path('api/auth/google/disconnect', google_auth_disconnect, name='google-auth-disconnect'),
]

urlpatterns += static('/img/', document_root=settings.BASE_DIR / 'img')
