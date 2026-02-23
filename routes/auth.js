import express from 'express';
import crypto from 'crypto';
import { register, login, verifyEmail, verifyEmailGet, requestPasswordReset, resetPassword, verify2FA, resendVerificationEmail, setup2FA, verify2FASetup, disable2FA, getMe, updatePreferences } from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.js';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_kyrbi';
const FRONTEND_URL = process.env.PUBLIC_FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`;

// Helper para login social
const socialCallback = (req, res) => {
    const user = req.user;
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
    
    // Redirigir al frontend con token
    // En producción es mejor usar cookies seguras o una página intermedia (popup message)
    res.redirect(`${FRONTEND_URL}/login.html?token=${token}&username=${encodeURIComponent(user.username)}&id=${user.id}`);
};

// Estado de proveedores disponibles
router.get('/providers', (req, res) => {
  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    gmail: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) // alias de Google
  };
  res.json(providers);
});

// Google
router.get('/google', (req, res, next) => {
  const state = req.query.token || undefined;
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login.html?error=oauth_failed` }), socialCallback);

// Gmail (alias a Google)
router.get('/gmail', (req, res, next) => {
  const state = req.query.token || undefined;
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});
router.get('/gmail/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login.html?error=oauth_failed` }), socialCallback);

// GitHub
router.get('/github', (req, res, next) => {
    const state = req.query.token || undefined;
    passport.authenticate('github', { scope: ['user:email'], state })(req, res, next);
});
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login.html?error=oauth_failed` }), socialCallback);

// Microsoft
router.get('/microsoft', (req, res, next) => {
    const state = req.query.token || undefined;
    passport.authenticate('microsoft', { state })(req, res, next);
});
router.get('/microsoft/callback', passport.authenticate('microsoft', { session: false, failureRedirect: `${FRONTEND_URL}/login.html?error=oauth_failed` }), socialCallback);

// Facebook
router.get('/facebook', (req, res, next) => {
    const state = req.query.token || undefined;
    passport.authenticate('facebook', { scope: ['email'], state })(req, res, next);
});
router.get('/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/login.html?error=oauth_failed` }), socialCallback);


router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email/:token', verifyEmailGet);
router.post('/password/reset/request', requestPasswordReset);
router.post('/password/reset/confirm', resetPassword);
router.post('/login/verify-2fa', verify2FA);
router.post('/verify-email/resend', resendVerificationEmail);

// 2FA Management
router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/verify-setup', authMiddleware, verify2FASetup);
router.post('/2fa/disable', authMiddleware, disable2FA);

// User info
router.get('/me', authMiddleware, getMe);
router.put('/preferences', authMiddleware, updatePreferences);

// CSRF token (double-submit cookie)
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
