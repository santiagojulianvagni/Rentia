import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Rentia — Rentabilidad real para tu e-commerce',
  description: 'Conectá tus ventas, costos y publicidad para conocer la ganancia real de tu tienda.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Rentia — Rentabilidad real para tu e-commerce',
    description: 'Conectá tus ventas, costos y publicidad para conocer la ganancia real de tu tienda.',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: 'Rentia — La rentabilidad real de tu e-commerce' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rentia — Rentabilidad real para tu e-commerce',
    description: 'Conectá tus ventas, costos y publicidad para conocer la ganancia real de tu tienda.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Rentia's own pages, so every Clerk flow (Google, email links) returns here. */}
        <ClerkProvider localization={esES} signInUrl="/ingresar" signUpUrl="/registro" signInFallbackRedirectUrl="/onboarding" signUpFallbackRedirectUrl="/onboarding">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
