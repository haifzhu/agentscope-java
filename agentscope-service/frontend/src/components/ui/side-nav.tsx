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
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from './tokens';

export interface NavItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** 角标计数；0 不渲染。 */
  badge?: number;
  disabled?: boolean;
}

export interface NavGroup {
  id: string;
  label?: React.ReactNode;
  items: NavItem[];
}

export interface SideNavProps {
  groups: NavGroup[];
  activeId?: string;
  onNavigate: (item: NavItem) => void;
  /** 分组不可折叠（单层导航）时传 false。 */
  collapsible?: boolean;
  defaultCollapsed?: string[];
  className?: string;
  'aria-label'?: string;
}

/**
 * 侧边导航。按分组渲染，支持角标与折叠。
 *
 * 显隐由调用方在「渲染前」过滤 —— PRD 要求无权限项不渲染而非点击后重定向，
 * 因此本组件只接收已经过滤好的 groups。
 */
export function SideNav({
  groups,
  activeId,
  onNavigate,
  collapsible = true,
  defaultCollapsed = [],
  className,
  'aria-label': ariaLabel = 'Main navigation',
}: SideNavProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(defaultCollapsed));

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav aria-label={ariaLabel} className={cn('flex flex-col gap-5', className)}>
      {groups.map((group) => {
        const isCollapsed = collapsible && collapsed.has(group.id);
        return (
          <div key={group.id} className="flex flex-col gap-1">
            {group.label && (
              <div className="flex items-center gap-1">
                {collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!isCollapsed}
                    className={cn(
                      'flex flex-1 items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-4',
                      'transition-colors hover:text-text-3',
                      focusRing,
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 transition-transform duration-(--duration-fast)',
                        !isCollapsed && 'rotate-90',
                      )}
                      aria-hidden="true"
                    />
                    {group.label}
                  </button>
                ) : (
                  <span className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-4">
                    {group.label}
                  </span>
                )}
              </div>
            )}

            {!isCollapsed && (
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={item.disabled}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onNavigate(item)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          active
                            ? 'bg-primary-soft font-medium text-primary-text'
                            : 'text-text-2 hover:bg-hover hover:text-text',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          focusRing,
                        )}
                      >
                        {item.icon && (
                          <span className="shrink-0 text-current" aria-hidden="true">
                            {item.icon}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-text-2">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
