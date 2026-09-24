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
 * 版本对比（PRD 5.7 / C7）：对两个定义快照做字段级差异计算。
 * 纯函数、无 React 依赖，便于单测覆盖。
 */

export type VersionDiffKind = 'added' | 'removed' | 'changed';

export interface VersionDiffEntry {
  key: string;
  kind: VersionDiffKind;
  /** 基线侧取值；新增字段为 null。 */
  before: string | null;
  /** 对比侧取值；删除字段为 null。 */
  after: string | null;
}

export type VersionSnapshot = Record<string, unknown> | null | undefined;

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(sortKeys(value)) ?? 'null';
  } catch {
    return String(value);
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** 对比两个快照，按字段名排序返回差异列表；完全一致时返回空数组。 */
export function diffSnapshots(before: VersionSnapshot, after: VersionSnapshot): VersionDiffEntry[] {
  const beforeKeys = before ? Object.keys(before) : [];
  const afterKeys = after ? Object.keys(after) : [];
  const keys = [...new Set([...beforeKeys, ...afterKeys])].sort();

  const entries: VersionDiffEntry[] = [];
  for (const key of keys) {
    const hasBefore = before != null && key in before;
    const hasAfter = after != null && key in after;
    if (hasBefore && !hasAfter) {
      entries.push({ key, kind: 'removed', before: stableStringify(before![key]), after: null });
    } else if (!hasBefore && hasAfter) {
      entries.push({ key, kind: 'added', before: null, after: stableStringify(after![key]) });
    } else if (hasBefore && hasAfter) {
      const beforeText = stableStringify(before![key]);
      const afterText = stableStringify(after![key]);
      if (beforeText !== afterText) {
        entries.push({ key, kind: 'changed', before: beforeText, after: afterText });
      }
    }
  }
  return entries;
}

export const diffKindLabels: Record<VersionDiffKind, string> = {
  added: '新增',
  removed: '删除',
  changed: '变更',
};
