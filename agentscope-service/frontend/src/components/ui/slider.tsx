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
import { disabledState, focusRing } from './tokens';

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

/**
 * 滑块。用原生 input[type=range] + appearance-none，
 * 保留方向键调节与读屏 aria-valuenow 语义。
 * 已填充轨道用 background-image 渐变表达，避免额外 DOM。
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  label,
  showValue = true,
  formatValue,
  className,
}: SliderProps) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const id = React.useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[13px] font-medium text-text-2">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-[13px] tabular-nums text-text-3">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3',
          '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary',
          '[&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-1',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface',
          focusRing,
          disabledState,
        )}
        style={{
          // 数据驱动几何：填充比例由当前值计算，无法用静态类表达
          backgroundImage: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percent}%, transparent ${percent}%)`,
        }}
      />
    </div>
  );
}
