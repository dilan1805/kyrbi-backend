import request from 'supertest';
import app from '../index.js';
import { User } from '../models/index.js';
import speakeasy from 'speakeasy';

describe('Security and Protection', () => {
  test('security headers present on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  test('HTTPS redirect enforced when FORCE_HTTPS=true', async () => {
    process.env.FORCE_HTTPS = 'true';
    const res = await request(app).get('/health').set('x-forwarded-proto', 'http');
    expect([301, 302]).toContain(res.status);
    expect(res.headers.location).toMatch(/^https:\/\//);
    process.env.FORCE_HTTPS = 'false';
  });

  test('protected endpoints require JWT', async () => {
    const chatRes = await request(app).post('/api/chat').send({ message: 'hola' });
    expect(chatRes.status).toBe(401);
    const histRes = await request(app).get('/api/chat/history');
    expect(histRes.status).toBe(401);
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });

  test('admin endpoint requires admin role and valid 2FA', async () => {
    const user = await User.create({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'StrongPass123!'
    });
    user.role = 'admin';
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    await user.save();

    // Login to get JWT
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'StrongPass123!' });
    expect(loginRes.status).toBe(200);
    // Admin has 2FA enabled; perform 2FA verification to obtain token
    const codeLogin = speakeasy.totp({ secret, encoding: 'base32' });
    const verifyRes = await request(app).post('/api/auth/login/verify-2fa').send({ email: 'admin@example.com', token: codeLogin });
    expect(verifyRes.status).toBe(200);
    const token = verifyRes.body.token;
    expect(token).toBeDefined();

    // Without 2FA header -> should fail
    const no2fa = await request(app).get('/api/admin/secure-health').set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(no2fa.status);

    // With invalid 2FA -> fail
    const bad2fa = await request(app).get('/api/admin/secure-health').set('Authorization', `Bearer ${token}`).set('x-2fa-code', '000000');
    expect([401, 403]).toContain(bad2fa.status);

    // With valid 2FA -> success
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const ok = await request(app).get('/api/admin/secure-health').set('Authorization', `Bearer ${token}`).set('x-2fa-code', code);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ok');
  });
});
