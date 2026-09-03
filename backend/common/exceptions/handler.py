from rest_framework.views import exception_handler as drf_exception_handler

from common.exceptions.errors import RouteWiseError


def api_exception_handler(exc, context):
    if isinstance(exc, RouteWiseError):
        return _envelope(
            code=exc.default_code,
            message=str(exc.detail),
            details=getattr(exc, "details", {}) or {},
            status=exc.status_code,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    code = getattr(exc, "default_code", None) or response.status_code
    if hasattr(code, "upper"):
        code = str(code).upper()
    else:
        code = f"HTTP_{code}"

    details = {}
    data = response.data
    if isinstance(data, dict):
        message = data.get("detail") or data.get("message") or "Request failed."
        if "detail" not in data:
            details = data
    elif isinstance(data, list):
        message = str(data[0]) if data else "Request failed."
        details = {"errors": data}
    else:
        message = str(data)

    return _envelope(str(code), str(message), details, response.status_code, response)


def _envelope(code, message, details, status, response=None):
    from rest_framework.response import Response

    payload = {"error": {"code": code, "message": message, "details": details or {}}}
    if response is None:
        return Response(payload, status=status)
    response.data = payload
    response.status_code = status
    return response
