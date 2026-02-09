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

const handleAuth = async (req, accessToken, refreshToken, profile, done, providerField) => {
  try {
    // 1. Check if social account is already linked
    let user = await User.findOne({ where: { [providerField]: profile.id } });

    // 2. Check if user is already logged in (Linking account)
    if (req.query.state) {
      try {
        const decoded = jwt.verify(req.query.state, SECRET);
        const loggedUser = await User.findByPk(decoded.id);
        
        if (loggedUser) {
          if (user) {
             if (user.id === loggedUser.id) {
               return done(null, loggedUser); // Already linked to this user
             } else {
               return done(null, false, { message: 'Esta cuenta social ya está vinculada a otro usuario.' });
             }
          } else {
            // Link to current user
            loggedUser[providerField] = profile.id;
            await loggedUser.save();
            return done(null, loggedUser);
          }
        }
      } catch (err) {
        // Invalid token in state, proceed as normal login
      }
    }

    // 3. Normal Login/Register
    if (user) return done(null, user);

    // 4. Check by email
    const email = profile.emails?.[0]?.value;
    if (email) {
      user = await User.findOne({ where: { email } });
      if (user) {
        user[providerField] = profile.id;
        await user.save();
        return done(null, user);
      }
    }

    // 5. Create new user
    user = await User.create({
      username: profile.displayName || profile.username || `${providerField.replace('Id', '')}_${profile.id}`,
      email: email || `${providerField.replace('Id', '')}_${profile.id}@placeholder.com`,
      [providerField]: profile.id,
      emailVerified: true,
      password: null
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
};

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${backendURL}/api/auth/google/callback`,
    passReqToCallback: true
  }, (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'googleId')));
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${backendURL}/api/auth/github/callback`,
    scope: ['user:email'],
    passReqToCallback: true
  }, (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'githubId')));
}

// Microsoft Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${backendURL}/api/auth/microsoft/callback`,
        scope: ['user.read'],
        passReqToCallback: true
    }, (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'microsoftId')));
}

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${backendURL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name'],
    passReqToCallback: true
  }, (req, token, refreshToken, profile, done) => handleAuth(req, token, refreshToken, profile, done, 'facebookId')));
}

export default passport;