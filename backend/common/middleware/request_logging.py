import logging
import re

logger = logging.getLogger("routewise.http")

SENSITIVE = re.compile(r"(password|token|authorization|secret|refresh)", re.I)
ADDRESS = re.compile(r"(address|home_address|lat|lng|latitude|longitude)", re.I)


class SafeRequestLoggingMiddleware:
    """Logs method/path/status without tokens or student addresses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path
        if not path.startswith("/api/"):
            return response
        user = getattr(request, "user", None)
        uid = getattr(user, "id", None) if user is not None and getattr(user, "is_authenticated", False) else "anon"
        logger.info("%s %s -> %s user=%s", request.method, path, response.status_code, uid)
        return response
