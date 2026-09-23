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
import { DataTable, type ColumnDef } from '@/components/ui/data-table';

/**
 * 回归测试：sortable 列必须渲染为可交互的按钮。
 *
 * 背景：早期实现只在提供了 onSortChange 时才渲染排序按钮，导致
 * 只写 `sortable: true` 的列表面看似可排序、实际完全不可点击，
 * 是一个静默失效（浏览器实测发现表头是纯文本、无 button 元素）。
 * 组件现在同时支持受控与非受控排序，两种情况下都必须可交互。
 */

interface Row {
  name: string;
  count: number;
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'count', header: 'Count', sortable: true, sortValue: (r) => r.count },
  { key: 'plain', header: 'Plain' },
];

const ROWS: Row[] = [
  { name: 'b', count: 2 },
  { name: 'a', count: 1 },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return renderToString(
    createElement(DataTable<Row>, {
      columns: COLUMNS,
      rows: ROWS,
      rowKey: (r: Row) => r.name,
      ...props,
    }),
  );
}

describe('DataTable sorting', () => {
  it('renders a sort control for sortable columns without onSortChange', () => {
    const html = renderTable();
    // 两个 sortable 列 → 两个可点击按钮
    expect(html.match(/<button/g)?.length).toBe(2);
  });

  it('still renders sort controls when sorting is controlled', () => {
    const html = renderTable({ sort: { key: 'name', direction: 'asc' }, onSortChange: () => undefined });
    expect(html.match(/<button/g)?.length).toBe(2);
  });

  it('renders no sort control for non-sortable columns', () => {
    const html = renderTable({
      columns: [{ key: 'plain', header: 'Plain' }],
    });
    expect(html).not.toContain('<button');
  });

  it('marks the active sort column for assistive technology', () => {
    const html = renderTable({ sort: { key: 'count', direction: 'desc' }, onSortChange: () => undefined });
    expect(html).toContain('aria-sort="descending"');
  });
});

describe('DataTable empty and selection states', () => {
  it('renders the provided empty state when there are no rows', () => {
    const html = renderTable({ rows: [], emptyState: createElement('p', null, 'Nothing here') });
    expect(html).toContain('Nothing here');
    expect(html).not.toContain('<table');
  });

  it('renders row selection checkboxes with an accessible name', () => {
    const html = renderTable({ selectedKeys: [], onSelectedKeysChange: () => undefined });
    expect(html).toContain('aria-label="Select all rows"');
    expect(html).toContain('aria-label="Select row 1"');
  });

  it('marks disabled rows so they can be skipped by assistive technology', () => {
    const html = renderTable({ isRowDisabled: (r: Row) => r.name === 'a' });
    expect(html).toContain('aria-disabled="true"');
  });
});
