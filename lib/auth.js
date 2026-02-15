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
  if (!token) {
    return { error: 'Authorization token missing or invalid format. Expected format: "Bearer <token>"' };
  }
  try {
    const user = jwt.verify(token, getSecret());
    return { user, error: null };
  } catch (err) {
    return { error: `Invalid or expired token: ${err.message}`, user: null };
  }
}

export function requireAuth(req, res) {
  const result = getUserFromRequest(req);
  if (result.error || !result.user) {
    res.status(401).json({ error: result.error || 'Unauthorized' });
    return null;
  }
  return result.user;
}
