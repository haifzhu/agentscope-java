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

import { ResourceConsumers } from '../components/ResourceConsumers';
import React, { useEffect, useState } from 'react';
import { Archive, Database, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Memory,
  MemoryStore,
  archiveMemoryStore,
  createMemoryStore,
  deleteMemory,
  deleteMemoryStore,
  listMemories,
  listMemoryStores,
  putMemory,
  redactMemory,
} from '../api/memoryStores';
import { AsyncState } from '../components/ui/async-state';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input, Textarea } from '../components/ui/input';
import { Page, PageHeader } from '../components/Page';
import { cn } from '../lib/utils';

export default function MemoryStoresPage() {
  const [stores, setStores] = useState<MemoryStore[]>([]);
  const [selected, setSelected] = useState<MemoryStore | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refreshStores() {
    setLoading(true);
    setErr(null);
    try {
      setStores(await listMemoryStores());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadMemories(store: MemoryStore) {
    setSelected(store);
    setErr(null);
    try {
      setMemories(await listMemories(store.id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '记忆加载失败');
    }
  }

  useEffect(() => {
    void refreshStores();
  }, []);

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName.trim()) return;
    setBusyId('create');
    try {
      const created = await createMemoryStore({
        name: storeName.trim(),
        description: storeDesc.trim() || undefined,
      });
      setCreating(false);
      setStoreName('');
      setStoreDesc('');
      await refreshStores();
      await loadMemories(created);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchiveStore(id: string) {
    if (!confirm('确认归档该记忆库？归档后新会话将不再挂载它。')) return;
    setBusyId(id);
    try {
      await archiveMemoryStore(id);
      if (selected?.id === id) {
        setSelected(null);
        setMemories([]);
      }
      await refreshStores();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '归档失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteStore(id: string) {
    if (!confirm('确认删除该记忆库及其全部记忆？此操作不可恢复。')) return;
    setBusyId(id);
    try {
      await deleteMemoryStore(id);
      if (selected?.id === id) {
        setSelected(null);
        setMemories([]);
      }
      await refreshStores();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRedactMemory(path: string) {
    if (!selected) return;
    if (!confirm(`确认永久擦除「${path}」？版本历史将被清空。`)) return;
    setBusyId(path);
    try {
      await redactMemory(selected.id, path);
      await loadMemories(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '擦除失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !editing) return;
    setBusyId('save');
    try {
      await putMemory(selected.id, editing.path, { content: editing.content });
      setEditing(null);
      await loadMemories(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteMemory(path: string) {
    if (!selected || !confirm(`确认删除记忆「${path}」？`)) return;
    setBusyId(path);
    try {
      await deleteMemory(selected.id, path);
      await loadMemories(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="记忆库"
        description="存放跨会话共享的知识。可在智能体的资源设置中绑定，或在启动托管会话时附加。"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> 新建记忆库
          </Button>
        }
      />
      <div className="mb-5 rounded-xl border border-info-soft bg-info-soft p-4 text-sm leading-6 text-info-text">
        托管智能体通过记忆工具按需发现并读取已绑定的文档，完整记忆库不会自动加入每次模型提示。共享知识在执行期间为只读，请在此更新文档。会话工作记忆与本共享库相互独立。
      </div>
      <AsyncState
        status={loading ? 'loading' : err ? 'error' : stores.length ? 'ready' : 'empty'}
        resource="记忆库"
        errorDescription={err ?? undefined}
        onRetry={() => void refreshStores()}
        emptyDescription="尚未创建记忆库。"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
          <div className="space-y-3">
            {stores.map((s) => (
              <Card
                key={s.id}
                className={cn(
                  'cursor-pointer space-y-2 p-4',
                  selected?.id === s.id && 'border-primary bg-primary-soft',
                )}
                onClick={() => void loadMemories(s)}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-text-3" />
                  <span className="flex-1 truncate text-sm font-semibold">{s.name}</span>
                </div>
                {s.description && (
                  <div className="text-xs text-text-3">{s.description}</div>
                )}
                <div className="font-mono text-xs text-text-3">{s.id}</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleArchiveStore(s.id);
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" /> 归档
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-danger-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteStore(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div>
            {selected ? (
              <Card className="p-5">
                <ResourceConsumers kind="memory" id={selected.id} />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">{selected.name} · 记忆</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ path: 'notes.md', content: '' })}
                  >
                    <Plus className="h-3.5 w-3.5" /> 新增记忆
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-3">
                      <th className="py-2 pr-3 font-medium">路径</th>
                      <th className="py-2 pr-3 font-medium">版本</th>
                      <th className="py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memories.map((m) => (
                      <tr key={m.id} className="border-b border-border">
                        <td className="py-2.5 pr-3"><code>{m.path}</code></td>
                        <td className="py-2.5 pr-3">v{m.headVersion}</td>
                        <td className="space-x-2 py-2.5 whitespace-nowrap">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ path: m.path, content: m.content })}>
                            <Pencil className="h-3.5 w-3.5" /> 编辑
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleRedactMemory(m.path)}>
                            擦除
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="text-danger-text" onClick={() => void handleDeleteMemory(m.path)}>
                            <Trash2 className="h-3.5 w-3.5" /> 删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {memories.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-text-3">
                          该记忆库暂无记忆。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            ) : (
              <div className="py-16 text-center text-text-3">
                选择左侧记忆库查看其记忆。
              </div>
            )}
          </div>
        </div>
      </AsyncState>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>新建记忆库</DialogTitle>
            <DialogDescription>为跨会话的共享知识建一个家。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleCreateStore} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                名称
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} autoFocus required />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                描述
                <Input value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
                <Button type="submit" disabled={busyId === 'create' || !storeName.trim()}>创建</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing && !!selected} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>编辑记忆</DialogTitle>
            <DialogDescription>更新路径或内容后保存。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSaveMemory} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                路径
                <Input
                  value={editing?.path ?? ''}
                  onChange={(e) => editing && setEditing({ ...editing, path: e.target.value })}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                内容
                <Textarea
                  className="min-h-[140px] font-mono"
                  value={editing?.content ?? ''}
                  onChange={(e) => editing && setEditing({ ...editing, content: e.target.value })}
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>取消</Button>
                <Button type="submit" disabled={busyId === 'save'}>保存</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
