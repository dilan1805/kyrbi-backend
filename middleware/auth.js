import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const hasSMTP = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const isEmailVerificationRequired = () =>
  String(process.env.REQUIRE_EMAIL_VERIFICATION || 'true') === 'true' && hasSMTP();

const authMiddleware = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_kyrbi');

    if (isEmailVerificationRequired()) {
      const user = await User.findByPk(decoded.id, { attributes: ['id', 'emailVerified'] });
      if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado.' });
      }
      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Debes verificar tu correo antes de continuar.',
          code: 'email_not_verified'
        });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalido o expirado.' });
  }
};

export default authMiddleware;
