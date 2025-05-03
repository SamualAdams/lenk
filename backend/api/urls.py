from django.urls import path
from . import views

urlpatterns = [
    # Add a basic API endpoint for testing
    path('hello/', views.hello_world, name='hello_world'),
]