import ResolvedDefinitionFiles from '../components/ResolvedDefinitionFiles';

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

import React from 'react';
import { useOutletContext } from 'react-router-dom';
import SubagentPanel from '../components/SubagentPanel';
import LinkedWorkspaceBanner from '../components/LinkedWorkspaceBanner';
import type { AgentDefinition } from '../api/agents';

/** C7：定义「子智能体」分区，令牌化 + 中文化。 */
export default function AgentSubagentsPage() {
  const { agentId, agent, canEdit = false, refreshAgent } = useOutletContext<{ agentId: string; agent: AgentDefinition | null; canEdit?: boolean; refreshAgent?: () => Promise<unknown> }>();
  const linked = agent?.workspaceId;

  if (agent?.workspaceBinding) return <ResolvedDefinitionFiles agent={agent} prefix="subagents/" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {linked ? (
        <LinkedWorkspaceBanner workspaceId={linked} resource="subagents" />
      ) : (
        <div className="border-b border-border bg-surface-2 px-6 py-2 text-xs leading-5 text-text-3">
          子智能体以 <code>subagents/&lt;name&gt;.md</code>（带 YAML frontmatter）的形式存储。在「定义 → 工作区」关联工作区后可跨智能体共享。
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SubagentPanel onChanged={() => { void refreshAgent?.(); }} agentId={agentId} readOnly={!!linked || !canEdit} />
      </div>
    </div>
  );
}
