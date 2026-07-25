import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasFeature, ROUTE_FEATURES } from '@/lib/features'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 0. Las rutas de API son públicas (Mercado Pago, etc.)
    // Retornamos inmediatamente para evitar redirecciones o chequeos de auth
    if (pathname.startsWith('/api')) {
        return NextResponse.next()
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // const { pathname } = request.nextUrl // Remove duplicate

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const origin = `${protocol}://${host}`

    const adminPaths = [
        '/admin',
        '/members',
        '/classes',
        '/payments',
        '/torneo',
        '/metricas',
        '/access-log',
        '/qr',
        '/reportes',
        '/asistencia-vivo',
        '/notificaciones'
    ]

    const isPathAdmin = adminPaths.some(p => pathname.startsWith(p))
    const isPathProtected = isPathAdmin || pathname.startsWith('/app') || pathname.startsWith('/validate') || pathname.startsWith('/profile')

    // 0. Las rutas de API son públicas (Mercado Pago, etc.)
    // (Ya manejado al principio de la función)

    // 1. Si no hay usuario y trata de acceder a rutas protegidas
    if (!user && isPathProtected) {
        return NextResponse.redirect(new URL('/login', origin))
    }

    // 2. Si hay usuario, verificamos su rol para rutas de admin
    if (user) {
        if (pathname === '/login') {
            return NextResponse.redirect(new URL('/app', origin))
        }

        if (isPathAdmin) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', user.id)
                .single()

            if (profile?.role !== 'admin' && profile?.role !== 'instructor') {
                console.warn(`[middleware] Blocked ${profile?.role || 'member'} ${user.email} from ${pathname}`)
                return NextResponse.redirect(new URL('/validate', origin))
            }

            // 3. Bloqueo por plan: la ruta existe pero la feature está apagada en esta instancia
            const featureEntry = Object.entries(ROUTE_FEATURES).find(([prefix]) => pathname.startsWith(prefix))
            if (featureEntry && !hasFeature(featureEntry[1])) {
                return NextResponse.redirect(new URL('/admin', origin))
            }
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - logo.png, google-icon.svg, etc (assets)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
