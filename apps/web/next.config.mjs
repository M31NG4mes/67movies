/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cinemaflow/types'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'static.tvmaze.com' },
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'api.anilibria.app' },
      { protocol: 'https', hostname: 'aniliberty.top' },
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
      { protocol: 'https', hostname: 'image.openmoviedb.com' },
      { protocol: 'https', hostname: 'st.kp.yandex.net' },
      { protocol: 'https', hostname: 'kinopoiskapiunofficial.tech' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'static.hdrezka.ac' },
      { protocol: 'https', hostname: 'rezka.ag' },
      { protocol: 'https', hostname: 'hdrezka.ag' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
