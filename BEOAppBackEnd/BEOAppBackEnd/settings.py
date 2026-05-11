"""
Django settings for BEOAppBackEnd project.

Twelve-factor: every secret / environment-sensitive value is read from os.environ.
Defaults are dev-safe; production must set DJANGO_SECRET_KEY, DJANGO_DEBUG=0,
DJANGO_ALLOWED_HOSTS, and DJANGO_CORS_ALLOWED_ORIGINS.
"""

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


# --- Helpers ----------------------------------------------------------------

def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == '':
        return list(default)
    return [item.strip() for item in raw.split(',') if item.strip()]


# Load a sibling .env file if python-dotenv is available (optional, dev only)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass


# --- Core -------------------------------------------------------------------

# In dev we auto-generate an ephemeral secret if none is provided so the server
# can boot, but we warn loudly. In production DJANGO_SECRET_KEY *must* be set.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or f'dev-{secrets.token_urlsafe(32)}'

DEBUG = _env_bool('DJANGO_DEBUG', default=True)

# Default to permissive in dev, locked-down everywhere else.
ALLOWED_HOSTS = _env_list(
    'DJANGO_ALLOWED_HOSTS',
    default=['*'] if DEBUG else [],
)


# --- Apps / Middleware ------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'BEOAppBackEnd.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'BEOAppBackEnd.wsgi.application'


# --- Database ---------------------------------------------------------------

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('DJANGO_DB_PATH', BASE_DIR / 'db.sqlite3'),
    }
}


# --- Auth password validation ----------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- I18n / static ----------------------------------------------------------

LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'UTC'
USE_I18N      = True
USE_TZ        = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- CORS -------------------------------------------------------------------
# In dev: allow-all by default. In prod: require explicit origin list.

CORS_ALLOW_ALL_ORIGINS = _env_bool('DJANGO_CORS_ALLOW_ALL', default=DEBUG)
CORS_ALLOWED_ORIGINS   = _env_list('DJANGO_CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_METHODS     = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]


# --- App-specific config ----------------------------------------------------

# How long an AuthToken stays valid. 30 days default.
AUTH_TOKEN_TTL_DAYS = int(os.environ.get('DJANGO_AUTH_TOKEN_TTL_DAYS', '30'))

# Max upload size for BEO PDFs, in MB.
MAX_UPLOAD_MB = int(os.environ.get('DJANGO_MAX_UPLOAD_MB', '25'))

# OAuth provider configuration — populate when ready to enable social login.
OAUTH_PROVIDERS: dict = {}


# --- Production hardening (only takes effect when DEBUG=False) -------------

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE   = True
    CSRF_COOKIE_SECURE      = True
    SECURE_HSTS_SECONDS     = 60 * 60 * 24 * 30  # 30 days, ramp up after verifying
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD     = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY  = 'strict-origin-when-cross-origin'

    # Fail loudly if someone forgot to set the secret key in prod.
    if SECRET_KEY.startswith('dev-'):
        raise RuntimeError(
            'DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0. '
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if not ALLOWED_HOSTS:
        raise RuntimeError(
            'DJANGO_ALLOWED_HOSTS must be set when DJANGO_DEBUG=0 '
            '(comma-separated list of hostnames).'
        )
