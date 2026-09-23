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

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  'aria-label'?: string;
}

/**
 * 单选框组。用 fieldset + 原生 radio，保证方向键在组内切换、
 * 读屏能播报组名（组件契约第 4 条）。
 */
export function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = 'vertical',
  className,
  'aria-label': ariaLabel,
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap items-center gap-5',
        className,
      )}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const checked = option.value === value;
        return (
          <div key={option.value} className="flex items-start gap-2.5">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-full border border-border-control bg-surface',
                'checked:border-[5px] checked:border-primary',
                'transition-colors duration-(--duration-fast)',
                focusRing,
                disabledState,
              )}
            />
            {(option.label || option.hint) && (
              <div className="min-w-0 leading-tight">
                <label htmlFor={id} className="cursor-pointer text-sm text-text">
                  {option.label}
                </label>
                {option.hint && <p className="mt-0.5 text-[13px] text-text-3">{option.hint}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
