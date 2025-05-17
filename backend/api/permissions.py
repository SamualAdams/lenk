from rest_framework import permissions

class AllowAnyPermission(permissions.BasePermission):
    """
    Allow any access.
    This permission is primarily for development and testing.
    """
    def has_permission(self, request, view):
        return True

class IsOwnerOrReadOnlyIfPublic(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Others can view only if it's public.
    """
    def has_object_permission(self, request, view, obj):
        # Always allow GET, HEAD or OPTIONS requests to public items
        if request.method in permissions.SAFE_METHODS and getattr(obj, "is_public", False):
            return True
        # Allow access if the user owns the cognition
        return getattr(obj, "user", None) == request.user