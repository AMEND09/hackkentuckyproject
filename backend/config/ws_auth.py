"""JWT auth for Channels websockets.

The SPA/mobile clients authenticate with SimpleJWT Bearer tokens, but websockets
can't send Authorization headers from the browser. We pass the access token as a
``?token=`` query-string param and resolve the user here. Sits *inside*
``AuthMiddlewareStack`` so it overrides the (anonymous) session user when a valid
token is present, while still allowing session-cookie auth as a fallback.
"""

from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _resolve_user(token: str):
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

    auth = JWTAuthentication()
    try:
        validated = auth.get_validated_token(token)
        return auth.get_user(validated)
    except (InvalidToken, TokenError, Exception):
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs((scope.get("query_string") or b"").decode())
        token = (query.get("token") or [None])[0]
        if token:
            user = await _resolve_user(token)
            if getattr(user, "is_authenticated", False):
                scope["user"] = user
        return await self.inner(scope, receive, send)
