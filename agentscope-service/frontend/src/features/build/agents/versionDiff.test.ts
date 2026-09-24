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

import { describe, expect, test } from 'vitest';
import { diffSnapshots } from './versionDiff';

describe('diffSnapshots', () => {
  test('相同快照返回空数组', () => {
    const snap = { name: 'worker', model: 'qwen-max' };
    expect(diffSnapshots(snap, { ...snap })).toEqual([]);
  });

  test('字段值变化标记为 changed，嵌套键序不影响比较', () => {
    const entries = diffSnapshots(
      { model: 'qwen-max', tools: { a: 1, b: 2 } },
      { model: 'deepseek-chat', tools: { b: 2, a: 1 } },
    );
    expect(entries).toEqual([
      { key: 'model', kind: 'changed', before: '"qwen-max"', after: '"deepseek-chat"' },
    ]);
  });

  test('新增与删除字段分别标记', () => {
    const entries = diffSnapshots({ name: 'w', kept: 1 }, { kept: 1, extra: true });
    expect(entries).toEqual([
      { key: 'extra', kind: 'added', before: null, after: 'true' },
      { key: 'name', kind: 'removed', before: '"w"', after: null },
    ]);
    const removed = diffSnapshots({ gone: 'x', kept: 1 }, { kept: 1 });
    expect(removed).toEqual([
      { key: 'gone', kind: 'removed', before: '"x"', after: null },
    ]);
  });

  test('空快照与 null 按全增/全删处理', () => {
    expect(diffSnapshots(null, { a: 1 })).toEqual([
      { key: 'a', kind: 'added', before: null, after: '1' },
    ]);
    expect(diffSnapshots({ a: 1 }, null)).toEqual([
      { key: 'a', kind: 'removed', before: '1', after: null },
    ]);
    expect(diffSnapshots(null, null)).toEqual([]);
  });

  test('数组顺序敏感：重排视为变更', () => {
    const entries = diffSnapshots({ tags: ['a', 'b'] }, { tags: ['b', 'a'] });
    expect(entries[0].kind).toBe('changed');
  });
});
