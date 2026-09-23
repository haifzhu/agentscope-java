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

/** 一层钻取：显示当前层级，点击回到某一层。 */
export interface DrillLevel {
  id: string;
  label: React.ReactNode;
}

export interface DrillDownProps {
  levels: DrillLevel[];
  /** 点击已进入的层级时回调；点击最后一项不触发（当前层）。 */
  onNavigate: (level: DrillLevel, index: number) => void;
  /** 右侧操作区，如「查看原始事件」。 */
  actions?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * 执行层级钻取器（PRD 5.5 三层钻取）。
 * 层级本身就是面包屑式导航，但语义是「下钻路径」而非「站点位置」，
 * 因此独立于 Breadcrumbs，并支持任意深度。
 */
export function DrillDown({
  levels,
  onNavigate,
  actions,
  className,
  'aria-label': ariaLabel = 'Drill-down path',
}: DrillDownProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <ol className="flex flex-wrap items-center gap-1 text-[13px]">
        {levels.map((level, i) => {
          const isLast = i === levels.length - 1;
          return (
            <li key={level.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-4" aria-hidden="true" />}
              {isLast ? (
                <span className="font-medium text-text" aria-current="location">
                  {level.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(level, i)}
                  className={cn(
                    'rounded text-text-3 transition-colors hover:text-text',
                    focusRing,
                  )}
                >
                  {level.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </nav>
  );
}
