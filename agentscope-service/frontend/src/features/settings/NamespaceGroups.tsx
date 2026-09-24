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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroups, saveGroups, type AccessGroup } from '@/api/resourceAccess';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AccountPicker, ErrorNotice, namespaceRoles, RoleBadges } from './AccessComponents';

export function NamespaceGroups({ namespace }: { namespace: string }) {
  const qc = useQueryClient(); const scope = useControlPlaneScope();
  const query = useQuery({ queryKey: ['namespace-groups', namespace], queryFn: () => getGroups(namespace) });
  const [groups, setGroups] = useState<Record<string, AccessGroup>>({}); const [id, setId] = useState(''); const [name, setName] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (query.data) setGroups(query.data.groups); }, [query.data]);
  const save = useMutation({ mutationFn: () => saveGroups(namespace, query.data!.version, groups), onSuccess: () => { setNotice('用户组与生效成员关系已保存。'); void qc.invalidateQueries({ queryKey: ['namespace-groups'] }); void qc.invalidateQueries({ queryKey: ['namespace-detail'] }); void qc.invalidateQueries({ queryKey: ['resource-access'] }); void qc.invalidateQueries({ queryKey: ['resource-catalog'] }); void qc.invalidateQueries({ queryKey: ['managed-namespaces'] }); void qc.invalidateQueries({ queryKey: ['account-namespaces'] }); void qc.invalidateQueries({ queryKey: ['namespace-audit'] }); scope.refreshNamespaces(); } });
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">用户组</h2><p className="mt-1 text-sm text-text-3">把命名空间角色成组授予多人。用户组面向人的组织；智能体团队面向执行的组织。</p></div><ErrorNotice error={query.error || save.error} />{notice && <p role="status" className="text-sm text-success-text">{notice}</p>}
    {query.isLoading && <p>正在加载用户组…</p>}
    {Object.entries(groups).map(([key, group]) => query.data?.canManage ? <GroupEditor key={key} namespace={namespace} id={key} value={group} onChange={value => setGroups({ ...groups, [key]: value })} onRemove={() => { const next = { ...groups }; delete next[key]; setGroups(next); }} /> : <article key={key} className="space-y-3 rounded-xl border p-5"><h3 className="font-semibold">{group.name}</h3><RoleBadges roles={group.roles} /></article>)}
    {!query.isLoading && Object.keys(groups).length === 0 && <p className="text-sm text-text-3">尚未创建用户组。</p>}
    {query.data?.canManage && <><form className="space-y-4 rounded-xl border border-dashed p-5" onSubmit={e => { e.preventDefault(); if (!groups[id]) { setGroups({ ...groups, [id]: { name, members: [], roles: ['member'] } }); setId(''); setName(''); } }}><h3 className="font-semibold">创建用户组</h3><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm">组名称<Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label className="space-y-2 text-sm">组标识符<Input required pattern="[a-z0-9][a-z0-9-]{0,62}" value={id} onChange={e => setId(e.target.value)} /></label></div>{id && groups[id] && <p className="text-sm text-danger-text">该组标识符已存在。</p>}<Button type="submit" variant="outline" disabled={!id || !name || !!groups[id]}>添加组</Button></form><p className="text-xs text-text-3">删除组会同时删除其资源授权。审计员相关变更需要命名空间所有者或平台管理员。</p><Button disabled={save.isPending || Object.values(groups).some(g => !g.roles.length || !g.name.trim())} onClick={() => save.mutate()}>保存用户组</Button></>}
  </section>;
}
function GroupEditor({ namespace, id, value, onChange, onRemove }: { namespace: string; id: string; value: AccessGroup; onChange: (v: AccessGroup) => void; onRemove: () => void }) {
  const [user, setUser] = useState('');
  return <article className="space-y-4 rounded-xl border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{value.name} <span className="text-xs font-normal text-text-3">{id}</span></h3><Button type="button" variant="ghost" size="sm" onClick={onRemove}>移除组</Button></div><div className="flex flex-wrap gap-4">{namespaceRoles.map(role => <label key={role} className="flex items-center gap-2 text-sm"><input aria-label={`${id} ${role}`} type="checkbox" checked={value.roles.includes(role)} onChange={e => onChange({ ...value, roles: e.target.checked ? [...value.roles, role] : value.roles.filter(r => r !== role) })} />{role}</label>)}</div><p className="text-xs text-text-3">每位成员都会获得这些命名空间角色，并与直接授予的权限合并。</p><div className="flex flex-wrap gap-2">{value.members.map(member => <span key={member} className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">{member}<button type="button" aria-label={`Remove ${member} from ${id}`} onClick={() => onChange({ ...value, members: value.members.filter(u => u !== member) })}>×</button></span>)}</div><div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><AccountPicker namespace={namespace} value={user} onChange={setUser} exclude={value.members} label={`Add person to ${id}`} /></div><Button type="button" variant="outline" disabled={!user} onClick={() => { onChange({ ...value, members: [...value.members, user] }); setUser(''); }}>添加成员</Button></div></article>;
}
