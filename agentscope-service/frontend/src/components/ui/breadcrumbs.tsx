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

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: React.ReactNode;
  /** 无 href 的项渲染为纯文本（当前页）。 */
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  'aria-label'?: string;
}

/** 面包屑。最后一项为当前页，标记 aria-current="page"。 */
export function Breadcrumbs({
  items,
  className,
  'aria-label': ariaLabel = 'Breadcrumb',
}: BreadcrumbsProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-4" aria-hidden="true" />}
              {isLast || (!item.href && !item.onClick) ? (
                <span className="font-medium text-text" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  onClick={
                    item.onClick
                      ? (e) => {
                          e.preventDefault();
                          item.onClick?.();
                        }
                      : undefined
                  }
                  className={cn(
                    'rounded text-text-3 outline-none transition-colors hover:text-text',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
