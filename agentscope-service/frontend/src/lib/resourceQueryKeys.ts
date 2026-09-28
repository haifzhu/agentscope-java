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
 * C15 四类资源页共用的 TanStack Query 键构造（D 阶段 MEDIUM-2 收口）。
 *
 * 迁移的目标不只是「用了 Query」，而是让父资源的 id 成为缓存身份的一部分：
 * 记忆库→记忆、密钥库→凭据、工作空间→技能/子智能体。
 * 这样切换父资源时，晚到的响应只会写回它自己那一格。
 */

export type ResourceKind = 'memoryStores' | 'vaults' | 'environments' | 'workspaces';
export type ChildResource = 'memories' | 'credentials' | 'skills' | 'subagents';

/** 集合根键。四页各用一段稳定前缀，便于按资源类型整体失效。 */
const COLLECTION: Record<ResourceKind, string> = {
  memoryStores: 'memory-stores',
  vaults: 'vaults',
  environments: 'environments',
  workspaces: 'workspace',
};

/** 父集合键，例如 ['memory-stores']。 */
export function collectionQueryKey(kind: ResourceKind): readonly string[] {
  return [COLLECTION[kind]];
}

/**
 * 子资源键，例如 ['vaults', 'v-1', 'credentials']。
 * 父 id 是必填参数——正是它把两个父资源的缓存分到不同的格子。
 */
export function childQueryKey(
  kind: ResourceKind,
  parentId: string,
  child: ChildResource,
): readonly string[] {
  return [COLLECTION[kind], parentId, child];
}

/** 取子键的父前缀，用于删除父资源时 removeQueries 清掉它的全部子查询。 */
export function parentOf(key: readonly string[]): readonly string[] {
  return key.slice(0, 2);
}

/** 单个父资源的详情键，例如 ['workspace', 'ws-1']。 */
export function detailQueryKey(kind: ResourceKind, parentId: string): readonly string[] {
  return [COLLECTION[kind], parentId];
}
