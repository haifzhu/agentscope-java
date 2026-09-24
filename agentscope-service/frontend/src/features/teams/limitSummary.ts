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

/**
 * 团队执行限额的业务语言摘要（PRD 5.8 / C10）：
 * 6 个限额字段在表单中折叠展示，摘要区用一句话说清当前生效的配置。
 */

export interface LimitDescriptor {
  field: string;
  label: string;
  /** 0 值的含义：使用平台默认值或表示「不额外限制」。 */
  zeroMeaning: string;
  /** 平台默认值（与后端约定一致），用于摘要回退。 */
  fallback?: number;
  max?: number;
}

export const LIMIT_DESCRIPTORS: LimitDescriptor[] = [
  { field: 'maxActiveTasks', label: '并发任务上限', zeroMeaning: '0 使用平台默认 32', fallback: 32 },
  { field: 'maxHops', label: '委派跳数上限', zeroMeaning: '0 使用平台默认 8', fallback: 8, max: 64 },
  { field: 'maxFanout', label: '单次委派接收方上限', zeroMeaning: '0 表示不额外限制', max: 256 },
  { field: 'maxChildDepth', label: '子事项嵌套深度', zeroMeaning: '0 使用平台默认 4', fallback: 4, max: 32 },
  { field: 'maxChildIssues', label: '每个父事项的子事项上限', zeroMeaning: '0 表示不额外限制' },
  { field: 'maxTaskRetries', label: '单任务重试上限', zeroMeaning: '0 表示不额外限制' },
];

export type LimitPolicy = Record<string, unknown>;

/** 返回显式配置（非 0）的限额摘要；全部为 0/未配置时返回 null。 */
export function limitSummary(policy: LimitPolicy): string | null {
  const parts = LIMIT_DESCRIPTORS.filter((d) => {
    const value = Number(policy[d.field] ?? 0);
    return Number.isFinite(value) && value > 0;
  }).map((d) => `${d.label} ${policy[d.field]}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** 全部限额是否仍为默认值（0 / 未配置）。 */
export function isLimitDefault(policy: LimitPolicy): boolean {
  return limitSummary(policy) === null;
}
