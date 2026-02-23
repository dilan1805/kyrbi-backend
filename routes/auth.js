import express from 'express';
import crypto from 'crypto';
import {
  register,
  login,
  verifyEmail,
  verifyEmailGet,
  requestPasswordReset,
  resetPassword,
  verify2FA,
  resendVerificationEmail,
  setup2FA,
  verify2FASetup,
  disable2FA,
  getMe,
  updatePreferences
} from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.js';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_kyrbi';
const FRONTEND_URL = process.env.PUBLIC_FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`;

const providersState = () => ({
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
  gmail: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
});

const strategyExists = (name) => Boolean(passport._strategy(name));
const oauthErrorRedirect = (message) => `${FRONTEND_URL}/login.html?error=${encodeURIComponent(message)}`;

const ensureOAuthReady = (strategyName, humanName, req, res) => {
  if (strategyExists(strategyName)) return true;
  const msg = `OAuth ${humanName} no esta configurado en el servidor`;
  if (req.accepts('html')) {
    res.redirect(oauthErrorRedirect(msg));
  } else {
    res.status(503).json({ error: msg, provider: strategyName });
  }
  return false;
};

const socialCallback = (req, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
  res.redirect(`${FRONTEND_URL}/login.html?token=${token}&username=${encodeURIComponent(user.username)}&id=${user.id}`);
};

const beginOAuth = (strategyName, humanName, optionsFactory) => (req, res, next) => {
  if (!ensureOAuthReady(strategyName, humanName, req, res)) return;
  const options = optionsFactory(req);
  passport.authenticate(strategyName, options)(req, res, next);
};

const oauthCallback = (strategyName, humanName) => (req, res, next) => {
  if (!ensureOAuthReady(strategyName, humanName, req, res)) return;
  passport.authenticate(strategyName, {
    session: false,
    failureRedirect: oauthErrorRedirect(`No se pudo autenticar con ${humanName}`)
  })(req, res, next);
};

router.get('/providers', (req, res) => {
  res.json(providersState());
});

router.get('/google', beginOAuth('google', 'Google', (req) => {
  const state = req.query.token || undefined;
  return { scope: ['profile', 'email'], state };
}));
router.get('/google/callback', oauthCallback('google', 'Google'), socialCallback);

router.get('/gmail', beginOAuth('google', 'Gmail', (req) => {
  const state = req.query.token || undefined;
  return { scope: ['profile', 'email'], state };
}));
router.get('/gmail/callback', oauthCallback('google', 'Gmail'), socialCallback);

router.get('/github', beginOAuth('github', 'GitHub', (req) => {
  const state = req.query.token || undefined;
  return { scope: ['user:email'], state };
}));
router.get('/github/callback', oauthCallback('github', 'GitHub'), socialCallback);

router.get('/microsoft', beginOAuth('microsoft', 'Microsoft', (req) => {
  const state = req.query.token || undefined;
  return { state };
}));
router.get('/microsoft/callback', oauthCallback('microsoft', 'Microsoft'), socialCallback);

router.get('/facebook', beginOAuth('facebook', 'Facebook', (req) => {
  const state = req.query.token || undefined;
  return { scope: ['email'], state };
}));
router.get('/facebook/callback', oauthCallback('facebook', 'Facebook'), socialCallback);

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email/:token', verifyEmailGet);
router.post('/password/reset/request', requestPasswordReset);
router.post('/password/reset/confirm', resetPassword);
router.post('/login/verify-2fa', verify2FA);
router.post('/verify-email/resend', resendVerificationEmail);

router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/verify-setup', authMiddleware, verify2FASetup);
router.post('/2fa/disable', authMiddleware, disable2FA);

router.get('/me', authMiddleware, getMe);
router.put('/preferences', authMiddleware, updatePreferences);

router.get('/csrf-token', (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf_token', token, {
    sameSite: 'lax',
    secure: (process.env.NODE_ENV || 'development') === 'production',
    httpOnly: false,
    maxAge: 60 * 60 * 1000,
  });
  res.json({ token });
});

export default router;
