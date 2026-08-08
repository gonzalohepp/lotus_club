import type { Metadata } from "next"
import { Montserrat, Geist_Mono } from "next/font/google"
import "./globals.css"

/**
 * Montserrat es la tipografía del manual de Kuro. Se sigue exponiendo como
 * `--font-geist-sans` para no tocar el mapeo de Tailwind ni los 58 archivos
 * que ya heredan la fuente por `font-sans`.
 */
const geistSans = Montserrat({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
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
  /*
   * Pestaña y favicon de la PLATAFORMA: Kuro.
   *
   * Antes esto resolvía la marca de la organización desde `public_organizations`
   * (por eso la pestaña decía "Lotus Club" y el favicon era el loto). Se dejó
   * fijo en Kuro por pedido. Para volver a la marca por organización hay que
   * releer esa vista acá y usar `branding.display_name` / `favicon_url`.
   */
  const name = "Kuro"
  const description = "Plataforma de gestión para academias y redes de jiu-jitsu."
  const logo = "/kuro-icon.png"

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
                   /* El tema principal de Kuro es el CLARO. Antes heredaba el
                      modo oscuro del sistema operativo, así que a cualquiera con
                      el SO en oscuro la app le abría en oscuro. Ahora sólo pasa a
                      oscuro si el usuario lo eligió expresamente con el toggle. */
                   if (localStorage.getItem('theme') === 'dark') {
                     document.documentElement.classList.add('dark');
                   }
                 } catch (e) {}
               })();
             `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-kuro-500/30`}
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
