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

/**
 * 骨架屏：数据类组件 loading 态的统一基元。
 * 用 bg-surface-3 + pulse，双主题下都可见；对读屏隐藏，
 * 由外层容器负责 aria-busy / 状态播报。
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-3', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** 多行文本骨架：rows 行等宽占位，最后一行略短以贴近真实排版。 */
export function SkeletonText({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === rows - 1 && 'w-2/3')} />
      ))}
    </div>
  );
}
