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

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bot, ChevronDown, CircleDot, GitBranch, Search, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

import { listTasks } from '@/api/collaboration';
import { listAttempts, listRuns } from '@/api/orchestration';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { EntityIdentityText, type EntityIdentityMap, useEntityIdentities } from '@/components/EntityIdentity';
import { Page, PageHeader } from '@/components/Page';
import { AsyncState } from '@/components/ui/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/format';
import {
  executionLabel,
  groupExecutions,
  isExecutionActive,
  matchesExecution,
  type ExecutionGroup,
} from './executions';

function tone(state: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (['completed', 'succeeded', 'partial_succeeded', 'healthy'].includes(state)) return 'success';
  if (['failed', 'cancelled', 'timed_out', 'lost'].includes(state)) return 'danger';
  if (['running', 'dispatched', 'leased'].includes(state)) return 'info';
  if (['planned', 'queued', 'waiting', 'paused', 'cancelling'].includes(state)) return 'warning';
  return 'default';
}

const STATE_LABELS: Record<string, string> = {
  completed: '已完成', succeeded: '已成功', partial_succeeded: '部分成功', healthy: '健康',
  failed: '失败', cancelled: '已取消', timed_out: '已超时', lost: '已失联',
  running: '运行中', dispatched: '已派发', leased: '已租约',
  planned: '已规划', queued: '排队中', waiting: '等待中', paused: '已暂停', cancelling: '取消中',
};

const MODE_LABELS: Record<string, string> = {
  direct: '直接执行', adaptive: '团队', declared: '工作流', subrun: '子运行',
  team: '团队', workflow: '工作流', issue: '事项',
};

function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state.replace(/_/g, ' ');
}

function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

function ExecutionCard({ group, identities }: { group: ExecutionGroup; identities: EntityIdentityMap }) {
  const scope = useControlPlaneScope();
  const { run, tasks, attempts } = group;
  const agents = [...new Set(tasks.map((task) => task.agentId))];
  const backendKinds = [...new Set(attempts.map((attempt) => attempt.backendKind))];
  // 失败节点折叠态高亮（C8）：折叠时也要一眼看出失败数量。
  const failedTaskCount = tasks.filter((task) => tone(task.status) === 'danger').length;
  const runFailed = tone(run.state) === 'danger';

  return (
    <details className={`group border-b border-border last:border-b-0 ${runFailed ? 'bg-danger-soft/40' : ''}`}>
      <summary className="flex cursor-pointer list-none items-start gap-4 rounded-lg px-5 py-5 transition-colors hover:bg-hover">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${runFailed ? 'border-danger bg-danger-soft text-danger-text' : 'border-border bg-surface text-text-3'}`}>
          {run.mode === 'direct' ? <Bot className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text">{executionLabel(group)}</span>
            <Badge tone={tone(run.state)}>{stateLabel(run.state)}</Badge>
            <span className="rounded-full bg-surface-3 px-2 py-1 text-[11px] font-medium tracking-wide text-text-3">{modeLabel(run.mode)}</span>
            {runFailed && failedTaskCount > 0 && (
              <span className="rounded-full border border-danger bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger-text">
                {failedTaskCount} 个失败节点
              </span>
            )}
          </span>
          <span className="mt-1.5 block text-xs text-text-3">
            {tasks.length} 个智能体步骤 · {attempts.length} 次运行时尝试 · {formatRelative(run.createdAt)}
          </span>
          <span className="mt-1 block truncate font-mono text-[11px] text-text-3">
            运行 {run.id.slice(0, 10)} · 事项 {run.rootIssueId.slice(0, 10)}
          </span>
          {!!agents.length && (
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-2">
              {agents.slice(0, 3).map((agentId) => <EntityIdentityText key={agentId} identities={identities} type="agent" entityRef={agentId} />)}
              {agents.length > 3 && <span className="text-text-3">+{agents.length - 3} 个</span>}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {!!backendKinds.length && <span className="hidden text-xs text-text-3 lg:block">{backendKinds.join(', ')}</span>}
          <ChevronDown className="mt-2 h-4 w-4 text-text-3 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t border-border bg-surface-2/50 px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-text-3">
            触发方式 <span className="font-medium text-text-2">{modeLabel(run.triggerType)}</span>
            {['waiting', 'paused'].includes(run.state) && run.waitReason && <> · 等待原因：{run.waitReason}</>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={scope.scopedPath(`/work/issues/${run.rootIssueId}`)}>打开事项</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={scope.scopedPath(`/work/executions/${run.id}`)}>执行详情</Link>
            </Button>
          </div>
        </div>

        {tasks.length ? (
          <ol className="space-y-3 border-l-2 border-border pl-5">
            {tasks.map((task) => {
              const taskAttempts = attempts.filter((attempt) => attempt.agentTaskId === task.id);
              const taskFailed = tone(task.status) === 'danger';
              return (
                <li key={task.id} className={`relative rounded-xl border p-4 ${taskFailed ? 'border-danger bg-danger-soft/40' : 'border-border bg-surface'}`}>
                  <span className={`absolute -left-[1.7rem] top-5 h-3 w-3 rounded-full border-2 border-surface ${taskFailed ? 'bg-danger' : 'bg-text-3'}`} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <EntityIdentityText identities={identities} type="agent" entityRef={task.agentId} secondary />
                        {task.teamRole && <span className="text-xs text-text-3">角色 {task.teamRole}</span>}
                        <Badge tone={tone(task.status)}>{stateLabel(task.status)}</Badge>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-text-3">智能体任务 {task.id.slice(0, 10)} · {modeLabel(task.triggerType)}</div>
                    </div>
                    <Link className="text-xs font-medium text-primary hover:underline" to={scope.scopedPath(`/work/executions/tasks/${task.id}`)}>诊断</Link>
                  </div>
                  {taskAttempts.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {taskAttempts.map((attempt) => (
                        <div key={attempt.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                          <Server className="h-3.5 w-3.5 shrink-0 text-text-3" />
                          <span className="min-w-0 flex-1 truncate text-text-2">
                            {attempt.backendKind} · 第 {attempt.attempt} 次尝试
                            {attempt.hostId && <span className="block truncate text-[11px] text-text-3">主机 <EntityIdentityText identities={identities} type="runtime_host" entityRef={attempt.hostId} /></span>}
                          </span>
                          <Badge tone={tone(attempt.state)}>{stateLabel(attempt.state)}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-text-3">尚未创建运行时尝试。</p>}
                </li>
              );
            })}
          </ol>
        ) : <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-3">该执行尚未创建智能体任务。</p>}
      </div>
    </details>
  );
}

export default function ExecutionsPage() {
  const scope = useControlPlaneScope();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const runs = useQuery({
    queryKey: ['orchestration-runs', scope.tenant, scope.namespace, 'executions'],
    queryFn: () => listRuns(scope.tenant, scope.namespace),
    refetchInterval: 5_000,
	refetchIntervalInBackground: false,
  });
  const tasks = useQuery({
    queryKey: ['agent-tasks', scope.tenant, scope.namespace, 'executions'],
    queryFn: () => listTasks(scope.tenant, scope.namespace),
    refetchInterval: 5_000,
	refetchIntervalInBackground: false,
  });
  const attempts = useQuery({
    queryKey: ['execution-attempts', scope.tenant, scope.namespace, 'executions'],
    queryFn: () => listAttempts(scope.tenant, scope.namespace),
    refetchInterval: 5_000,
	refetchIntervalInBackground: false,
  });

  const groups = useMemo(
    () => groupExecutions(runs.data?.runs || [], tasks.data?.items || [], attempts.data?.attempts || []),
    [attempts.data?.attempts, runs.data?.runs, tasks.data?.items],
  );
  const identities = useEntityIdentities([
    ...(tasks.data?.items || []).map(task => ({ type: 'agent', ref: task.agentId })),
    ...(attempts.data?.attempts || []).map(attempt => ({ type: 'runtime_host', ref: attempt.hostId })),
  ]);
  const filtered = useMemo(() => groups.filter((group) => {
    if (status === 'active' && !isExecutionActive(group.run)) return false;
    if (status === 'failed' && group.run.state !== 'failed') return false;
    if (status === 'succeeded' && !['succeeded', 'partial_succeeded'].includes(group.run.state)) return false;
    if (mode && group.run.mode !== mode) return false;
    return matchesExecution(group, search);
  }), [groups, mode, search, status]);
  const loading = runs.isPending || tasks.isPending || attempts.isPending;
  const failed = groups.filter((group) => group.run.state === 'failed').length;
  const active = groups.filter((group) => isExecutionActive(group.run)).length;

  return (
    <Page>
      <PageHeader
        title="执行记录"
        description="从编排运行、智能体任务到物理运行时尝试的统一运维时间线。"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-3"><CircleDot className="h-4 w-4" /> 进行中的执行</div><div className="mt-2 text-2xl font-semibold text-text">{loading ? '—' : active}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-3"><Activity className="h-4 w-4" /> 智能体步骤</div><div className="mt-2 text-2xl font-semibold text-text">{loading ? '—' : tasks.data?.items.length || 0}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-3"><Server className="h-4 w-4" /> 失败的执行</div><div className="mt-2 text-2xl font-semibold text-text">{loading ? '—' : failed}</div></Card>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
          <Input className="pl-9 shadow-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索运行、事项、智能体、任务或主机" />
        </label>
        <div className="flex gap-2">
          <select aria-label="执行状态" className="h-10 rounded-lg border border-border-control bg-surface px-3 text-sm text-text" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="failed">失败</option>
            <option value="succeeded">已成功</option>
          </select>
          <select aria-label="执行方式" className="h-10 rounded-lg border border-border-control bg-surface px-3 text-sm text-text" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="">全部方式</option>
            <option value="direct">直接执行</option>
            <option value="adaptive">团队</option>
            <option value="declared">工作流</option>
            <option value="subrun">子运行</option>
          </select>
        </div>
      </div>

      <AsyncState
        status={loading ? 'loading' : runs.isError || tasks.isError || attempts.isError ? 'error' : groups.length === 0 ? 'empty' : 'ready'}
        resource="执行记录"
        emptyDescription="分派事项、调用端点任务或启动工作流后，这里会出现对应的执行。"
        errorDescription="加载执行记录失败，请稍后重试。"
        onRetry={() => { void runs.refetch(); void tasks.refetch(); void attempts.refetch(); }}
      >
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-xs text-text-3">
            <span>{filtered.length === 0 ? '没有匹配的执行' : `共 ${filtered.length} 个执行`}</span>
            <span>展开执行可下钻智能体任务与运行时尝试</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-3">换个搜索词或筛选条件试试。</p>
          ) : (
            filtered.map((group) => <ExecutionCard key={group.run.id} group={group} identities={identities} />)
          )}
        </Card>
      </AsyncState>
    </Page>
  );
}
