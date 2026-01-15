/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    /* reactCompiler: true, */
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'iavldjgkejbnkddivoqd.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
};

export default nextConfig;
