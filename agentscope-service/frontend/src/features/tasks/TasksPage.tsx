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

/*
 * Copyright 2024-2026 the original author or authors.
 * Licensed under the Apache License, Version 2.0.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { listTasks } from '@/api/collaboration';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { EntityIdentityText, entityDisplayName, useEntityIdentities } from '@/components/EntityIdentity';
import { EmptyState } from '@/components/EmptyState';
import { Page, PageHeader } from '@/components/Page';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/format';

const TASK_STATUS_LABEL: Record<string, string> = {
  completed: '已完成', failed: '失败', cancelled: '已取消',
  running: '运行中', dispatched: '已派发', pending: '待处理',
};

function tone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success';
  if (['failed', 'cancelled'].includes(status)) return 'danger';
  if (['running', 'dispatched'].includes(status)) return 'info';
  return 'warning';
}

export default function TasksPage() {
  const scope = useControlPlaneScope();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const tasks = useQuery({
    queryKey: ['agent-tasks', scope.tenant, scope.namespace, status],
    queryFn: () => listTasks(scope.tenant, scope.namespace, status),
    refetchInterval: 5000,
  });
  const identities = useEntityIdentities((tasks.data?.items || []).flatMap(task => [
    { type: 'agent', ref: task.agentId },
    { type: 'issue', ref: task.issueId },
    { type: 'team', ref: task.teamId },
  ]));
  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tasks.data?.items || []).filter((task) => !needle || [task.id, task.issueId, task.agentId, entityDisplayName(identities, 'agent', task.agentId), entityDisplayName(identities, 'issue', task.issueId), task.teamRole, task.triggerType, task.status].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [identities, search, tasks.data?.items]);

  return (
    <Page>
      <PageHeader
        title="智能体任务"
        description="由分派、讨论、委派、自动化或重试产生的执行义务。"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
          <Input className="pl-9 shadow-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务" />
        </label>
        <select className="h-10 rounded-lg border border-border bg-surface px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="dispatched">已派发</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      {!tasks.isLoading && !items.length ? (
        <EmptyState title={search ? '没有匹配的任务' : '暂无智能体任务'} description={search ? '换个搜索词或状态筛选试试。' : '在事项中分派或 @ 某个智能体即可创建任务。'} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-text-3"><span>{tasks.isPending ? '正在加载任务…' : `共 ${items.length} 个任务`}</span><span className="hidden sm:block">Updated automatically</span></div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3"><tr><th className="px-5 py-3">任务</th><th className="px-4 py-3">事项</th><th className="px-4 py-3">智能体 / 角色</th><th className="px-4 py-3">输入</th><th className="px-4 py-3">状态</th><th className="w-12 px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
              <tbody className="divide-y divide-border">{items.map((task) => (
                <tr key={task.id} className="group hover:bg-surface-2/70">
                  <td className="px-5 py-4"><Link className="font-mono text-sm font-medium text-text group-hover:text-primary" to={scope.scopedPath(`/work/executions/tasks/${task.id}`)}>{task.id.slice(0, 10)}</Link><div className="mt-1 text-xs text-text-3">{formatRelative(task.createdAt)}</div></td>
                  <td className="px-4 py-4"><Link className="text-xs text-text-2 hover:text-primary" to={scope.scopedPath(`/work/issues/${task.issueId}`)}><EntityIdentityText identities={identities} type="issue" entityRef={task.issueId} secondary /></Link></td>
                  <td className="px-4 py-4"><EntityIdentityText identities={identities} type="agent" entityRef={task.agentId} /><div className="mt-1 text-xs text-text-3">{task.teamRole || task.triggerType}</div></td>
                  <td className="px-4 py-4 text-text-2">{task.inputs?.length || 0}</td>
                  <td className="px-4 py-4"><Badge tone={tone(task.status)}>TASK_STATUS_LABEL[task.status] ?? task.status</Badge></td>
                  <td className="px-4 py-4 text-text-3"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">{items.map((task) => (
            <Link key={task.id} to={scope.scopedPath(`/work/executions/tasks/${task.id}`)} className="flex gap-3 px-4 py-4 hover:bg-hover">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-3"><Bot className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><div className="truncate font-mono text-sm font-medium text-text">{task.id.slice(0, 10)}</div><div className="mt-1 truncate text-xs text-text-3"><EntityIdentityText identities={identities} type="agent" entityRef={task.agentId} /> · {formatRelative(task.createdAt)}</div><Badge className="mt-2" tone={tone(task.status)}>TASK_STATUS_LABEL[task.status] ?? task.status</Badge></div>
              <ChevronRight className="mt-2 h-4 w-4 text-text-3" />
            </Link>
          ))}</div>
        </Card>
      )}
    </Page>
  );
}
