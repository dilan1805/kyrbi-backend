import request from 'supertest';
import app from '../index.js';
import { sequelize, User } from '../models/index.js';
import speakeasy from 'speakeasy';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth Advanced Flows', () => {
  const user = {
    username: 'advancedUser',
    email: 'advanced@example.com',
    password: 'Password123!',
  };
  let token = '';
  let secret = '';

  it('should register and login', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: user.password
    });
    token = res.body.token;
    expect(token).toBeDefined();
  });

  // 2FA Flow
  it('should setup 2FA', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('secret');
    secret = res.body.secret;
  });

  it('should verify and enable 2FA', async () => {
    const code = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });

    const res = await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: code });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toMatch(/activado/);
  });

  it('login should require 2FA now', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: user.password
    });

    expect(res.body).toHaveProperty('require2FA', true);
    expect(res.body).not.toHaveProperty('token');
  });

  it('should verify 2FA code during login', async () => {
    const code = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });

    const res = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({
        email: user.email,
        token: code
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });

  // Password Reset Flow
  let resetToken = '';
  it('should request password reset', async () => {
    const res = await request(app)
      .post('/api/auth/password/reset/request')
      .send({ email: user.email });
    
    expect(res.statusCode).toEqual(200);
    
    if (res.body.tokenPreview) {
        resetToken = res.body.tokenPreview;
    }
  });

  it('should reset password with token', async () => {
     if (!resetToken) {
         const dbUser = await User.findOne({ where: { email: user.email } });
         resetToken = dbUser.resetPasswordToken;
     }

     const newPassword = 'NewPassword123!';
     const res = await request(app)
       .post('/api/auth/password/reset/confirm')
       .send({
         token: resetToken,
         password: newPassword
       });
     
     expect(res.statusCode).toEqual(200);

     const loginRes = await request(app).post('/api/auth/login').send({
         email: user.email,
         password: newPassword
     });
     
     expect(loginRes.body).toHaveProperty('require2FA', true);
  });
});
