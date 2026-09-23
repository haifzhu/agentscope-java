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

import { cn } from '@/lib/utils';
import { solidToneClasses, type Tone } from './tokens';

/**
 * 图表调色板：双主题下「不可反转」的语义色顺序。
 * 明暗两套都由 CSS 变量承载，此处只取令牌，不写字面色值。
 */
export const CHART_SERIES: Tone[] = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'];

export function seriesClass(tone: Tone | undefined, index: number): string {
  return solidToneClasses[tone ?? CHART_SERIES[index % CHART_SERIES.length]];
}

export interface ChartContainerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 图例：色块 + 文案，色块取自同一令牌。 */
  legend?: { label: string; tone: Tone }[];
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * 图表容器：统一标题/图例/间距与令牌配色。
 * 具体图形（折线/柱状/环形）由 A5 的自研 SVG 基元实现，
 * 此处只负责外壳，保证「图表配色属于设计系统」这条约束成立。
 */
export function ChartContainer({
  title,
  description,
  legend,
  actions,
  className,
  children,
}: ChartContainerProps) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-text">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-text-3">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {legend && legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5 text-[12px] text-text-3">
              <span
                className={cn('h-2.5 w-2.5 rounded-sm', solidToneClasses[entry.tone])}
                aria-hidden="true"
              />
              {entry.label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * 图表的无障碍降级：同一份数据的表格形式。
 * PRD 验收 8.3-7 要求图表必须有等价文本表达，
 * 由调用方在图与表之间切换，或直接用 sr-only 包裹。
 */
export function ChartDataFallback({
  caption,
  columns,
  rows,
  className,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  className?: string;
}) {
  return (
    <table className={cn('w-full border-collapse text-[13px]', className)}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="border-b border-border px-2 py-1.5 text-left font-medium text-text-3">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="border-b border-border px-2 py-1.5 tabular-nums text-text-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
