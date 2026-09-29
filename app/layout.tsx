import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RailSync | Modern Rail Intelligence & Fleet Telemetry',
  description:
    'Mission-critical rail operations, real-time fleet telemetry, automated signal interlocking, and AI dispatch platform.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] text-[#131b2e] antialiased selection:bg-[#dce1ff] selection:text-[#00236f]">
        {children}
      </body>
    </html>
  )
}
