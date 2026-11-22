'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isAuthPage = pathname === '/auth';

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken && !isAuthPage) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, isAuthPage, router]);

  // Wait for client hydration before revealing protected pages
  if (!hydrated && !isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-[#09090D] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl brand-logo-badge flex items-center justify-center text-lg font-black text-white animate-pulse">
          67
        </div>
        <div className="w-7 h-7 border-2 border-[#8065FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Block flash of content while redirecting unauthenticated visitor to /auth
  if (!accessToken && !isAuthPage) {
    return null;
  }

  if (isAuthPage) {
    return <main className="flex-1 min-h-screen">{children}</main>;
  }

  return <main className="flex-1 md:pl-16 pb-20 md:pb-0">{children}</main>;
}
