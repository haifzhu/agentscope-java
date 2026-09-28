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

import { namespaceCan } from '../lib/namespaceScope';
import { useControlPlaneScope } from '../app/ScopeContext';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Environment,
  archiveEnvironment,
  createEnvironment,
  deleteEnvironment,
  listEnvironments,
  updateEnvironment,
} from '../api/environments';
import { HandsStatus, fetchHandsStatus } from '../api/hands';
import { AsyncState } from '../components/ui/async-state';
import { Badge } from '../components/ui/badge';
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
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Input, Textarea } from '../components/ui/input';
import { Page, PageHeader } from '../components/Page';
import { apiErrorMessage } from '../lib/apiError';

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

const TYPE_LABEL: Record<string, string> = {
  local: '本地',
  sandbox: '沙箱',
  remote: '远程',
  self_hosted: '自托管',
};

export default function EnvironmentsHubPage() {
  const canManage = namespaceCan(useControlPlaneScope().roles, 'configure');
  const queryClient = useQueryClient();
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Environment | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('local');
  const [editName, setEditName] = useState('');
  const [editConfigText, setEditConfigText] = useState('{}');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: 'archive' | 'delete'; env: Environment }>();

  // D 阶段 MEDIUM-2：列表与 Hands 状态迁到 Query，取代手写 refresh + useEffect。
  const envQuery = useQuery({
    queryKey: ['environments'],
    queryFn: listEnvironments,
    retry: false,
  });
  const handsQuery = useQuery({
    queryKey: ['hands-status'],
    queryFn: fetchHandsStatus,
    retry: false,
  });
  const items = envQuery.data ?? [];
  const hands: HandsStatus | null = handsQuery.data ?? null;
  const loading = envQuery.isLoading;
  const errorText = envQuery.error ? apiErrorMessage(envQuery.error, '加载失败') : err;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['environments'] });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusyId('create');
    setErr(null);
    try {
      const created = await createEnvironment({
        name: name.trim(),
        type: type.trim() || 'local',
      });
      setCreatedKey(created.apiKey ?? null);
      setCreating(false);
      setName('');
      setType('local');
      await refresh();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '创建失败'));
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(env: Environment) {
    setEditing(env);
    setEditName(env.name);
    setEditConfigText(JSON.stringify(env.config ?? {}, null, 2));
    setErr(null);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(editConfigText || '{}') as Record<string, unknown>;
    } catch {
      setErr('配置必须是合法的 JSON');
      return;
    }
    setBusyId(editing.id);
    setErr(null);
    try {
      await updateEnvironment(editing.id, { name: editName.trim(), config });
      setEditing(null);
      await refresh();
    } catch (ex: unknown) {
      setErr(apiErrorMessage(ex, '保存失败'));
    } finally {
      setBusyId(null);
    }
  }

  async function runEnvAction(env: Environment, kind: 'archive' | 'delete') {
    setBusyId(env.id);
    setErr(null);
    try {
      if (kind === 'archive') await archiveEnvironment(env.id);
      else await deleteEnvironment(env.id);
      await refresh();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, kind === 'archive' ? '归档失败' : '删除失败'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="运行环境"
        description="运行环境决定托管智能体在哪里读取文件、执行命令。新会话自动使用智能体的默认环境；可在此配置本地执行、远程文件系统、沙箱模板或自托管 Environment Worker，然后在智能体的运行时页或创建会话时选择。"
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> 新建环境
            </Button>
          ) : undefined
        }
      />
      <AsyncState
        status={loading ? 'loading' : errorText ? 'error' : items.length ? 'ready' : 'empty'}
        resource="运行环境"
        errorDescription={errorText ?? undefined}
        onRetry={() => void refresh()}
        emptyDescription="尚未创建自定义环境。托管会话需要时会自动创建默认环境。"
      >
        {canManage && hands && (
          <Card className="mb-6 space-y-1 p-5">
            <div className="text-sm font-semibold">Worker 状态</div>
            <div className="text-sm text-text-3">
              brain <code>{hands.brainInstanceId}</code> · 待处理工作{' '}
              {hands.pendingWorkItems} · 本地沙箱{' '}
              {hands.localSandboxRegistrySize}
            </div>
            <div className="text-xs text-text-3">
              workers:{' '}
              {Object.keys(hands.workerHeartbeats).length === 0
                ? '无'
                : Object.entries(hands.workerHeartbeats)
                    .map(
                      ([id, ts]) =>
                        `${id}@${new Date(ts).toLocaleTimeString()}`,
                    )
                    .join('、')}
            </div>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((env) => (
            <Card key={env.id} className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <MonitorSmartphone className="h-5 w-5 text-text-3" />
                <span className="flex-1 truncate text-sm font-semibold">
                  {env.name}
                </span>
                <Badge tone={env.archivedAt ? 'warning' : 'info'}>
                  {env.archivedAt
                    ? '已归档'
                    : (TYPE_LABEL[env.type] ?? env.type)}
                </Badge>
              </div>
              <div className="font-mono text-xs text-text-3">{env.id}</div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {!env.archivedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === env.id}
                      onClick={() => openEdit(env)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> 编辑
                    </Button>
                  )}
                  {!env.archivedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === env.id}
                      onClick={() => setPending({ kind: 'archive', env })}
                    >
                      <Archive className="h-3.5 w-3.5" /> 归档
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-danger-text"
                    disabled={busyId === env.id}
                    onClick={() => setPending({ kind: 'delete', env })}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </AsyncState>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>新建运行环境</DialogTitle>
            <DialogDescription>
              为智能体会话指定文件读写与命令执行的位置。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleCreate} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                名称
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="default-local"
                  autoFocus
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                类型
                <select
                  className={selectClass}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="local">本地（local）</option>
                  <option value="sandbox">沙箱（sandbox）</option>
                  <option value="remote">远程（remote）</option>
                  <option value="self_hosted">自托管（self_hosted）</option>
                </select>
              </label>
              {type === 'self_hosted' && (
                <p className="text-xs leading-5 text-text-3">
                  该环境下的会话会在每轮开始时从自托管的 Environment
                  Worker 挂载沙箱。运行会话前，请先使用该环境 ID 与 API
                  密钥启动外部 Worker。
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={busyId === 'create' || !name.trim()}>
                  {busyId === 'create' ? '创建中…' : '创建'}
                </Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>编辑运行环境</DialogTitle>
            <DialogDescription>调整名称与 JSON 配置。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleUpdate} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                名称
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                类型（只读）
                <Input value={editing?.type ?? ''} disabled />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                配置（JSON）
                <Textarea
                  className="min-h-[140px] font-mono text-xs"
                  value={editConfigText}
                  onChange={(e) => setEditConfigText(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={!editing || busyId === editing?.id}>
                  {busyId === editing?.id ? '保存中…' : '保存'}
                </Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdKey}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>环境 API 密钥</DialogTitle>
            <DialogDescription>
              请将该密钥配置到你的 Environment Worker
              中。密钥仅显示一次。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Input
              aria-label="API 密钥"
              readOnly
              value={createdKey ?? ''}
              onFocus={(e) => e.target.select()}
            />
            <Button className="mt-4" onClick={() => setCreatedKey(null)}>
              我已保存
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(undefined); }}
        title={pending?.kind === 'delete'
          ? `永久删除运行环境「${pending.env.name}」？`
          : pending?.kind === 'archive'
            ? `归档运行环境「${pending.env.name}」？`
            : ''}
        description={pending?.kind === 'delete'
          ? '该运行环境将被永久删除，此操作不可恢复。'
          : '归档后新会话不再选用它，既有配置保留。'}
        dangerLevel={pending?.kind === 'delete' ? 'danger' : 'warning'}
        confirmLabel={pending?.kind === 'delete' ? '删除' : '归档'}
        cancelLabel="取消"
        busy={!!pending && busyId === pending.env.id}
        onConfirm={() => {
          if (!pending) return;
          const target = pending;
          setPending(undefined);
          void runEnvAction(target.env, target.kind);
        }}
      />

    </Page>
  );
}
