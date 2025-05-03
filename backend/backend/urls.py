from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # Include the API app URLs
    path('', RedirectView.as_view(url='api/hello/', permanent=False)),  # Add a redirect for the root URL
]