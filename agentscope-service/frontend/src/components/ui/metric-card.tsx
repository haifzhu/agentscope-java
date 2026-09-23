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

import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { solidToneClasses, type Tone } from './tokens';

export interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** 环比变化：正数上升、负数下降；0 或 undefined 不渲染趋势行。 */
  delta?: number;
  /** delta 为「上升是好事」还是「下降是好事」，决定配色。 */
  positiveIsGood?: boolean;
  /** 迷你趋势数据，渲染为内联 SVG 折线。 */
  trend?: number[];
  /** 点击整卡跳转到带筛选的列表页（PRD 5.3 要求指标卡带筛选跳转）。 */
  onClick?: () => void;
  className?: string;
}

/** 把数值序列归一化为 SVG 折线的 points 字符串。 */
export function trendPoints(values: number[], width = 88, height = 28): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * 指标卡。首屏「需要我处理」的核心单元。
 * 趋势线用内联 SVG（自研，零依赖），当前色由令牌决定，双主题自动跟随。
 */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  positiveIsGood = true,
  trend,
  onClick,
  className,
}: MetricCardProps) {
  const hasDelta = typeof delta === 'number' && delta !== 0;
  const rising = (delta ?? 0) > 0;
  const good = rising === positiveIsGood;
  const deltaTone: Tone = good ? 'success' : 'danger';

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-text-3">{label}</span>
        {trend && trend.length > 1 && (
          <svg
            viewBox="0 0 88 28"
            width={88}
            height={28}
            className="shrink-0 text-primary"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <polyline
              points={trendPoints(trend)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-text">{value}</span>
        {unit && <span className="text-[13px] text-text-3">{unit}</span>}
      </div>

      {hasDelta && (
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums',
              good ? 'text-success-text' : 'text-danger-text',
            )}
          >
            {rising ? (
              <ArrowUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
            )}
            {Math.abs(delta)}%
          </span>
          <span className="text-[12px] text-text-4">较上一周期</span>
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-1',
          'transition-colors duration-(--duration-fast) hover:bg-hover',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return <Card className={cn('flex flex-col p-5', className)}>{body}</Card>;
}

/**
 * 迷你堆叠条：用于「状态分布」这类聚合展示。
 * 数据为空时渲染占位，避免 0 宽度导致布局塌陷。
 */
export function StackedBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; tone: Tone }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return <div className={cn('h-2 w-full rounded-full bg-surface-3', className)} aria-hidden="true" />;
  }

  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            className={cn('h-full', solidToneClasses[s.tone])}
            // 数据驱动几何：宽度由占比计算，无法用静态类表达
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
    </div>
  );
}
