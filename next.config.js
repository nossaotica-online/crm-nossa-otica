/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // No GitHub Pages o site é servido em /<nome-do-repo>; o workflow
  // de deploy define NEXT_PUBLIC_BASE_PATH. Local fica vazio.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  compiler: {
    // Remove console.log/warn/error e demais chamadas console.* do bundle final.
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;
