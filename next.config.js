/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // Accommodate audio files during voice intake
    },
  },
};

module.exports = nextConfig;
