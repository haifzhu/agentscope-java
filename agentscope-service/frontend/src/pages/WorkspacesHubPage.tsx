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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { createWorkspace, deleteWorkspace, listWorkspaces, WorkspaceSummary } from '../api/workspaces';
import { useControlPlaneScope } from '../app/ScopeContext';
import { EmptyState } from '../components/EmptyState';
import { Page, PageHeader } from '../components/Page';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { apiErrorMessage } from '../lib/apiError';

export default function WorkspacesHubPage() {
  const navigate = useNavigate();
  const scope = useControlPlaneScope();
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function reload() {
    try {
      setItems(await listWorkspaces());
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace({ name: name.trim() });
      setName('');
      setCreateOpen(false);
      navigate(scope.scopedPath(`/agent-center/workspaces/${encodeURIComponent(ws.id)}`));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="工作空间"
        description="在可复用的工作空间中编写技能、工具、子智能体与 AGENTS.md，再将智能体绑定到它。"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建工作空间</Button>}
      />
      {err && <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger-text">{err}</div>}
      {items.length ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-xs text-text-3">共 {items.length} 个工作空间</div>
          <div className="divide-y divide-border">
            {items.map((workspace) => (
              <div key={workspace.id} className="group flex items-center gap-3 px-5 py-4 hover:bg-hover">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-3"><FolderOpen className="h-4 w-4" /></span>
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(scope.scopedPath(`/agent-center/workspaces/${encodeURIComponent(workspace.id)}`))}>
                  <div className="truncate text-sm font-semibold text-text group-hover:text-primary">{workspace.name}</div>
                  <div className="mt-1 truncate text-xs text-text-3">
                    {workspace.description || workspace.id} · v{workspace.version}{workspace.agentsMdExists ? ' · AGENTS.md' : ''} · {workspace.skillCount ?? 0} skills · {workspace.subagentCount ?? 0} subagents
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-text-3 hover:text-danger-text"
                  aria-label={`删除 ${workspace.name}`}
                  onClick={() => setPending({ id: workspace.id, name: workspace.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-4 w-4 text-text-3" />
              </div>
            ))}
          </div>
        </Card>
      ) : !err && <EmptyState title="暂无工作空间" description="创建工作空间，在多个智能体间共享工具、技能与操作说明。" action={<Button size="sm" onClick={() => setCreateOpen(true)}>创建工作空间</Button>} />}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>新建工作空间</DialogTitle><DialogDescription>为智能体的工具、技能与操作说明建一个可复用的家。</DialogDescription></DialogHeader>
          <DialogBody>
            <form onSubmit={(event) => { event.preventDefault(); void onCreate(); }} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium text-text-2">名称<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="研究工作空间" autoFocus required /></label>
              <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button type="submit" disabled={creating || !name.trim()}>{creating ? '创建中…' : '创建工作空间'}</Button></div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? `删除工作空间「${pending.name}」？` : ''}
        description="工作空间及其技能、子智能体定义都会被移除，此操作不可恢复。"
        dangerLevel="danger"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={async () => {
          const target = pending;
          setPending(null);
          if (!target) return;
          try {
            await deleteWorkspace(target.id);
            await reload();
          } catch (cause: unknown) {
            setErr(apiErrorMessage(cause, '删除失败'));
          }
        }}
      />
    </Page>
  );
}
