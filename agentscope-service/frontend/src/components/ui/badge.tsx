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
import { toneClasses, solidToneClasses, type Tone } from './tokens';

/** 兼容旧调用点的 tone 词表：default 映射到 neutral。 */
const LEGACY_TONE_ALIAS = { default: 'neutral' } as const;

export type BadgeTone = Tone | keyof typeof LEGACY_TONE_ALIAS;

function resolveTone(tone: BadgeTone): Tone {
  return (LEGACY_TONE_ALIAS as Record<string, Tone>)[tone] ?? (tone as Tone);
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium leading-none',
        toneClasses[resolveTone(tone)],
        className,
      )}
      {...props}
    />
  );
}

/**
 * 状态点：与 Badge 同色板，用于表格/列表里的紧凑状态指示。
 * 纯装饰时对读屏隐藏，带 label 时作为 img 暴露。
 */
export function StatusDot({
  tone = 'neutral',
  className,
  label,
}: {
  tone?: BadgeTone;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', solidToneClasses[resolveTone(tone)], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
