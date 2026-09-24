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
import { Archive, KeyRound, Lock, Plus, Trash2 } from 'lucide-react';
import {
  Vault,
  VaultCredential,
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
import { Page, PageHeader } from '../components/Page';
import { cn } from '../lib/utils';

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

const CRED_TYPE_LABEL: Record<string, string> = {
  static_bearer: 'MCP Bearer 令牌',
  mcp_oauth: 'MCP OAuth 令牌（可选刷新）',
  environment_variable: '显式环境变量占位',
  api_key: '通用密钥（仅存储）',
};

export default function VaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selected, setSelected] = useState<Vault | null>(null);
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creatingVault, setCreatingVault] = useState(false);
  const [addingCred, setAddingCred] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [credType, setCredType] = useState('static_bearer');
  const [credLabel, setCredLabel] = useState('');
  const [credTarget, setCredTarget] = useState('');
  const [credSecret, setCredSecret] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refreshVaults() {
    setLoading(true);
    setErr(null);
    try {
      setVaults(await listVaults());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadCredentials(vault: Vault) {
    setSelected(vault);
    setErr(null);
    try {
      setCredentials(await listCredentials(vault.id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '凭据加载失败');
    }
  }

  useEffect(() => {
    void refreshVaults();
  }, []);

  async function handleCreateVault(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultName.trim()) return;
    setBusyId('create');
    try {
      const created = await createVault({ displayName: vaultName.trim() });
      setCreatingVault(false);
      setVaultName('');
      await refreshVaults();
      await loadCredentials(created);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenameVault(v: Vault) {
    const next = window.prompt('重命名密钥库', v.displayName);
    if (next == null || !next.trim() || next.trim() === v.displayName) return;
    setBusyId(v.id);
    try {
      await updateVault(v.id, { displayName: next.trim() });
      await refreshVaults();
      if (selected?.id === v.id) {
        setSelected({ ...v, displayName: next.trim() });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '重命名失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchiveVault(id: string) {
    if (!confirm('确认归档该密钥库？归档后不再向会话注入凭据。')) return;
    setBusyId(id);
    try {
      await archiveVault(id);
      if (selected?.id === id) {
        setSelected(null);
        setCredentials([]);
      }
      await refreshVaults();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '归档失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteVault(id: string) {
    if (!confirm('确认删除该密钥库及其全部凭据？此操作不可恢复。')) return;
    setBusyId(id);
    try {
      await deleteVault(id);
      if (selected?.id === id) {
        setSelected(null);
        setCredentials([]);
      }
      await refreshVaults();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
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
      setErr(e instanceof Error ? e.message : '校验失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotateSecret(credentialId: string) {
    if (!selected) return;
    const secret = window.prompt('输入新的密钥值（只写不读，保存后不再显示）');
    if (secret == null || !secret) return;
    setBusyId(credentialId);
    try {
      await updateCredential(selected.id, credentialId, { secret });
      await loadCredentials(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '更新失败');
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
      await loadCredentials(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '添加失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCredential(credentialId: string) {
    if (!selected || !confirm('确认删除该凭据？')) return;
    setBusyId(credentialId);
    try {
      await deleteCredential(selected.id, credentialId);
      await loadCredentials(selected);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
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
        status={loading ? 'loading' : err ? 'error' : vaults.length ? 'ready' : 'empty'}
        resource="密钥库"
        errorDescription={err ?? undefined}
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
                onClick={() => void loadCredentials(v)}
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
                      void handleRenameVault(v);
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
                      void handleArchiveVault(v.id);
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
                      void handleDeleteVault(v.id);
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
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleRotateSecret(c.id)}>
                            轮换
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="text-danger-text" onClick={() => void handleDeleteCredential(c.id)}>
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
                  <option value="static_bearer">MCP Bearer 令牌</option>
                  <option value="mcp_oauth">MCP OAuth 令牌（可选刷新）</option>
                  <option value="environment_variable">显式环境变量占位</option>
                  <option value="api_key">通用密钥（仅存储）</option>
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
    </Page>
  );
}
