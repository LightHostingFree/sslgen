import * as Sentry from '@sentry/nextjs';

const tracesSampleRate = (() => {
  const value = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0');
  return Number.isFinite(value) ? value : 0;
})();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  tracesSampleRate,
});

// Next.js calls this hook on route transitions so Sentry can create navigation spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
