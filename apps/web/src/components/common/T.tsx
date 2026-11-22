'use client';

import React from 'react';
import { TRANSLATIONS, usePreferencesStore } from '../../stores/preferences.store';

export type TranslationKey = keyof typeof TRANSLATIONS.ru;

export function T({ k }: { k: TranslationKey }) {
  const language = usePreferencesStore((s) => s.language);
  return <>{TRANSLATIONS[language][k]}</>;
}
