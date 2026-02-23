/* ==========================================================================
   Backend para Ciencias para vivir mejor - Asistente Kyrbi
   Servidor Express con integración de IA real
   ========================================================================== */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { syncDatabase } from './models/index.js';

// Cargar variables de entorno
dotenv.config();

// Sincronizar BD y esperar antes de procesar solicitudes
const dbReadyPromise = syncDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize());

app.use(async (req, res, next) => {
  try {
    await dbReadyPromise;
    next();
  } catch {
    res.status(500).json({ error: 'Base de datos no disponible' });
  }
});

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const helmetCsp = {
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https:"],
    fontSrc: ["'self'", "data:", "https:"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: []
  }
};
app.use(helmet({
  contentSecurityPolicy: helmetCsp,
  hsts: { maxAge: 15552000 },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use((req, res, next) => {
  const force = String(process.env.FORCE_HTTPS || 'false') === 'true';
  const xf = req.headers['x-forwarded-proto'];
  if (force && xf === 'http') {
    const host = req.headers.host;
    return res.redirect(`https://${host}${req.originalUrl}`);
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.'
});
app.use(limiter);

// Headers de seguridad adicionales (personalizados si es necesario)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
  next();
});

app.use((req, res, next) => {
  const stringify = (o) => {
    try { return JSON.stringify(o); } catch { return ''; }
  };
  const s = [
    req.url || '',
    stringify(req.query),
    stringify(req.body)
  ].join(' ').toLowerCase();
  const patterns = [
    'union select',
    ' or 1=1',
    'drop table',
    '../',
    '<script',
    '%3cscript',
    '--',
    ';--',
    '/*',
    '*/',
    'xp_cmdshell',
    'sleep('
  ];
  for (const p of patterns) {
    if (s.includes(p)) {
      return res.status(400).json({ error: 'blocked' });
    }
  }
  next();
});
// CSRF protección (double-submit cookie) opcional
const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  const pairs = header.split(';').map((p) => p.trim()).filter(Boolean);
  const out = {};
  for (const p of pairs) {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  }
  return out;
};
app.use((req, res, next) => {
  const enabled = String(process.env.CSRF_ENABLED || 'false') === 'true';
  if (!enabled) return next();
  if (req.method !== 'POST') return next();
  const needs = req.path.startsWith('/api/auth/');
  if (!needs) return next();
  const cookies = parseCookies(req);
  const headerToken = req.headers['x-csrf-token'];
  if (!cookies.csrf_token || !headerToken || cookies.csrf_token !== headerToken) {
    return res.status(403).json({ error: 'CSRF token inválido' });
  }
  next();
});

// Rate limiting simple en memoria por IP
const rateMap = new Map();
app.use((req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 15 * 1000;
  const limit = 60;
  const entry = rateMap.get(key) || { count: 0, ts: now };
  if (now - entry.ts > windowMs) {
    entry.count = 0;
    entry.ts = now;
  }
  entry.count++;
  rateMap.set(key, entry);
  if (entry.count > limit) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
  }
  next();
});

// Rutas
app.use('/api/auth', authRouter);
app.use('/api', chatRouter);
app.use('/api/admin', adminRouter);

// Servir archivos estáticos del frontend
const frontendPath = join(__dirname, '../kyrbi-frontend');
app.use(express.static(frontendPath));
console.log(`📂 Sirviendo frontend desde: ${frontendPath}`);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor Kyrbi funcionando' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor solo si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Kyrbi iniciado en http://localhost:${PORT}`);
    console.log(`📡 Endpoint de chat: http://localhost:${PORT}/api/chat`);
    console.log(`💚 Modo: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

export default app;
