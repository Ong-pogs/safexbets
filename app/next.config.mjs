/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // web3.js / wallet-adapter reference some Node core modules that don't exist in the
    // browser bundle. Stub them so the client build doesn't try to polyfill them.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
