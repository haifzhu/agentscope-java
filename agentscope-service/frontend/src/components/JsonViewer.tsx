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
 * JSON 查看器。
 *
 * 代码底色刻意用 --color-canvas（最暗层）而非字面色值：
 * 浅色主题下它是浅灰底 + 深字，暗色下自动变成深底 + 亮字，
 * 两套都由令牌驱动，不再需要为暗色单独写一遍。
 */
export function JsonViewer({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn(
        'overflow-auto rounded-lg border border-border bg-canvas p-4 font-mono text-xs leading-relaxed text-text-2',
        className,
      )}
    >
      {text}
    </pre>
  );
}
