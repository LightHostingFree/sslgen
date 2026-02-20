const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = { reactStrictMode: true };

module.exports = withSentryConfig(nextConfig, {
  org: 'is-cool-me',
  project: 'sslgen',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  webpack: { automaticVercelMonitors: true },
  treeshake: { removeDebugLogging: true },
});
