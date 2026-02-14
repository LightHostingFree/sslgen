const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = { reactStrictMode: true, experimental: { appDir: false } };

module.exports = withSentryConfig(nextConfig, {
  org: 'is-cool-me',
  project: 'sslgen',
  silent: true,
});
