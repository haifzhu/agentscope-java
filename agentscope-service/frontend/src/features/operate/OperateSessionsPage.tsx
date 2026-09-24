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

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Page, PageHeader } from '@/components/Page';
import { PressureGauge } from '@/components/PressureGauge';
import { fetchManagedAgents, fetchRuntimeSessions, phaseTone, sessionDetailPath } from './api';
import { useControlPlaneScope } from '@/app/ScopeContext';

const PAGE_SIZE = 50;
const PHASES = ['active', 'idle', 'compressing', 'archived', 'terminated'] as const;

const PHASE_LABELS: Record<string, string> = {
  active: '活跃', idle: '空闲', compressing: '压缩中', archived: '已归档', terminated: '已终止',
};

function isPhase(v: string): v is (typeof PHASES)[number] {
  return (PHASES as readonly string[]).includes(v);
}

export default function OperateSessionsPage() {
  const scope = useControlPlaneScope();
  const [params, setParams] = useSearchParams();
  const [agent, setAgent] = useState(() => params.get('agent') || '');
  const [phase, setPhase] = useState(() => {
    const p = params.get('phase') || '';
    return isPhase(p) ? p : '';
  });
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const nextPhase = params.get('phase') || '';
    const nextAgent = params.get('agent') || '';
    setPhase(isPhase(nextPhase) ? nextPhase : '');
    setAgent(nextAgent);
    setOffset(0);
  }, [params]);

  function updatePhase(next: string) {
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('phase', next);
    else nextParams.delete('phase');
    setParams(nextParams, { replace: true });
  }

  function updateAgent(next: string) {
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('agent', next);
    else nextParams.delete('agent');
    setParams(nextParams, { replace: true });
  }

  const agents = useQuery({
    queryKey: ['v1-agents', scope.namespace, 'all'],
    queryFn: () => fetchManagedAgents({ presence: 'all', namespace: scope.namespace }),
    refetchInterval: 30_000,
  });

  const sessions = useQuery({
    queryKey: ['runtime-sessions', scope.namespace, agent, phase, offset],
    queryFn: () =>
      fetchRuntimeSessions({
        agent: agent || undefined,
        phase: phase || undefined,
        namespace: scope.namespace,
        limit: PAGE_SIZE,
        offset,
      }),
    refetchInterval: 10_000,
  });

  const list = sessions.data?.sessions || [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((s) => {
      const hay = [s.sessionId, s.id, s.agentName, s.namespace, s.phase, s.framework]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [list, q]);

  const agentOptions = (agents.data?.items || [])
    .map((a) => a.name)
    .filter(Boolean)
    .sort();

  const canPrev = offset > 0;
  const can下一页 = list.length >= PAGE_SIZE;

  return (
    <Page>
      <PageHeader
        title="会话运维"
        description="跨智能体与执行后端的会话上下文。"
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">智能体</span>
          <select
            className="h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={agent}
            onChange={(e) => updateAgent(e.target.value)}
          >
            <option value="">全部智能体</option>
            {agentOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">状态</span>
          <select
            className="h-10 min-w-[9rem] rounded-lg border border-border bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={phase}
            onChange={(e) => updatePhase(e.target.value)}
          >
            <option value="">全部状态</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-[16rem] flex-1 gap-1 text-sm">
          <span className="text-muted-foreground">搜索</span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按会话 ID、智能体筛选本页…"
          />
        </label>
      </div>

      {list.length === 0 && !sessions.isLoading ? (
        <EmptyState title="暂无会话" description="当前筛选条件下没有会话。" />
      ) : filtered.length === 0 && !sessions.isLoading ? (
        <EmptyState title="没有匹配" description={`本页没有匹配「${q.trim()}」的会话。`} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-1">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2/70 text-[11px] font-semibold tracking-[0.08em] text-text-3">
                <tr>
                  <th className="px-5 py-3.5 font-medium">智能体</th>
                  <th className="px-5 py-3.5 font-medium">会话</th>
                  <th className="px-5 py-3.5 font-medium">状态</th>
                  <th className="px-5 py-3.5 font-medium">上下文压力</th>
                  <th className="px-5 py-3.5 font-medium">消息数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id || `${s.agentName}/${s.sessionId}`} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-medium">{s.agentName}</td>
                    <td className="px-5 py-3.5">
                      <Link className="text-primary hover:underline" to={scope.scopedPath(sessionDetailPath(s))}>
                        {s.sessionId}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={phaseTone(s.phase)}>{PHASE_LABELS[s.phase] ?? s.phase}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <PressureGauge value={s.snapshot?.contextPressure} />
                    </td>
                    <td className="px-5 py-3.5 font-mono tabular-nums text-muted-foreground">
                      {s.snapshot?.effectiveMessageCount ?? s.snapshot?.messageCount ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              显示第 {offset + 1}–{offset + list.length} 条
              {q.trim() ? ` · ${filtered.length} 条匹配搜索` : ''}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canPrev || sessions.isFetching}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!can下一页 || sessions.isFetching}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
