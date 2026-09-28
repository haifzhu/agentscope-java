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
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, KeyRound, Lock, Plus, Trash2 } from 'lucide-react';
import {
  Vault,
  addCredential,
  archiveVault,
  createVault,
  deleteCredential,
  deleteVault,
  listCredentials,
  listVaults,
  updateCredential,
  updateVault,
  validateCredential,
} from '../api/vaults';
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
import { Input } from '../components/ui/input';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Page, PageHeader } from '../components/Page';
import { apiErrorMessage } from '../lib/apiError';
import { childQueryKey, collectionQueryKey } from '../lib/resourceQueryKeys';
import { cn } from '../lib/utils';

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

/** 凭据类型的中文标签：下拉与列表共用一份，避免两处各写一套。 */
const CRED_TYPE_LABEL: Record<string, string> = {
  static_bearer: 'MCP Bearer 令牌',
  mcp_oauth: 'MCP OAuth 令牌（可选刷新）',
  environment_variable: '显式环境变量占位',
  api_key: '通用密钥（仅存储）',
};

export default function VaultsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Vault | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creatingVault, setCreatingVault] = useState(false);
  const [addingCred, setAddingCred] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [credType, setCredType] = useState('static_bearer');
  const [credLabel, setCredLabel] = useState('');
  const [credTarget, setCredTarget] = useState('');
  const [credSecret, setCredSecret] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<
    { kind: 'archiveVault' | 'deleteVault'; vault: Vault }
    | { kind: 'deleteCredential'; vault: Vault; credentialId: string }
  >();
  const [renaming, setRenaming] = useState<Vault | null>(null);
  const [renameText, setRenameText] = useState('');
  // 密钥轮换改为 Dialog 表单（安全 LOW-1）：原生 prompt 无法遮蔽输入，
  // 也无法做「只写不读」的可见提示。
  const [rotating, setRotating] = useState<{ vault: Vault; credentialId: string } | null>(null);
  const [rotateSecret, setRotateSecret] = useState('');

  // D 阶段 MEDIUM-2：密钥库与凭据列表迁到 Query；凭据按密钥库 id 分键，
  // 快速切换密钥库时晚到的响应不会覆盖当前选中库。
  const vaultsQuery = useQuery({ queryKey: collectionQueryKey('vaults'), queryFn: listVaults, retry: false });
  const vaults = vaultsQuery.data ?? [];
  const credentialsQuery = useQuery({
    queryKey: childQueryKey('vaults', selected?.id ?? '', 'credentials'),
    queryFn: () => listCredentials(selected!.id),
    enabled: !!selected,
    retry: false,
  });
  const credentials = credentialsQuery.data ?? [];
  const loading = vaultsQuery.isLoading;
  const errorText = vaultsQuery.error
    ? apiErrorMessage(vaultsQuery.error, '加载失败')
    : selected && credentialsQuery.error
      ? apiErrorMessage(credentialsQuery.error, '凭据加载失败')
      : err;

  const refreshVaults = () => queryClient.invalidateQueries({ queryKey: collectionQueryKey('vaults') });
  const refreshCredentials = (vaultId: string) =>
    queryClient.invalidateQueries({ queryKey: childQueryKey('vaults', vaultId, 'credentials') });

  async function handleCreateVault(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultName.trim()) return;
    setBusyId('create');
    try {
      const created = await createVault({ displayName: vaultName.trim() });
      setCreatingVault(false);
      setVaultName('');
      await refreshVaults();
      setSelected(created);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '创建失败'));
    } finally {
      setBusyId(null);
    }
  }

  function openRename(v: Vault) {
    setRenaming(v);
    setRenameText(v.displayName);
    setErr(null);
  }

  async function handleRenameVault(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const next = renameText.trim();
    if (!next || next === renaming.displayName) {
      setRenaming(null);
      return;
    }
    setBusyId(renaming.id);
    setErr(null);
    try {
      await updateVault(renaming.id, { displayName: next });
      await refreshVaults();
      if (selected?.id === renaming.id) setSelected({ ...renaming, displayName: next });
      setRenaming(null);
    } catch (ex: unknown) {
      setErr(apiErrorMessage(ex, '重命名失败'));
    } finally {
      setBusyId(null);
    }
  }

  async function runVaultAction(vault: Vault, kind: 'archive' | 'delete') {
    setBusyId(vault.id);
    setErr(null);
    try {
      if (kind === 'archive') await archiveVault(vault.id);
      else await deleteVault(vault.id);
      if (selected?.id === vault.id) setSelected(null);
      queryClient.removeQueries({ queryKey: childQueryKey('vaults', vault.id, 'credentials') });
      await refreshVaults();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, kind === 'archive' ? '归档失败' : '删除失败'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleValidateCredential(credentialId: string) {
    if (!selected) return;
    setBusyId(credentialId);
    try {
      const result = await validateCredential(selected.id, credentialId);
      const detail = Object.entries(result.checks)
        .map(([k, v]) => `${k}=${v}`)
        .join('、');
      window.alert(result.ok ? `有效（${detail}）` : `无效（${detail}）`);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '校验失败'));
    } finally {
      setBusyId(null);
    }
  }

  function openRotate(vault: Vault, credentialId: string) {
    setRotating({ vault, credentialId });
    setRotateSecret('');
    setErr(null);
  }

  async function handleRotateSecret(e: React.FormEvent) {
    e.preventDefault();
    if (!rotating || !rotateSecret) return;
    setBusyId(rotating.credentialId);
    setErr(null);
    try {
      await updateCredential(rotating.vault.id, rotating.credentialId, { secret: rotateSecret });
      setRotating(null);
      setRotateSecret('');
      await refreshCredentials(rotating.vault.id);
    } catch (ex: unknown) {
      setErr(apiErrorMessage(ex, '更新失败'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !credLabel.trim() || !credSecret.trim()) return;
    setBusyId('cred');
    try {
      if (!credTarget.trim()) throw new Error('请填写连接名称、端点 URL 或环境变量名。');
      if (credType === 'environment_variable' && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(credTarget.trim()))
        throw new Error('请填写合法的环境变量名。');
      if (credType === 'mcp_oauth') {
        const value = JSON.parse(credSecret) as { access_token?: string };
        if (typeof value.access_token !== 'string' || !value.access_token)
          throw new Error('OAuth 凭据必须包含 access_token。');
      }
      await addCredential(selected.id, {
        type: credType,
        label: credLabel.trim(),
        target: credTarget.trim(),
        secret: credSecret,
      });
      setAddingCred(false);
      setCredLabel('');
      setCredTarget('');
      setCredSecret('');
      await refreshCredentials(selected.id);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '添加失败'));
    } finally {
      setBusyId(null);
    }
  }

  async function runCredentialDelete(vault: Vault, credentialId: string) {
    setBusyId(credentialId);
    setErr(null);
    try {
      await deleteCredential(vault.id, credentialId);
      await refreshCredentials(vault.id);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '删除失败'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="密钥库"
        description="管理智能体通过密钥库绑定可使用的凭据。每条凭据的目标标识其服务的连接或环境变量。"
        actions={
          <Button onClick={() => setCreatingVault(true)}>
            <Plus className="h-4 w-4" /> 新建密钥库
          </Button>
        }
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning-soft bg-warning-soft p-4 text-sm leading-6 text-warning-text">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        密钥值为只写——添加后仅显示元数据（类型、标签、目标）。
      </div>
      <AsyncState
        status={loading ? 'loading' : errorText ? 'error' : vaults.length ? 'ready' : 'empty'}
        resource="密钥库"
        errorDescription={errorText ?? undefined}
        onRetry={() => void refreshVaults()}
        emptyDescription="尚未创建密钥库。"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
          <div className="space-y-3">
            {vaults.map((v) => (
              <Card
                key={v.id}
                className={cn(
                  'cursor-pointer space-y-2 p-4',
                  selected?.id === v.id && 'border-primary bg-primary-soft',
                )}
                onClick={() => setSelected(v)}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-text-3" />
                  <span className="flex-1 truncate text-sm font-semibold">{v.displayName}</span>
                </div>
                <div className="font-mono text-xs text-text-3">{v.id}</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRename(v);
                    }}
                  >
                    重命名
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPending({ kind: 'archiveVault', vault: v });
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
                      setPending({ kind: 'deleteVault', vault: v });
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
                <ResourceConsumers kind="vault" id={selected.id} />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">{selected.displayName} · 凭据</h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddingCred(true)}>
                    <Plus className="h-3.5 w-3.5" /> 新增凭据
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-3">
                      <th className="py-2 pr-3 font-medium">标签</th>
                      <th className="py-2 pr-3 font-medium">类型</th>
                      <th className="py-2 pr-3 font-medium">目标</th>
                      <th className="py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map((c) => (
                      <tr key={c.id} className="border-b border-border">
                        <td className="py-2.5 pr-3">{c.label}</td>
                        <td className="py-2.5 pr-3"><code>{c.type}</code></td>
                        <td className="py-2.5 pr-3">{c.target || '—'}</td>
                        <td className="space-x-2 py-2.5 whitespace-nowrap">
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleValidateCredential(c.id)}>
                            校验
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => selected && openRotate(selected, c.id)}>
                            轮换
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="text-danger-text" onClick={() => selected && setPending({ kind: 'deleteCredential', vault: selected, credentialId: c.id })}>
                            <Trash2 className="h-3.5 w-3.5" /> 删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {credentials.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-text-3">
                          该密钥库暂无凭据。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            ) : (
              <div className="py-16 text-center text-text-3">
                选择左侧密钥库管理其凭据。
              </div>
            )}
          </div>
        </div>
      </AsyncState>

      <Dialog open={creatingVault} onOpenChange={setCreatingVault}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>新建密钥库</DialogTitle>
            <DialogDescription>集中存放智能体运行所需的凭据。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleCreateVault} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                显示名称
                <Input value={vaultName} onChange={(e) => setVaultName(e.target.value)} autoFocus required />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setCreatingVault(false)}>取消</Button>
                <Button type="submit" disabled={busyId === 'create' || !vaultName.trim()}>创建</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={addingCred && !!selected} onOpenChange={(open) => !open && setAddingCred(false)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>新增凭据</DialogTitle>
            <DialogDescription>密钥只写不读；目标决定凭据注入的位置。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleAddCredential} className="space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                类型
                <select className={selectClass} value={credType} onChange={(e) => setCredType(e.target.value)}>
                  {Object.entries(CRED_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                标签
                <Input value={credLabel} onChange={(e) => setCredLabel(e.target.value)} autoFocus required />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                目标
                <Input
                  value={credTarget}
                  onChange={(e) => setCredTarget(e.target.value)}
                  placeholder={credType === 'environment_variable' ? 'CRM_TOKEN' : 'crm 或 https://crm.example/mcp'}
                  required
                />
              </label>
              <p className="text-xs leading-5 text-text-3">
                {credType === 'environment_variable'
                  ? '只有被显式引用的 ${VARIABLE} 值才会替换进 MCP 请求头、环境变量或查询参数。'
                  : 'Bearer 与 OAuth 凭据按连接名或完整端点 URL（含路径）匹配。'}
              </p>
              {credType === 'mcp_oauth' && (
                <p className="text-xs leading-5 text-text-3">
                  请输入包含 access_token 与可选 expires_at 的
                  JSON。自动续期还需 refresh.token_endpoint、client_id 与
                  refresh_token；客户端认证可在 refresh.token_endpoint_auth
                  中配置。刷新凭据保留在控制面。
                </p>
              )}
              <label className="block space-y-2 text-sm font-medium">
                密钥（只写）
                <Input type="password" value={credSecret} onChange={(e) => setCredSecret(e.target.value)} required />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setAddingCred(false)}>取消</Button>
                <Button type="submit" disabled={busyId === 'cred'}>添加</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(undefined); }}
        title={
          pending?.kind === 'deleteVault'
            ? `删除密钥库「${pending.vault.displayName}」及其全部凭据？`
            : pending?.kind === 'archiveVault'
              ? `归档密钥库「${pending.vault.displayName}」？`
              : pending?.kind === 'deleteCredential'
                ? '删除该凭据？'
                : ''
        }
        description={
          pending?.kind === 'deleteVault'
            ? '该密钥库及其全部凭据将被永久删除，此操作不可恢复。'
            : pending?.kind === 'archiveVault'
              ? '归档后不再向会话注入凭据，既有内容保留。'
              : pending?.kind === 'deleteCredential'
                ? '删除后使用该凭据的智能体将无法再读取密钥。'
                : undefined
        }
        dangerLevel={pending?.kind === 'archiveVault' ? 'warning' : 'danger'}
        confirmLabel={pending?.kind === 'archiveVault' ? '归档' : '删除'}
        cancelLabel="取消"
        busy={
          !!pending && (pending.kind === 'deleteCredential'
            ? busyId === pending.credentialId
            : busyId === pending.vault.id)
        }
        onConfirm={() => {
          if (!pending) return;
          const target = pending;
          setPending(undefined);
          if (target.kind === 'deleteCredential') void runCredentialDelete(target.vault, target.credentialId);
          else void runVaultAction(target.vault, target.kind === 'archiveVault' ? 'archive' : 'delete');
        }}
      />

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>重命名密钥库</DialogTitle>
            <DialogDescription>仅修改展示名称，已有凭据与授权不变。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleRenameVault} className="space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                展示名称
                <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>取消</Button>
                <Button type="submit" disabled={busyId === renaming?.id || !renameText.trim()}>保存</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rotating} onOpenChange={(open) => !open && setRotating(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>轮换密钥</DialogTitle>
            <DialogDescription>
              新值保存后立即生效，旧值作废。密钥只写不读，保存后不再回显。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleRotateSecret} className="space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                新的密钥值
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={rotateSecret}
                  onChange={(e) => setRotateSecret(e.target.value)}
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setRotating(null)}>取消</Button>
                <Button type="submit" disabled={busyId === rotating?.credentialId || !rotateSecret}>轮换</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

    </Page>
  );
}
