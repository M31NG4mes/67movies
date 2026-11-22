'use client';

import React from 'react';
import { usePreferencesStore } from '../../stores/preferences.store';

const SNOWFLAKES_BG = Array.from({ length: 24 }, (_, i) => ({
  id: `bg-${i}`,
  left: `${(i * 4.2 + (i % 3) * 1.1) % 100}%`,
  size: 2.5 + (i % 3) * 1.5,
  delay: `${-(i * 0.9)}s`,
  duration: `${10 + (i % 5) * 2.5}s`,
  opacity: 0.22 + (i % 4) * 0.12,
}));

const SNOWFLAKES_FG = Array.from({ length: 14 }, (_, i) => ({
  id: `fg-${i}`,
  left: `${(i * 7.3 + 2) % 98}%`,
  size: 6 + (i % 3) * 2.5,
  delay: `${-(i * 1.15)}s`,
  duration: `${6.5 + (i % 4) * 1.8}s`,
  opacity: 0.45 + (i % 3) * 0.15,
}));

const BULB_COLORS = ['#FACC15', '#38BDF8', '#F43F5E', '#34D399', '#C084FC', '#FB923C'];

export function NewYearOverlay() {
  const newYearMode = usePreferencesStore((s) => s.newYearMode);

  if (!newYearMode) return null;

  return (
    <>
      {/* Soft Icy Frost Glow along Top Edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 md:left-16 right-0 z-30 h-24"
        style={{
          background:
            'linear-gradient(180deg, rgba(125, 211, 252, 0.14) 0%, rgba(125, 211, 252, 0) 100%)',
        }}
      />

      {/* Curved SVG Festive String Garland with Glowing Bulbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 md:left-16 right-0 z-40 h-11 overflow-hidden"
      >
        <svg
          className="w-full h-7 opacity-40"
          preserveAspectRatio="none"
          viewBox="0 0 1200 28"
          fill="none"
        >
          <path
            d="M0,4 Q100,24 200,4 T400,4 T600,4 T800,4 T1000,4 T1200,4"
            stroke="rgba(226,232,240,0.45)"
            strokeWidth="1.5"
          />
        </svg>

        <div className="absolute top-0 inset-x-0 flex items-start justify-around px-3">
          {Array.from({ length: 20 }, (_, i) => {
            const color = BULB_COLORS[i % BULB_COLORS.length];
            const dip = i % 2 === 0 ? 'mt-2' : 'mt-4';
            return (
              <span
                key={i}
                className={`relative ${dip} w-2 h-3 rounded-b-full rounded-t-sm animate-twinkle`}
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 12px 3px ${color}`,
                  animationDelay: `${(i % 6) * 0.4}s`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Multi-layer Parallax Snowfall (background fine flakes + soft foreground flakes) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      >
        {SNOWFLAKES_BG.map((f) => (
          <span
            key={f.id}
            className="absolute -top-4 rounded-full bg-white animate-snowfall"
            style={{
              left: f.left,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.opacity,
              animationDelay: f.delay,
              animationDuration: f.duration,
            }}
          />
        ))}
        {SNOWFLAKES_FG.map((f) => (
          <span
            key={f.id}
            className="absolute -top-6 rounded-full bg-sky-100 animate-snowfall blur-[0.7px]"
            style={{
              left: f.left,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.opacity,
              animationDelay: f.delay,
              animationDuration: f.duration,
              boxShadow: '0 0 10px rgba(186, 230, 253, 0.85)',
            }}
          />
        ))}
      </div>
    </>
  );
}
