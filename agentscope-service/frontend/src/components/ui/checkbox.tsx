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

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** 部分选中（如全选父项），仅影响视觉与 aria。 */
  indeterminate?: boolean;
}

/**
 * 多选框。用原生 input + appearance-none 自绘，
 * 而非 div 模拟 —— 键盘、表单提交、读屏语义天然正确。
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, indeterminate = false, id, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        <input
          ref={innerRef}
          id={inputId}
          type="checkbox"
          aria-describedby={hintId}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-border-control bg-surface',
            'checked:border-primary checked:bg-primary',
            'indeterminate:border-primary indeterminate:bg-primary',
            'bg-center bg-no-repeat',
            // 勾选态：内联 SVG 数据 URI，白色对勾
            "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22><path d=%22M3.5 8.5l3 3 6-7%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')]",
            "indeterminate:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22><path d=%22M4 8h8%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22/></svg>')]",
            'transition-colors duration-(--duration-fast)',
            focusRing,
            disabledState,
            className,
          )}
          {...props}
        />
        {(label || hint) && (
          <div className="min-w-0 leading-tight">
            {label && (
              <label htmlFor={inputId} className="cursor-pointer text-sm text-text">
                {label}
              </label>
            )}
            {hint && (
              <p id={hintId} className="mt-0.5 text-[13px] text-text-3">
                {hint}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
