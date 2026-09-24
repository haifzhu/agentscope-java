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

import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SkillsWorkspacePanel from '../components/SkillsWorkspacePanel';
import LinkedWorkspaceBanner from '../components/LinkedWorkspaceBanner';
import type { AgentDefinition } from '../api/agents';

/** C7：定义「技能」分区，令牌化 + 中文化。 */
export default function AgentSkillsPage() {
  const { agentId, agent, canEdit = false, refreshAgent } = useOutletContext<{ agentId: string; agent: AgentDefinition | null; canEdit?: boolean; refreshAgent?: () => Promise<unknown> }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const linked = agent?.workspaceId;

  if (agent?.workspaceBinding) return <ResolvedDefinitionFiles agent={agent} prefix="skills/" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {linked ? (
        <LinkedWorkspaceBanner workspaceId={linked} resource="skills" />
      ) : (
        <div className="border-b border-border bg-surface-2 px-6 py-2 text-xs leading-5 text-text-3">
          在该智能体的私有工作区下管理技能。如需共享技能包，请创建工作区并在「定义 → 工作区」关联。
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SkillsWorkspacePanel
          agentId={agentId}
          refreshKey={refreshKey}
          onChange={() => { setRefreshKey(k => k + 1); void refreshAgent?.(); }}
          readOnly={!!linked || !canEdit}
        />
      </div>
    </div>
  );
}
