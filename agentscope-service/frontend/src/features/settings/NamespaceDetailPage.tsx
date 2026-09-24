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
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNamespace, listManagedNamespaces, setNamespaceArchived, transferNamespace, updateNamespace, type Namespace } from '@/api/permissions';
import { getUserId, isAdmin } from '@/api/auth';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { Page, PageHeader } from '@/components/Page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { AccountPicker, ErrorNotice, MembersEditor, PermissionModelGuide, RoleBadges, RoleGuide } from './AccessComponents';
import { NamespaceAuditList } from './AccessLogPage';
import { NamespaceResources, AccessRequests } from './NamespaceResources';
import { NamespaceGroups } from './NamespaceGroups';
import { SharedTemplates } from './SharedTemplates';

export default function NamespaceDetailPage() {
  const { namespaceName = '' } = useParams(); const scope = useControlPlaneScope(); const qc = useQueryClient();
  const list = useQuery({ queryKey: ['managed-namespaces'], queryFn: listManagedNamespaces });
  const summary = list.data?.items.find(n => n.name === namespaceName);
  const query = useQuery({ queryKey: ['namespace-detail', namespaceName], queryFn: () => getNamespace(namespaceName), enabled: !!summary?.canManage });
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<Namespace>(); const tab = searchParams.get('tab') || (summary?.canManage ? 'members' : 'access');
  const setTab = (value: string) => { const next = new URLSearchParams(searchParams); next.set('tab', value); setSearchParams(next); };
  const [dialog, setDialog] = useState<'transfer' | 'archive' | null>(null); const [newOwner, setNewOwner] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setDraft(query.data?.namespace); }, [query.data]);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['namespace-detail', namespaceName] }); await qc.invalidateQueries({ queryKey: ['managed-namespaces'] }); await qc.invalidateQueries({ queryKey: ['namespace-audit'] }); await qc.invalidateQueries({ queryKey: ['account-namespaces'] }); scope.refreshNamespaces(); };
  const save = useMutation({ mutationFn: () => updateNamespace(draft!), onSuccess: async () => { setNotice('命名空间已保存。'); await refresh(); } });
  const transfer = useMutation({ mutationFn: () => transferNamespace(query.data!.namespace, newOwner), onSuccess: async () => { setDialog(null); setNewOwner(''); setNotice('所有权已转移。原所有者仍保留命名空间管理员身份。'); await refresh(); } });
  const archive = useMutation({ mutationFn: () => setNamespaceArchived(query.data!.namespace, !query.data!.namespace.archived), onSuccess: async () => { setDialog(null); setNotice('命名空间状态已更新。'); await refresh(); } });
  const canOwn = !!draft && (draft.owner === getUserId() || isAdmin());
  const TAB_LABELS: Record<string, string> = { members: '成员', access: '访问', resources: '资源', 'user groups': '用户组', requests: '访问申请', 'shared templates': '共享模板', settings: '设置', 'access log': '访问日志' };
  const tabs = summary?.canManage ? ['members', 'resources', ...(summary.kind === 'shared' ? ['user groups'] : []), 'requests', 'shared templates', 'settings', 'access log'] : ['access', 'resources', ...(summary?.kind === 'shared' ? ['user groups'] : []), 'requests', 'shared templates'];
  return <Page><Link className="text-sm text-text-3 hover:text-primary" to="/settings/namespaces">← 命名空间</Link><PageHeader title={summary?.displayName || namespaceName} description={<span>{namespaceName} · {summary?.kind === 'personal' ? '个人空间' : summary?.kind === 'global' ? '全局空间' : '共享空间'}</span>} actions={summary?.archived ? <Badge>已归档</Badge> : <RoleBadges roles={summary?.roles} />} />
    <ErrorNotice error={list.error || query.error || save.error} />
    {notice && <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success-text">{notice}</p>}
    {list.isLoading || query.isLoading && summary?.canManage ? <p className="text-sm text-text-3">正在加载命名空间…</p> : !summary ? <p className="rounded-xl border p-6 text-sm text-text-3">该命名空间不可用，或你已失去访问权限。</p> : <>
      <nav aria-label="命名空间设置" className="flex gap-5 overflow-x-auto border-b">{tabs.map(t => <button type="button" key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium capitalize ${tab === t || tabs.length === 1 ? 'border-primary text-primary-text' : 'border-transparent text-text-3'}`}>{TAB_LABELS[t] || t}</button>)}</nav>
      {!summary.canManage && (tab === "access" || tab === "members") && <section className="space-y-4 rounded-xl border p-5"><h2 className="font-semibold">你在该命名空间的访问权限</h2><RoleBadges roles={summary.roles} /><p className="text-sm text-text-3">{summary.kind === 'global' ? '该全局命名空间对所有账号可用，由平台管理。' : `如需调整访问权限，请联系命名空间所有者（${summary.owner}）。`}个别工作可能另有共享规则。</p><RoleGuide /><PermissionModelGuide /></section>}
      {summary.canManage && draft && tab === 'members' && <section className="space-y-5"><div><h2 className="text-lg font-semibold">成员与权限</h2><p className="mt-1 text-sm text-text-3">成员关系决定该命名空间的权限。平台角色在「用户」中单独管理。</p></div>{draft.kind === 'personal' ? <p className="rounded-xl border p-5 text-sm text-text-3">个人命名空间的成员固定为其所有者。</p> : <><MembersEditor key={namespaceName} namespace={namespaceName} owner={draft.owner} members={draft.members || {}} onChange={members => { setNotice(''); setDraft({ ...draft, members }); }} /><Button disabled={save.isPending || Object.values(draft.members || {}).some(r => !r.length)} onClick={() => save.mutate()}>{save.isPending ? '保存中…' : '保存成员关系'}</Button></>}<details className="rounded-xl border p-5"><summary className="cursor-pointer text-sm font-medium">角色权限说明</summary><div className="mt-4 space-y-4"><RoleGuide /><PermissionModelGuide /></div></details></section>}
      {summary.canManage && draft && tab === 'settings' && <div className="max-w-3xl space-y-5"><section className="space-y-4 rounded-xl border p-5"><h2 className="font-semibold">基本信息</h2><label className="block space-y-2 text-sm">显示名称<Input value={draft.displayName} maxLength={200} onChange={e => setDraft({ ...draft, displayName: e.target.value })} /></label><p className="text-xs text-text-3">命名空间标识符保持为 {draft.name} 不变。</p><Button disabled={!draft.displayName.trim() || save.isPending} onClick={() => save.mutate()}>保存设置</Button></section>{draft.kind === 'shared' && canOwn && <><section className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">所有权</h2><p className="text-sm text-text-3">将职责转移给另一个可用账号。原所有者保留管理员访问权限。</p><Button variant="outline" disabled={draft.archived} onClick={() => setDialog('transfer')}>转移所有权</Button></section><section className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">{draft.archived ? '恢复命名空间' : '归档命名空间'}</h2><p className="text-sm text-text-3">归档会保留资源与历史，但移除成员访问。恢复后访问权限重新生效。</p><Button variant="outline" onClick={() => setDialog('archive')}>{draft.archived ? '恢复命名空间' : '归档命名空间'}</Button></section></>}</div>}
      {tab === 'resources' && <NamespaceResources namespace={namespaceName} />}
      {tab === 'user groups' && <NamespaceGroups namespace={namespaceName} />}
      {tab === 'requests' && <AccessRequests namespace={namespaceName} />}
      {tab === 'shared templates' && <SharedTemplates namespace={namespaceName} />}
      {summary.canManage && tab === 'access log' && <NamespaceAuditList name={namespaceName} />}
    </>}
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent size="md"><DialogHeader><DialogTitle>{dialog === 'transfer' ? '转移命名空间所有权' : draft?.archived ? '恢复命名空间' : '归档命名空间'}</DialogTitle><DialogDescription>{dialog === 'transfer' ? '选择将拥有该命名空间的账号。' : `这将改变 ${summary?.displayName || namespaceName} 的成员访问。资源与历史会保留。`}</DialogDescription></DialogHeader><DialogBody><div className="space-y-4">{dialog === 'transfer' && <AccountPicker namespace={namespaceName} value={newOwner} onChange={setNewOwner} exclude={[draft?.owner || '']} label="新的命名空间所有者" />}<ErrorNotice error={transfer.error || archive.error} /><Button disabled={dialog === 'transfer' ? !newOwner || transfer.isPending : archive.isPending} onClick={() => dialog === 'transfer' ? transfer.mutate() : archive.mutate()}>{dialog === 'transfer' ? 'Transfer ownership' : draft?.archived ? 'Restore namespace' : 'Archive namespace'}</Button></div></DialogBody></DialogContent></Dialog>
  </Page>;
}
