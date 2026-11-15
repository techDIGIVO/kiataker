/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kiataker/tokens", "@kiataker/copy", "@kiataker/contracts"],
  env: {
    API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
