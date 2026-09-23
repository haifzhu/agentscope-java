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
import { CHART_SERIES } from './chart-container';

/** 实心语义色的 stroke 形态（与 tokens 的 solidToneClasses 一一对应）。 */
export const solidStrokeClasses: Record<Tone, string> = {
  neutral: 'stroke-text-4',
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  info: 'stroke-info',
};

function strokeClass(tone: Tone | undefined, index: number): string {
  return solidStrokeClasses[tone ?? CHART_SERIES[index % CHART_SERIES.length]];
}

/* ============================================================
 * A5 图表基元：自研 SVG，零第三方依赖。
 *
 * 约束（与 ChartContainer 一致）：颜色只取语义令牌
 * （solidToneClasses → CSS 变量），不写字面色值，双主题自动跟随；
 * 网格线/坐标文字用 border / text-3 / text-4 令牌。
 * 图形本身不参与交互（PRD 数据可视化以读为主），
 * 可访问性由 role="img" + aria-label 承载。
 * ============================================================ */

/** 归一化到 [0,1]，空数据与全等值都落在下限，避免除零。 */
export function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = max - min;
  if (span <= 0) return 0;
  return (value - min) / span;
}

export interface LineChartProps {
  /** 每个 series 是一条折线；颜色按 CHART_SERIES 顺序取令牌。 */
  series: { name: string; points: number[] }[];
  /** y 轴刻度文案，从下到上。缺省按 0/50%/100% 三档生成。 */
  yLabels?: string[];
  ariaLabel: string;
  className?: string;
}

/**
 * 折线图：viewBox 固定 600×220，宽度自适应容器。
 * 点位计算纯函数化（linePath），便于单测。
 */
export function linePath(points: number[], width = 600, height = 220): string {
  if (points.length === 0) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  return points
    .map((v, i) => {
      const x = points.length > 1 ? i * stepX : width / 2;
      const y = height - normalize(v, min, max) * (height - 8) - 4;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function LineChart({ series, yLabels, ariaLabel, className }: LineChartProps) {
  const labels = yLabels ?? ['100%', '50%', '0'];
  return (
    <svg
      viewBox="0 0 600 220"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {[0, 105, 210].map((y) => (
        <line key={y} x1={0} x2={600} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
      ))}
      {series.map((s, i) => (
        <path
          key={s.name}
          d={linePath(s.points)}
          fill="none"
          strokeWidth={2}
          className={strokeClass(undefined, i)}
          pathLength={1}
        />
      ))}
      <span className="sr-only">{labels.join(' ')}</span>
    </svg>
  );
}

export interface BarChartProps {
  /** 每根柱一个条目；tone 缺省按 CHART_SERIES 顺序。 */
  data: { label: string; value: number; tone?: Tone }[];
  /** 数值格式化，用于柱顶标注与 aria。 */
  formatValue?: (value: number) => string;
  ariaLabel: string;
  className?: string;
}

/** 柱状图：横向条形，标签在左、柱在中、数值在右，纯 div + 令牌色实现。 */
export function BarChart({ data, formatValue, ariaLabel, className }: BarChartProps) {
  const fmt = formatValue ?? String;
  const max = data.length ? Math.max(...data.map((d) => d.value), 1) : 1;
  return (
    <ul className={cn('space-y-2.5', className)} role="img" aria-label={ariaLabel}>
      {data.map((item, index) => (
        <li key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-text-2" title={item.label}>{item.label}</span>
          <span className="h-2.5 min-w-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            <span
              className={cn('block h-full rounded-full', solidToneClasses[item.tone ?? CHART_SERIES[index % CHART_SERIES.length]])}
              style={{ width: `${Math.max(normalize(item.value, 0, max) * 100, 1.5)}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-text-3">{fmt(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** 环形图弧段几何：把 [0,1] 占比转为 SVG arc path（12 点钟方向起笔）。 */
export function donutArcPaths(
  segments: { label: string; value: number }[],
  size = 160,
  thickness = 22,
): { path: string; label: string; ratio: number }[] {
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  if (total <= 0) return [];
  const radius = (size - thickness) / 2;
  const center = size / 2;
  let angle = -Math.PI / 2;
  return segments.map((segment) => {
    const ratio = Math.max(segment.value, 0) / total;
    const sweep = ratio * Math.PI * 2;
    const x1 = center + radius * Math.cos(angle);
    const y1 = center + radius * Math.sin(angle);
    angle += sweep;
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const path =
      ratio >= 1
        ? // 单一段占满时 start=end，改画整圆
          `M${center - radius},${center} a${radius},${radius} 0 1 0 ${radius * 2},0 a${radius},${radius} 0 1 0 ${-radius * 2},0`
        : `M${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
    return { path, label: segment.label, ratio };
  });
}

export interface DonutChartProps {
  segments: { label: string; value: number; tone?: Tone }[];
  /** 中心文案，通常放总量。 */
  centerLabel?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

/** 环形图：占比结构（如按类型的执行分布）。图例由 ChartContainer 承载。 */
export function DonutChart({ segments, centerLabel, ariaLabel, className }: DonutChartProps) {
  const arcs = donutArcPaths(segments);
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg viewBox="0 0 160 160" className="h-40 w-40" role="img" aria-label={ariaLabel}>
        {arcs.length === 0 && (
          <circle cx={80} cy={80} r={69} fill="none" strokeWidth={22} className="stroke-border" />
        )}
        {arcs.map((arc, index) => (
          <path
            key={arc.label}
            d={arc.path}
            fill="none"
            strokeWidth={22}
            strokeLinecap="butt"
            className={strokeClass(segments[index].tone, index)}
          />
        ))}
      </svg>
      {centerLabel !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tabular-nums text-text">{total}</span>
          <span className="text-xs text-text-3">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
