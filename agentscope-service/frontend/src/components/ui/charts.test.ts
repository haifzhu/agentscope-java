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
import { donutArcPaths, linePath, normalize } from './charts';
import { solidStrokeClasses } from './charts';

describe('normalize', () => {
  it('maps value into 0..1 by min/max', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(0, 0, 10)).toBe(0);
    expect(normalize(10, 0, 10)).toBe(1);
  });

  it('falls back to 0 when span is zero or value is not finite', () => {
    expect(normalize(3, 3, 3)).toBe(0);
    expect(normalize(Number.NaN, 0, 10)).toBe(0);
  });
});

describe('linePath', () => {
  it('starts with M and draws one L per subsequent point', () => {
    const d = linePath([1, 2, 3]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('returns empty string without points', () => {
    expect(linePath([])).toBe('');
  });

  it('higher value maps to smaller y within the viewBox', () => {
    const d = linePath([0, 10], 100, 100);
    const [first, second] = d.replace('M', '').split('L');
    const y1 = Number(first.split(',')[1]);
    const y2 = Number(second.split(',')[1]);
    expect(y2).toBeLessThan(y1);
  });
});

describe('donutArcPaths', () => {
  it('returns nothing when total is zero', () => {
    expect(donutArcPaths([{ label: 'a', value: 0 }])).toEqual([]);
  });

  it('draws a full circle when a single segment covers everything', () => {
    const [arc] = donutArcPaths([{ label: 'only', value: 5 }]);
    expect(arc.ratio).toBe(1);
    expect(arc.path).toContain('a');
  });

  it('splits ratio by value share', () => {
    const arcs = donutArcPaths([
      { label: 'a', value: 3 },
      { label: 'b', value: 1 },
    ]);
    expect(arcs[0].ratio).toBeCloseTo(0.75);
    expect(arcs[1].ratio).toBeCloseTo(0.25);
  });
});

describe('solidStrokeClasses', () => {
  it('covers all chart series tones with token classes only', () => {
    for (const tone of ['primary', 'info', 'success', 'warning', 'danger', 'neutral'] as const) {
      expect(solidStrokeClasses[tone]).toMatch(/^stroke-(primary|info|success|warning|danger|text-4)$/);
    }
  });
});
