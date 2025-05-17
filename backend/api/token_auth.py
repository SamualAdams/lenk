

from datetime import datetime, timedelta
from django.conf import settings
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.authtoken.models import Token

class ExpiringTokenAuthentication(TokenAuthentication):
    """Custom token authentication with expiration"""
    
    def authenticate_credentials(self, key):
        try:
            token = Token.objects.get(key=key)
        except Token.DoesNotExist:
            raise AuthenticationFailed('Invalid token')
        
        # Check if token has expired
        token_age = datetime.now() - token.created.replace(tzinfo=None)
        token_expiry = getattr(settings, 'TOKEN_EXPIRY_TIME', 7)  # Default 7 days
        
        if token_age > timedelta(days=token_expiry):
            token.delete()
            raise AuthenticationFailed('Token has expired')
        
        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted')
            
        return (token.user, token)