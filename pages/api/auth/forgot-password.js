import { randomBytes } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../../lib/prisma';
import { sendEmail, forgotPasswordTemplate } from '../../../lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    }

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    const appUrl = process.env.APP_URL || 'https://sslgen.app';
    const resetUrl = `${appUrl}?reset=${token}`;
    const { subject, html } = forgotPasswordTemplate(email, resetUrl);
    await sendEmail({ to: email, subject, html });

    return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ error: error.message });
  }
}
