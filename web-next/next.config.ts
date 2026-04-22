import type { NextConfig } from 'next';

/** Com `output: 'export'` não há servidor Next em runtime; rewrites não se aplicam ao `next build`. */
const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

export default nextConfig;
