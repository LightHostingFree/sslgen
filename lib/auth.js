import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

function getSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  return JWT_SECRET;
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
