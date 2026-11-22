'use client';

import { useEffect, useRef } from 'react';
import { useUiStore } from '../stores/ui.store';

interface SpatialNavOptions {
  containerSelector?: string;
  itemSelector?: string;
  autoFocusFirst?: boolean;
}

export function useSpatialNav(options: SpatialNavOptions = {}) {
  const {
    itemSelector = '[data-nav-item="true"]',
    autoFocusFirst = false,
  } = options;

  const activeFocusId = useUiStore((state) => state.activeFocusId);
  const setActiveFocusId = useUiStore((state) => state.setActiveFocusId);
  const isNavigating = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (autoFocusFirst) {
      const firstItem = document.querySelector<HTMLElement>(itemSelector);
      if (firstItem) {
        firstItem.focus();
        setActiveFocusId(firstItem.id || 'first-nav-item');
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Spatial keys
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
      if (!keys.includes(e.key)) return;

      const items = Array.from(document.querySelectorAll<HTMLElement>(itemSelector)).filter(
        (el) => el.offsetParent !== null && !el.hasAttribute('disabled')
      );

      if (items.length === 0) return;

      const current = (document.activeElement as HTMLElement) || items[0];
      const currentIndex = items.indexOf(current);

      if (e.key === 'Enter') {
        if (current && items.includes(current)) {
          current.click();
        }
        return;
      }

      if (e.key === 'Escape') {
        window.history.back();
        return;
      }

      e.preventDefault();
      isNavigating.current = true;

      const currentRect = current.getBoundingClientRect();
      let bestItem: HTMLElement | null = null;
      let minDistance = Infinity;

      for (const item of items) {
        if (item === current) continue;
        const rect = item.getBoundingClientRect();

        let isCandidate = false;
        if (e.key === 'ArrowRight' && rect.left >= currentRect.left + 5) isCandidate = true;
        if (e.key === 'ArrowLeft' && rect.right <= currentRect.right - 5) isCandidate = true;
        if (e.key === 'ArrowDown' && rect.top >= currentRect.top + 5) isCandidate = true;
        if (e.key === 'ArrowUp' && rect.bottom <= currentRect.bottom - 5) isCandidate = true;

        if (isCandidate) {
          const dx = rect.left + rect.width / 2 - (currentRect.left + currentRect.width / 2);
          const dy = rect.top + rect.height / 2 - (currentRect.top + currentRect.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDistance) {
            minDistance = dist;
            bestItem = item;
          }
        }
      }

      // Fallback linear wrap if no 2D neighbor found in row/column
      if (!bestItem) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          bestItem = items[(currentIndex + 1) % items.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          bestItem = items[(currentIndex - 1 + items.length) % items.length];
        }
      }

      if (bestItem) {
        bestItem.focus();
        bestItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        setActiveFocusId(bestItem.id || null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemSelector, autoFocusFirst, setActiveFocusId]);

  return { activeFocusId };
}
