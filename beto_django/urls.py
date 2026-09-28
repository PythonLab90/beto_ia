from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from .views import chat, confirm_email_reminders, embed, pagina, register_email_reminders, transcribe_video, transcribe_video_url

urlpatterns = [
    path('', pagina, name='pagina'),
    path('beto-embed.js', embed, name='embed'),
    path('api/chat', chat, name='chat'),
    path('api/email-reminders/register', register_email_reminders, name='register-email-reminders'),
    path('api/email-reminders/confirm', confirm_email_reminders, name='confirm-email-reminders'),
    path('api/transcribe-video', transcribe_video, name='transcribe-video'),
    path('api/transcribe-video-url', transcribe_video_url, name='transcribe-video-url'),
]

urlpatterns += static('/img/', document_root=settings.BASE_DIR / 'img')
