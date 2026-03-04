# API Docs · Kyrbi Backend

Base URL local: `http://localhost:3000`  
Base path API: `/api`

## Resumen
Kyrbi expone autenticación, chat con persistencia, configuración de usuario y métricas públicas.

## Autenticación

### POST `/api/auth/register`
Registra usuario con correo y contraseña.

Body:
```json
{
  "username": "usuario_demo",
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

Response:
```json
{
  "message": "Usuario registrado exitosamente. Verifica tu correo.",
  "user": {
    "id": "uuid",
    "username": "usuario_demo",
    "email": "usuario@ejemplo.com"
  },
  "token": "jwt"
}
```

### POST `/api/auth/login`
Inicia sesión con correo y contraseña.

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
Envía mensaje al asistente (requiere JWT).

Body:
```json
{
  "message": "Quiero mejorar mi energía en clases",
  "mode": "guia",
  "conversationId": "uuid-opcional"
}
```

### GET `/api/chat/history`
Lista conversaciones del usuario autenticado.

### GET `/api/chat/history/:id`
Obtiene detalle y mensajes de una conversación.

### PATCH `/api/chat/history/:id`
Renombra una conversación.

Body:
```json
{
  "title": "Plan de hábitos semanales"
}
```

### DELETE `/api/chat/history/:id`
Elimina una conversación y sus mensajes.

### GET `/api/chat/memory/:id`
Obtiene resumen de memoria persistente de una conversación.

## Chat público (controlado por variable de entorno)

Los endpoints públicos están deshabilitados por defecto.

- `GET /api/chat/public/history`
- `GET /api/chat/public/history/:id`
- `POST /api/chat/public`

Para habilitar:
```env
ALLOW_PUBLIC_CHAT=true
```

## Métricas y salud

### GET `/health`
Estado básico del backend.

### GET `/api/meta`
Métricas públicas de plataforma.

Ejemplo:
```json
{
  "product": {
    "name": "Kyrbi",
    "tier": "Business",
    "environment": "production"
  },
  "metrics": {
    "registeredUsers": 120,
    "totalConversations": 985,
    "uptime": "5d 8h",
    "sla": "99.5%"
  },
  "release": {
    "version": "1.0.0",
    "date": "2026-03-03"
  }
}
```

## Variables de entorno relevantes

```env
ALLOW_PUBLIC_CHAT=false
MAX_MESSAGE_LENGTH=1200
APP_VERSION=1.0.0
RELEASE_DATE=2026-03-03
```

## Pruebas

```bash
npm test
```
