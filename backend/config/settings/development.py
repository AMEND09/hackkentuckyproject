from .base import *  # noqa: F401,F403
import socket

DEBUG = True

# Dev only: allow access from LAN (physical phones / simulators hitting the
# machine's LAN IP) without pinning a specific address that changes per network.
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True


def _tcp_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


if not _tcp_open(5432):
    DATABASES = {  # noqa: F405
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev.sqlite3",  # noqa: F405
        }
    }

if not _tcp_open(6379):
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
