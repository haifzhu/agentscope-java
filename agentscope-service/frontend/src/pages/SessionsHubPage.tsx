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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  ManagedSession,
  ManagedSessionListStatus,
  archiveManagedSession,
  agentTaskDetailPath,
  deleteManagedSession,
  isAgentTaskSession,
  listManagedSessions,
  parseAgentTaskExternalKey,
  restoreManagedSession,
} from '../api/managedSessions';
import { AgentDefinition, listAgents } from '../api/agents';
import { Environment, listEnvironments } from '../api/environments';
import { Badge, type BadgeTone } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Tabs } from '../components/ui/tabs';
import { Page, PageHeader } from '../components/Page';

const selectClass =
  'h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text';

const STATUS_LABEL: Record<string, string> = {
  running: '运行中',
  idle: '空闲',
  active: '活跃',
  requires_action: '待处理',
  terminated: '已终止',
  archived: '已归档',
  rescheduled: '已重排',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  running: 'info',
  idle: 'success',
  active: 'success',
  requires_action: 'warning',
  terminated: 'neutral',
  archived: 'neutral',
  rescheduled: 'warning',
};

type SessionAction =
  | { kind: 'archive'; session: ManagedSession }
  | { kind: 'delete'; session: ManagedSession };

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function stopReasonSummary(stopReason: Record<string, unknown> | null | undefined): string | null {
  if (!stopReason || typeof stopReason !== 'object') return null;
  const type = stopReason.type;
  if (typeof type === 'string' && type) return type;
  try {
    const raw = JSON.stringify(stopReason);
    return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
  } catch {
    return null;
  }
}

function mountSummary(s: ManagedSession, envNameById: Map<string, string>): string {
  const env = envNameById.get(s.environmentId) || s.environmentId || '—';
  const vaults = s.vaultIds?.length ?? 0;
  const mems = s.memoryStoreIds?.length ?? 0;
  return `运行环境：${env} · 密钥库：${vaults} · 记忆库：${mems}`;
}

/**
 * Top-level Managed Sessions hub (`/sessions`). Optional `?agentId=` filter.
 */
export default function SessionsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const agentFilter = searchParams.get('agentId') ?? '';
  const [tab, setTab] = useState<ManagedSessionListStatus>('active');
  const [managedEntries, setManagedEntries] = useState<ManagedSession[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [envNameById, setEnvNameById] = useState<Map<string, string>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SessionAction>();
  const navigate = useNavigate();

  const agentNameById = useMemo(
    () => new Map(agents.map(a => [a.id, a.name])),
    [agents],
  );

  const newSessionHref = agentFilter
    ? `/managed/sessions/new?agentId=${encodeURIComponent(agentFilter)}`
    : '/managed/sessions/new';

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const [list, envs, agentList] = await Promise.all([
        listManagedSessions(agentFilter || undefined, tab),
        listEnvironments().catch(() => [] as Environment[]),
        listAgents().catch(() => [] as AgentDefinition[]),
      ]);
      setManagedEntries(list);
      setEnvNameById(new Map(envs.map(e => [e.id, e.name])));
      setAgents(agentList);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '会话列表加载失败');
    }
  }, [agentFilter, tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runAction(sessionId: string, action: () => Promise<unknown>) {
    setBusyId(sessionId);
    setErr(null);
    try {
      await action();
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title="会话"
        description="管理托管会话资源：开启聊天、查看执行记录、归档或删除。"
        actions={
          <>
            <label className="sr-only" htmlFor="session-agent-filter">按智能体筛选</label>
            <select
              id="session-agent-filter"
              className={selectClass}
              value={agentFilter}
              onChange={e => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set('agentId', e.target.value);
                else next.delete('agentId');
                setSearchParams(next, { replace: true });
              }}
            >
              <option value="">全部智能体</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Button asChild>
              <Link to={newSessionHref}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                新建会话
              </Link>
            </Button>
          </>
        }
      />

      <Tabs
        aria-label="会话状态筛选"
        value={tab}
        onChange={value => setTab(value as ManagedSessionListStatus)}
        items={[
          { value: 'active', label: '活跃' },
          { value: 'archived', label: '已归档' },
        ]}
      />

      {err && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-text">
          {err}
        </p>
      )}

      {!err && managedEntries.length === 0 && (
        <Card className="py-14 text-center text-[15px] text-text-4">
          {tab === 'archived' ? (
            '暂无已归档的会话。'
          ) : (
            <>
              还没有托管会话——{' '}
              <Link to={newSessionHref} className="font-semibold text-primary underline">新建一个会话</Link>。
            </>
          )}
        </Card>
      )}

      {managedEntries.map(s => {
        const reason = stopReasonSummary(s.stopReason);
        const archived = !!s.archivedAt;
        const agentLabel = agentNameById.get(s.agentId) || s.agentId;
        const taskRef = parseAgentTaskExternalKey(s.externalKey);
        const fromTask = isAgentTaskSession(s);
        return (
          <Card key={s.id} className="mb-3 p-5">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span
                className="flex-1 truncate text-[15.5px] font-semibold text-text"
                title={s.id}
              >
                {s.id}
              </span>
              {fromTask && (
                <Badge tone="success" title={s.externalKey || undefined}>AgentTask</Badge>
              )}
              <Badge tone={STATUS_TONE[s.status] ?? 'primary'}>
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
              <span className="shrink-0 text-[13px] text-text-4">{relTime(s.updatedAt)}</span>
            </div>
            <div className="mt-1.5 text-[13.5px] font-medium text-primary-text">{agentLabel}</div>
            {taskRef && (
              <div className="mt-1.5 text-[12.5px] text-success-text">
                来自 AgentTask {taskRef.agentTaskId}
              </div>
            )}
            {reason && (
              <div className="mt-1 truncate text-[12.5px] text-text-3" title={reason}>
                终止原因：{reason}
              </div>
            )}
            <div className="mt-2 text-[12.5px] text-text-3">{mountSummary(s, envNameById)}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12.5px]">
              {!archived && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  disabled={busyId === s.id}
                  onClick={() => navigate(`/managed/sessions/${encodeURIComponent(s.id)}`)}
                >
                  {fromTask ? '查看执行记录' : '打开聊天'}
                </Button>
              )}
              {taskRef && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() => navigate(agentTaskDetailPath(taskRef))}
                >
                  打开 AgentTask
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => navigate(`/managed/sessions/${encodeURIComponent(s.id)}?tab=details`)}
              >
                详情
              </Button>
              {!archived ? (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  disabled={busyId === s.id}
                  onClick={() => setPendingAction({ kind: 'archive', session: s })}
                >
                  归档
                </Button>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  disabled={busyId === s.id}
                  onClick={() => void runAction(s.id, () => restoreManagedSession(s.id))}
                >
                  恢复
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="px-0 text-danger-text"
                disabled={busyId === s.id}
                onClick={() => setPendingAction({ kind: 'delete', session: s })}
              >
                删除
              </Button>
            </div>
          </Card>
        );
      })}

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={open => { if (!open) setPendingAction(undefined); }}
        title={pendingAction?.kind === 'delete'
          ? `彻底删除会话「${pendingAction.session.id}」？`
          : pendingAction?.kind === 'archive'
            ? `归档会话「${pendingAction.session.id}」？`
            : ''}
        description={pendingAction?.kind === 'delete'
          ? '删除后该会话及其消息记录不可恢复。'
          : '归档后不再出现在活跃列表，可随时恢复。'}
        dangerLevel={pendingAction?.kind === 'delete' ? 'danger' : 'warning'}
        confirmLabel={pendingAction?.kind === 'delete' ? '删除' : '归档'}
        cancelLabel="取消"
        busy={!!pendingAction && busyId === pendingAction.session.id}
        onConfirm={() => {
          if (!pendingAction) return;
          const { session, kind } = pendingAction;
          setPendingAction(undefined);
          void runAction(session.id, () =>
            kind === 'delete' ? deleteManagedSession(session.id) : archiveManagedSession(session.id));
        }}
      />
    </Page>
  );
}
