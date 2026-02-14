const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = { reactStrictMode: true, experimental: { appDir: false } };

module.exports = withSentryConfig(nextConfig, {
  silent: true,
});
