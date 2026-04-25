/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Cloudflare Pages deployment via @cloudflare/next-on-pages
  // https://developers.cloudflare.com/pages/framework-guides/nextjs/
  ...(process.env.CF_PAGES ? { output: 'export', trailingSlash: true } : {}),
};

export default nextConfig;
