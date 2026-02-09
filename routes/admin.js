import express from 'express';
import authMiddleware from '../middleware/auth.js';
import speakeasy from 'speakeasy';
import { User } from '../models/index.js';

const router = express.Router();

router.get('/secure-health', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(403).json({ error: '2fa_required' });
    }
    const token = (req.headers['x-2fa-code'] || '').toString();
    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });
    if (!ok) {
      return res.status(401).json({ error: 'invalid_2fa' });
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
