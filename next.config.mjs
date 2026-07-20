/** @type {import('next').NextConfig} */
const isDesktopBuild = process.env.NEXT_PUBLIC_DESKTOP_APP === '1';

const nextConfig = {
  ...(isDesktopBuild ? { output: 'standalone' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
