'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
import ThemeToggle from '../components/ThemeToggle'

type Role = 'admin' | 'member'
type Profile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: Role | null
  avatar_url: string | null
}

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/qr', label: 'QR de Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
  { href: '/members', label: 'Miembros', icon: Users },
  { href: '/classes', label: 'Clases', icon: GraduationCap },
  { href: '/payments', label: 'Pagos', icon: DollarSign },
  { href: '/metricas', label: 'Metricas', icon: ChartLine },
  { href: '/access-log', label: 'Historial de Accesos', icon: ClipboardList },
]

const userNav = [
  { href: '/validate', label: 'Validar Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
]

export default function AdminLayout({ children, active }: { children: React.ReactNode, active?: string }) {
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
        .select('user_id,email,first_name,last_name,role,avatar_url')
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain animate-pulse" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium tracking-widest uppercase text-[10px]">Cargando Sistema Management…</p>
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
    <div className="min-h-screen flex w-full bg-background transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-slate-900/50 dark:backdrop-blur-2xl border-r border-border flex flex-col transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
              <div>
                <h2 className="font-black text-lg text-foreground tracking-tight leading-tight">Beleza <span className="text-blue-600">Dojo</span></h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {isAdmin ? 'Admin Panel' : 'Member Portal'}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Menu */}
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 py-4">
            {isAdmin ? 'Principal' : 'Menú'}
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const isActive = active === item.href || pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20'
                      : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer profile section */}
        <div className="p-4 border-t border-border">
          <div className="px-3 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center gap-3 mb-3 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserIcon className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate leading-none">{profile?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="group w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background glow effects for the main content area */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-background transition-colors duration-300">
          <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] dark:bg-blue-600/10" />
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] dark:bg-purple-600/10" />
        </div>

        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-6 py-4 md:hidden sticky top-0 z-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-8 h-8 object-contain" alt="Logo" />
            <h1 className="text-xl font-black text-foreground tracking-tight">Beleza <span className="text-blue-600">Dojo</span></h1>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  )
}
