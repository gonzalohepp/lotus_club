'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { QrCode, User as UserIcon } from 'lucide-react';
import { PropsWithChildren } from 'react';

function NavItem({
  href,
  icon,
  label,
}: { href: string; icon: React.ReactNode; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition
        ${active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function UserLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[260px,1fr]">
        {/* SIDEBAR */}
        <aside className="border-r bg-white p-4 md:min-h-screen">
          <div className="flex items-center gap-3 px-2 py-3">
            {/* usa tu archivo público: /logo.jpg */}
            <Image
              src="/logo.jpg"
              alt="Beleza Dojo"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Beleza Dojo</div>
              <div className="text-xs text-slate-500">Portal de Usuario</div>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Menú
            </div>

            <NavItem
              href="/access"                 // <— tu ruta de “Validar Acceso”
              icon={<QrCode className="h-4 w-4" />}
              label="Validar Acceso"
            />
            <NavItem
              href="/mi-perfil"              // <— NUEVO: Mi Perfil en el menú
              icon={<UserIcon className="h-4 w-4" />}
              label="Mi Perfil"
            />
          </div>

          {/* Footer usuario (opcional) */}
          {/* <div className="mt-8 rounded-lg border p-3 text-xs text-slate-500">
            Usuario: nombre@correo
          </div> */}
        </aside>

        {/* CONTENIDO */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
