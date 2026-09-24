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

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listNamespaceAudit } from '@/api/permissions';
import { listAccountAudit, listUsers } from '@/api/admin';
import { isAdmin } from '@/lib/auth';
import { Page, PageHeader } from '@/components/Page';
import { Button } from '@/components/ui/button';
import { ErrorNotice, RoleBadges } from './AccessComponents';

export function NamespaceAuditList({ name }: { name?: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ['namespace-audit', name, offset], queryFn: () => listNamespaceAudit(name, offset) });
  return <div className="space-y-4"><ErrorNotice error={query.error} />{query.isLoading ? <p className="text-sm text-text-3">正在加载访问历史…</p> : query.data?.items.length === 0 ? <p className="rounded-xl border p-5 text-sm text-text-3">暂无访问变更记录。</p> : query.data?.items.map(a => <details key={a.id} className="rounded-xl border p-4"><summary className="cursor-pointer text-sm"><span className="font-medium">{a.namespace.displayName}</span><span className="ml-3 text-text-3">版本 {a.version} · {a.actor} · {new Date(a.createdAt).toLocaleString()}</span></summary><div className="mt-4 space-y-3 text-sm"><p>所有者：{a.namespace.owner} · {a.namespace.archived ? '已归档' : '生效中'}</p>{Object.entries(a.namespace.members || {}).map(([id, roles]) => <div key={id} className="flex flex-wrap items-center gap-3"><span className="break-all text-xs text-text-3">{id}</span><RoleBadges roles={roles} /></div>)}{Object.keys(a.namespace.members || {}).length === 0 && Object.keys(a.namespace.groups || {}).length === 0 && <p className="text-text-3">仅所有者。</p>}{Object.entries(a.namespace.groups || {}).map(([id, g]) => <div key={id} className="space-y-2 rounded-lg bg-surface-2 p-3"><p className="font-medium">用户组：{g.name}（{id}）</p><RoleBadges roles={g.roles} /><p className="break-all text-xs text-text-3">成员：{g.members?.join('、') || '无'}</p></div>)}{Object.entries(a.namespace.resources || {}).map(([key, p]) => <div key={key} className="space-y-1 rounded-lg bg-surface-2 p-3"><p className="break-all font-medium">资源：{key} · {p.mode}</p>{Object.entries(p.users || {}).map(([id, actions]) => <p key={id} className="break-all text-xs">用户 {id}：{actions.join('、')}</p>)}{Object.entries(p.groups || {}).map(([id, actions]) => <p key={id} className="text-xs">用户组 {id}：{actions.join('、')}</p>)}{!!p.consumers?.length && <p className="break-all text-xs">已授权消费方：{p.consumers.join('、')}</p>}{!!p.exportTo?.length && <p className="text-xs">模板导出至：{p.exportTo.join('、')}</p>}</div>)}{a.namespace.requests?.map(r => <p key={r.id} className="break-all text-xs text-text-3">访问申请：{r.user} · {r.resource} · {r.action} · {r.status}{r.reviewedBy ? ` · 审批人 ${r.reviewedBy}` : ''}</p>)}</div></details>)}<Pagination offset={offset} count={query.data?.items.length || 0} onChange={setOffset} /></div>;
}
function Pagination({ offset, count, onChange }: { offset: number; count: number; onChange: (n: number) => void }) { return <div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - 50))}>上一页</Button><Button variant="outline" size="sm" disabled={count < 50} onClick={() => onChange(offset + 50)}>下一页</Button></div>; }

export default function AccessLogPage() {
  const [tab, setTab] = useState('namespaces'); const [offset, setOffset] = useState(0); const admin = isAdmin();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: listUsers, enabled: admin });
  const accounts = useQuery({ queryKey: ['account-audit', offset], queryFn: () => listAccountAudit(offset), enabled: admin && tab === 'accounts' });
  const label = (id: string) => users.data?.find(a => a.userId === id)?.username || id;
  if (!admin) return <Navigate to="/settings/namespaces" replace />;
  return <Page><PageHeader title="访问日志" description="审计账号生命周期、平台角色变更与命名空间授权历史。" /><div className="flex gap-2"><Button variant={tab === 'namespaces' ? 'default' : 'outline'} onClick={() => setTab('namespaces')}>命名空间访问</Button><Button variant={tab === 'accounts' ? 'default' : 'outline'} onClick={() => setTab('accounts')}>账号与平台角色</Button></div>{tab === 'namespaces' ? <NamespaceAuditList /> : <div className="space-y-4"><ErrorNotice error={accounts.error} />{accounts.isLoading && <p className="text-sm text-text-3">正在加载账号历史…</p>}{accounts.data?.items.map(a => <article key={a.id} className="space-y-2 rounded-xl border p-4"><p className="text-sm font-medium">{label(a.userId)} · {a.action.replace(/\./g, ' ')}</p><p className="text-xs text-text-3">操作人 {label(a.actor)} · {new Date(a.createdAt).toLocaleString()}</p>{Array.isArray(a.details.roles) && <p className="text-sm text-text-2">平台角色：{(a.details.roles as string[]).join('、')}</p>}</article>)}{accounts.data?.items.length === 0 && <p className="text-sm text-text-3">暂无账号变更记录。</p>}<Pagination offset={offset} count={accounts.data?.items.length || 0} onChange={setOffset} /></div>}</Page>;
}
