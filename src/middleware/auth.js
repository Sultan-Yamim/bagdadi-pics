// JWT auth middleware. Verifies the Authorization header and attaches req.user.

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn('[auth] JWT_SECRET not set - using insecure dev fallback');
}
const EFFECTIVE_SECRET = SECRET || 'dev-only-change-me-in-production';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, EFFECTIVE_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, SECRET: EFFECTIVE_SECRET };
