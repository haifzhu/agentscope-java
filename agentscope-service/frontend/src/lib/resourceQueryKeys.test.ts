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
import {
  childQueryKey,
  collectionQueryKey,
  detailQueryKey,
  parentOf,
} from './resourceQueryKeys';

/**
 * C15 资源页的 query key 契约（D 阶段 MEDIUM-2）。
 *
 * 四类资源页统一用「父集合 + 父 id + 子集合」的键形状；父 id 必须在键里，
 * 否则快速切换父资源时，旧 id 的迟到响应会落进当前页面（迁移前手写
 * useState + useEffect 正是这个竞态）。这些断言把该契约钉住。
 */
describe('resourceQueryKeys', () => {
  it('namespaces each collection by resource kind', () => {
    expect(collectionQueryKey('memoryStores')).toEqual(['memory-stores']);
    expect(collectionQueryKey('vaults')).toEqual(['vaults']);
    expect(collectionQueryKey('environments')).toEqual(['environments']);
    expect(collectionQueryKey('workspaces')).toEqual(['workspace']);
  });

  it('puts the parent id into every child key', () => {
    expect(childQueryKey('memoryStores', 'ms-1', 'memories'))
      .toEqual(['memory-stores', 'ms-1', 'memories']);
    expect(childQueryKey('vaults', 'v-1', 'credentials'))
      .toEqual(['vaults', 'v-1', 'credentials']);
    expect(childQueryKey('workspaces', 'ws-1', 'skills'))
      .toEqual(['workspace', 'ws-1', 'skills']);
  });

  it('produces distinct keys for distinct parents (the race guard)', () => {
    const a = childQueryKey('memoryStores', 'ms-1', 'memories');
    const b = childQueryKey('memoryStores', 'ms-2', 'memories');
    expect(a).not.toEqual(b);
    // 键不同 → cache 分格，迟到的 ms-2 响应不会写进 ms-1 那一格。
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('scopes a child key under its parent prefix so invalidating the parent cascades', () => {
    const parent = collectionQueryKey('vaults');
    const child = childQueryKey('vaults', 'v-1', 'credentials');
    expect(child.slice(0, parent.length)).toEqual([...parent]);
  });

  it('builds a per-parent detail key distinct from the collection root', () => {
    const detail = detailQueryKey('workspaces', 'ws-1');
    expect(detail).toEqual(['workspace', 'ws-1']);
    expect(detail).not.toEqual([...collectionQueryKey('workspaces')]);
    expect(detailQueryKey('workspaces', 'ws-2')).not.toEqual(detail);
  });

  it('encodes the parent relationship used by removeQueries on delete', () => {
    expect(parentOf(childQueryKey('vaults', 'v-1', 'credentials'))).toEqual(['vaults', 'v-1']);
  });
});
