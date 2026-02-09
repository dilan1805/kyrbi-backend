import request from 'supertest';
import app from '../index.js';

describe('OAuth Providers Status', () => {
  it('should expose providers availability flags', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('github');
    expect(res.body).toHaveProperty('microsoft');
    expect(res.body).toHaveProperty('facebook');
    expect(res.body).toHaveProperty('gmail');
    for (const key of Object.keys(res.body)) {
      expect(typeof res.body[key]).toBe('boolean');
    }
    expect(res.body.gmail).toBe(res.body.google);
  });
});
