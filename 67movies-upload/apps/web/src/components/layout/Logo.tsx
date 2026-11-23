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
      className={`inline-flex items-center gap-2 group focus:outline-none ${className}`}
    >
      {/* Geometric '67' Emblem */}
      <div className="relative flex items-center justify-center">
        <svg
          viewBox="0 0 54 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-auto drop-shadow-[0_0_12px_rgba(128,101,255,0.45)]"
        >
          {/* Digit 6: geometric octagonal curve */}
          <path
            d="M20 4H7.5C5.5 4 4 5.5 4 7.5V28.5C4 30.5 5.5 32 7.5 32H18.5C20.5 32 22 30.5 22 28.5V18.5C22 16.5 20.5 15 18.5 15H5"
            stroke="url(#gradient-6)"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner ring dot of 6 */}
          <rect
            x="9.5"
            y="20.5"
            width="6.5"
            height="6.5"
            rx="1.5"
            fill="#8065FF"
          />

          {/* Digit 7: sharp modern diagonal */}
          <path
            d="M27 6.5H47L34 32"
            stroke="url(#gradient-7)"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Accent slash on 7 */}
          <line
            x1="31"
            y1="19"
            x2="43"
            y2="19"
            stroke="#A18BFF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          <defs>
            <linearGradient id="gradient-6" x1="4" y1="4" x2="22" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A18BFF" />
              <stop offset="1" stopColor="#8065FF" />
            </linearGradient>
            <linearGradient id="gradient-7" x1="27" y1="6.5" x2="47" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#A18BFF" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Word 'movies' - subtle, geometric, wide-tracked */}
      {!compact && (
        <span className="hidden sm:inline-flex items-baseline tracking-widest font-semibold text-cinema-text text-sm uppercase transition-colors group-hover:text-brand-light">
          movies
          <span className="w-1.5 h-1.5 rounded-full bg-brand-main ml-1 animate-pulse" />
        </span>
      )}
    </Link>
  );
}
