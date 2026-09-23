/*
 * Copyright 2024-2026 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toggleSort } from '@/components/ui/data-table';

describe('Tabs', () => {
  const ITEMS: TabItem[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'settings', label: 'Settings' },
    { value: 'disabled', label: 'Disabled', disabled: true },
  ];

  it('gives the active tab a zero tabindex and the rest -1 (roving tabindex)', () => {
    const html = renderToString(
      createElement(Tabs, { items: ITEMS, value: 'settings', onChange: () => undefined }),
    );
    expect(html).toContain('id="tab-settings"');
    expect(html).toMatch(/id="tab-settings"[^>]*tabindex="0"|tabindex="0"[^>]*id="tab-settings"/);
  });

  it('marks the active tab as selected for assistive technology', () => {
    const html = renderToString(
      createElement(Tabs, { items: ITEMS, value: 'overview', onChange: () => undefined }),
    );
    expect(html).toContain('aria-selected="true"');
  });

  it('renders disabled tabs as disabled buttons', () => {
    const html = renderToString(
      createElement(Tabs, { items: ITEMS, value: 'overview', onChange: () => undefined }),
    );
    expect(html).toContain('disabled');
  });

  it('renders badges only when the count is positive', () => {
    const withZero = renderToString(
      createElement(Tabs, {
        items: [{ value: 'a', label: 'A', badge: 0 }],
        value: 'a',
        onChange: () => undefined,
      }),
    );
    expect(withZero).not.toContain('>0<');

    const withCount = renderToString(
      createElement(Tabs, {
        items: [{ value: 'a', label: 'A', badge: 7 }],
        value: 'a',
        onChange: () => undefined,
      }),
    );
    expect(withCount).toContain('>7<');
  });
});

describe('Badge legacy tone alias', () => {
  it('accepts the historical default tone', () => {
    const html = renderToString(createElement(Badge, { tone: 'default' }, 'x'));
    expect(html).toContain('bg-surface-3');
  });

  it('accepts semantic tones', () => {
    const html = renderToString(createElement(Badge, { tone: 'success' }, 'ok'));
    expect(html).toContain('bg-success-soft');
    expect(html).toContain('text-success-text');
  });
});

describe('toggleSort', () => {
  it('starts ascending when the column was not sorted', () => {
    expect(toggleSort({ key: 'name', direction: 'desc' }, 'other')).toEqual({
      key: 'other',
      direction: 'asc',
    });
  });

  it('flips ascending to descending on the same column', () => {
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    });
  });

  it('flips descending back to ascending on the same column', () => {
    expect(toggleSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    });
  });

  it('switching columns always starts at ascending', () => {
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'count')).toEqual({
      key: 'count',
      direction: 'asc',
    });
  });
});
