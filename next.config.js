const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = { reactStrictMode: true, experimental: { appDir: false } };

module.exports = withSentryConfig(nextConfig, {
  org: 'is-cool-me',
  project: 'sslgen',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  automaticVercelMonitors: true,
  treeshake: { removeDebugLogging: true },
});
