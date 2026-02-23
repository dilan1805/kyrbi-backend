import { User } from '../models/index.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import authMiddleware from '../middleware/auth.js';

const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_kyrbi';
const backendURL = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const frontendURL = process.env.PUBLIC_FRONTEND_URL || '';

const hasSMTP = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailer = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
const sendMail = async (to, subject, html) => {
  if (!hasSMTP()) return;
  const from = process.env.MAIL_FROM || 'Kyrbi <no-reply@kyrbi.local>';
  try {
    await mailer().sendMail({ from, to, subject, html });
  } catch {}
};

export const register = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { captchaToken } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Completa username, email y password.' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ error: 'El nombre de usuario ya esta en uso.' });
    }

    if (process.env.RECAPTCHA_SECRET) {
      try {
        const axios = (await import('axios')).default;
        const resp = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
          params: { secret: process.env.RECAPTCHA_SECRET, response: captchaToken }
        });
        if (!resp.data.success) {
          return res.status(400).json({ error: 'CAPTCHA inválido' });
        }
      } catch {
        return res.status(500).json({ error: 'Error verificando CAPTCHA' });
      }
    }

    const user = await User.create({ username, email, password });
    
    user.emailVerificationToken = crypto.randomBytes(24).toString('hex');
    user.emailVerificationExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await user.save();

    const verifyLink = `${backendURL}/api/auth/verify-email/${user.emailVerificationToken}`;
    await sendMail(
      user.email,
      'Verifica tu correo en Kyrbi',
      `<p>Hola ${user.username},</p><p>Para activar tu cuenta, verifica tu correo.</p><p><a href="${verifyLink}">Verificar correo</a></p><p>Si el enlace no funciona, usa este código: <strong>${user.emailVerificationToken}</strong></p>`
    );

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });

    res.status(201).json({ 
      message: 'Usuario registrado exitosamente. Verifica tu correo.',
      user: { id: user.id, username: user.username, email: user.email },
      token,
      verifyTokenPreview: process.env.NODE_ENV === 'development' ? user.emailVerificationToken : undefined
    });
  } catch (error) {
    console.error(error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
      const fields = Object.keys(error?.fields || {});
      if (fields.includes('email')) {
        return res.status(400).json({ error: 'El email ya esta registrado.' });
      }
      if (fields.includes('username')) {
        return res.status(400).json({ error: 'El nombre de usuario ya esta en uso.' });
      }
      return res.status(400).json({ error: 'Ya existe un usuario con esos datos.' });
    }
    if (error?.name === 'SequelizeValidationError') {
      const first = error?.errors?.[0]?.message || 'Datos de registro invalidos.';
      return res.status(400).json({ error: first });
    }
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
};

export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { captchaToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Completa email y contrasena.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    if (!user.password) {
      return res.status(401).json({
        error: 'Esta cuenta usa inicio de sesion social. Inicia con Google/Facebook o recupera tu contrasena.'
      });
    }

    let passwordValid = false;
    try {
      passwordValid = await user.validatePassword(password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    if (process.env.RECAPTCHA_SECRET) {
      try {
        const axios = (await import('axios')).default;
        const resp = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
          params: { secret: process.env.RECAPTCHA_SECRET, response: captchaToken }
        });
        if (!resp.data.success) {
          return res.status(400).json({ error: 'CAPTCHA inválido' });
        }
      } catch {
        return res.status(500).json({ error: 'Error verificando CAPTCHA' });
      }
    }

    if (user.twoFactorEnabled) {
      return res.json({
        message: 'Se requiere código de autenticación (2FA)',
        require2FA: true,
        type: 'totp'
      });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Inicio de sesión exitoso',
      user: { id: user.id, username: user.username, email: user.email, preferences: user.preferences },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Token inválido' });
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    res.json({ message: 'Correo verificado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error verificando correo' });
  }
};

export const verifyEmailGet = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Token inválido' });
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    if (frontendURL) {
      return res.redirect(`${frontendURL}/login.html?verified=1`);
    }
    res.json({ message: 'Correo verificado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error verificando correo' });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: 'Si el correo existe, se enviará un enlace' });
    user.resetPasswordToken = crypto.randomBytes(24).toString('hex');
    user.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
    const resetLink = frontendURL ? `${frontendURL}/reset-password.html?token=${user.resetPasswordToken}` : '';
    await sendMail(
      user.email,
      'Restablece tu contraseña en Kyrbi',
      resetLink
        ? `<p>Para cambiar tu contraseña, abre este enlace:</p><p><a href="${resetLink}">Restablecer contraseña</a></p><p>Token: <strong>${user.resetPasswordToken}</strong></p>`
        : `<p>Usa este token para restablecer tu contraseña: <strong>${user.resetPasswordToken}</strong></p>`
    );
    res.json({
      message: 'Se ha enviado un enlace de recuperación',
      tokenPreview: process.env.NODE_ENV === 'development' ? user.resetPasswordToken : undefined
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generando recuperación' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ where: { resetPasswordToken: token } });
    if (!user) return res.status(400).json({ error: 'Token inválido' });
    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ message: 'Contraseña restablecida correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error restableciendo contraseña' });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    if (!email || !token) return res.status(400).json({ error: 'Email y token requeridos' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token
    });

    if (!verified) return res.status(401).json({ error: 'Código inválido' });

    const jwtToken = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Inicio de sesión exitoso',
      user: { id: user.id, username: user.username, email: user.email },
      token: jwtToken
    });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando 2FA' });
  }
};

export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (user.emailVerified) return res.status(400).json({ error: 'El correo ya está verificado' });

        user.emailVerificationToken = crypto.randomBytes(24).toString('hex');
        user.emailVerificationExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);
        await user.save();

        const verifyLink = `${backendURL}/api/auth/verify-email/${user.emailVerificationToken}`;
        await sendMail(
            user.email,
            'Verifica tu correo en Kyrbi',
            `<p>Hola ${user.username},</p><p>Para activar tu cuenta, verifica tu correo.</p><p><a href="${verifyLink}">Verificar correo</a></p>`
        );

        res.json({ message: 'Correo de verificación reenviado' });
    } catch (error) {
        res.status(500).json({ error: 'Error reenviando verificación' });
    }
};

export const setup2FA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const secret = speakeasy.generateSecret({ length: 20, name: `Kyrbi (${user.email})` });
    
    user.twoFactorSecret = secret.base32;
    await user.save();
    
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json({ error: 'Error generando QR' });
      res.json({ 
        message: 'Escanea el código QR', 
        qrCode: data_url,
        secret: secret.base32 
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error iniciando configuración 2FA' });
  }
};

export const verify2FASetup = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token
    });

    if (verified) {
      user.twoFactorEnabled = true;
      await user.save();
      res.json({ message: '2FA activado correctamente' });
    } else {
      res.status(400).json({ error: 'Código inválido' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error verificando configuración 2FA' });
  }
};

export const disable2FA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.json({ message: '2FA desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error desactivando 2FA' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'twoFactorEnabled', 'emailVerified', 'preferences', 'googleId', 'facebookId', 'githubId', 'microsoftId']
    });
    
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Formato de preferencias invalido' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const current = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
    const merged = { ...current, ...preferences };

    // Limite simple para evitar payloads enormes.
    if (JSON.stringify(merged).length > 8000) {
      return res.status(400).json({ error: 'Preferencias demasiado grandes' });
    }

    user.preferences = merged;
    await user.save();

    res.json({
      message: 'Preferencias actualizadas',
      preferences: user.preferences
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando preferencias' });
  }
};
