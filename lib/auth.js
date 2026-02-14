import jwt from 'jsonwebtoken';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

function getSecret() {
  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is required');
  }
  return CLERK_SECRET_KEY;
}

export function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, getSecret(), { expiresIn: '7d' });
}

export function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
