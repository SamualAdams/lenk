# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'cognitions', views.CognitionViewSet)
router.register(r'nodes', views.NodeViewSet)
router.register(r'syntheses', views.SynthesisViewSet)
router.register(r'preset-responses', views.PresetResponseViewSet)
router.register(r'arcs', views.ArcViewSet)

urlpatterns = [
    path('hello/', views.hello_world, name='hello_world'),
    path('', include(router.urls)),
]