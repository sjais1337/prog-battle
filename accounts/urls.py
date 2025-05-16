# accounts/urls.py
from django.urls import path
from .views import RegisterView, UserDetailView # Add UserDetailView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('me/', UserDetailView.as_view(), name='user_detail'),
]