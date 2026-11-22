'use client';

import { useEffect } from 'react';
import { usePreferencesStore } from '../../stores/preferences.store';

export function ThemeInitializer() {
  const hydrate = usePreferencesStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
