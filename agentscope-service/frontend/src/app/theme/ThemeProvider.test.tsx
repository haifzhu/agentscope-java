/*
 * Copyright 2024-2026 the original author or authors.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it } from 'vitest';
import { resolveInitialTheme, THEME_STORAGE_KEY, toggle } from './ThemeProvider';

describe('theme logic', () => {
  it('resolves dark when the anti-FOUC script pre-set the dark class', () => {
    expect(resolveInitialTheme(true)).toBe('dark');
  });

  it('defaults to light without the dark class', () => {
    expect(resolveInitialTheme(false)).toBe('light');
  });

  it('toggles between light and dark', () => {
    expect(toggle('light')).toBe('dark');
    expect(toggle('dark')).toBe('light');
  });

  it('uses the storage key the index.html boot script reads', () => {
    expect(THEME_STORAGE_KEY).toBe('ags-theme');
  });
});
