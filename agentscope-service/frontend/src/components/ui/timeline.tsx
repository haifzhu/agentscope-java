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
import { solidToneClasses, toneClasses, type Tone } from './tokens';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 时间戳或相对时间文本；由调用方决定格式。 */
  time?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

/**
 * 时间线。用于「工作动态」「执行记录」。竖线用 CSS 伪元素式的绝对定位
 * 而非连接字符，保证与文字基线解耦。
 */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => {
        const tone = item.tone ?? 'neutral';
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {/* 连接线：仅非末项绘制，避免末尾悬空 */}
            {!isLast && (
              <span
                className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full',
                toneClasses[tone],
              )}
            >
              {item.icon ?? <span className={cn('h-1.5 w-1.5 rounded-full', solidToneClasses[tone])} />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-text">{item.title}</p>
                {item.time && <time className="text-[12px] tabular-nums text-text-4">{item.time}</time>}
              </div>
              {item.description && (
                <p className="mt-0.5 text-[13px] leading-5 text-text-3">{item.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
