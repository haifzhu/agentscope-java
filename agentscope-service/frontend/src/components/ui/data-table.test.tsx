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
import { sortRows, virtualWindow, type ColumnDef } from '@/components/ui/data-table';

interface Row {
  name: string;
  count: number;
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'count', header: 'Count', sortable: true, sortValue: (r) => r.count },
];

describe('sortRows', () => {
  it('returns the same array instance when no sort is given', () => {
    const rows: Row[] = [{ name: 'b', count: 2 }];
    expect(sortRows(rows, COLUMNS, undefined)).toBe(rows);
  });

  it('sorts numerically when the column resolves to numbers', () => {
    const rows: Row[] = [
      { name: 'a', count: 300 },
      { name: 'b', count: 20 },
      { name: 'c', count: 1000 },
    ];

    const asc = sortRows(rows, COLUMNS, { key: 'count', direction: 'asc' });
    expect(asc.map((r) => r.count)).toEqual([20, 300, 1000]);

    const desc = sortRows(rows, COLUMNS, { key: 'count', direction: 'desc' });
    expect(desc.map((r) => r.count)).toEqual([1000, 300, 20]);
  });

  it('does not mutate the input array', () => {
    const rows: Row[] = [
      { name: 'b', count: 2 },
      { name: 'a', count: 1 },
    ];
    const snapshot = rows.map((r) => r.name);

    sortRows(rows, COLUMNS, { key: 'name', direction: 'asc' });

    expect(rows.map((r) => r.name)).toEqual(snapshot);
  });

  it('returns rows unchanged for an unknown sort key', () => {
    const rows: Row[] = [{ name: 'b', count: 2 }];
    expect(sortRows(rows, COLUMNS, { key: 'missing', direction: 'asc' })).toBe(rows);
  });
});

describe('virtualWindow', () => {
  const ROW_HEIGHT = 40;

  it('starts at the top with no scroll offset', () => {
    const { start, offsetY } = virtualWindow(0, 400, 1000, ROW_HEIGHT, 8);
    expect(start).toBe(0);
    expect(offsetY).toBe(0);
  });

  it('never returns a negative start', () => {
    const { start } = virtualWindow(-500, 400, 1000, ROW_HEIGHT, 8);
    expect(start).toBe(0);
  });

  it('clamps the end to the total row count', () => {
    const { end } = virtualWindow(999_999, 400, 50, ROW_HEIGHT, 8);
    expect(end).toBe(50);
  });

  it('keeps the window bounded regardless of scroll position', () => {
    const { start, end } = virtualWindow(20_000, 400, 100_000, ROW_HEIGHT, 8);
    expect(end - start).toBeLessThan(50);
  });

  it('offsets rendered rows by the window start', () => {
    const scrollTop = 4000; // row 100
    const { start, offsetY } = virtualWindow(scrollTop, 400, 1000, ROW_HEIGHT, 8);
    expect(offsetY).toBe(start * ROW_HEIGHT);
  });
});
