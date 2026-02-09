# Backend - Ciencias para vivir mejor

Servidor backend para el asistente Kyrbi con integración de IA real.

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Configura las variables de entorno:

**En PowerShell:**
```powershell
copy env.example .env
```

**En Linux/Mac:**
```bash
cp env.example .env
```

**O crea el archivo manualmente** con este contenido:

3. Edita `.env` y agrega tu API Key de OpenAI:
```
OPENAI_API_KEY=sk-tu-api-key-aqui
```

## Obtener API Key de OpenAI

1. Ve a https://platform.openai.com/api-keys
2. Inicia sesión o crea una cuenta
3. Crea una nueva API key
4. Copia la clave y pégala en el archivo `.env`

**Nota:** OpenAI ofrece créditos gratuitos para nuevos usuarios. El modelo `gpt-3.5-turbo` es económico y suficiente para este proyecto.

## Ejecutar el servidor

### Desarrollo:
```bash
npm run dev
```

### Producción:
```bash
npm start
```

El servidor se iniciará en `http://localhost:3000`

## Endpoints

### POST /api/chat
Envía un mensaje al asistente Kyrbi.

**Request:**
```json
{
  "message": "Hola, quiero mejorar mi alimentación",
  "mode": "chef",
  "history": [
    { "role": "user", "text": "Hola" },
    { "role": "assistant", "text": "Hola, soy Kyrbi..." }
  ]
}
```

**Response:**
```json
{
  "text": "Hola, soy Kyrbi. Me alegra que quieras mejorar tu alimentación...",
  "mode": "chef",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /health
Verifica el estado del servidor.

## Estructura

```
server/
├── index.js          # Servidor principal
├── routes/
│   └── chat.js      # Ruta del chat
├── prompts/
│   ├── base.txt     # Prompt base de Kyrbi
│   ├── guia.txt     # Modo Guía general
│   ├── chef.txt     # Modo Chef
│   ├── coach.txt    # Modo Coach
│   └── descanso.txt # Modo Descanso
├── .env             # Variables de entorno (no commitear)
└── package.json     # Dependencias
```

## Seguridad

- Las API keys nunca se exponen al frontend
- No se guardan conversaciones en base de datos
- Validación de entrada en todos los endpoints
- Manejo de errores seguro
