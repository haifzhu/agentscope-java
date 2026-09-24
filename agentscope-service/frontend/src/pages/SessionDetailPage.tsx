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

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  agentTaskDetailPath,
  getManagedSession,
  ManagedSession,
  parseAgentTaskExternalKey,
} from '../api/managedSessions';
import ChatPanel from '../components/ChatPanel';
import SessionTranscript from '../components/SessionTranscript';
import { BackButton } from '../components/ui/back-button';
import { Badge } from '../components/ui/badge';
import { Tabs } from '../components/ui/tabs';
import { cn } from '../lib/utils';

type Tab = 'chat' | 'details';

export default function SessionDetailPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'details' ? 'details' : 'chat';
  const [session, setSession] = useState<ManagedSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getManagedSession(sessionId)
      .then(s => { if (!cancelled) setSession(s); })
      .catch(e => {
        if (!cancelled) {
          setSession(null);
          setErr(e instanceof Error ? e.message : '会话加载失败');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'chat') params.delete('tab');
    else params.set('tab', 'details');
    setSearchParams(params, { replace: true });
  }

  if (!sessionId) {
    return (
      <div className="p-8 text-sm text-danger-text">
        缺少会话 ID。<Link className="underline" to="/managed/sessions">返回会话列表</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-sm text-text-4">会话加载中…</div>;
  }

  if (err || !session) {
    return (
      <div className="p-8 text-sm text-danger-text">
        {err || '未找到该会话。'}{' '}
        <Link className="underline" to="/managed/sessions">返回会话列表</Link>
        {' · '}
        <Link className="underline" to="/managed/sessions/new">新建会话</Link>
      </div>
    );
  }

  const taskRef = parseAgentTaskExternalKey(session.externalKey);
  const fromTask = !!taskRef;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3.5 border-b border-border bg-surface px-5 pt-3.5 sm:px-7">
        <BackButton label="返回" onClick={() => navigate(-1)} />
        <h1 className="m-0 text-[17px] font-bold text-text">会话</h1>
        <span
          className="font-mono text-[12.5px] text-text-4"
          title={session.id}
        >
          {session.id}
        </span>
        {fromTask && (
          <Badge tone="success" title={session.externalKey || undefined}>
            AgentTask
          </Badge>
        )}
        <span className="flex-1" />
        <Tabs
          aria-label="会话视图切换"
          value={tab}
          onChange={next => setTab(next as Tab)}
          items={[
            { value: 'chat', label: fromTask ? '执行记录' : '聊天' },
            { value: 'details', label: '详情' },
          ]}
        />
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          tab === 'chat' ? 'flex flex-col overflow-hidden' : 'overflow-auto',
        )}
      >
        {tab === 'chat' ? (
          <>
            {taskRef && (
              <div className="mx-5 mt-3 shrink-0 rounded-[10px] border border-success-soft bg-success-soft px-3.5 py-3 text-sm leading-6 text-success-text sm:mx-7">
                该会话执行 AgentTask <strong>{taskRef.agentTaskId}</strong>。此处不支持直接聊天——请前往{' '}
                <Link to={agentTaskDetailPath(taskRef)} className="font-semibold text-success-text underline">
                  AgentTask 详情页
                </Link>{' '}
                继续持久化讨论。
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ChatPanel
                sessionId={session.id}
                agentId={session.agentId}
                readOnly={fromTask}
              />
            </div>
          </>
        ) : (
          <SessionTranscript
            agentId={session.agentId}
            sessionId={session.id}
            embedded
            onDeleted={() => navigate('/managed/sessions', { replace: true })}
          />
        )}
      </div>
    </div>
  );
}
