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
 * 工作流实时校验（PRD 5.9 / C11）：编辑过程中即时发现结构问题，
 * 其中「成环拒绝」在连线编辑时直接拦截，不允许提交带环的定义。
 */

export interface WorkflowEdgeLike {
  from: string;
  to: string;
}

export interface WorkflowNodeLike {
  key: string;
  type: string;
}

export type WorkflowIssue =
  | { kind: 'cycle'; message: string; path: string[] }
  | { kind: 'dangling-edge'; message: string; edge: WorkflowEdgeLike }
  | { kind: 'duplicate-key'; message: string; key: string }
  | { kind: 'empty-key'; message: string };

/**
 * 检测有向边集中的环（DFS，按字典序保证确定性）。
 * 返回一条环路径（首尾相同），无环返回 null。
 */
export function detectCycle(edges: WorkflowEdgeLike[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort();
  const visiting = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    if (done.has(node)) return null;
    if (visiting.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    visiting.add(node);
    stack.push(node);
    for (const next of (adjacency.get(node) ?? []).slice().sort()) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    done.add(node);
    return null;
  };

  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

/** 全量校验：环、悬空连线、重复/空节点 key。空列表表示定义合法。 */
export function validateWorkflow(
  nodes: WorkflowNodeLike[],
  edges: WorkflowEdgeLike[],
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  const cycle = detectCycle(edges);
  if (cycle) {
    issues.push({
      kind: 'cycle',
      message: `检测到环：${cycle.join(' → ')}。工作流不允许成环，请调整连线。`,
      path: cycle,
    });
  }

  const keys = new Set(nodes.map((n) => n.key));
  for (const edge of edges) {
    if (!keys.has(edge.from) || !keys.has(edge.to)) {
      issues.push({
        kind: 'dangling-edge',
        message: `连线 ${edge.from} → ${edge.to} 引用了不存在的节点。`,
        edge,
      });
    }
  }

  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node.key.trim()) {
      issues.push({ kind: 'empty-key', message: '存在 key 为空的节点。' });
    } else if (seen.has(node.key)) {
      issues.push({
        kind: 'duplicate-key',
        message: `节点 key「${node.key}」重复。`,
        key: node.key,
      });
    }
    seen.add(node.key);
  }

  return issues;
}
