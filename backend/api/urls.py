# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import auth_views

# Create specific URL patterns first, before the router
urlpatterns = [
    path('hello/', views.hello_world, name='hello_world'),
    path('cognitions/create/', views.create_cognition, name='create_cognition'),
    path('nodes/add_or_update/', views.add_or_update_node, name='add_or_update_node'),
    path('auth/register/', auth_views.register_user, name='register'),
    path('auth/login/', auth_views.login_user, name='login'),
    path('auth/logout/', auth_views.logout_user, name='logout'),
    path('auth/user/', auth_views.get_user_info, name='user_info'),
    path('auth/refresh-token/', auth_views.refresh_token, name='refresh_token'),
    path('text/convert_to_markdown/', views.convert_text_to_markdown, name='convert_text_to_markdown'),
]

# Then add router URLs
router = DefaultRouter()
router.register(r'cognitions', views.CognitionViewSet, basename='cognition')
router.register(r'nodes', views.NodeViewSet, basename='node')
# router.register(r'syntheses', views.SynthesisViewSet, basename='synthesis')  # Removed - consolidated into widgets
router.register(r'preset-responses', views.PresetResponseViewSet, basename='presetresponse')
router.register(r'arcs', views.ArcViewSet, basename='arc')
router.register(r'profiles', views.UserProfileViewSet, basename='profile')
router.register(r'widgets', views.WidgetViewSet, basename='widget')
router.register(r'groups', views.GroupViewSet, basename='group')
router.register(r'invitations', views.GroupInvitationViewSet, basename='invitation')

# Append router URLs to the urlpatterns
urlpatterns += router.urls
