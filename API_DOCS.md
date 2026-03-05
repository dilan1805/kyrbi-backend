# API Docs - Kyrbi Backend

Base URL local: `http://localhost:3000`  
Base path API: `/api`

## Resumen
Kyrbi expone autenticacion, chat con persistencia, configuracion de usuario y metricas publicas.

## Autenticacion

### POST `/api/auth/register`
Registra usuario con correo y contrasena.
Se aceptan correos institucionales internos y con dominio completo (ejemplos: `user@irk`, `user@irk.mx`).
Si `REQUIRE_EMAIL_VERIFICATION=true` y SMTP esta configurado, la respuesta no entrega `token` hasta verificar correo.

Body:
```json
{
  "username": "usuario_demo",
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

### POST `/api/auth/login`
Inicia sesion con correo y contrasena.
El login usa el mismo validador de correo que registro para evitar inconsistencias.
Si el correo no esta verificado y la verificacion esta obligatoria, responde `403` con `code: "email_not_verified"`.

Body:
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

### GET `/api/auth/me`
Obtiene perfil del usuario autenticado.  
Header: `Authorization: Bearer <token>`

### PUT `/api/auth/preferences`
Actualiza preferencias del usuario autenticado.  
Header: `Authorization: Bearer <token>`

Body:
```json
{
  "preferences": {
    "chatSettings": {
      "autoSave": true,
      "defaultMode": "general",
      "theme": "system"
    }
  }
}
```

### OAuth social
- `GET /api/auth/google`
- `GET /api/auth/facebook`
- `GET /api/auth/github`
- `GET /api/auth/microsoft`
- `GET /api/auth/providers` (estado de proveedores habilitados)

## Chat autenticado

### POST `/api/chat`
Envia mensaje al asistente (requiere JWT).

Body:
```json
{
  "message": "Quiero mejorar mi energia en clases",
  "mode": "guia",
  "conversationId": "uuid-opcional"
}
```

### GET `/api/chat/history`
Lista conversaciones del usuario autenticado.

### GET `/api/chat/history/:id`
Obtiene detalle y mensajes de una conversacion.

### PATCH `/api/chat/history/:id`
Renombra una conversacion.

Body:
```json
{
  "title": "Plan de habitos semanales"
}
```

### DELETE `/api/chat/history/:id`
Elimina una conversacion y sus mensajes.

### GET `/api/chat/memory/:id`
Obtiene resumen de memoria persistente de una conversacion.

## Chat publico (controlado por variable de entorno)

Los endpoints publicos estan deshabilitados por defecto.

- `GET /api/chat/public/history`
- `GET /api/chat/public/history/:id`
- `POST /api/chat/public`

Para habilitar:
```env
ALLOW_PUBLIC_CHAT=true
```

## Metricas y salud

### GET `/health`
Estado basico del backend.

### GET `/api/meta`
Metricas publicas de plataforma.

## Variables de entorno relevantes

```env
ALLOW_PUBLIC_CHAT=false
MAX_MESSAGE_LENGTH=1200
APP_VERSION=1.0.0
RELEASE_DATE=2026-03-03
SQLITE_STORAGE=./database/kyrbi.sqlite
REQUIRE_EMAIL_VERIFICATION=true
# Alternativa:
# DATABASE_URL=sqlite:./database/kyrbi.sqlite
```

## Pruebas

```bash
npm test
```
