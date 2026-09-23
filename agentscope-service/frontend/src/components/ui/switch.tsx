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

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * 开关。用 button[role=switch] 而非 checkbox：
 * 语义更贴合「即时生效的二元状态」，且空格/回车天然可切换。
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  hint,
  id,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;
  const hintId = hint ? `${switchId}-hint` : undefined;

  const control = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={hintId}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors duration-(--duration-fast)',
        checked ? 'bg-primary' : 'bg-border-strong',
        focusRing,
        disabledState,
      )}
    >
      <span
        className={cn(
          'inline-block h-4.5 w-4.5 rounded-full bg-surface shadow-1 transition-transform duration-(--duration-fast)',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );

  if (!label && !hint) return <span className={className}>{control}</span>;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      {control}
      <div className="min-w-0 leading-tight">
        {label && (
          <label htmlFor={switchId} className="cursor-pointer text-sm text-text">
            {label}
          </label>
        )}
        {hint && (
          <p id={hintId} className="mt-0.5 text-[13px] text-text-3">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
