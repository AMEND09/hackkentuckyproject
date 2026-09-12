from .base import *  # noqa: F401,F403

DEBUG = False


def _host_list() -> list[str]:
    hosts = [h.strip() for h in env("ALLOWED_HOSTS", default="").split(",") if h.strip()]  # noqa: F405
    for key in ("RAILWAY_PUBLIC_DOMAIN", "RAILWAY_PRIVATE_DOMAIN"):
        value = env(key, default="")  # noqa: F405
        if value:
            hosts.append(value.split(":")[0])
    hosts.extend([".up.railway.app", ".railway.app", "healthcheck.railway.app", "localhost", "127.0.0.1"])
    seen: set[str] = set()
    unique: list[str] = []
    for host in hosts:
        if host not in seen:
            seen.add(host)
            unique.append(host)
    return unique


ALLOWED_HOSTS = _host_list()
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Set SESSION_COOKIE_SECURE=false / CSRF_COOKIE_SECURE=false only for plain-HTTP
# local/network deploys. Anything behind TLS should leave the secure defaults on.
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=True)  # noqa: F405
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=True)  # noqa: F405

_csrf = [o.strip() for o in env("CSRF_TRUSTED_ORIGINS", default="").split(",") if o.strip()]  # noqa: F405
_csrf.extend(["https://*.up.railway.app", "https://*.railway.app"])
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_csrf))

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://[a-z0-9-]+\.up\.railway\.app$",
    r"^https://[a-z0-9-]+\.railway\.app$",
]
