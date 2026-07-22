import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { SupabaseSessionKeepAlive } from '@/components/SupabaseSessionKeepAlive'
import { BRAND_ASSETS } from '@/lib/brand-assets'
import { isDesktopApp } from '@/lib/runtime'
import './globals.css'

// Prevent Next.js from statically caching auth-bound responses across users.
// Required when using Supabase-authenticated pages.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: BRAND_ASSETS.appTitle,
  description: 'Create customized handwriting practice worksheets for primary school students',
  applicationName: BRAND_ASSETS.appName,
  manifest: BRAND_ASSETS.manifest,
  icons: {
    icon: [
      { url: BRAND_ASSETS.favicon, sizes: 'any' },
      { url: BRAND_ASSETS.faviconSvg, type: 'image/svg+xml' },
      { url: BRAND_ASSETS.faviconPng96, sizes: '96x96', type: 'image/png' },
    ],
    apple: BRAND_ASSETS.appleTouchIcon,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND_ASSETS.themeColor },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const desktop = isDesktopApp()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {!desktop && <SupabaseSessionKeepAlive />}
        {children}
        {!desktop && process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
