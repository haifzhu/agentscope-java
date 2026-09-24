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
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UsersRound } from 'lucide-react';
import { createUser, listUsers, resetPassword, setAccountDisabled, updateRoles, type AdminUserView } from '@/api/admin';
import { getNamespace, listAccountNamespaces, listManagedNamespaces, updateNamespace } from '@/api/permissions';
import { getUserId, isAdmin } from '@/api/auth';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { Page, PageHeader } from '@/components/Page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { accountLabel, ErrorNotice, namespaceRoles, roleDescriptions, RoleBadges } from '@/features/settings/AccessComponents';

export default function AdminUsersPage() {
  const admin = isAdmin(); const qc = useQueryClient(); const scope = useControlPlaneScope();
  const [params, setParams] = useSearchParams(); const [search, setSearch] = useState(''); const [creating, setCreating] = useState(false); const [generated, setGenerated] = useState('');
  const query = useQuery({ queryKey: ['admin-users'], queryFn: listUsers, enabled: admin });
  const selected = query.data?.find(a => a.userId === params.get('user'));
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['admin-users'] }); await qc.invalidateQueries({ queryKey: ['account-audit'] }); scope.refreshNamespaces(); };
  if (!admin) return <Navigate to="/settings/namespaces" replace />;
  const users = query.data?.filter(a => `${a.username} ${a.displayName} ${a.userId}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <Page><PageHeader title="用户" description="管理平台账号，以及每个人对共享命名空间的访问。" actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />创建用户</Button>} />
    <Input className="max-w-sm" aria-label="搜索用户" placeholder="按姓名或用户名搜索" value={search} onChange={e => setSearch(e.target.value)} />
    <ErrorNotice error={query.error} />
    <div className={`grid items-start gap-6 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]' : ''}`}><section className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-surface-2 text-xs text-text-3"><tr><th className="p-4 font-medium">账号</th><th className="p-4 font-medium">平台角色</th><th className="p-4 font-medium">状态</th></tr></thead><tbody className="divide-y">{users.map(a => <tr key={a.userId} className={selected?.userId === a.userId ? 'bg-primary-soft' : 'hover:bg-hover'}><td className="p-4"><button className="text-left font-medium text-text hover:text-primary" onClick={() => { const next = new URLSearchParams(params); next.set('user', a.userId); setParams(next); }}>{accountLabel(a)}</button><p className="mt-1 break-all text-xs text-text-3">{a.userId}</p></td><td className="p-4"><Badge>{a.roles.includes('admin') ? '平台管理员' : '普通用户'}</Badge></td><td className="p-4"><Badge tone={a.disabled ? 'default' : 'success'}>{a.disabled ? '已停用' : '启用中'}</Badge></td></tr>)}</tbody></table>{query.isLoading ? <p className="p-6 text-sm text-text-3">正在加载账号…</p> : users.length === 0 && <p className="p-8 text-center text-sm text-text-3">没有匹配的账号。</p>}</section>
      {selected && <UserDetail key={selected.userId} user={selected} onChanged={refresh} />}
    </div>
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent size="md"><DialogHeader><DialogTitle>创建用户</DialogTitle><DialogDescription>先创建账号，再为其分配所需命名空间的访问。</DialogDescription></DialogHeader><DialogBody>{creating && <CreateUserForm onCreated={password => { setCreating(false); setGenerated(password || ''); void refresh(); }} />}</DialogBody></DialogContent></Dialog>
    <Dialog open={!!generated} onOpenChange={open => { if (!open) setGenerated(''); }}><DialogContent size="md"><DialogHeader><DialogTitle>账号已创建</DialogTitle><DialogDescription>请把初始密码转交给新用户。仅此处显示一次。</DialogDescription></DialogHeader><DialogBody><code className="block break-all rounded-lg bg-surface-2 p-4 text-lg">{generated}</code><Button className="mt-4" onClick={() => setGenerated('')}>完成</Button></DialogBody></DialogContent></Dialog>
  </Page>;
}

function CreateUserForm({ onCreated }: { onCreated: (password?: string) => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [admin, setAdmin] = useState(false);
  const create = useMutation({ mutationFn: () => createUser({ username: username.trim(), initialPassword: password || undefined, roles: admin ? ['user', 'admin'] : ['user'] }), onSuccess: r => onCreated(r.generatedPassword) });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); create.mutate(); }}><label className="block space-y-2 text-sm font-medium">用户名<Input required maxLength={100} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" /></label><label className="block space-y-2 text-sm font-medium">初始密码<Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /><span className="block text-xs font-normal text-slate-500">留空则自动生成密码。</span></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} />平台管理员</label><ErrorNotice error={create.error} /><Button type="submit" disabled={!username.trim() || create.isPending}>{create.isPending ? '创建中…' : '创建用户'}</Button></form>;
}

function UserDetail({ user, onChanged }: { user: AdminUserView; onChanged: () => Promise<void> }) {
  const [roles, setRoles] = useState(user.roles); const [dialog, setDialog] = useState<'status' | 'password' | null>(null); const [password, setPassword] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => setRoles(user.roles), [user]);
  const mutation = useMutation({ mutationFn: (action: 'roles' | 'status' | 'password') => action === 'roles' ? updateRoles(user.userId, roles, user.version) : action === 'status' ? setAccountDisabled(user.userId, !user.disabled, user.version) : resetPassword(user.userId, password), onSuccess: async () => { setDialog(null); setPassword(''); setNotice('账号已更新。'); await onChanged(); } });
  return <aside className="space-y-5"><section className="space-y-4 rounded-xl border p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary-soft p-3 text-primary-text"><UsersRound className="h-5 w-5" /></span><div><h2 className="font-semibold">{accountLabel(user)}</h2><p className="mt-1 text-xs text-text-3">{user.createdAt ? `加入于 ${new Date(user.createdAt).toLocaleDateString()}` : user.userId}</p></div></div><h3 className="text-sm font-medium">平台角色</h3><p className="text-xs leading-5 text-text-3">平台管理负责账号与命名空间的供给。命名空间角色与私有工作访问另行分配。</p><div className="space-y-2">{['user', 'admin', 'agent_developer', 'operator'].map(r => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={e => setRoles(e.target.checked ? [...roles, r] : roles.filter(x => x !== r))} />{r === 'admin' ? '平台管理员' : r === 'user' ? '控制台用户' : `${r}（旧版导航）`}</label>)}</div><ErrorNotice error={mutation.error} />{notice && <p role="status" className="text-sm text-success-text">{notice}</p>}<Button disabled={!roles.length || mutation.isPending} onClick={() => mutation.mutate('roles')}>保存平台角色</Button><div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => setDialog('password')}>重置密码</Button><Button variant="outline" disabled={user.userId === getUserId()} onClick={() => setDialog('status')}>{user.disabled ? '启用账号' : '停用账号'}</Button></div></section>
    <UserNamespaceAccess user={user} />
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent size="md"><DialogHeader><DialogTitle>{dialog === 'password' ? '重置密码' : user.disabled ? '启用账号' : '停用账号'}</DialogTitle><DialogDescription>{dialog === 'password' ? `为 ${user.username} 设置新密码。既有登录将被吊销。` : user.disabled ? '该账号可重新登录。此前的会话仍保持吊销。' : '登录与既有会话将被阻止。历史工作保留。请先转移其拥有的共享命名空间。'}</DialogDescription></DialogHeader><DialogBody><div className="space-y-4">{dialog === 'password' && <Input aria-label="新的账号密码" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />}<ErrorNotice error={mutation.error} /><Button disabled={mutation.isPending || dialog === 'password' && password.length < 6} onClick={() => mutation.mutate(dialog === 'password' ? 'password' : 'status')}>{dialog === 'password' ? '重置密码' : user.disabled ? '启用账号' : '停用账号'}</Button></div></DialogBody></DialogContent></Dialog>
  </aside>;
}

function UserNamespaceAccess({ user }: { user: AdminUserView }) {
  const qc = useQueryClient(); const scope = useControlPlaneScope();
  const memberships = useQuery({ queryKey: ['account-namespaces', user.userId], queryFn: () => listAccountNamespaces(user.userId) });
  const all = useQuery({ queryKey: ['managed-namespaces'], queryFn: listManagedNamespaces });
  const [name, setName] = useState(''); const [editing, setEditing] = useState('');
  const assigned = memberships.data?.items || [];
  const choices = all.data?.items.filter(n => n.kind === 'shared' && !n.archived && !assigned.some(a => a.name === n.name)) || [];
  return <section className="space-y-4 rounded-xl border p-5"><h3 className="font-semibold">命名空间访问</h3><ErrorNotice error={memberships.error || all.error} /><div className="divide-y">{assigned.map(n => <div key={n.name} className="space-y-2 py-3"><div className="flex items-center justify-between gap-2"><Link to={`/settings/namespaces/${encodeURIComponent(n.name)}`} className="text-sm font-medium hover:text-primary">{n.displayName}</Link><Badge>{n.owner === user.userId ? '所有者' : n.archived ? '已归档' : '成员'}</Badge></div><RoleBadges roles={n.roles || []} />{n.groups && n.groups.length > 0 && <Link className="block text-xs text-primary" to={`/settings/namespaces/${encodeURIComponent(n.name)}?tab=user+groups`}>经用户组：{n.groups.join('、')}</Link>}{n.kind === 'shared' && !n.archived && <Button variant="ghost" size="sm" onClick={() => setEditing(n.name)}>编辑命名空间访问</Button>}</div>)}</div>{!memberships.isLoading && assigned.length === 0 && <p className="text-sm text-text-3">尚无命名空间成员关系。该用户首次登录时会创建个人空间。</p>}<div className="flex flex-wrap gap-2"><select aria-label="分配命名空间" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" value={name} onChange={e => setName(e.target.value)}><option value="">选择共享命名空间</option>{choices.map(n => <option key={n.name} value={n.name}>{n.displayName}</option>)}</select><Button variant="outline" disabled={!name || user.disabled} onClick={() => setEditing(name)}>分配访问</Button></div><Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(''); }}><DialogContent size="md"><DialogHeader><DialogTitle>命名空间访问 · {editing}</DialogTitle><DialogDescription>设置 {user.username} 的直接角色。用户组授权在命名空间的用户组中管理。</DialogDescription></DialogHeader><DialogBody>{editing && <UserGrantEditor key={editing} name={editing} user={user} onSaved={async () => { setEditing(''); setName(''); await qc.invalidateQueries({ queryKey: ['account-namespaces'] }); await qc.invalidateQueries({ queryKey: ['namespace-detail'] }); await qc.invalidateQueries({ queryKey: ['managed-namespaces'] }); scope.refreshNamespaces(); }} />}</DialogBody></DialogContent></Dialog></section>;
}

function UserGrantEditor({ name, user, onSaved }: { name: string; user: AdminUserView; onSaved: () => Promise<void> }) {
  const query = useQuery({ queryKey: ['namespace-detail', name], queryFn: () => getNamespace(name) });
  const [roles, setRoles] = useState<string[]>(['member']);
  useEffect(() => { if (query.data) setRoles(query.data.namespace.members[user.userId] || ['member']); }, [query.data, user.userId]);
  const owner = query.data?.namespace.owner === user.userId;
  const save = useMutation({ mutationFn: (remove: boolean) => { const n = query.data!.namespace; const members = { ...n.members }; if (remove || owner && roles.length === 0) delete members[user.userId]; else members[user.userId] = roles; return updateNamespace({ ...n, members }); }, onSuccess: onSaved });
  return <div className="space-y-4"><ErrorNotice error={query.error || save.error} />{query.isLoading ? <p className="text-sm text-text-3">正在加载访问…</p> : query.data && <>{owner && <p className="text-sm text-text-3">所有者天然拥有管理、开发与运维权限。要移除这些权限，请先在命名空间设置中转移所有权。</p>}<div className="space-y-3">{namespaceRoles.map(r => { const implicit = owner && ['admin', 'member', 'developer', 'operator'].includes(r); return <label key={r} className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={implicit || roles.includes(r)} disabled={(owner && r !== "auditor") || user.disabled} onChange={e => setRoles(e.target.checked ? [...roles, r] : roles.filter(v => v !== r))} /><span><span className="capitalize font-medium">{r}</span><span className="mt-1 block text-xs text-text-3">{roleDescriptions[r]}</span></span></label>; })}</div><div className="flex gap-2"><Button disabled={save.isPending || !owner && !roles.length || user.disabled} onClick={() => save.mutate(false)}>保存访问</Button>{!owner && query.data.namespace.members[user.userId] && <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(true)}>移除直接访问</Button>}</div></>}</div>;
}
