from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = env("ALLOWED_HOSTS", default="").split(",")  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
