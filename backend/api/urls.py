# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create specific URL patterns first, before the router
urlpatterns = [
    path('hello/', views.hello_world, name='hello_world'),
    path('cognitions/create/', views.create_cognition, name='create_cognition'),
    path('nodes/add_or_update/', views.add_or_update_node, name='add_or_update_node'),
]

# Then add router URLs
router = DefaultRouter()
router.register(r'cognitions', views.CognitionViewSet)
router.register(r'nodes', views.NodeViewSet)
router.register(r'syntheses', views.SynthesisViewSet)
router.register(r'preset-responses', views.PresetResponseViewSet)
router.register(r'arcs', views.ArcViewSet)

# Append router URLs to the urlpatterns
urlpatterns += router.urls