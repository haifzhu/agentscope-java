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
import { Progress } from '@/components/ui/progress';
import type { Tone } from '@/components/ui/tokens';

/** 阈值：达到即升级告警色。命名常量，避免魔法数字散落。 */
const PRESSURE_WARNING = 0.7;
const PRESSURE_CRITICAL = 0.85;

export function pressureTone(ratio: number): Tone {
  if (ratio >= PRESSURE_CRITICAL) return 'danger';
  if (ratio >= PRESSURE_WARNING) return 'warning';
  return 'success';
}

/**
 * 上下文压力计。令牌化改造：原先用 bg-red-500 / bg-amber-500 / bg-emerald-500
 * 三档硬编码，暗色下不跟随；现改用 Progress 的语义色三件套。
 */
export function PressureGauge({
  value,
  className,
}: {
  value?: number | null;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span className="text-xs text-text-3" title="Context pressure has not been reported">
        Not reported
      </span>
    );
  }

  const ratio = Math.max(0, Math.min(1, value));
  const pct = Math.round(ratio * 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Progress value={ratio * 100} tone={pressureTone(ratio)} className="w-24" />
      <span className="text-xs tabular-nums text-text-3" title={`Context pressure ${pct}%`}>
        {pct}%
      </span>
    </div>
  );
}
