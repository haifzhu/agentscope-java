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

import type { Tone } from '@/components/ui/tokens';

/**
 * 事项状态标签的唯一字典（PRD 5.10）。
 *
 * 此前 `issueTransition`、`WorkSurface`、`WorkActivityPage` 各维护一份中文标签，
 * 且口径已经漂移（同一 `blocked` 在不同页面显示为「被阻塞」/「受阻」）。
 * D 阶段收口为单一字典，所有渲染路径都从这里取词。
 */
export const ISSUE_STATUS_LABELS: Record<string, string> = {
  backlog: '待办',
  todo: '待办',
  open: '已开放',
  in_progress: '进行中',
  in_review: '评审中',
  blocked: '被阻塞',
  done: '已完成',
  cancelled: '已取消',
};

/** 与标签同源的语义色，避免「同一状态两处不同色」。 */
export const ISSUE_STATUS_TONES: Record<string, Tone> = {
  backlog: 'neutral',
  todo: 'neutral',
  open: 'info',
  in_progress: 'info',
  in_review: 'warning',
  blocked: 'danger',
  done: 'success',
  cancelled: 'neutral',
};

/** 未知状态回落为原值（下划线转空格），不静默吞掉。 */
export function issueStatusLabel(status: string): string {
  if (!status) return '—';
  return ISSUE_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function issueStatusTone(status: string): Tone {
  return ISSUE_STATUS_TONES[status] ?? 'neutral';
}
