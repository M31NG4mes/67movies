import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { Navbar } from '../components/layout/Navbar';
import { ThemeInitializer } from '../components/layout/ThemeInitializer';
import { NewYearOverlay } from '../components/layout/NewYearOverlay';
import { AuthGate } from '../components/layout/AuthGate';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: '67movies — Премиальный онлайн-кинотеатр',
  description:
    '67movies — оригинальный кинотеатр с каталогом фильмов и сериалов TMDB в тёмном кинематографичном стиле.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-[#09090D] text-white min-h-screen flex flex-col antialiased selection:bg-[#8065FF] selection:text-white overflow-x-hidden">
        <ThemeInitializer />
        <NewYearOverlay />
        <AuthGate>
          <Navbar />
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
