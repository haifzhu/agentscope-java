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

import ResolvedDefinitionFiles from '../components/ResolvedDefinitionFiles';
import { updateAgent } from '../api/agents';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import WorkspaceFileTree from '../components/WorkspaceFileTree';
import WorkspaceEditor from '../components/WorkspaceEditor';
import LinkedWorkspaceBanner from '../components/LinkedWorkspaceBanner';
import type { AgentDefinition } from '../api/agents';

/** C7：定义「工作区」分区。已发布的文件 / 私有定义草稿两视图，令牌化 + 中文化。 */
export default function AgentWorkspacePage() {
  const { agentId, agent, canEdit = false, refreshAgent } = useOutletContext<{ agentId: string; agent: AgentDefinition | null; canEdit?: boolean; refreshAgent?: () => Promise<unknown> }>();
  const [view, setView] = useState('published');
  const [publishError, setPublishError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const linked = agent?.workspaceId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {linked && <LinkedWorkspaceBanner workspaceId={linked} resource="files" />}
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3 text-sm">
        <Button size="sm" variant={view === 'published' ? 'secondary' : 'ghost'} onClick={() => setView('published')}>已发布文件</Button>
        {!linked && <Button size="sm" variant={view === 'draft' ? 'secondary' : 'ghost'} onClick={() => setView('draft')}>私有定义草稿</Button>}
        {!linked && canEdit && <Button size="sm" disabled={publishing} onClick={async () => {
          if (!agent) return; setPublishError(''); setPublishing(true);
          try { await updateAgent(agentId, { name: agent.name, version: agent.version }); await refreshAgent?.(); setView('published'); }
          catch (e) { setPublishError(String(e)); } finally { setPublishing(false); }
        }}>{publishing ? '发布中…' : '发布私有文件'}</Button>}
        {publishError && <p role="alert" className="text-sm text-danger-text">{publishError}</p>}
      </div>
      {(linked || view === 'published') && agent ? <ResolvedDefinitionFiles agent={agent} /> :
      <div className="flex min-h-0 flex-1">
        <WorkspaceFileTree
          agentId={agentId}
          selectedPath={selected}
          onSelect={p => setSelected(p || null)}
        />
        <WorkspaceEditor agentId={agentId} path={selected} canEdit={canEdit} />
      </div>}
    </div>
  );
}
