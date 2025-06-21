import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zenlit - Social Networking Platform',
  description: 'Connect with people around you',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}