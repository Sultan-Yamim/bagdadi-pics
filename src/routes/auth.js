// REST routes for authentication.
//   POST /api/auth/signup  - create an account, returns JWT
//   POST /api/auth/login   - exchange email+password for a JWT
//   GET  /api/auth/me      - return the current authenticated user (if any)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userService = require('../services/userService');
const { requireAuth, SECRET } = require('../middleware/auth');

const router = express.Router();
const TOKEN_EXPIRES = '7d';

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!firstName || !lastName) return res.status(400).json({ error: 'First name and last name are required' });

    const existing = await userService.findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account already exists for this email' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: email, // email as Cosmos id (unique)
      email,
      firstName,
      lastName,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await userService.createUser(user);

    const token = jwt.sign({ sub: email, email }, SECRET, { expiresIn: TOKEN_EXPIRES });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await userService.findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ sub: email, email }, SECRET, { expiresIn: TOKEN_EXPIRES });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
