import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

/**
 * Título, descripción y favicon salen de la marca configurada, no de constantes.
 *
 * Corre SIN SESIÓN (es la landing pública), así que lee `public_organizations`
 * — una vista que expone sólo nombre, slug y branding, sin plan ni features.
 *
 * `NEXT_PUBLIC_LANDING_ORG` define de qué marca es esta landing. Sin esa
 * variable se toma la primera organización activa, que es lo correcto mientras
 * haya una sola.
 */
export async function generateMetadata(): Promise<Metadata> {
  const fallback = {
    name: "Dojo Access",
    description: "Gestión y control de acceso para academias de artes marciales.",
    logo: "/logo.png",
  }

  let name = fallback.name
  let description = fallback.description
  let logo = fallback.logo

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let query = supabase.from("public_organizations").select("name, branding").limit(1)
    const slug = process.env.NEXT_PUBLIC_LANDING_ORG
    if (slug) query = query.eq("slug", slug)

    const { data } = await query.maybeSingle()

    if (data) {
      const branding = (data.branding ?? {}) as {
        display_name?: string
        logo_url?: string
        favicon_url?: string
        description?: string
      }
      name = branding.display_name || data.name || fallback.name
      description = branding.description || fallback.description
      logo = branding.favicon_url || branding.logo_url || fallback.logo
    }
  } catch (e) {
    // Un fallo acá no debe tumbar el render de la página: se cae al default.
    console.error("[metadata] no se pudo resolver la marca:", e)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"

  return {
    title: { default: name, template: `%s | ${name}` },
    description,
    icons: {
      icon: [{ url: logo }, { url: logo, sizes: "32x32", type: "image/png" }],
      shortcut: logo,
      apple: [{ url: logo, sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.json",
    metadataBase: new URL(siteUrl),
  }
}

import { createClient } from "@supabase/supabase-js"

import { Providers } from "./providers"
import { getTenantContext } from "@/lib/tenant/server"

// El tenant se resuelve acá, en el servidor, y baja por contexto a todo el
// árbol de cliente. En rutas públicas (landing, login) no hay sesión y devuelve
// null, que es exactamente lo que los componentes esperan.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getTenantContext()
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        {/* ... script ... */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
               (function() {
                 try {
                   var theme = localStorage.getItem('theme');
                   var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                   if (theme === 'dark' || (!theme && supportDark)) {
                     document.documentElement.classList.add('dark');
                   }
                 } catch (e) {}
               })();
             `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-blue-500/30`}
        suppressHydrationWarning
      >
        <Providers tenant={tenant}>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
