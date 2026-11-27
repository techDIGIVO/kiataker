/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kiataker/tokens", "@kiataker/copy", "@kiataker/contracts"],
  env: {
    API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:4000",
    // The WhatsApp simulator on the site talks to this API. Unset = the main API. Set it to the
    // temporary demo API (render.yaml, kiataker-api-demo) while the real number isn't live.
    DEMO_API_BASE_URL: process.env.DEMO_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
