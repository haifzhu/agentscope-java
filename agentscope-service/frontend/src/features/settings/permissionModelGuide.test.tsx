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

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PermissionModelGuide } from './AccessComponents';

/**
 * C16 三层权限模型说明（PRD 5.14）。
 *
 * 这段文案是权限风险的唯一解释入口，措辞漂移会直接影响越权误判，
 * 因此对三层结构与反直觉规则做快照级断言。
 */
describe('PermissionModelGuide', () => {
  const html = renderToString(createElement(PermissionModelGuide));

  it('renders the three authorization layers in order', () => {
    expect(html).toContain('第一层 · 平台角色');
    expect(html).toContain('第二层 · 命名空间角色');
    expect(html).toContain('第三层 · 资源授权');
    const first = html.indexOf('第一层');
    const second = html.indexOf('第二层');
    const third = html.indexOf('第三层');
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it('enumerates the six resource-level grants', () => {
    for (const grant of ['discover', 'use', 'inspect', 'edit', 'publish', 'manage']) {
      expect(html).toContain(grant);
    }
  });

  it('makes the auditor counter-intuitive rule explicit', () => {
    // 「管理员 ≠ 审计员」是 PRD 5.14 明确要求显式警示的反直觉规则。
    expect(html).toContain('管理员不等于审计员');
    expect(html).toContain('auditor');
    expect(html).toContain('只读不管理');
  });

  it('states the group escalation constraint', () => {
    expect(html).toContain('用户组不能被授予超出授予者的权限');
  });

  it('exposes the guide as a labelled region for assistive technology', () => {
    expect(html).toContain('aria-label="权限模型说明"');
  });
});
