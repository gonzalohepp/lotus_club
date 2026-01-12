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
  ChartLine,
  User as UserIcon,
  Building2,
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
  { href: '/admin/academies', label: 'Academias', icon: Building2 },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
      if (data) {
        setProfile(data as Profile)
      } else {
        setProfile({
          user_id: user.id,
          email: user.email ?? null,
          first_name: null,
          last_name: null,
          role: 'member',
          avatar_url: user.user_metadata?.avatar_url ?? null
        })
      }
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

  /* State for mobile sidebar */
  // Moved to top


  const isAdmin = profile?.role === 'admin'
  const nav = isAdmin ? adminNav : userNav

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Usuario'

  return (
    <div className="min-h-screen flex w-full bg-background transition-colors duration-300 relative">

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0 md:static md:inset-auto md:flex
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Header (with Close button for mobile) */}
        <div className="border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-black text-lg text-foreground tracking-tight leading-tight">Beleza <span className="text-blue-600">Dojo</span></h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {isAdmin ? 'Admin Panel' : 'Member Portal'}
              </p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5 rotate-180" />
          </button>

          {/* Desktop Theme Toggle */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </div>

        {/* Theme Toggle (Desktop position - typically header, but user had it in sidebar header previously. 
            Let's keep the sidebar simple. The previous code had ThemeToggle in sidebar header. 
            We can keep it there or strict to desktop.) 
            
            Wait, previous code had ThemeToggle in sidebar header? 
            Yes: <ThemeToggle /> inside sidebar header div.
        */}
        <div className="px-6 pb-2 md:hidden">
          {/* Maybe show theme toggle here for mobile sidebar too if wanted, 
               but it is already in mobile header. avoiding duplicate unique IDs if any. 
           */}
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
                  onClick={() => setSidebarOpen(false)} // Close on navigate
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
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Background glow effects for the main content area */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-background transition-colors duration-300">
          <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] dark:bg-blue-600/10" />
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] dark:bg-purple-600/10" />
        </div>

        {/* Mobile Header */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-4 py-3 md:hidden sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-foreground hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {/* Hamburger Icon */}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-8 h-8 object-contain" alt="Logo" />
              <h1 className="text-lg font-black text-foreground tracking-tight">Beleza <span className="text-blue-600">Dojo</span></h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {children}
        </div>
      </main>
    </div>
  )
}
