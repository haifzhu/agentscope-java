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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAgents } from '../api/agents';
import NewManagedSessionForm from '../components/NewManagedSessionForm';
import { AgentPicker } from '../components/AgentPicker';
import { BackButton } from '../components/ui/back-button';
import { Card } from '../components/ui/card';
import { Page, PageHeader } from '../components/Page';

/**
 * Create a Managed session definition (static bind). Does not post user.message.
 */
export default function SessionCreatePage() {
  const [searchParams] = useSearchParams();
  const prefAgentId = searchParams.get('agentId') ?? '';
  const [agentId, setAgentId] = useState(prefAgentId);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    listAgents()
      .then(list => {
        if (cancelled) return;
        if (!prefAgentId && list.length === 1) {
          setAgentId(list[0].id);
        }
      })
      .catch(e => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : '智能体列表加载失败');
      });
    return () => { cancelled = true; };
  }, [prefAgentId]);

  useEffect(() => {
    if (prefAgentId) setAgentId(prefAgentId);
  }, [prefAgentId]);

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="新建会话"
        description="创建一个绑定智能体并完成挂载的会话资源。在聊天中发送消息之前不会开启任何一轮对话。"
        actions={<BackButton label="返回" onClick={() => navigate(-1)} />}
      />
      {loadErr && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-text">
          {loadErr}
        </p>
      )}

      <Card className="p-5">
        <span className="mb-1.5 block text-sm font-medium text-text-2">智能体</span>
        <div className="mb-5">
          <AgentPicker value={agentId} onChange={setAgentId} required aria-label="会话所属智能体" />
        </div>

        {agentId ? (
          <div className="rounded-xl border border-border bg-surface p-1">
            <NewManagedSessionForm
              agentId={agentId}
              modal={false}
              onCancel={() => navigate(agentId
                ? `/managed/sessions?agentId=${encodeURIComponent(agentId)}`
                : '/managed/sessions')}
              onCreated={session => {
                navigate(`/managed/sessions/${encodeURIComponent(session.id)}`, { replace: true });
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-text-4">
            请先选择一个智能体，再配置运行环境、密钥库与记忆库挂载。
          </p>
        )}
      </Card>
    </Page>
  );
}
