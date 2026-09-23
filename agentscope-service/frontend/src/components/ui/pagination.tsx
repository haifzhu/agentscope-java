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

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from './tokens';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** 分页单位，如「条」「个智能体」。 */
  unit?: string;
}

/** 生成带省略号的页码序列：始终保留首尾与当前页邻域。 */
export function paginationRange(page: number, pageCount: number, siblings = 1): (number | 'gap')[] {
  const totalSlots = siblings * 2 + 5;
  if (pageCount <= totalSlots) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, pageCount - 1);
  const showLeftGap = left > 2;
  const showRightGap = right < pageCount - 1;

  return [
    1,
    ...(showLeftGap ? (['gap'] as const) : []),
    ...Array.from({ length: right - left + 1 }, (_, i) => left + i),
    ...(showRightGap ? (['gap'] as const) : []),
    pageCount,
  ];
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
  unit = 'items',
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const range = paginationRange(current, pageCount);

  const navButton = (
    target: number,
    disabled: boolean,
    Icon: typeof ChevronLeft,
    label: string,
  ) => (
    <button
      type="button"
      onClick={() => onPageChange(target)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-2',
        'transition-colors duration-(--duration-fast) hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40',
        focusRing,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3 py-3', className)}
    >
      <p className="text-[13px] tabular-nums text-text-3">
        {total} {unit} total
        {total > 0 && ` (showing ${from}–${to})`}
      </p>

      <div className="flex items-center gap-1.5">
        {onPageSizeChange && (
          <label className="mr-2 flex items-center gap-1.5 text-[13px] text-text-3">
            Per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                'h-8 rounded-md border border-border-control bg-surface px-1.5 text-[13px] text-text',
                focusRing,
              )}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {navButton(current - 1, current <= 1, ChevronLeft, '上一页')}

        {range.map((item, i) =>
          item === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-text-4" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === current ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] tabular-nums',
                'transition-colors duration-(--duration-fast)',
                item === current
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-surface text-text-2 hover:bg-hover',
                focusRing,
              )}
            >
              {item}
            </button>
          ),
        )}

        {navButton(current + 1, current >= pageCount, ChevronRight, '下一页')}
      </div>
    </nav>
  );
}
