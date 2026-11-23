import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { Navbar } from '../components/layout/Navbar';
import { ThemeInitializer } from '../components/layout/ThemeInitializer';
import { NewYearOverlay } from '../components/layout/NewYearOverlay';
import { AuthGate } from '../components/layout/AuthGate';
import { FriendRequestNotifier } from '../components/layout/FriendRequestNotifier';

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
    <html lang="ru" className="dark overflow-x-hidden max-w-full">
      <body className="bg-[#09090D] text-white min-h-screen w-full max-w-full flex flex-col antialiased selection:bg-[#8065FF] selection:text-white overflow-x-hidden">
        <ThemeInitializer />
        <NewYearOverlay />
        <AuthGate>
          <Navbar />
          <FriendRequestNotifier />
          <div className="w-full max-w-full min-w-0 overflow-x-clip flex-1 flex flex-col">
            {children}
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
