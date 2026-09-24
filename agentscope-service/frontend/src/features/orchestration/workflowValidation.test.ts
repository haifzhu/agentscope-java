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
import { detectCycle, validateWorkflow } from './workflowValidation';

describe('detectCycle', () => {
  test('无环返回 null（含菱形汇聚）', () => {
    expect(
      detectCycle([
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ]),
    ).toBeNull();
  });

  test('直接自环被拒绝', () => {
    expect(detectCycle([{ from: 'a', to: 'a' }])).toEqual(['a', 'a']);
  });

  test('间接环返回完整路径', () => {
    const cycle = detectCycle([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ])!;
    expect(cycle[cycle.length - 1]).toBe(cycle[0]);
    expect(new Set(cycle).size).toBe(3);
  });

  test('空边集无环', () => {
    expect(detectCycle([])).toBeNull();
  });
});

describe('validateWorkflow', () => {
  const nodes = [{ key: 'a', type: 'agent' }, { key: 'b', type: 'join' }];

  test('合法定义返回空列表', () => {
    expect(validateWorkflow(nodes, [{ from: 'a', to: 'b' }])).toEqual([]);
  });

  test('悬空连线与重复 key 被报告', () => {
    const issues = validateWorkflow(
      [...nodes, { key: 'a', type: 'timer' }],
      [{ from: 'a', to: 'ghost' }],
    );
    expect(issues.map((i) => i.kind)).toEqual(['dangling-edge', 'duplicate-key']);
  });

  test('成环返回带路径的 cycle 问题', () => {
    const issues = validateWorkflow(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('cycle');
  });
});
