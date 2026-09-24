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
import { isLimitDefault, limitSummary } from './limitSummary';

describe('limitSummary', () => {
  test('全部默认值时返回 null 且 isLimitDefault 为真', () => {
    expect(limitSummary({})).toBeNull();
    expect(limitSummary({ maxHops: 0, maxFanout: '0' })).toBeNull();
    expect(isLimitDefault({ maxActiveTasks: 0 })).toBe(true);
  });

  test('只摘出显式配置的限额，按定义顺序拼接', () => {
    expect(limitSummary({ maxHops: 5, maxFanout: 10 })).toBe('委派跳数上限 5 · 单次委派接收方上限 10');
  });

  test('非法输入按默认处理', () => {
    expect(limitSummary({ maxTaskRetries: Number.NaN })).toBeNull();
    expect(limitSummary({ maxTaskRetries: -1 })).toBeNull();
  });
});
