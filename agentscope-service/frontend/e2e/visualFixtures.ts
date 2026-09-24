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

import type { Page } from '@playwright/test';

/**
 * A6/JICH-338 视觉基线共享夹具：全部 `/api/**` 走固定 mock，
 * 截图确定性不依赖后端；外网字体在用例内拦截，CI 离线可跑。
 */

export const NOW = Date.now();
export const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const ISSUE_ID = 'issue-1';
const APPROVAL_ID = 'approval-1';
const AGENT_ID = 'worker';

export async function mockVisualApi(page: Page, roles: string[] = ['admin']) {
  const token = `test.${Buffer.from(JSON.stringify({ username: 'alice', roles })).toString('base64url')}.test`;
  await page.addInitScript((t) => localStorage.setItem('claw_token', t), token);
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });

    if (path === '/api/auth/me') return json({ username: 'alice', roles, isAdmin: true });
    if (path === '/api/v1/me/scope') return json({ tenant: 'default', namespace: 'default', mode: 'single', selectorVisible: false, namespaces: [{ tenant: 'default', name: 'default', roles }] });
    if (path === '/api/v1/me/preferences') return json({ preferences: {} });

    const issues = [
      { id: ISSUE_ID, identifier: 'JICH-101', title: '工作台视觉基线落地', description: '把关键页面的像素基线纳入回归闸门。', status: 'in_review', priority: 'high', kind: 'user_work', visibility: 'work_hub', completionPolicy: 'review', tenant: 'default', namespace: 'default', creator: { type: 'human', ref: 'alice' }, updatedAt: hoursAgo(1), createdAt: hoursAgo(30), version: 2 },
      { id: 'issue-2', identifier: 'JICH-102', title: '阶段 C 铺开前的清单确认', description: '逐条核对 PRD 的验收项。', status: 'blocked', priority: 'urgent', kind: 'user_work', visibility: 'work_hub', completionPolicy: 'review', tenant: 'default', namespace: 'default', creator: { type: 'human', ref: 'alice' }, updatedAt: hoursAgo(3), createdAt: hoursAgo(40), version: 1 },
      { id: 'issue-3', identifier: 'JICH-103', title: '维护 runbook 更新', description: '同步最新的处置步骤。', status: 'in_progress', priority: 'normal', kind: 'user_work', visibility: 'work_hub', completionPolicy: 'review', tenant: 'default', namespace: 'default', creator: { type: 'human', ref: 'bob' }, assigneeType: 'agent', assigneeRef: 'reviewer', updatedAt: hoursAgo(6), createdAt: hoursAgo(50), version: 1 },
    ];
    if (path === '/api/v1/issues') return json({ items: issues });

    const runs = [
      { id: 'run-1', tenant: 'default', namespace: 'default', rootIssueId: ISSUE_ID, mode: 'team', triggerType: 'issue', state: 'failed', version: 2, createdAt: hoursAgo(2), startedAt: hoursAgo(2), completedAt: hoursAgo(1), failureCode: 'tool_error', failureMessage: 'web_search 调用超时', usage: { totalTokens: 12500 } },
      { id: 'run-2', tenant: 'default', namespace: 'default', rootIssueId: 'issue-2', mode: 'direct', triggerType: 'issue', state: 'running', version: 1, createdAt: hoursAgo(1), startedAt: hoursAgo(1), usage: { totalTokens: 3200 } },
      { id: 'run-3', tenant: 'default', namespace: 'default', rootIssueId: 'issue-3', mode: 'workflow', triggerType: 'workflow', state: 'succeeded', version: 1, createdAt: hoursAgo(5), startedAt: hoursAgo(5), completedAt: hoursAgo(4), usage: { totalTokens: 8100 } },
    ];
    if (path === '/api/v1/orchestration-runs' && !url.searchParams.get('definitionId')) return json({ runs });
    if (path === '/api/v1/overview/timeseries') return json({ metric: 'tokens', bucket: 'hour', points: Array.from({ length: 12 }, (_, i) => ({ bucketStart: hoursAgo(11 - i), promptTokens: 100 * (i + 1), completionTokens: 40 * (i + 1), totalTokens: 140 * (i + 1), sampleCount: 3 })) });
    if (path === '/api/v1/overview') return json({ agentCount: 3, instanceCount: 2, healthyInstanceCount: 2, dataplaneCount: 1, sessionCount: 5, activeSessionCount: 1, tokenUsage24h: 23800, errorCount24h: 1 });

    if (path === '/api/v1/inbox/summary') return json({ summary: { attentionTotal: 2, unread: 1, pendingApprovals: 1, actionRequired: 1, byType: {} } });
    if (path === '/api/v1/inbox') return json({ items: [
      { id: 'in-1', title: '审批请求：发布 v1.4.0', body: '发布审批需要你确认。', type: 'approval', approvalId: APPROVAL_ID, severity: 'attention', read: false, needsAction: true, archived: false, createdAt: hoursAgo(2), actor: { type: 'human', ref: 'bob' } },
      { id: 'in-2', title: '评审助手提及了你', body: '@alice 请查看第 3 轮评审结论。', type: 'mention', severity: 'attention', read: false, needsAction: false, archived: false, createdAt: hoursAgo(5), actor: { type: 'agent', ref: 'reviewer' } },
      { id: 'in-3', title: '执行失败：web_search', body: '工具调用超时，已重试 2 次。', type: 'agent_task_failed', severity: 'error', read: true, needsAction: false, archived: false, createdAt: hoursAgo(7), actor: { type: 'system', ref: 'outbox' } },
    ], hasMore: false, nextCursor: '' });
    if (path.startsWith('/api/v1/inbox/')) return json({ item: { id: path.split('/')[4], title: '审批请求：发布 v1.4.0', body: '发布审批需要你确认。', type: 'approval', approvalId: APPROVAL_ID, severity: 'attention', read: true, needsAction: true, archived: false, createdAt: hoursAgo(2), actor: { type: 'human', ref: 'bob' } } });

    const approval = { id: APPROVAL_ID, targetType: 'agent', targetRef: AGENT_ID, issueId: ISSUE_ID, runId: 'run-1', requestedBy: { type: 'agent', ref: 'reviewer' }, approverRef: 'alice', status: 'pending', reason: '发布 v1.4.0 前需要人工确认。', request: { command: 'deploy --dry-run' }, version: 1, createdAt: hoursAgo(2), updatedAt: hoursAgo(2) };
    if (path === '/api/v1/approvals') return json({ items: [approval] });
    if (path.startsWith('/api/v1/approvals/')) return json({ approval });

    if (path === `/api/v1/issues/${ISSUE_ID}`) return json({ issue: issues[0] });
    if (path === `/api/v1/issues/${ISSUE_ID}/comments`) return json({ items: [
      { id: 'c-1', issueId: ISSUE_ID, threadRootId: 'c-1', author: { type: 'agent', ref: 'reviewer' }, content: '第 3 轮评审已通过，等待验收。', type: 'result', version: 1, createdAt: hoursAgo(4), updatedAt: hoursAgo(4) },
      { id: 'c-2', issueId: ISSUE_ID, threadRootId: 'c-1', parentId: 'c-1', author: { type: 'human', ref: 'alice' }, content: '收到，我先核对验收标准。', type: 'comment', version: 1, createdAt: hoursAgo(3), updatedAt: hoursAgo(3) },
    ], nextCursor: '' });
    if (path === `/api/v1/issues/${ISSUE_ID}/activity`) return json({ items: [
      { id: 'a-1', issueId: ISSUE_ID, action: 'issue.status_changed', actor: { type: 'agent', ref: 'reviewer' }, objectType: 'issue', objectRef: ISSUE_ID, details: { from: 'in_progress', to: 'in_review' }, createdAt: hoursAgo(4) },
    ] });
    if (path === `/api/v1/issues/${ISSUE_ID}/subscribers`) return json({ items: [{ subscriberType: 'human', subscriberRef: 'alice' }] });
    if (path === `/api/v1/issues/${ISSUE_ID}/artifacts`) return json({ items: [{ id: 'art-1', filename: 'review-report.md', sizeBytes: 20480, createdAt: hoursAgo(4) }] });
    if (path === `/api/v1/issues/${ISSUE_ID}/children`) return json({ items: [
      { id: 'child-1', identifier: 'JICH-101.1', title: '补齐深色主题对比度', status: 'done', priority: 'normal', parentIssueId: ISSUE_ID, tenant: 'default', namespace: 'default', kind: 'user_work', visibility: 'work_hub', completionPolicy: 'review', creator: { type: 'human', ref: 'alice' }, createdAt: hoursAgo(20), updatedAt: hoursAgo(8), version: 2 },
      { id: 'child-2', identifier: 'JICH-101.2', title: '补移动端断点截图', status: 'in_progress', priority: 'normal', parentIssueId: ISSUE_ID, tenant: 'default', namespace: 'default', kind: 'user_work', visibility: 'work_hub', completionPolicy: 'review', creator: { type: 'human', ref: 'alice' }, createdAt: hoursAgo(18), updatedAt: hoursAgo(2), version: 1 },
    ] });
    if (path === `/api/v1/issues/${ISSUE_ID}/summary`) return json({ summary: { issueId: ISSUE_ID, title: issues[0].title, status: 'in_review', commentCount: 2, unresolvedThreads: 0, activeTasks: 1, terminalTasks: 2, childCount: 2, updatedAt: hoursAgo(1) } });
    if (path === '/api/v1/agent-tasks') return json({ items: [
      { id: 'task-1', tenant: 'default', namespace: 'default', issueId: ISSUE_ID, orchestrationRunId: 'run-1', agentId: AGENT_ID, status: 'failed', priority: 1, triggerType: 'issue', originator: { type: 'human', ref: 'alice' }, errorCode: 'tool_error', version: 2, createdAt: hoursAgo(2) },
    ] });

    if (path === '/api/v1/teams') return json({ items: [{ id: 'team-1', name: '评审机器人组', status: 'active' }, { id: 'team-2', name: '值班分派组', status: 'active' }] });
    if (path === '/api/v1/orchestration-definitions') return json({ definitions: [{ id: 'wf-1', tenant: 'default', namespace: 'default', name: '发布校验流', draftSpec: { nodes: [] }, draftVersion: 1, version: 1, createdAt: hoursAgo(20), updatedAt: hoursAgo(10) }] });

    if (path === `/api/v1/agents/${AGENT_ID}`) return json({ agent: { id: AGENT_ID, agentKey: AGENT_ID, displayName: '评审助手', name: '评审助手', description: '负责代码评审与结果验收的智能体。', runtimeKind: 'managed', tenant: 'default', namespace: 'default', ownerRef: 'alice', ownerType: 'user', status: 'active', version: 1 } });
    if (path.endsWith('/definition')) return json({ agent: { id: AGENT_ID, name: '评审助手', version: 1 }, definition: { id: AGENT_ID, name: '评审助手', version: 1, tools: [], mcpServers: [], skills: [{ name: 'review' }], workspaceId: 'pack', workspaceBinding: { version: 1, digest: 'abc', overrides: [], instructions: '保持简洁' }, definitionDigest: 'digest', system: '你是评审助手。' } });
    if (path.endsWith('/tools/catalog/builtins')) return json([{ id: 'web_search', description: '联网检索' }]);
    if (path.endsWith('/tools/catalog/mcp-servers')) return json([]);
    if (path.endsWith('/workspace-capabilities')) return json({ bindings: [], applications: [] });
    if (path === `/api/v1/agents/${AGENT_ID}/overview`) return json({ readiness: { state: 'ready' }, instances: { healthy: 1 }, usage: { totalTokens: 23800, errorCount: 1, status: 'ok' } });
    if (path.endsWith('/bindings')) return json({ items: [{ id: 'binding', agentId: AGENT_ID, kind: 'managed', enabled: true, priority: 100, configuration: {} }] });
    if (path.endsWith('/agent-instances')) return json({ items: [] });
    if (path.endsWith('/agent-tasks') || path.endsWith('/agent-sessions')) return json({ items: [] });

    // ---- JICH-340 阶段 C 第二批（C7–C13）视觉基线数据 ----

    // C7 版本历史 + 版本对比
    if (path === `/api/v1/agents/${AGENT_ID}/versions`) return json({ versions: [
      { version: 3, snapshot: { name: '评审助手', model: 'dashscope:qwen-max', system: '你是评审助手。', maxIters: 12 }, createdAt: hoursAgo(1) },
      { version: 2, snapshot: { name: '评审助手', model: 'dashscope:qwen-plus', system: '你是评审助手。', maxIters: 8 }, createdAt: hoursAgo(26) },
      { version: 1, snapshot: { name: '评审助手', model: 'dashscope:qwen-plus', system: '初版提示词', maxIters: 8 }, createdAt: hoursAgo(72) },
    ] });
    const versionMatch = path.match(/\/agents\/[^/]+\/versions\/(\d+)$/);
    if (versionMatch) {
      const snapshots: Record<string, Record<string, unknown>> = {
        1: { name: '评审助手', model: 'dashscope:qwen-plus', system: '初版提示词', maxIters: 8 },
        2: { name: '评审助手', model: 'dashscope:qwen-plus', system: '你是评审助手。', maxIters: 8 },
        3: { name: '评审助手', model: 'dashscope:qwen-max', system: '你是评审助手。', maxIters: 12 },
      };
      return json({ version: { version: Number(versionMatch[1]), snapshot: snapshots[versionMatch[1]], createdAt: hoursAgo(2) } });
    }

    // C8 执行记录：运行时尝试
    if (path === '/api/v1/execution-attempts') return json({ attempts: [
      { id: 'att-1', tenant: 'default', namespace: 'default', agentTaskId: 'task-1', backendKind: 'sandbox', attempt: 1, state: 'failed', hostId: 'host-1', startedAt: hoursAgo(2), createdAt: hoursAgo(2) },
    ] });

    // C9 会话运维
    if (path === '/api/v1/agents' && url.searchParams.get('presence')) return json({ items: [{ id: AGENT_ID, agentKey: AGENT_ID, name: '评审助手', displayName: '评审助手', status: 'active', runtimeKind: 'managed', tenant: 'default', namespace: 'default' }] });
    if (path === '/api/v1/sessions') return json({ sessions: [
      { id: 's-1', sessionId: 'sess-9f31', agentName: '评审助手', agentId: AGENT_ID, namespace: 'default', framework: 'agent_scope_java', phase: 'idle', startedAt: hoursAgo(5), lastActiveAt: hoursAgo(1), snapshot: { contextPressure: 0.42, effectiveMessageCount: 18 } },
      { id: 's-2', sessionId: 'sess-a0b2', agentName: '评审助手', agentId: AGENT_ID, namespace: 'default', framework: 'agent_scope_java', phase: 'active', busy: true, startedAt: hoursAgo(1), lastActiveAt: hoursAgo(0.1), snapshot: { contextPressure: 0.78, effectiveMessageCount: 44 } },
    ] });

    // C10 团队编排：限额折叠 + 配置摘要
    if (path === '/api/v1/teams/team-1/overview') return json({ team: {
      id: 'team-1', tenant: 'default', namespace: 'default', name: '评审机器人组', description: '负责评审与验收的常驻团队。', instructions: '按评审清单执行，结果需附证据。', status: 'active', leaderAgentId: AGENT_ID,
      members: [{ id: 'm-1', teamId: 'team-1', agentId: 'reviewer-2', role: 'worker', instructions: '执行静态检查' }],
      policy: { maxHops: 5, maxFanout: 10 }, version: 3, createdAt: hoursAgo(80), updatedAt: hoursAgo(9),
    }, overview: {
      teamId: 'team-1', observedAt: hoursAgo(0.1), readiness: 'ready', reason: '成员全部就绪',
      members: [
        { agentId: AGENT_ID, role: 'lead', leader: true, readiness: { state: 'ready', reason: 'ok' } },
        { agentId: 'reviewer-2', role: 'worker', leader: false, readiness: { state: 'ready', reason: 'ok' } },
      ],
      runs: { total: 12, activeTasks: 1 }, endpoints: { total: 1, published: 1 },
    } });

    // C11 工作流设计器 / C12 运行追踪
    const wfSpec = { nodes: [
      { key: 'start-review', type: 'agent', agentId: AGENT_ID, issueMode: 'inherit', failurePolicy: 'fail_fast' },
      { key: 'needs-approval', type: 'condition', issueMode: 'inherit', failurePolicy: 'fail_fast' },
      { key: 'human-approval', type: 'approval', issueMode: 'inherit', failurePolicy: 'fail_fast', approval: { approverRef: 'alice', prompt: '请审批发布' } },
      { key: 'merge', type: 'join', issueMode: 'inherit', failurePolicy: 'fail_fast', join: { mode: 'all' } },
    ], edges: [
      { from: 'start-review', to: 'needs-approval', on: ['succeeded'] },
      { from: 'needs-approval', to: 'human-approval', on: ['succeeded'] },
      { from: 'human-approval', to: 'merge', on: ['succeeded'] },
    ] };
    if (path === '/api/v1/orchestration-definitions/wf-1') return json({ definition: { id: 'wf-1', tenant: 'default', namespace: 'default', name: '发布校验流', draftSpec: wfSpec, draftVersion: 2, version: 2, createdAt: hoursAgo(20), updatedAt: hoursAgo(10) } });
    if (path === '/api/v1/orchestration-definitions/wf-1/revisions') return json({ revisions: [{ id: 'rev-1', definitionId: 'wf-1', revision: 1, name: '发布校验流 r1', spec: wfSpec, createdAt: hoursAgo(12) }] });
    if (path === '/api/v1/orchestration-runs/run-1' || path === '/api/v1/orchestration-runs/run-1/graph') {
      const graph = {
        run: runs[0],
        definition: { id: 'wf-1', tenant: 'default', namespace: 'default', name: '发布校验流', draftSpec: wfSpec, draftVersion: 2, version: 2, createdAt: hoursAgo(20), updatedAt: hoursAgo(10) },
        revision: { id: 'rev-1', definitionId: 'wf-1', revision: 1, name: '发布校验流 r1', createdAt: hoursAgo(12) },
        nodes: [
          { id: 'n-1', nodeKey: 'start-review', type: 'agent', state: 'succeeded', startedAt: hoursAgo(2) },
          { id: 'n-2', nodeKey: 'needs-approval', type: 'condition', state: 'succeeded', startedAt: hoursAgo(2) },
          { id: 'n-3', nodeKey: 'human-approval', type: 'approval', state: 'waiting', startedAt: hoursAgo(1.5) },
        ],
        edges: [
          { id: 'e-1', fromNodeId: 'n-1', toNodeId: 'n-2', onStates: ['succeeded'] },
          { id: 'e-2', fromNodeId: 'n-2', toNodeId: 'n-3', onStates: ['succeeded'] },
        ],
        tasks: [{ id: 'task-1', agentId: AGENT_ID, status: 'failed', runNodeId: 'n-1' }],
        attempts: [],
        childRuns: [],
      };
      return path.endsWith('/graph') ? json(graph) : json({ run: runs[0] });
    }
    if (path === '/api/v1/orchestration-runs/run-1/events') return json({ events: [] });

    // C13 API 端点
    if (path === '/api/v1/endpoints/ep-1') return json({ endpoint: { id: 'ep-1', tenant: 'default', namespace: 'default', name: '评审结果查询', slug: 'review-result', description: '查询评审结论的稳定公开 API。', targetType: 'agent', targetRef: AGENT_ID, invocationMode: 'conversation', eventSchemaVersion: 'v1', timeoutSeconds: 300, maxPayloadBytes: 1048576, authPolicy: { type: 'api_key' }, rateLimit: { requests: 60, windowSeconds: 60 }, activeReleaseId: 'rel-1', activeRelease: 1, status: 'published', version: 2, createdAt: hoursAgo(60), updatedAt: hoursAgo(10) } });
    if (path === '/api/v1/endpoints/ep-1/readiness') return json({ readiness: { state: 'ready', reason: '目标智能体在线', compatible: true } });
    if (path === '/api/v1/endpoints/ep-1/credentials') return json({ items: [{ id: 'cred-1', endpointId: 'ep-1', name: '默认调用凭据', keyPrefix: 'k3f9', status: 'active', createdAt: hoursAgo(60), lastUsedAt: hoursAgo(1) }] });
    if (path === '/api/v1/endpoints/ep-1/invocations') return json({ items: [{ id: 'inv-1', endpointId: 'ep-1', status: 'completed', correlationId: 'corr-1', createdAt: hoursAgo(1) }] });
    if (path === '/api/v1/endpoints/ep-1/releases') return json({ items: [{ id: 'rel-1', endpointId: 'ep-1', number: 1, targetType: 'agent', targetRef: AGENT_ID, reason: 'initial publish', activatedAt: hoursAgo(58) }] });

    if (path.endsWith('/events/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
    return json({ items: [], summary: {} });
  });
}
