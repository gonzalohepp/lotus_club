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
  title: {
    default: "Beleza Dojo — Panel",
    template: "%s | Beleza Dojo",
  },
  description:
    "Panel administrativo y portal de alumnos para el control de acceso del dojo.",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Fondo general suave para TODA la app */}
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          {children}
        </div>
      </body>
    </html>
  )
}
