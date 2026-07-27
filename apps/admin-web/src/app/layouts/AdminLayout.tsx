'use client'
import { useEffect, useState, useMemo } from 'react'
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
  Bell,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Wifi,
  WifiOff,
  Activity,
  Sparkles,
  Crown
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import ThemeToggle from '../components/ThemeToggle'
import { motion, AnimatePresence } from 'framer-motion'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { hasFeature, PLAN, type FeatureKey } from '@/lib/features'
import UpgradeModal from '../components/plan/UpgradeModal'
import ProBenefitsModal from '../components/plan/ProBenefitsModal'

type Notification = {
  id: string
  type: 'access_denied' | 'fraud'
  title: string
  description: string
  timestamp: string
  link?: string
  read: boolean
}

type AccessLogRow = {
  id: string | number
  user_id: string | null
  result: string
  reason: string | null
  scanned_at: string
}

type Role = 'admin' | 'member' | 'instructor' | 'becado'
type Profile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: Role | null
  avatar_url: string | null
}

const NAV_ITEMS: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: string[]
  feature?: FeatureKey
}[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/qr', label: 'QR de Acceso', icon: QrCode, roles: ['admin', 'instructor'], feature: 'qr' },
  { href: '/validate', label: 'Validar Acceso', icon: QrCode, roles: ['admin', 'instructor', 'becado', 'member'] },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon, roles: ['admin', 'instructor', 'becado', 'member'] },
  { href: '/members', label: 'Miembros', icon: Users, roles: ['admin'], feature: 'members' },
  { href: '/admin/academies', label: 'Academias', icon: Building2, roles: ['admin'], feature: 'academies' },
  { href: '/classes', label: 'Clases', icon: GraduationCap, roles: ['admin'], feature: 'classes' },
  { href: '/payments', label: 'Pagos', icon: DollarSign, roles: ['admin'], feature: 'payments' },
  { href: '/metricas', label: 'Metricas', icon: ChartLine, roles: ['admin'], feature: 'metrics' },
  { href: '/reportes', label: 'Reportes', icon: ClipboardList, roles: ['admin'], feature: 'reports' },
  { href: '/asistencia-vivo', label: 'Asistencia en Vivo', icon: Activity, roles: ['admin', 'instructor'], feature: 'asistenciaVivo' },
  { href: '/access-log', label: 'Historial de Accesos', icon: ClipboardList, roles: ['admin'], feature: 'accessLog' },
  { href: '/notificaciones', label: 'Notificaciones', icon: Bell, roles: ['admin'], feature: 'notifications' },
]

export default function AdminLayout({ children, active }: { children: React.ReactNode, active?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showProBenefits, setShowProBenefits] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const { isSupported, subscription, subscribeUser, unsubscribeUser } = usePushNotifications()
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BMXQvrbtBZdniuZrLMYD87T0E-742Lo72ktJWrjzB5mcbKYrrCh5X6cAo7z0d09QqOygrZsNFVEz_IBgTWqUp6o'

  const handleTogglePush = async () => {
    if (subscription) {
      const success = await unsubscribeUser()
      if (success) toast.info('Notificaciones desactivadas')
    } else {
      const sub = await subscribeUser(VAPID_PUBLIC_KEY)
      if (sub) {
        toast.success('¡Notificaciones activadas!')
      } else {
        toast.error('No se pudo activar las notificaciones.')
      }
    }
  }

  const fetchInitialNotifs = async () => {
    const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]')

    const { data: logs } = await supabase
      .from('access_logs')
      .select('id, result, reason, scanned_at, profiles!inner(first_name, last_name)')
      .eq('result', 'denegado')
      .order('scanned_at', { ascending: false })
      .limit(20)

    const mappedLogs: Notification[] = (logs || [])
      .filter(l => !dismissed.includes(l.id.toString()))
      .map(l => ({
        id: l.id.toString(),
        type: 'access_denied',
        title: 'Acceso Denegado',
        description: `${(l.profiles as unknown as { first_name: string, last_name: string }).first_name || 'Usuario'} ${(l.profiles as unknown as { first_name: string, last_name: string }).last_name || ''}: ${l.reason || ''}`,
        timestamp: l.scanned_at,
        read: true
      }))

    const combined = [...mappedLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15)

    setNotifications(combined)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,first_name,last_name,role,avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) console.error('[AdminLayout] load profile error:', error)
      if (data) {
        setProfile(data as Profile)
        // Ensure push sync happens for the current user session
        if ('Notification' in window && Notification.permission === 'granted') {
          // Subscription synced
          subscribeUser(VAPID_PUBLIC_KEY).catch(err =>
            console.error('[Push] Silent sync failed:', err)
          )
        }
      } else {
        setProfile({
          user_id: user.id,
          email: user.email ?? null,
          first_name: null,
          last_name: null,
          role: null,
          avatar_url: null
        })
      }
      setLoading(false)
      fetchInitialNotifs()
    }
    load()
    // No incluimos `subscription` en las deps a propósito: este efecto es de
    // carga inicial (perfil + sync silencioso de push). Si dependiera de
    // `subscription`, cada vez que el usuario se desactiva a mano el efecto
    // se re-disparaba y el sync silencioso lo volvía a suscribir al toque,
    // haciendo que el ícono de wifi "revirtiera" solo después de desactivar.
  }, [router, VAPID_PUBLIC_KEY, subscribeUser])

  // ========= Real-time Security Alerts =========
  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'instructor')) return

    const userId = profile.user_id
    // Subscribing to security alerts

    const channel = supabase
      .channel(`security_alerts_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_logs' },
        async (payload) => {
          const newLog = payload.new as AccessLogRow
          if (newLog.result === 'denegado') {
            // Access Denied detected

            let name = 'Usuario desconocido'
            if (newLog.user_id) {
              const { data: p } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', newLog.user_id)
                .maybeSingle()
              if (p) name = `${p.first_name} ${p.last_name}`
            }

            const newNotif: Notification = {
              id: newLog.id.toString(),
              type: 'access_denied',
              title: 'Acceso Denegado',
              description: `${name}: ${newLog.reason}`,
              timestamp: newLog.scanned_at,
              read: false
            }

            setNotifications(prev => [newNotif, ...prev].slice(0, 15))

            try {
              const audio = new Audio('/alert.mp3')
              audio.volume = 0.3
              audio.play().catch(() => { })
            } catch { }

            toast.error(`¡Alerta de Acceso!`, {
              description: `${name}: ${newLog.reason}`,
              duration: 8000,
              icon: <ShieldAlert className="w-5 h-5 text-red-500" />
            })

            // Detección de fraude (múltiples intentos)
            if (newLog.user_id) {
              const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
              const { count } = await supabase
                .from('access_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', newLog.user_id)
                .eq('result', 'denegado')
                .gt('scanned_at', fiveMinsAgo)

              if (count && count >= 3) {
                const fraudNotif: Notification = {
                  id: `fraud-${newLog.user_id}-${Date.now()}`,
                  type: 'fraud',
                  title: 'Posible Fraude',
                  description: `${name} falló ${count} intentos en 5 minutos.`,
                  timestamp: new Date().toISOString(),
                  read: false
                }
                setNotifications(prev => [fraudNotif, ...prev].slice(0, 15))

                toast.warning('Posible Intento de Fraude', {
                  description: `${name} ha fallado ${count} intentos en 5 minutos.`,
                  duration: 12000,
                  icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
                })
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      // Cleanup security alerts
      supabase.removeChannel(channel)
    }
  }, [profile])

  /* State and Hooks for Navigation & Protection */
  const role = profile?.role || 'member'
  const nav = useMemo(
    () => NAV_ITEMS.filter(item => item.roles.includes(role) && (!item.feature || hasFeature(item.feature))),
    [role]
  )
  const isAdmin = role === 'admin' || role === 'instructor'

  // Optimized Route protection
  useEffect(() => {
    if (loading || !profile) return

    const currentPath = pathname
    // Public or special paths
    if (currentPath === '/login' || currentPath === '/auth/callback') return

    const userRole = profile.role || 'member'
    // Ordenado por especificidad (href más largo primero) para que, por ej.,
    // /admin/academies matchee su propia entrada (y su feature gate) en vez
    // de caer en el prefijo más corto de /admin (el dashboard, sin gate).
    const matchingItem = [...NAV_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find(item => currentPath === item.href || currentPath.startsWith(item.href + '/'))
    const allowed = !!matchingItem
      && matchingItem.roles.includes(userRole)
      && (!matchingItem.feature || hasFeature(matchingItem.feature))

    if (!allowed && currentPath !== '/validate') {
      const defaultPath = userRole === 'admin' ? '/admin' : '/profile'
      // Only replace if we are not already at the default path to prevent loops
      if (currentPath !== defaultPath) {
        router.replace(defaultPath)
      }
    }
  }, [pathname, loading, profile, router])

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
          <p className="text-muted-foreground animate-pulse font-medium tracking-widest uppercase text-[10px]">Cargando…</p>
        </div>
      </div>
    )
  }

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
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0 md:sticky md:top-0 md:h-screen
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-bold text-lg text-foreground tracking-tight leading-tight">Beleza <span className="text-brand">Dojo</span></h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {role === 'admin' ? 'Admin Panel' : role === 'instructor' ? 'Instructor Panel' : 'Portal de Alumno'}
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
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200 group',
                    isActive
                      ? 'bg-brand text-white font-semibold'
                      : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-brand'}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Upgrade CTA (solo plan Basic) */}
        {PLAN === 'basic' && role === 'admin' && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowUpgrade(true)}
              className="group relative w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/30 overflow-hidden transition-transform active:scale-95 hover:scale-[1.02]"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent shine-sweep" />
              <Sparkles className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Actualizar a Pro</span>
            </button>
          </div>
        )}

        {/* Badge de plan Pro (solo instancias Pro) */}
        {PLAN === 'pro' && role === 'admin' && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowProBenefits(true)}
              className="group relative w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-500/30 overflow-hidden transition-transform active:scale-95 hover:scale-[1.02]"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent shine-sweep" />
              <Crown className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Sos Plan Pro</span>
            </button>
          </div>
        )}

        {/* Footer profile section */}
        <div className="p-4 border-t border-border">
          <div className="px-3 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center gap-3 mb-3 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-light dark:bg-brand/20 flex items-center justify-center text-brand-dark dark:text-brand">
                <UserIcon className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
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
        <div className="pointer-events-none absolute inset-0 -z-10 bg-background transition-colors duration-300" />

        {/* Desktop & Mobile Top Bar */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-foreground hover:bg-slate-100 dark:hover:bg-white/10 md:hidden"
            >
              {/* Hamburger Icon */}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-border bg-slate-50/80 dark:bg-white/5 p-1.5">
            {isAdmin && (
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => {
                    setShowNotifs(!showNotifs)
                    if (!showNotifs) setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  }}
                  className="p-2.5 rounded-xl text-muted-foreground hover:bg-white dark:hover:bg-slate-800 transition-colors relative group"
                >
                  <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                  )}
                </button>

                {profile?.role === 'admin' && isSupported && (
                  <button
                    onClick={handleTogglePush}
                    className={`p-2.5 rounded-xl transition-colors relative group ${subscription
                      ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      : 'text-muted-foreground hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    title={subscription ? 'Notificaciones activas' : 'Activar notificaciones push'}
                  >
                    {subscription ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </button>
                )}

                {showNotifs && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                )}
                <AnimatePresence>
                  {showNotifs && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500">Notificaciones</h3>
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                            {notifications.length}
                          </span>
                        </div>
                        <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                              <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="w-6 h-6 text-slate-200 dark:text-slate-700" />
                              </div>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin noticias</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800/30">
                              {notifications.map(n => (
                                <div key={n.id} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-default">
                                  <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110 ${n.type === 'access_denied' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:border-red-500/20' :
                                      n.type === 'fraud' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20' :
                                        'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20'
                                      }`}>
                                      {n.type === 'access_denied' ? <ShieldAlert className="w-5 h-5" /> :
                                        n.type === 'fraud' ? <AlertTriangle className="w-5 h-5" /> :
                                          <Bell className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">{n.title}</p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 font-medium">{n.description}</p>
                                      <div className="flex items-center justify-between mt-3">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {n.link && (
                                          <button
                                            onClick={() => {
                                              router.push(n.link!)
                                              setShowNotifs(false)
                                            }}
                                            className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] flex items-center gap-1.5 hover:gap-2.5 transition-all"
                                          >
                                            Ver Ficha <ArrowRight className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <div className="p-4 bg-slate-50/50 dark:bg-white/2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => {
                                const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]')
                                const newDismissed = [...new Set([...dismissed, ...notifications.map(n => n.id)])]
                                localStorage.setItem('dismissed_notifs', JSON.stringify(newDismissed))
                                setNotifications([])
                              }}
                              className="w-full py-2.5 text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
                            >
                              Limpiar Panel
                            </button>
                          </div>
                        )}
                      </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {isAdmin && <div className="w-px h-5 bg-border mx-0.5" />}
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {/* Ancho y padding únicos para toda la app — no lo dupliques en cada página */}
          <div className="max-w-[1800px] mx-auto p-6 md:p-8">
            {children}
          </div>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </main>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <ProBenefitsModal open={showProBenefits} onClose={() => setShowProBenefits(false)} />
    </div>
  )
}
