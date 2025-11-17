'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  QrCode,
  Users,
  DollarSign,
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  LogOut,
  Trophy,
  ChartLine,
  User as UserIcon,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Role = 'admin' | 'member'
type Profile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: Role | null
}

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/qr', label: 'QR de Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
  { href: '/members', label: 'Miembros', icon: Users },
  { href: '/classes', label: 'Clases', icon: GraduationCap },
  { href: '/payments', label: 'Pagos', icon: DollarSign },
  { href: '/torneo', label: 'Torneo', icon:  Trophy },
  { href: '/metricas', label: 'Metricas', icon: ChartLine  },
  { href: '/access-log', label: 'Historial de Accesos', icon: ClipboardList },
]

const userNav = [
  { href: '/validate', label: 'Validar Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,first_name,last_name,role')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!error) setProfile(data as Profile)
      setLoading(false)
    }
    load()
  }, [router])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain animate-pulse" />
          </div>
          <p className="text-slate-600">Cargando…</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'
  const nav = isAdmin ? adminNav : userNav
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Usuario'

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <div>
              <h2 className="font-bold text-xl text-slate-900">Beleza Dojo</h2>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'Panel Administrativo' : 'Portal de Usuario'}
              </p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
            {isAdmin ? 'Menú Administrativo' : 'Menú'}
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150',
                    'text-slate-600 hover:bg-blue-50 hover:text-blue-600',
                    active ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : '',
                  ].join(' ')}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className="px-3 py-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Usuario</p>
            <p className="text-sm font-medium text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{profile?.email}</p>
            {isAdmin && (
              <p className="text-xs text-blue-600 font-semibold mt-1">Administrador</p>
            )}
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 md:hidden sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-6 h-6 object-contain" alt="Logo" />
            <h1 className="text-lg font-bold text-slate-900">Beleza Dojo</h1>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  )
}
