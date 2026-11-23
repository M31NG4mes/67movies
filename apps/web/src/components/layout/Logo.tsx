'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className = '' }: LogoProps) {
  return (
    <Link
      href="/"
      data-nav-item="true"
      aria-label="67movies главная"
      className={`inline-flex items-center gap-2.5 group focus:outline-none ${className}`}
    >
      {/* Sleek Cinema '67' Emblem synced with active theme accent */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl brand-logo-badge transition-transform duration-300 group-hover:scale-105 group-active:scale-95 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/25 pointer-events-none" />
        <svg
          viewBox="0 0 40 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 h-5 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        >
          {/* Digit 6 */}
          <path
            d="M16 4.5H9.2C6.8 4.5 5 6.3 5 8.7V19.3C5 21.7 6.8 23.5 9.2 23.5H15C17.2 23.5 18.8 21.9 18.8 19.7V15.5C18.8 13.5 17.2 12 15 12H5.5"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Digit 7 */}
          <path
            d="M22.5 5.2H35.5L26.5 23.5"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="25.5"
            y1="14"
            x2="33.5"
            y2="14"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {!compact && (
        <span className="hidden sm:inline-flex items-baseline tracking-[0.18em] font-black text-cinema-text text-sm uppercase transition-colors group-hover:text-brand-light">
          movies
          <span
            className="w-1.5 h-1.5 rounded-full ml-1.5 animate-pulse"
            style={{ backgroundColor: 'var(--brand-main)' }}
          />
        </span>
      )}
    </Link>
  );
}
