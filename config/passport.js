import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { User } from '../models/index.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_kyrbi';
const backendURL = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const providerAlias = (providerField) => String(providerField || '').replace(/Id$/i, '').toLowerCase() || 'social';

const normalizeUsername = (value, fallback = 'kyrbi_user') => {
  const raw = String(value || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalized || fallback).slice(0, 32);
};

const ensureUniqueUsername = async (baseUsername) => {
  const cleanBase = normalizeUsername(baseUsername);
  let candidate = cleanBase;
  let suffix = 0;

  while (await User.findOne({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${cleanBase.slice(0, 26)}_${suffix}`;
    if (suffix > 99) break;
  }

  return candidate;
};

const ensureUniqueEmail = async (baseEmail, providerField, profileId) => {
  const alias = providerAlias(providerField);
  let candidate = String(baseEmail || '').trim().toLowerCase();

  if (!candidate) {
    candidate = `${alias}_${String(profileId || Date.now())}@social.kyrbi.local`;
  }

  let suffix = 0;
  while (await User.findOne({ where: { email: candidate } })) {
    suffix += 1;
    const [localPart, domain = 'social.kyrbi.local'] = candidate.split('@');
    const safeLocal = localPart.replace(/_\d+$/, '');
    candidate = `${safeLocal}_${suffix}@${domain}`;
    if (suffix > 99) break;
  }

  return candidate;
};

const handleAuth = async (req, accessToken, refreshToken, profile, done, providerField) => {
  try {
    const profileId = String(profile?.id || '').trim();
    if (!profileId) {
      return done(null, false, { message: 'No se pudo identificar el perfil social.' });
    }

    // 1) Social account already linked
    let user = await User.findOne({ where: { [providerField]: profileId } });

    // 2) Account linking when user is already logged in
    if (req.query.state) {
      try {
        const decoded = jwt.verify(req.query.state, SECRET);
        const loggedUser = await User.findByPk(decoded.id);

        if (loggedUser) {
          if (user) {
            if (user.id === loggedUser.id) {
              return done(null, loggedUser);
            }
            return done(null, false, { message: 'Esta cuenta social ya esta vinculada a otro usuario.' });
          }

          loggedUser[providerField] = profileId;
          await loggedUser.save();
          return done(null, loggedUser);
        }
      } catch {
        // Invalid state token: continue as normal login
      }
    }

    // 3) Normal social login
    if (user) return done(null, user);

    // 4) Match by email (if provider returns one)
    const incomingEmail = String(profile.emails?.[0]?.value || '').trim().toLowerCase();
    if (incomingEmail) {
      user = await User.findOne({ where: { email: incomingEmail } });
      if (user) {
        user[providerField] = profileId;
        await user.save();
        return done(null, user);
      }
    }

    // 5) Create user safely (avoid username/email collisions)
    const alias = providerAlias(providerField);
    const usernameBase = normalizeUsername(
      profile.displayName || profile.username || `${alias}_${profileId}`,
      `${alias}_${profileId}`
    );

    const safeUsername = await ensureUniqueUsername(usernameBase);
    const safeEmail = await ensureUniqueEmail(incomingEmail, providerField, profileId);

    user = await User.create({
      username: safeUsername,
      email: safeEmail,
      [providerField]: profileId,
      emailVerified: true,
      password: null,
    });

    done(null, user);
  } catch (error) {
    console.error('OAuth handleAuth error:', providerField, error?.message || error);
    done(error, null);
  }
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${backendURL}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'googleId')
    )
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${backendURL}/api/auth/github/callback`,
        scope: ['user:email'],
        passReqToCallback: true,
      },
      (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'githubId')
    )
  );
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${backendURL}/api/auth/microsoft/callback`,
        scope: ['user.read'],
        passReqToCallback: true,
      },
      (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'microsoftId')
    )
  );
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${backendURL}/api/auth/facebook/callback`,
        profileFields: ['id', 'emails', 'name'],
        passReqToCallback: true,
      },
      (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'facebookId')
    )
  );
}

export default passport;
