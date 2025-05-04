from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

# Replace this line:
# from . import views  # This is causing the error - there's no views.py in this directory

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # Include the API app URLs
    path('', RedirectView.as_view(url='api/hello/', permanent=False)),  # Add a redirect for the root URL
]