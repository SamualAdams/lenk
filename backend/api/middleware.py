class CustomCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Add CORS headers for preflight requests
        if request.method == 'OPTIONS':
            response = self.get_response(request)
            response["Access-Control-Allow-Origin"] = "http://localhost:3000"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            response["Access-Control-Allow-Credentials"] = "true"
            return response
        
        # Process the request normally
        response = self.get_response(request)
        
        # Add CORS headers to all responses
        response["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response["Access-Control-Allow-Credentials"] = "true"
        
        # Add security headers
        response["X-Content-Type-Options"] = "nosniff"
        response["X-XSS-Protection"] = "1; mode=block"
        response["X-Frame-Options"] = "DENY"
        
        return response