import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../../lib/prisma';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    return res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ error: error.message });
  }
}
