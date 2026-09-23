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
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { SkeletonText } from './skeleton';

export type AsyncStatus = 'loading' | 'empty' | 'error' | 'ready';

/**
 * 三态文案模板：集中一处，页面只传 resource 名（技术方案 §3.3）。
 * 这样「空状态/加载中/错误」不再由各页面自行编写。
 */
export const asyncMessages = {
  loading: (resource: string) => `正在加载${resource}…`,
  empty: (resource: string) => `暂无${resource}`,
  error: (resource: string) => `${resource}加载失败`,
  retry: '重试',
} as const;

export interface AsyncStateProps {
  status: AsyncStatus;
  /** 资源名，用于拼装三态文案，如「智能体」「执行记录」。 */
  resource: string;
  /** 空态补充说明：现象 + 下一步。 */
  emptyDescription?: React.ReactNode;
  /** 空态行动入口，如「新建智能体」。 */
  emptyAction?: React.ReactNode;
  /** 错误详情，展示在文案下方便于排查。 */
  errorDescription?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * 数据类组件的统一三态容器（组件契约第 3 条）。
 *
 * 之所以收敛成一个受控组件：PRD 5.1.2 指出过往「空状态/加载中/错误」
 * 文案各页面自行编写，导致同一资源在不同页面措辞不一致。
 */
export function AsyncState({
  status,
  resource,
  emptyDescription,
  emptyAction,
  errorDescription,
  onRetry,
  className,
  children,
}: AsyncStateProps) {
  if (status === 'ready') {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div
        className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card p-5', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{asyncMessages.loading(resource)}</span>
        <SkeletonText rows={3} />
      </div>
    );
  }

  const isError = status === 'error';
  const Icon = isError ? AlertTriangle : Inbox;

  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center',
        className,
      )}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full',
          isError ? 'bg-danger-soft text-danger-text' : 'bg-surface-3 text-text-3',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-text">
        {isError ? asyncMessages.error(resource) : asyncMessages.empty(resource)}
      </h3>
      {isError && errorDescription ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-text-3">{errorDescription}</p>
      ) : (
        emptyDescription && (
          <p className="mt-1 max-w-md text-sm leading-6 text-text-3">{emptyDescription}</p>
        )
      )}
      <div className="mt-4">
        {isError
          ? onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {asyncMessages.retry}
              </Button>
            )
          : emptyAction}
      </div>
    </div>
  );
}
