const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = { reactStrictMode: true };
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

module.exports = withSentryConfig(nextConfig, {
  ...(hasSentryAuthToken
    ? {
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'is-cool-me',
        project: 'sslgen',
      }
    : {}),
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  webpack: { automaticVercelMonitors: true },
  treeshake: { removeDebugLogging: true },
});
