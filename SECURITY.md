# Seguridad y Hardening

## Objetivos
- HTTPS obligatorio en producción.
- Headers de seguridad (CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options).
- Protección contra XSS, SQLi y CSRF.
- Rate limiting y WAF básico.
- 2FA obligatorio para acceso administrativo.

## Configuración
- Establecer `FORCE_HTTPS=true` y `CORS_ORIGIN=<frontend_origin>` en producción.
- Activar CSRF: `CSRF_ENABLED=true`.
- Crear usuarios admin y habilitar 2FA desde `/api/auth/2fa/setup`.

## Auditoría
- El pipeline ejecuta `npm audit` y debe pasar sin vulnerabilidades críticas.

## WAF
- Middleware bloquea patrones comunes de inyección y traversal.

## 2FA Admin
- Endpoint `/api/admin/secure-health` requiere JWT y header `x-2fa-code` válido.
