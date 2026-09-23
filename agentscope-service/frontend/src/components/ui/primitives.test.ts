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
import { paginationRange } from '@/components/ui/pagination';
import { trendPoints } from '@/components/ui/metric-card';
import { avatarInitials } from '@/components/ui/avatar';
import { pressureTone } from '@/components/PressureGauge';

describe('paginationRange', () => {
  it('lists every page when they all fit', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps first, last, and the current neighbourhood', () => {
    expect(paginationRange(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
  });

  it('does not emit a leading gap when the current page is near the start', () => {
    expect(paginationRange(2, 20)).toEqual([1, 2, 3, 'gap', 20]);
  });

  it('does not emit a trailing gap when the current page is near the end', () => {
    expect(paginationRange(19, 20)).toEqual([1, 'gap', 18, 19, 20]);
  });
});

describe('trendPoints', () => {
  it('returns empty for fewer than two points', () => {
    expect(trendPoints([])).toBe('');
    expect(trendPoints([5])).toBe('');
  });

  it('maps the series across the full width and height', () => {
    expect(trendPoints([0, 10])).toBe('0.0,28.0 88.0,0.0');
  });

  it('draws a flat series at the bottom rather than dividing by zero', () => {
    // 全等值域 span=0，必须回退为 1，否则会出现 NaN 坐标
    const points = trendPoints([5, 5, 5]);
    expect(points).not.toContain('NaN');
    expect(points.split(' ')).toHaveLength(3);
  });
});

describe('avatarInitials', () => {
  it('uses the first character for CJK names', () => {
    expect(avatarInitials('张伟')).toBe('张');
  });

  it('uses both initials for multi-word latin names', () => {
    expect(avatarInitials('Ada Lovelace')).toBe('AL');
  });

  it('falls back to a placeholder for blank names', () => {
    expect(avatarInitials('   ')).toBe('?');
  });
});

describe('pressureTone', () => {
  it('is success below the warning threshold', () => {
    expect(pressureTone(0)).toBe('success');
    expect(pressureTone(0.69)).toBe('success');
  });

  it('is warning from the warning threshold up to critical', () => {
    expect(pressureTone(0.7)).toBe('warning');
    expect(pressureTone(0.84)).toBe('warning');
  });

  it('is danger at and above the critical threshold', () => {
    expect(pressureTone(0.85)).toBe('danger');
    expect(pressureTone(1)).toBe('danger');
  });
});
