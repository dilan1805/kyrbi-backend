/* ==========================================================================
   Ruta de chat para el asistente Kyrbi (Con Persistencia y Auth)
   Endpoint: POST /api/chat
   ========================================================================== */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import axios from 'axios';
import authMiddleware from '../middleware/auth.js';
import { Conversation, Message, User } from '../models/index.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mapeo de modos a archivos de prompt
const MODE_PROMPTS = {
  guia: 'guia.txt',
  chef: 'chef.txt',
  coach: 'coach.txt',
  descanso: 'descanso.txt',
};

/**
 * Carga un prompt desde archivo
 */
function loadPrompt(filename) {
  try {
    const promptPath = join(__dirname, '..', 'prompts', filename);
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    console.error(`Error cargando prompt ${filename}:`, error);
    return '';
  }
}

/**
 * Construye el prompt completo para la IA
 */
function buildPrompt(mode, dbHistory, memorySummary) {
  const basePrompt = loadPrompt('base.txt');
  const modeFile = MODE_PROMPTS[mode] || MODE_PROMPTS.guia;
  const modePrompt = loadPrompt(modeFile);

  const baseWithMode = basePrompt.replace('{{MODO}}', modePrompt);

  let historyText = '';
  if (dbHistory?.length) {
    historyText = '\n\nCONTEXTO DE LA CONVERSACIÓN:\n';
    dbHistory.forEach(msg => {
      historyText += `${msg.role === 'user' ? 'Usuario' : 'Kyrbi'}: ${msg.content}\n`;
    });
  }

  let memoryText = '';
  if (memorySummary && memorySummary.trim().length) {
    memoryText = '\n\nMEMORIA PERSISTENTE (hechos clave y preferencias):\n' + memorySummary.trim() + '\n';
  }

  return baseWithMode + memoryText + historyText;
}

function simpleReply(message, mode) {
  const m = (message || '').toLowerCase();
  const suggestions = {
    guia: [
      'Entiendo. ¿Puedes contarme un poco tu rutina diaria?',
      '¿Qué objetivo te gustaría alcanzar esta semana?',
      'Te haré preguntas cortas para entender mejor tu situación.'
    ],
    chef: [
      'Vamos a planear comidas simples y saludables.',
      '¿Qué sueles desayunar?',
      '¿Tienes alguna restricción alimentaria?'
    ],
    coach: [
      'Me enfocaré en hábitos y energía.',
      '¿Cómo te sientes durante las clases?',
      '¿Qué actividad física realizas?'
    ],
    descanso: [
      'Dormir bien mejora la concentración.',
      '¿A qué hora te duermes normalmente?',
      '¿Usas pantallas antes de dormir?'
    ]
  };
  if (m.includes('plan')) return 'Podemos crear un plan semanal básico: define 1 objetivo y 3 acciones pequeñas. ¿Qué objetivo te gustaría?';
  if (m.includes('energ')) return 'Para mejorar la energía, prueba 1) hidratación, 2) snack con proteína y fruta, 3) pausas activas breves.';
  const bank = suggestions[mode] || suggestions.guia;
  return bank[Math.floor(Math.random() * bank.length)];
}

/**
 * GET /api/chat/history
 * Obtiene todas las conversaciones del usuario
 */
router.get('/chat/history', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']],
      include: [{
        model: Message,
        limit: 1,
        order: [['createdAt', 'DESC']]
      }]
    });
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

/**
 * GET /api/chat/history/:id
 * Obtiene los mensajes de una conversación específica
 */
router.get('/chat/history/:id', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      },
      include: [{
        model: Message,
        order: [['createdAt', 'ASC']]
      }]
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Error obteniendo conversación' });
  }
});

/**
 * POST /api/chat
 * Envía un mensaje y obtiene respuesta de la IA
 */
router.post('/chat', authMiddleware, async (req, res) => {
  const { message, mode = 'guia', conversationId } = req.body;

  // Validaciones
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Mensaje no válido.' });
  }

  try {
    let conversation;

    // Buscar o crear conversación
    if (conversationId) {
      conversation = await Conversation.findOne({
        where: { id: conversationId, userId: req.user.id }
      });
      if (!conversation) {
        // Si no existe o no es del usuario, creamos una nueva
        conversation = await Conversation.create({
          userId: req.user.id,
          mode,
          title: message.substring(0, 30) + '...'
        });
      }
    } else {
      conversation = await Conversation.create({
        userId: req.user.id,
        mode,
        title: message.substring(0, 30) + '...'
      });
    }

    // Guardar mensaje del usuario
    await Message.create({
      conversationId: conversation.id,
      role: 'user',
      content: message.trim()
    });

    // Obtener historial reciente para contexto (últimos 10 mensajes)
    const recentMessages = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [['createdAt', 'ASC']], // Orden cronológico
      limit: 10, // Limitamos contexto para no exceder tokens
      offset: Math.max(0, (await Message.count({ where: { conversationId: conversation.id } })) - 10)
    });

    // Construir prompt
    const selectedMode = MODE_PROMPTS[mode] ? mode : 'guia';
    const systemPrompt = buildPrompt(selectedMode, recentMessages, conversation.summary);

    // Preparar mensajes para Groq
    const groqMessages = [{ role: 'system', content: systemPrompt }];
    
    // Añadir historial al formato de Groq
    recentMessages.forEach(msg => {
        // Mapear 'assistant' (nuestro DB) a 'assistant' (Groq)
        // Mapear 'user' a 'user'
        // Filtrar 'system' si hubiese
        if (msg.role !== 'system') {
             groqMessages.push({
                role: msg.role,
                content: msg.content
            });
        }
    });

    let botReply = '';
    if (process.env.GROQ_API_KEY) {
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      botReply = groqRes.data.choices[0]?.message?.content || 'Lo siento, hubo un error al procesar tu respuesta.';
    } else {
      botReply = simpleReply(message, selectedMode);
    }

    // Guardar respuesta del asistente
    await Message.create({
      conversationId: conversation.id,
      role: 'assistant',
      content: botReply
    });

    // Actualizar timestamp de conversación
    await conversation.changed('updatedAt', true);
    await conversation.save();

    // Actualizar memoria persistente (resumen) cuando la conversación crece
    try {
      const totalCount = await Message.count({ where: { conversationId: conversation.id } });
      const shouldSummarize = totalCount % 8 === 0 && process.env.NODE_ENV !== 'test'; // cada 8 mensajes, evitar en tests
      if (shouldSummarize) {
        const summarizeInput = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        const memoryPrompt = `Resume en 5-8 viñetas los datos persistentes del usuario (preferencias, objetivos, restricciones, hábitos) y hechos clave para continuidad. Tono neutro. No repitas el chat, solo hechos duraderos.\n\n${summarizeInput}`;
        const memRes = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: 'Eres un asistente que genera memoria persistente breve y útil.' }, { role: 'user', content: memoryPrompt }],
            temperature: 0.2,
            max_tokens: 400
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const summary = memRes.data.choices[0]?.message?.content?.trim();
        if (summary) {
          conversation.summary = summary.slice(0, 2000);
          await conversation.save();
        }
      }
    } catch (e) {
      console.warn('No se pudo actualizar memoria persistente:', e.message);
    }

    res.json({
      text: botReply, // Mantener compatibilidad con frontend actual
      content: botReply,
      mode: selectedMode,
      conversationId: conversation.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/chat:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje.' });
  }
});

/**
 * GET /api/chat/memory/:id
 * Obtiene la memoria (resumen persistente) de una conversación
 */
router.get('/chat/memory/:id', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    res.json({ conversationId: conversation.id, summary: conversation.summary || '' });
  } catch (error) {
    console.error('Error obteniendo memoria:', error);
    res.status(500).json({ error: 'Error obteniendo memoria' });
  }
});

router.get('/chat/public/history', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
    const conversations = await Conversation.findAll({
      where: { sessionId },
      order: [['updatedAt', 'DESC']],
      include: [{ model: Message, limit: 1, order: [['createdAt', 'DESC']] }]
    });
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching public history:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

router.get('/chat/public/history/:id', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, sessionId },
      include: [{ model: Message, order: [['createdAt', 'ASC']] }]
    });
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada' });
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching public conversation:', error);
    res.status(500).json({ error: 'Error obteniendo conversación' });
  }
});

router.post('/chat/public', async (req, res) => {
  const { message, mode = 'guia', conversationId, sessionId } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Mensaje no válido.' });
  }
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId requerido.' });
  }
  try {
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ where: { id: conversationId, sessionId } });
      if (!conversation) {
        conversation = await Conversation.create({ sessionId, mode, title: message.substring(0, 30) + '...' });
      }
    } else {
      conversation = await Conversation.create({ sessionId, mode, title: message.substring(0, 30) + '...' });
    }
    await Message.create({ conversationId: conversation.id, role: 'user', content: message.trim() });
    const recentMessages = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [['createdAt', 'ASC']],
      limit: 10,
      offset: Math.max(0, (await Message.count({ where: { conversationId: conversation.id } })) - 10)
    });
    const selectedMode = MODE_PROMPTS[mode] ? mode : 'guia';
    const systemPrompt = buildPrompt(selectedMode, recentMessages, conversation.summary);
    const groqMessages = [{ role: 'system', content: systemPrompt }];
    recentMessages.forEach(msg => {
      if (msg.role !== 'system') {
        groqMessages.push({ role: msg.role, content: msg.content });
      }
    });
    let botReply = '';
    if (process.env.GROQ_API_KEY) {
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      botReply = groqRes.data.choices[0]?.message?.content || 'Lo siento, hubo un error al procesar tu respuesta.';
    } else {
      botReply = simpleReply(message, selectedMode);
    }
    await Message.create({ conversationId: conversation.id, role: 'assistant', content: botReply });
    await conversation.changed('updatedAt', true);
    await conversation.save();
    res.json({ text: botReply, content: botReply, mode: selectedMode, conversationId: conversation.id, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error en /api/chat/public:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje.' });
  }
});

export default router;
