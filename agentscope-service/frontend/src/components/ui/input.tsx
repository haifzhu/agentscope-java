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
import { controlBorder, disabledState, focusRing } from './tokens';

const fieldClasses = cn(
  'flex w-full rounded-lg bg-surface px-3.5 text-sm text-text',
  controlBorder,
  'shadow-1 transition-colors duration-(--duration-fast)',
  'placeholder:text-text-3',
  focusRing,
  disabledState,
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(fieldClasses, 'h-10 py-2', className)} ref={ref} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldClasses, 'min-h-[96px] py-2.5', className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select className={cn(fieldClasses, 'h-10 py-2 pr-9', className)} ref={ref} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export interface FieldProps {
  /** 控件的可见标签；作为 label 文本渲染，同时关联到控件。 */
  label?: React.ReactNode;
  /** 帮助文本，id 会自动接到控件的 aria-describedby。 */
  hint?: React.ReactNode;
  /** 错误文本；非空时控件标记 aria-invalid。 */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => React.ReactNode;
}

/**
 * 表单字段容器：统一 label / hint / error 的关联与无障碍语义，
 * 避免各页面各写一套 label 与错误提示。
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-2">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={errorId} className="text-[13px] text-danger-text">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-[13px] text-text-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
