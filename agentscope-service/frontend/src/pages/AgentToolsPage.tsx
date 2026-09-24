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
import ToolsActivePanel from '../components/ToolsActivePanel';
import ToolsCatalogPanel from '../components/ToolsCatalogPanel';
import LinkedWorkspaceBanner from '../components/LinkedWorkspaceBanner';
import McpConnectionsEditor from '../components/McpConnectionsEditor';
import { getAgent, updateAgent } from '../api/agents';
import type { AgentDefinition } from '../api/agents';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

const HELP_CLASS = 'border-b border-border bg-surface-2 px-6 py-2 text-xs leading-5 text-text-3';

/** C7：定义「工具与 MCP」分区，令牌化 + 中文化。 */
export default function AgentToolsPage() {
  const { agentId, agent, canEdit = false, refreshAgent } = useOutletContext<{ agentId: string; agent: AgentDefinition | null; canEdit?: boolean; refreshAgent?: () => Promise<unknown> }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [browseOpen, setBrowseOpen] = useState(false);
  const linked = agent?.workspaceId;
  const toolsEditable = canEdit && (!linked || !!agent?.workspaceBinding?.overrides.includes('tools'));
  const mcpEditable = toolsEditable && (!linked || !!agent?.workspaceBinding?.overrides.includes('mcpServers'));

  const bumpRefresh = () => { setRefreshKey(k => k + 1); void refreshAgent?.(); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {linked ? (
        <LinkedWorkspaceBanner workspaceId={linked} resource="tools" hasOverrides={!!agent?.workspaceBinding?.overrides.includes('tools')} />
      ) : (
        <div className={HELP_CLASS}>
          选择该智能体在新会话中可使用的工具；需要你批准才能运行的工具请选择<b>询问</b>。
        </div>
      )}
      {agent?.runtimeKind === 'hosted-runtime' && <div role="note" className={HELP_CLASS}>
        目录中的内置工具属于平台托管智能体。托管运行时使用自身原生工具，支持情况取决于提供方；
        Codex 不应用这些内置策略，沙箱与审批设置请在其运行时档案中配置。MCP 连接可在下方配置。
      </div>}
      <div className="min-h-0 flex-1 overflow-auto">
        {agent && <McpConnectionsEditor servers={agent.mcpServers ?? []} tools={agent.tools ?? []} readOnly={!mcpEditable} canConnect={canEdit} onOAuthConnected={async vaultId => {
          const latest = await getAgent(agentId);
          if (!(latest.defaultVaultIds ?? []).includes(vaultId)) {
            await updateAgent(agentId, { name: latest.name, version: latest.version, defaultVaultIds: [...(latest.defaultVaultIds ?? []), vaultId] });
          }
          await refreshAgent?.();
        }} onSave={async (servers, tools) => {
          await updateAgent(agentId, { name: agent.name, version: agent.version, mcpServers: servers, tools });
          bumpRefresh();
        }} />}
        <ToolsActivePanel
          agentId={agentId}
          refreshKey={refreshKey}
          onChange={bumpRefresh}
          onRequestBrowse={() => setBrowseOpen(true)}
          readOnly={!toolsEditable}
          mcpReadOnly={!mcpEditable}
        />
      </div>
      <Dialog open={browseOpen && toolsEditable} onOpenChange={setBrowseOpen}>
        <DialogContent className="h-[min(640px,86vh)] max-w-[820px]">
          <DialogHeader>
            <DialogTitle>配置工具</DialogTitle>
            <DialogDescription>为该智能体选择内置工具并添加 MCP 连接。</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ToolsCatalogPanel agentId={agentId} onSaved={bumpRefresh} allowMcp={mcpEditable} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
