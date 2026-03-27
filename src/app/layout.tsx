import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alegra Talent Bot',
  description: 'Evaluación de candidatos para Alegra',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
