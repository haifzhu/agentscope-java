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

export interface TreeNode {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
  /** 叶节点右侧补充信息（状态、数量等）。 */
  meta?: React.ReactNode;
  disabled?: boolean;
}

export interface TreeProps {
  nodes: TreeNode[];
  /** 默认展开的节点 id。 */
  defaultExpanded?: string[];
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * 树形结构。用于「子工单树」「能力层级」。
 * 用 role=tree/treeitem + aria-expanded 表达层级，
 * 展开/收起是本地状态，不要求调用方托管。
 */
export function Tree({
  nodes,
  defaultExpanded = [],
  selectedId,
  onSelect,
  className,
  'aria-label': ariaLabel,
}: TreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(defaultExpanded));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNodes = (list: TreeNode[], level: number) => (
    <ul role="group" className={cn(level > 0 && 'ml-[18px] border-l border-border pl-3')}>
      {list.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = expanded.has(node.id);
        const isSelected = selectedId === node.id;

        return (
          <li key={node.id} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm transition-colors',
                isSelected ? 'bg-primary-soft text-primary-text' : 'text-text-2 hover:bg-hover',
                node.disabled && 'opacity-50',
              )}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  className={cn('rounded p-0.5 text-text-3 hover:bg-hover', focusRing)}
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-(--duration-fast)',
                      isExpanded && 'rotate-90',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="w-[18px] shrink-0" aria-hidden="true" />
              )}

              <button
                type="button"
                disabled={node.disabled}
                onClick={() => onSelect?.(node)}
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-between gap-2 rounded text-left',
                  'disabled:cursor-not-allowed',
                  focusRing,
                )}
              >
                <span className="truncate">{node.label}</span>
                {node.meta && <span className="shrink-0 text-[12px] text-text-3">{node.meta}</span>}
              </button>
            </div>

            {hasChildren && isExpanded && renderNodes(node.children!, level + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div role="tree" aria-label={ariaLabel} className={className}>
      {renderNodes(nodes, 0)}
    </div>
  );
}
