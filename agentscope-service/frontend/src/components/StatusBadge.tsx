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
import { Badge, type BadgeTone } from '@/components/ui/badge';

/** 状态词表 → 语义色。集中一处，便于与后端状态枚举对齐。 */
const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'success',
  healthy: 'success',
  ready: 'success',
  succeeded: 'success',
  terminated: 'danger',
  failed: 'danger',
  unhealthy: 'danger',
  error: 'danger',
  compressing: 'warning',
  pending: 'warning',
  running: 'info',
};

export function statusTone(status?: string): BadgeTone {
  return STATUS_TONES[(status ?? '').toLowerCase()] ?? 'neutral';
}

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} className={cn('uppercase tracking-wide', className)}>
      {status || 'unknown'}
    </Badge>
  );
}
