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

export const metadata: Metadata = {
  title: "Lotus Club",
  description:
    "Sitio oficial de Lotus Club. Jiu-Jitsu, Grappling, MMA y Judo.",
  icons: {
    icon: "/logo.png", // poné logo.png en /public
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  metadataBase:
    typeof window === "undefined"
      ? new URL("http://localhost:3000")
      : undefined,
}

import { Providers } from "./providers"

// ... imports

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-red-500/30`}
        suppressHydrationWarning
      >
        <Providers>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
