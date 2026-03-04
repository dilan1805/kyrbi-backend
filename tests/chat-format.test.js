import request from 'supertest';
import app from '../index.js';
import { sequelize } from '../models/index.js';
import { normalizeAssistantReply } from '../routes/chat.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Chat response formatting', () => {
  it('normalizes plain text into structured markdown', () => {
    const raw = 'Te recomiendo empezar con un solo habito y medir avance diario.';
    const out = normalizeAssistantReply(raw, 'guia');

    expect(out).toContain('### Resumen rapido');
    expect(out).toContain('### Recomendaciones');
    expect(out).toContain('### Siguiente paso');
    expect(out).toMatch(/(^|\n)-\s+/);
  });

  it('limits excessive bullets to max 5', () => {
    const raw = [
      '### Resumen rapido',
      'Texto breve.',
      '',
      '### Recomendaciones',
      '- Uno',
      '- Dos',
      '- Tres',
      '- Cuatro',
      '- Cinco',
      '- Seis',
      '- Siete',
      '',
      '### Siguiente paso',
      '¿Seguimos?',
    ].join('\n');

    const out = normalizeAssistantReply(raw, 'guia');
    const bulletCount = out
      .split('\n')
      .filter((line) => /^\s*-\s+/.test(line))
      .length;

    expect(bulletCount).toBeLessThanOrEqual(5);
  });

  it('returns markdown format from POST /api/chat', async () => {
    const user = {
      username: 'format_user',
      email: 'format.user@example.com',
      password: 'Password123!',
    };

    const registerRes = await request(app).post('/api/auth/register').send(user);
    expect(registerRes.statusCode).toBe(201);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: user.password,
    });
    expect(loginRes.statusCode).toBe(200);

    const token = loginRes.body.token;
    expect(token).toBeTruthy();

    const chatRes = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Necesito ordenar mejor mi semana para dormir y rendir en clases.',
        mode: 'guia',
      });

    expect(chatRes.statusCode).toBe(200);
    expect(chatRes.body.format).toBe('markdown');
    expect(String(chatRes.body.text || '')).toContain('### Resumen rapido');
    expect(String(chatRes.body.text || '')).toMatch(/(^|\n)-\s+/);
  });
});
