import * as Sentry from '@sentry/nextjs';

const tracesSampleRate = (() => {
  const value = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0');
  return Number.isFinite(value) ? value : 0;
})();

export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate,
  });
}

export const onRequestError = Sentry.captureRequestError;
