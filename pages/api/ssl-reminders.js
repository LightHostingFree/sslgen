import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { sendEmail, sslExpiryReminderTemplate } from '../../lib/email';

const REMINDER_THRESHOLD_DAYS = Number(process.env.REMINDER_THRESHOLD_DAYS || 30);
const REMINDER_SECRET = process.env.REMINDER_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Require a secret token to prevent unauthorized triggering
  if (REMINDER_SECRET) {
    const authHeader = req.headers.authorization || '';
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (provided !== REMINDER_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const thresholdDate = new Date(Date.now() + REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    const expiring = await prisma.certificate.findMany({
      where: {
        status: 'ISSUED',
        expiresAt: { not: null, gt: new Date(), lt: thresholdDate }
      },
      include: { user: { select: { email: true } } }
    });

    if (expiring.length === 0) {
      return res.json({ sent: 0, message: 'No expiring certificates found' });
    }

    // Group certificates by user email
    const byUser = {};
    for (const cert of expiring) {
      const email = cert.user.email;
      if (!byUser[email]) byUser[email] = [];
      byUser[email].push(cert);
    }

    let sent = 0;
    const errors = [];
    for (const [email, certs] of Object.entries(byUser)) {
      try {
        const { subject, html } = sslExpiryReminderTemplate(email, certs);
        await sendEmail({ to: email, subject, html });
        sent++;
      } catch (err) {
        Sentry.captureException(err);
        errors.push({ email, error: err.message });
      }
    }

    return res.json({ sent, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ error: error.message });
  }
}
