import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@lambersond/3d-dice-core',
    '@lambersond/3d-dice-react',
    '@lambersond/3d-dice-engine',
  ],
}

export default nextConfig
