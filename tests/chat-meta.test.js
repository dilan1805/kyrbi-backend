import request from 'supertest';
import app from '../index.js';
import { sequelize } from '../models/index.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Chat History Management and Meta', () => {
  const user = {
    username: 'chat_meta_user',
    email: 'chat.meta@example.com',
    password: 'Password123!',
  };

  let token = '';
  let conversationId = '';

  it('registers and logs in', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(user);
    expect(registerRes.statusCode).toBe(201);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: user.password,
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    token = loginRes.body.token;
  });

  it('creates chat conversation', async () => {
    const chatRes = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Quiero organizar mis hábitos de la semana',
        mode: 'guia',
      });

    expect(chatRes.statusCode).toBe(200);
    expect(chatRes.body.conversationId).toBeTruthy();
    conversationId = chatRes.body.conversationId;
  });

  it('renames conversation with PATCH /api/chat/history/:id', async () => {
    const patchRes = await request(app)
      .patch(`/api/chat/history/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Plan semanal de hábitos' });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.title).toBe('Plan semanal de hábitos');
  });

  it('deletes conversation with DELETE /api/chat/history/:id', async () => {
    const delRes = await request(app)
      .delete(`/api/chat/history/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.ok).toBe(true);
  });

  it('blocks public chat endpoints when ALLOW_PUBLIC_CHAT=false', async () => {
    const resPublicPost = await request(app).post('/api/chat/public').send({
      sessionId: 'public-session-1',
      message: 'hola',
      mode: 'guia',
    });
    expect(resPublicPost.statusCode).toBe(403);

    const resPublicHistory = await request(app).get('/api/chat/public/history').query({ sessionId: 'public-session-1' });
    expect(resPublicHistory.statusCode).toBe(403);
  });

  it('returns public metrics from /api/meta', async () => {
    const metaRes = await request(app).get('/api/meta');
    expect(metaRes.statusCode).toBe(200);
    expect(metaRes.body).toHaveProperty('product.name');
    expect(metaRes.body).toHaveProperty('metrics.registeredUsers');
    expect(metaRes.body).toHaveProperty('metrics.totalConversations');
    expect(metaRes.body).toHaveProperty('metrics.uptime');
    expect(metaRes.body).toHaveProperty('metrics.sla');
  });
});
