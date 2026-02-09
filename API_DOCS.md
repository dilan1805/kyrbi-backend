# Documentación de la API de Kyrbi

Esta API proporciona servicios de autenticación, gestión de usuarios y funcionalidades de la aplicación Kyrbi.

## Base URL
`/api`

## Autenticación

### Registro
Crea un nuevo usuario.

- **URL:** `/auth/register`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "password": "Password123!"
  }
  ```
- **Respuesta Exitosa (201):**
  ```json
  {
    "message": "Usuario registrado exitosamente. Por favor verifica tu correo electrónico."
  }
  ```

### Login
Inicia sesión con credenciales.

- **URL:** `/auth/login`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "Password123!"
  }
  ```
- **Respuesta Exitosa (200) - Sin 2FA:**
  ```json
  {
    "message": "Login exitoso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": {
      "id": 1,
      "username": "usuario123",
      "email": "usuario@ejemplo.com",
      "twoFactorEnabled": false
    }
  }
  ```
- **Respuesta Exitosa (200) - Con 2FA Activo:**
  ```json
  {
    "message": "2FA requerido",
    "require2FA": true,
    "email": "usuario@ejemplo.com"
  }
  ```

### Verificar 2FA (Login)
Completa el login cuando 2FA está activo.

- **URL:** `/auth/login/verify-2fa`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "token": "123456"
  }
  ```
- **Respuesta Exitosa (200):** Devuelve token JWT igual que Login normal.

### Perfil de Usuario
Obtiene información del usuario autenticado.

- **URL:** `/auth/me`
- **Método:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200):**
  ```json
  {
    "id": 1,
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "twoFactorEnabled": true,
    "emailVerified": true,
    "preferences": {}
  }
  ```

## Gestión de 2FA

Requiere Header `Authorization: Bearer <token>`.

### Iniciar Configuración 2FA
Genera un secreto y código QR para configurar TOTP.

- **URL:** `/auth/2fa/setup`
- **Método:** `POST`
- **Respuesta Exitosa (200):**
  ```json
  {
    "secret": "JBSWY3DPEHPK3PXP...",
    "qrCode": "data:image/png;base64,..."
  }
  ```

### Verificar Configuración 2FA
Confirma el código TOTP y activa 2FA para el usuario.

- **URL:** `/auth/2fa/verify-setup`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "token": "123456"
  }
  ```

### Desactivar 2FA
Desactiva la autenticación de dos factores.

- **URL:** `/auth/2fa/disable`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "token": "123456" // Código actual para confirmar (seguridad)
  }
  ```

## Recuperación de Contraseña

### Solicitar Reset
Envía un correo con el link de recuperación.

- **URL:** `/auth/password/reset/request`
- **Método:** `POST`
- **Body:** `{ "email": "usuario@ejemplo.com" }`

### Confirmar Reset
Establece la nueva contraseña usando el token recibido.

- **URL:** `/auth/password/reset/confirm`
- **Método:** `POST`
- **Body:**
  ```json
  {
    "token": "token_recibido_por_email",
    "password": "NuevaPassword123!"
  }
  ```

## Login Social

- **Google:** `/api/auth/google`
- **GitHub:** `/api/auth/github`
- **Microsoft:** `/api/auth/microsoft`

Los callbacks redirigen al frontend con el token en la URL (ej: `/login.html?token=...`).

## Notas de Desarrollo
- **Tests:** Ejecutar `npm test` para correr la suite de pruebas (Jest + Supertest).
- **Base de Datos:** SQLite (archivo `kyrbi.sqlite` en dev/prod, `:memory:` en tests).
