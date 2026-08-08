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
  ShieldCheck,
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
import { type FeatureKey } from '@/lib/features'
import { type Capability } from '@/lib/tenant/types'
import { useTenant } from '@/lib/tenant/context'
import DojoSwitcher from '@/components/tenant/DojoSwitcher'
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

/** Interruptor del badge "Sos Plan Pro" del sidebar. Ver uso más abajo. */
const SHOW_PRO_BADGE = false

const NAV_ITEMS: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: string[]
  feature?: FeatureKey
  /**
   * Capacidad requerida por ROL (distinto de `feature`, que depende del PLAN).
   * "Academias" es de la marca: el administrador de una sucursal no da de alta
   * sedes, eso lo hace el superadmin de la organización.
   */
  capability?: Capability
}[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/qr', label: 'QR de Acceso', icon: QrCode, roles: ['admin', 'instructor'], feature: 'qr' },
  { href: '/validate', label: 'Validar Acceso', icon: QrCode, roles: ['admin', 'instructor', 'becado', 'member'] },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon, roles: ['admin', 'instructor', 'becado', 'member'] },
  { href: '/members', label: 'Miembros', icon: Users, roles: ['admin'], feature: 'members' },
  { href: '/admin/academies', label: 'Academias', icon: Building2, roles: ['admin'], feature: 'dojos', capability: 'viewDojos' },
  { href: '/classes', label: 'Clases', icon: GraduationCap, roles: ['admin'], feature: 'classes' },
  // Pagos y Métricas muestran plata: van con `viewFinance`, que deja afuera
  // al head coach (ve todas las sedes y alumnos, pero no finanzas).
  { href: '/payments', label: 'Pagos', icon: DollarSign, roles: ['admin'], feature: 'payments', capability: 'viewFinance' },
  { href: '/metricas', label: 'Metricas', icon: ChartLine, roles: ['admin'], feature: 'metrics', capability: 'viewFinance' },
  { href: '/reportes', label: 'Reportes', icon: ClipboardList, roles: ['admin'], feature: 'reports' },
  // El instructor veía quién entrenaba EN ESE MOMENTO, pero no el historial de
  // sus propias clases: eso vivía en /reportes, que es sólo de admin.
  { href: '/mis-clases', label: 'Mis Clases', icon: GraduationCap, roles: ['admin', 'instructor'] },
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

  // Tenant activo: de acá salen el rol (POR DOJO, no global), el plan de la
  // organización y las features habilitadas.
  const tenant = useTenant()
  const { can, allows, org, activeDojo, isPlatformAdmin, orgRole, branding } = tenant

  // El rol sale de la sede activa. Sin fallback a `profiles.role`: ese es el rol
  // global heredado del sistema single-tenant y hoy dice 'member' para casi
  // todos, incluido el desarrollador.
  //
  // Se declaran acá arriba —y no más abajo, junto al resto de los derivados—
  // porque el effect de alertas de seguridad los usa, y tenerlos después dejaba
  // una referencia en zona muerta temporal que funcionaba de casualidad.
  const role = tenant.role ?? 'member'
  const isAdmin = role === 'admin' || role === 'instructor'

  // Nombre de marca: el display_name configurado, o el de la organización.
  // Se parte en dos para conservar el efecto de la última palabra en color,
  // que es como venía el logo original ("Beleza *Dojo*").
  const brandName = branding.display_name || org?.name || 'Dojo Access'
  const brandWords = (() => {
    const parts = brandName.trim().split(/\s+/)
    return parts.length > 1
      ? { head: parts.slice(0, -1).join(' '), tail: parts[parts.length - 1] }
      : { head: brandName, tail: '' }
  })()

  // Etiqueta de nivel de acceso para el bloque de usuario del sidebar.
  const accessLevel = isPlatformAdmin
    ? { label: 'Desarrollador', className: 'bg-kuro-400/20 text-kuro-600 dark:text-kuro-400' }
    : orgRole === 'superadmin'
      ? { label: 'Superadmin', className: 'bg-warn-400/20 text-warn-600 dark:text-warn-400' }
      : orgRole === 'manager'
        ? { label: 'Staff de marca', className: 'bg-warn-400/15 text-warn-600 dark:text-warn-400' }
        : null
  const plan = org?.plan ?? 'basic'

  const { isSupported, subscription, subscribeUser, unsubscribeUser } = usePushNotifications()
  // Sin fallback hardcodeado a propósito: acá había una clave VAPID de otro
  // proyecto. Con ella, el navegador se suscribía usando ese par de claves y la
  // suscripción quedaba guardada en la base sin servir para nada, porque la
  // privada de esta instancia no coincide. Si no hay clave configurada, las
  // notificaciones simplemente no se ofrecen.
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const pushDisponible = isSupported && !!VAPID_PUBLIC_KEY

  const handleTogglePush = async () => {
    if (subscription) {
      const success = await unsubscribeUser()
      if (success) toast.info('Notificaciones desactivadas')
    } else {
      const sub = await subscribeUser(VAPID_PUBLIC_KEY!)
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
        if ('Notification' in window && pushDisponible) {
          if (Notification.permission === 'granted') {
            // Subscription synced
            subscribeUser(VAPID_PUBLIC_KEY!).catch(err =>
              console.error('[Push] Silent sync failed:', err)
            )
          } else if (Notification.permission === 'default') {
            // Pedimos el permiso una sola vez por usuario: si lo ignora o lo
            // rechaza, no lo volvemos a molestar automáticamente (queda el
            // toggle manual en el header para activarlo cuando quiera).
            const promptedKey = `push_prompted_${user.id}`
            if (!localStorage.getItem(promptedKey)) {
              localStorage.setItem(promptedKey, '1')
              toast('¿Querés recibir notificaciones push?', {
                description: 'Te avisamos de novedades importantes al instante.',
                duration: 15000,
                action: {
                  label: 'Activar',
                  onClick: () => {
                    subscribeUser(VAPID_PUBLIC_KEY!).then(sub => {
                      if (sub) toast.success('¡Notificaciones activadas!')
                    }).catch(err => console.error('[Push] Prompted subscribe failed:', err))
                  }
                }
              })
            }
          }
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
  }, [router, VAPID_PUBLIC_KEY, pushDisponible, subscribeUser])

  // ========= Real-time Security Alerts =========
  useEffect(() => {
    // El rol viene de la sede activa, no del global heredado: un admin de sede
    // cuyo `profiles.role` quedó en 'member' —el caso normal ahora— no recibía
    // las alertas de acceso denegado de su propio dojo.
    if (!profile || !isAdmin) return

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
              icon: <ShieldAlert className="w-5 h-5 text-alert-500" />
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
                  icon: <AlertTriangle className="w-5 h-5 text-warn-500" />
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
  const nav = useMemo(
    () => NAV_ITEMS.filter(item =>
      item.roles.includes(role)
      && (!item.feature || can(item.feature))
      && (!item.capability || allows(item.capability))
    ),
    [role, can, allows]
  )

  // Optimized Route protection
  useEffect(() => {
    if (loading || !profile) return

    const currentPath = pathname
    // Public or special paths
    if (currentPath === '/login' || currentPath === '/auth/callback') return

    const userRole = role
    // Ordenado por especificidad (href más largo primero) para que, por ej.,
    // /admin/academies matchee su propia entrada (y su feature gate) en vez
    // de caer en el prefijo más corto de /admin (el dashboard, sin gate).
    const matchingItem = [...NAV_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find(item => currentPath === item.href || currentPath.startsWith(item.href + '/'))
    const allowed = !!matchingItem
      && matchingItem.roles.includes(userRole)
      && (!matchingItem.feature || can(matchingItem.feature))
      && (!matchingItem.capability || allows(matchingItem.capability))

    if (!allowed && currentPath !== '/validate') {
      const defaultPath = userRole === 'admin' ? '/admin' : '/profile'
      // Only replace if we are not already at the default path to prevent loops
      if (currentPath !== defaultPath) {
        router.replace(defaultPath)
      }
    }
  }, [pathname, loading, profile, router, role, can, allows])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            {/* Marca de la plataforma, no de la organización: la carga es de
                Kuro y todavía no hay tenant resuelto. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kuro-icon.png"
              alt="Kuro"
              className="w-20 h-20 rounded-2xl object-contain animate-pulse"
            />
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
      {/* El sidebar es SIEMPRE oscuro, en tema claro y en oscuro, como la
          maqueta del manual: panel negro con los ítems enmarcados. Por eso acá
          los colores van explícitos y no por tokens de tema. */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-[#121113] border-r border-white/10 flex flex-col transition-transform duration-300 md:translate-x-0 md:sticky md:top-0 md:h-screen
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Header — marca de la plataforma (Kuro), no de la organización: el
            nombre de la sede ya está en el selector de la barra superior. */}
        <div className="border-b border-white/10 p-6 flex items-center justify-between">
          <div>
            {/* Sólo el wordmark: el ícono al lado repetía la misma marca. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kuro-wordmark.png" alt="Kuro" className="h-9 w-auto" />
            <p className="mt-2 text-[10px] text-[#A7ACA2] font-bold uppercase tracking-widest">
              {role === 'admin' ? 'Admin Panel' : role === 'instructor' ? 'Instructor Panel' : 'Portal de Alumno'}
            </p>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-[#A7ACA2] hover:bg-white/5"
          >
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </div>

        {/* Menu */}
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="text-[10px] font-black text-[#A7ACA2] uppercase tracking-[0.2em] px-3 py-4">
            {isAdmin ? 'Principal' : 'Menú'}
          </div>
          <nav className="space-y-2">
            {nav.map((item) => {
              const isActive = active === item.href || pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)} // Close on navigate
                  className={[
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-200 group',
                    isActive
                      ? 'bg-[#899878] border-[#899878] text-[#121113] font-bold'
                      : 'border-white/12 text-[#D8DDD5] hover:border-[#899878]/60 hover:bg-white/5',
                  ].join(' ')}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-[#121113]' : 'text-[#A7ACA2] group-hover:text-[#899878]'}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Consola de plataforma — sólo el desarrollador. El superadmin de una
            marca administra sus sedes desde "Academias", pero nunca ve esto:
            acá se listan las demás organizaciones y sus planes. */}
        {isPlatformAdmin && (
          <div className="px-4 pb-3">
            <Link
              href="/superadmin"
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-warn-500/40 bg-warn-500/10 text-warn-400 font-black uppercase tracking-widest text-[11px] transition-colors hover:bg-warn-500/20"
            >
              <ShieldAlert className="w-4 h-4" />
              Consola de plataforma
            </Link>
          </div>
        )}

        {/* Upgrade CTA (solo plan Basic) */}
        {plan === 'basic' && role === 'admin' && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowUpgrade(true)}
              className="group relative w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[#899878] text-[#121113] font-black uppercase tracking-widest text-[11px] overflow-hidden transition-transform active:scale-95 hover:brightness-110"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent shine-sweep" />
              <Sparkles className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Actualizar a Pro</span>
            </button>
          </div>
        )}

        {/* Badge de plan Pro (solo organizaciones Pro).
            Oculto por pedido. Poner SHOW_PRO_BADGE en true lo revive: el
            ProBenefitsModal sigue cableado, no hace falta tocar nada más. */}
        {SHOW_PRO_BADGE && plan === 'pro' && role === 'admin' && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowProBenefits(true)}
              /* Era un degradado dorado con brillo animado: el dorado no existe
                 en la paleta de Kuro y era lo más ruidoso de la pantalla. Pasa a
                 un badge sobrio con el acento de marca. */
              className="group relative w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-[#899878]/50 bg-[#899878]/12 text-[#D8DDD5] font-black uppercase tracking-widest text-[11px] transition-colors hover:bg-[#899878]/22"
            >
              <Crown className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Sos Plan Pro</span>
            </button>
          </div>
        )}

        {/* Footer profile section */}
        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-3 bg-white/5 rounded-2xl flex items-center gap-3 mb-3 border border-white/10">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-white/15" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#899878]/20 flex items-center justify-center text-[#899878]">
                <UserIcon className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#F7F7F2] truncate">{displayName}</p>
              <p className="text-[10px] text-[#A7ACA2] truncate leading-none">{profile?.email}</p>
              {/* Nivel de acceso. Sin esto no hay forma de saber, mirando la
                  pantalla, si estás viendo una sede porque sos su admin o
                  porque tu rol te da acceso a todas. */}
              {accessLevel && (
                <span className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${accessLevel.className}`}>
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {accessLevel.label}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            className="group w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-white/12 text-xs font-black uppercase tracking-widest text-[#A7ACA2] hover:bg-alert-500/15 hover:text-alert-400 hover:border-alert-500/40 transition-all duration-200"
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
        <header className="bg-white/80 dark:bg-carbon-900/80 backdrop-blur-xl border-b border-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-foreground hover:bg-carbon-100 dark:hover:bg-white/10 md:hidden"
            >
              {/* Hamburger Icon */}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Sede activa: todo lo que se ve abajo está filtrado por este dojo */}
            <DojoSwitcher />
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-border bg-carbon-50/80 dark:bg-white/5 p-1.5">
            {isAdmin && (
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => {
                    setShowNotifs(!showNotifs)
                    if (!showNotifs) setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  }}
                  className="p-2.5 rounded-xl text-muted-foreground hover:bg-white dark:hover:bg-carbon-800 transition-colors relative group"
                >
                  <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-alert-500 rounded-full border-2 border-white dark:border-carbon-900 animate-pulse" />
                  )}
                </button>

                {showNotifs && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                )}
                <AnimatePresence>
                  {showNotifs && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-carbon-950 border border-carbon-200 dark:border-carbon-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-5 border-b border-carbon-100 dark:border-carbon-800 flex items-center justify-between">
                          <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-carbon-500">Notificaciones</h3>
                          <span className="text-[10px] font-bold text-kuro-500 bg-kuro-50 dark:bg-kuro-500/10 px-2 py-0.5 rounded-full">
                            {notifications.length}
                          </span>
                        </div>
                        <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                              <div className="w-12 h-12 bg-carbon-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="w-6 h-6 text-carbon-200 dark:text-carbon-700" />
                              </div>
                              <p className="text-xs text-carbon-400 font-bold uppercase tracking-widest">Sin noticias</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-carbon-50 dark:divide-carbon-800/30">
                              {notifications.map(n => (
                                <div key={n.id} className="p-5 hover:bg-carbon-50 dark:hover:bg-white/5 transition-colors group cursor-default">
                                  <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110 ${n.type === 'access_denied' ? 'bg-alert-50 text-alert-600 border-alert-100 dark:bg-alert-500/10 dark:border-alert-500/20' :
                                      n.type === 'fraud' ? 'bg-warn-50 text-warn-600 border-warn-100 dark:bg-warn-500/10 dark:border-warn-500/20' :
                                        'bg-kuro-50 text-kuro-600 border-kuro-100 dark:bg-kuro-500/10 dark:border-kuro-500/20'
                                      }`}>
                                      {n.type === 'access_denied' ? <ShieldAlert className="w-5 h-5" /> :
                                        n.type === 'fraud' ? <AlertTriangle className="w-5 h-5" /> :
                                          <Bell className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-carbon-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">{n.title}</p>
                                      <p className="text-[11px] text-carbon-500 dark:text-carbon-400 leading-relaxed line-clamp-2 font-medium">{n.description}</p>
                                      <div className="flex items-center justify-between mt-3">
                                        <p className="text-[10px] text-carbon-400 font-bold uppercase tracking-widest">
                                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {n.link && (
                                          <button
                                            onClick={() => {
                                              router.push(n.link!)
                                              setShowNotifs(false)
                                            }}
                                            className="text-[10px] font-black text-kuro-600 dark:text-kuro-400 uppercase tracking-[0.15em] flex items-center gap-1.5 hover:gap-2.5 transition-all"
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
                          <div className="p-4 bg-carbon-50/50 dark:bg-white/2 border-t border-carbon-100 dark:border-carbon-800">
                            <button
                              onClick={() => {
                                const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]')
                                const newDismissed = [...new Set([...dismissed, ...notifications.map(n => n.id)])]
                                localStorage.setItem('dismissed_notifs', JSON.stringify(newDismissed))
                                setNotifications([])
                              }}
                              className="w-full py-2.5 text-[10px] font-black text-carbon-400 hover:text-alert-500 uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
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
            {pushDisponible && (
              <button
                onClick={handleTogglePush}
                className={`p-2.5 rounded-xl transition-colors relative group ${subscription
                  ? 'text-kuro-500 hover:bg-kuro-50 dark:hover:bg-kuro-500/10'
                  : 'text-muted-foreground hover:bg-white dark:hover:bg-carbon-800'
                  }`}
                title={subscription ? 'Notificaciones activas' : 'Activar notificaciones push'}
              >
                {subscription ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </button>
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
