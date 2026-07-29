import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    reactCompiler: true,
    turbopack: {
        root: path.resolve(__dirname, '../../'),
    },
    images: {
        remotePatterns: [
            // Storage de cualquier proyecto Supabase: avatares subidos por el
            // admin y logos de marca del bucket `branding`. El comodín cubre a
            // todos los tenants sin tener que listar project refs uno por uno.
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
            // Avatares de Google. El trigger `handle_new_user()` guarda el
            // avatar_url que viene en los metadatos de OAuth, y esa URL apunta
            // a lh3.googleusercontent.com — sin este patrón, cualquier pantalla
            // que renderice la foto de un usuario logueado con Google explota
            // con "hostname is not configured under images".
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
};
export default nextConfig;
