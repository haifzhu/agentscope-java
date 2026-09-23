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
 * 空状态。
 *
 * 保留原签名以兼容既有调用点，但样式改为令牌驱动；
 * 需要「加载中 / 错误」的调用方请改用 `ui/async-state` 的 <AsyncState>，
 * 它把三态收敛在一处（技术方案 §3.3）。
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-1',
        className,
      )}
    >
      <div className="h-10 w-10 rounded-full border border-border bg-surface-3" />
      <h3 className="mt-4 text-sm font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-6 text-text-3">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
