from rest_framework import permissions

class AllowAnyPermission(permissions.BasePermission):
    """
    Allow any access.
    This permission is primarily for development and testing.
    """
    def has_permission(self, request, view):
        return True