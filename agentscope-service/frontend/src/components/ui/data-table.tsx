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

import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from './tokens';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  /** 单元格渲染；未提供时回退到 row[key]。 */
  cell?: (row: T, index: number) => React.ReactNode;
  /** 提供后该列可排序。 */
  sortable?: boolean;
  /** 自定义排序比较函数，默认按字符串/数字。 */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  /** 列宽，如 '160px'、'20%'。 */
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** 行点击；提供后整行可键盘聚焦并回车触发。 */
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** 批量选择；提供后渲染首列复选框。 */
  selectedKeys?: string[];
  onSelectedKeysChange?: (keys: string[]) => void;
  /** 行级禁用（如非法流转的状态），禁用行不参与批量选择。 */
  isRowDisabled?: (row: T) => boolean;
  /** 超过该行数才启用虚拟滚动，避免小表无谓开销。 */
  virtualizeAfter?: number;
  rowHeight?: number;
  /** 可视区高度，配合虚拟滚动使用。 */
  maxHeight?: number;
  caption?: string;
  emptyState?: React.ReactNode;
  className?: string;
}

const DEFAULT_ROW_HEIGHT = 44;
const DEFAULT_VIRTUALIZE_AFTER = 200;
const OVERSCAN = 8;

function defaultSortValue<T>(row: T, key: string): string | number {
  const raw = (row as Record<string, unknown>)[key];
  if (typeof raw === 'number') return raw;
  return String(raw ?? '');
}

/** 按列定义排序；纯函数，便于单测。 */
export function sortRows<T>(rows: T[], columns: ColumnDef<T>[], sort?: SortState): T[] {
  if (!sort) return rows;
  const column = columns.find((c) => c.key === sort.key);
  if (!column) return rows;
  const read = column.sortValue ?? ((row: T) => defaultSortValue(row, sort.key));

  // 复制后排序，不修改入参（不可变原则）
  return [...rows].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), 'zh-CN');
    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

/** 计算虚拟滚动窗口；纯函数，便于单测。 */
export function virtualWindow(
  scrollTop: number,
  viewportHeight: number,
  total: number,
  rowHeight: number,
  overscan = OVERSCAN,
): { start: number; end: number; offsetY: number } {
  const visible = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(total, start + visible + overscan * 2);
  return { start, end, offsetY: start * rowHeight };
}

/**
 * 数据表格。PRD 5.1.2 点名的重型组件，能力齐备：
 * 排序 / 列宽 / 批量选择 / 行禁用 / 虚拟滚动 / 三态由外层 AsyncState 负责。
 *
 * 虚拟滚动只在行数超过 virtualizeAfter 时启用，小表走普通渲染，
 * 避免无谓的绝对定位与测量开销。
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  selectedKeys,
  onSelectedKeysChange,
  isRowDisabled,
  virtualizeAfter = DEFAULT_VIRTUALIZE_AFTER,
  rowHeight = DEFAULT_ROW_HEIGHT,
  maxHeight,
  caption,
  emptyState,
  className,
}: DataTableProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  const selectable = Boolean(selectedKeys && onSelectedKeysChange);
  const useVirtual = rows.length > virtualizeAfter && Boolean(maxHeight);

  React.useEffect(() => {
    if (!useVirtual) return;
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [useVirtual]);

  const sorted = React.useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);

  const windowRange = useVirtual
    ? virtualWindow(scrollTop, viewportHeight || rowHeight * 10, sorted.length, rowHeight)
    : { start: 0, end: sorted.length, offsetY: 0 };
  const visibleRows = useVirtual ? sorted.slice(windowRange.start, windowRange.end) : sorted;

  const selectableRows = React.useMemo(
    () =>
      sorted
        .map((row, i) => ({ row, key: rowKey(row, i) }))
        .filter(({ row }) => !isRowDisabled?.(row)),
    [sorted, rowKey, isRowDisabled],
  );
  const allSelected = selectableRows.length > 0 && selectableRows.every(({ key }) => selectedKeys?.includes(key));
  const someSelected = !allSelected && selectableRows.some(({ key }) => selectedKeys?.includes(key));

  const toggleAll = () => {
    if (!onSelectedKeysChange) return;
    onSelectedKeysChange(allSelected ? [] : selectableRows.map(({ key }) => key));
  };

  const toggleOne = (key: string) => {
    if (!onSelectedKeysChange || !selectedKeys) return;
    onSelectedKeysChange(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key],
    );
  };

  const handleSort = (column: ColumnDef<T>) => {
    if (!column.sortable || !onSortChange) return;
    const nextDirection: SortDirection =
      sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: column.key, direction: nextDirection });
  };

  const alignClass = (align?: ColumnDef<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const headerRow = (
    <tr className="border-b border-border">
      {selectable && (
        <th scope="col" className="w-10 px-3 py-2.5">
          <input
            type="checkbox"
            aria-label="Select all rows"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className={cn(
              'h-4 w-4 appearance-none rounded-[4px] border border-border-control bg-surface',
              'checked:border-primary checked:bg-primary',
              focusRing,
            )}
          />
        </th>
      )}
      {columns.map((column) => {
        const active = sort?.key === column.key;
        const SortIcon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
        return (
          <th
            key={column.key}
            scope="col"
            style={column.width ? { width: column.width } : undefined}
            aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn('px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-text-3', alignClass(column.align))}
          >
            {column.sortable && onSortChange ? (
              <button
                type="button"
                onClick={() => handleSort(column)}
                className={cn(
                  'inline-flex items-center gap-1 rounded transition-colors hover:text-text',
                  focusRing,
                )}
              >
                {column.header}
                <SortIcon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-text-4')} aria-hidden="true" />
              </button>
            ) : (
              column.header
            )}
          </th>
        );
      })}
    </tr>
  );

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)}>
      <div
        ref={scrollRef}
        onScroll={useVirtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
        className="overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
        tabIndex={0}
        role="region"
        aria-label={caption ?? 'Data table'}
      >
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10 bg-surface-2">{headerRow}</thead>
          <tbody>
            {useVirtual && windowRange.offsetY > 0 && (
              <tr aria-hidden="true" style={{ height: windowRange.offsetY }} />
            )}
            {visibleRows.map((row, i) => {
              const index = windowRange.start + i;
              const key = rowKey(row, index);
              const disabled = isRowDisabled?.(row) ?? false;
              const checked = selectedKeys?.includes(key) ?? false;

              return (
                <tr
                  key={key}
                  aria-selected={selectable ? checked : undefined}
                  aria-disabled={disabled || undefined}
                  onClick={onRowClick && !disabled ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick && !disabled
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick && !disabled ? 0 : undefined}
                  style={useVirtual ? { height: rowHeight } : undefined}
                  className={cn(
                    'border-b border-border last:border-b-0 transition-colors',
                    (onRowClick || selectable) && !disabled && 'hover:bg-hover',
                    onRowClick && !disabled && cn('cursor-pointer', focusRing),
                    disabled && 'opacity-50',
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${index + 1}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleOne(key)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'h-4 w-4 appearance-none rounded-[4px] border border-border-control bg-surface',
                          'checked:border-primary checked:bg-primary',
                          focusRing,
                        )}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-3 py-2.5 text-text-2', alignClass(column.align), column.className)}
                    >
                      {column.cell ? column.cell(row, index) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {useVirtual && (
        <div className="border-t border-border px-3 py-2 text-[12px] text-text-3 tabular-nums">
          {sorted.length} rows, rendered {windowRange.start + 1}–{windowRange.end}
        </div>
      )}
    </div>
  );
}
