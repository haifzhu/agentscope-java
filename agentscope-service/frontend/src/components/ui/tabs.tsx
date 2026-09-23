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
import { cn } from '@/lib/utils';
import { toneClasses, type Tone } from './tokens';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** 角标计数；0 不渲染。 */
  badge?: number;
  badgeTone?: Tone;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * 标签页。用 role=tablist + 方向键漫游（roving tabindex），
 * 而非纯 div —— 键盘可达是组件契约第 4 条。
 */
export function Tabs({ items, value, onChange, className, 'aria-label': ariaLabel }: TabsProps) {
  const listRef = React.useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === value);
    if (idx < 0) return;

    let next: number;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else return;

    e.preventDefault();
    const target = enabled[next];
    onChange(target.value);
    // 焦点按 id 定位到目标 tab，而非按序号索引全部按钮：
    // 序号来自「已启用」子集，若与全部按钮的下标混用，
    // 中间存在禁用项时会把焦点丢到禁用按钮上（不可聚焦）。
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${CSS.escape(target.value)}`)
      ?.focus();
  };

  return (
    <div
      ref={(node) => {
        listRef.current = node;
      }}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.value}`}
            id={`tab-${item.value}`}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium',
              'border-b-2 -mb-px transition-colors duration-(--duration-fast)',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-primary text-primary-text'
                : 'border-transparent text-text-3 hover:border-border-strong hover:text-text',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums',
                  toneClasses[item.badgeTone ?? 'neutral'],
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 标签页面板：与 Tabs 配对，补齐 aria-controls 关系。 */
export function TabPanel({
  value,
  activeValue,
  className,
  children,
}: {
  value: string;
  activeValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (value !== activeValue) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {children}
    </div>
  );
}
