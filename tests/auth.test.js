import request from 'supertest';
import app from '../index.js';
import { sequelize, User } from '../models/index.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth Endpoints', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
  };
  let token = '';

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message');
  });

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('should not login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword',
      });

    expect(res.statusCode).toEqual(401);
  });

  it('should block login for unverified email when verification is required', async () => {
    const previous = {
      REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
    };

    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_USER = 'test-user';
    process.env.SMTP_PASS = 'test-pass';

    try {
      const pendingUser = {
        username: 'pending_verify_user',
        email: 'pending.verify@example.com',
        password: 'Password123!',
      };

      await User.create({
        ...pendingUser,
        emailVerified: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: pendingUser.email,
          password: pendingUser.password,
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('code', 'email_not_verified');
    } finally {
      process.env.REQUIRE_EMAIL_VERIFICATION = previous.REQUIRE_EMAIL_VERIFICATION;
      process.env.SMTP_HOST = previous.SMTP_HOST;
      process.env.SMTP_USER = previous.SMTP_USER;
      process.env.SMTP_PASS = previous.SMTP_PASS;
    }
  });

  it('should allow institutional emails without TLD (ej. usuario@irk)', async () => {
    const institutionalUser = {
      username: 'inst_user',
      email: 'inst.user@irk',
      password: 'Password123!',
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(institutionalUser);
    expect(registerRes.statusCode).toEqual(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: institutionalUser.email,
        password: institutionalUser.password,
      });

    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should allow institutional emails with domain suffix (ej. usuario@irk.mx)', async () => {
    const institutionalUserMx = {
      username: 'inst_user_mx',
      email: 'inst.user@irk.mx',
      password: 'Password123!',
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(institutionalUserMx);
    expect(registerRes.statusCode).toEqual(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'INST.USER@IRK.MX',
        password: institutionalUserMx.password,
      });

    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 401 (not 500) for social account without password', async () => {
    await User.create({
      username: 'social_only_user',
      email: 'social_only@example.com',
      password: null,
      googleId: 'google-social-1',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'social_only@example.com',
        password: 'Password123!',
      });

    expect(res.statusCode).toEqual(401);
    expect(String(res.body.error || '')).toContain('inicio de sesion social');
  });

  it('should not return 500 when oauth provider is not configured', async () => {
    const res = await request(app).get('/api/auth/google');

    expect([302, 503]).toContain(res.statusCode);
    if (res.statusCode === 302) {
      expect(String(res.headers.location || '')).toContain('error=');
    }
  });

  it('should get user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.email).toEqual(testUser.email);
  });
  
  it('should not access protected route without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');
      
      expect(res.statusCode).toEqual(401);
  });
});
