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
import { useQuery } from '@tanstack/react-query';
import { searchAccounts, type DirectoryAccount } from '@/api/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const namespaceRoles = ['viewer', 'member', 'developer', 'operator', 'admin', 'auditor'] as const;
export const roleDescriptions: Record<string, string> = {
  viewer: '发现资源，并读取共享给你的工作。',
  member: '创建工作，使用智能体、团队与工作流。',
  developer: '配置并发布资源；创建并运行工作。',
  operator: '检查并运维命名空间基础设施。',
  admin: '管理成员、资源与基础设施。',
  auditor: '读取全部业务工作，包括私有事项与执行数据。',
};
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  let message = error instanceof Error ? error.message : String(error);
  try { const body = JSON.parse(message); message = body.error || body.message || message; } catch { /* Plain text error. */ }
  return <p role="alert" className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger-text">{message}</p>;
}
export const accountLabel = (a: DirectoryAccount) => a.displayName ? `${a.displayName} (${a.username})` : a.username;
export function RoleBadges({ roles = [] }: { roles?: string[] }) { return <div className="flex flex-wrap gap-1.5">{roles.map(role => <Badge key={role} title={roleDescriptions[role]}>{role}</Badge>)}</div>; }
export function RoleGuide() { return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{namespaceRoles.map(role => <div key={role} className={role === 'auditor' ? 'rounded-lg border border-warning-soft bg-warning-soft p-3' : 'rounded-lg bg-surface-2 p-3'}><p className="text-sm font-medium capitalize">{role}</p><p className="mt-1 text-xs leading-5 text-text-3">{roleDescriptions[role]}</p>{role === 'auditor' && <p className="mt-1 text-xs font-medium leading-5 text-warning-text">注意：审计员可以读取全部私有事项与执行数据——权限范围大于普通管理员，请仅在明确需要审计时授予。</p>}</div>)}</div></div>; }

/** 三层权限模型解释（PRD 5.14）：平台角色 → 命名空间角色 → 资源授权。 */
export function PermissionModelGuide() {
  return <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-5" aria-label="权限模型说明">
    <h3 className="text-sm font-semibold">权限分三层生效</h3>
    <ol className="space-y-2 text-xs leading-5 text-text-3">
      <li><strong className="text-text-2">第一层 · 平台角色</strong>：在「用户」中管理，决定账号能否登录控制台、管理平台与命名空间供给。</li>
      <li><strong className="text-text-2">第二层 · 命名空间角色</strong>：由命名空间成员关系（含用户组）决定，控制该空间内资源与工作的默认权限。</li>
      <li><strong className="text-text-2">第三层 · 资源授权</strong>：在单个资源上显式授予（discover / use / inspect / edit / publish / manage），可收紧或放宽第二层的默认值。</li>
    </ol>
    <p className="rounded-lg border border-warning-soft bg-warning-soft p-3 text-xs leading-5 text-warning-text">审计权限的反直觉规则：命名空间 <strong>管理员不等于审计员</strong>——管理员管理资源，但读取全部私有事项与执行数据需要显式授予 auditor 角色；反之 auditor 只读不管理。用户组不能被授予超出授予者的权限。</p>
  </section>;
}

export function AccountPicker({ namespace, value, onChange, label = '查找账号', exclude = [] }: { namespace?: string; value: string; onChange: (id: string) => void; label?: string; exclude?: string[] }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(text), 200); return () => clearTimeout(timer); }, [text]);
  const accounts = useQuery({ queryKey: ['account-directory', namespace, query], queryFn: () => searchAccounts(namespace, query), enabled: open });
  const selected = useQuery({ queryKey: ['account-identity', namespace, value], queryFn: () => searchAccounts(namespace, '', [value]), enabled: !!value });
  const chosen = selected.data?.items[0];
  return <div className="min-w-0 space-y-2">
    {value ? <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"><span>{chosen ? accountLabel(chosen) : value}</span><Button type="button" variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(true); }}>更改</Button></div> : <>
      <Input aria-label={label} role="combobox" aria-expanded={open} aria-controls={`accounts-${label.replace(/ /g, '-')}`} autoComplete="off" placeholder="按姓名或用户名搜索" value={text} onFocus={() => setOpen(true)} onChange={event => { setText(event.target.value); setOpen(true); }} />
      {open && <div id={`accounts-${label.replace(/ /g, '-')}`} role="listbox" aria-label={`${label} results`} className="max-h-48 overflow-auto rounded-lg border border-border bg-surface p-1">
        {accounts.isLoading ? <p className="p-2 text-xs text-text-3">正在搜索账号…</p> : accounts.data?.items.filter(a => !a.disabled && !exclude.includes(a.userId)).map(a => <button type="button" role="option" aria-selected={false} key={a.userId} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-hover" onClick={() => { onChange(a.userId); setOpen(false); setText(''); }}>{accountLabel(a)}</button>)}
        {accounts.data && !accounts.data.items.some(a => !a.disabled && !exclude.includes(a.userId)) && <p className="p-2 text-xs text-text-3">没有匹配的可用账号。</p>}
        <ErrorNotice error={accounts.error} />
      </div>}
    </>}
  </div>;
}

export function MembersEditor({ namespace, owner, members, onChange }: { namespace?: string; owner: string; members: Record<string, string[]>; onChange: (members: Record<string, string[]>) => void }) {
  const [account, setAccount] = useState('');
  const [role, setRole] = useState('member');
  const ids = [...new Set([owner, ...Object.keys(members)].filter(Boolean))].sort();
  const directory = useQuery({ queryKey: ['member-identities', namespace, ids], queryFn: () => searchAccounts(namespace, '', ids), enabled: ids.length > 0 });
  const identities = new Map(directory.data?.items.map(a => [a.userId, a]));
  return <div className="space-y-5">
    <ErrorNotice error={directory.error} />
    <div className="divide-y rounded-xl border">{ids.map(id => {
      const a = identities.get(id); const isOwner = id === owner;
      return <div key={id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{a ? accountLabel(a) : id} {isOwner && <Badge>所有者</Badge>} {a?.disabled && <Badge>已停用</Badge>}</p><p className="mt-1 break-all text-xs text-text-3">{id}</p></div>{!isOwner && <Button type="button" variant="ghost" size="sm" onClick={() => { const next = { ...members }; delete next[id]; onChange(next); }}>移除</Button>}</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">{namespaceRoles.map(r => {
          const implicit = isOwner && ['admin', 'member', 'developer', 'operator'].includes(r);
          return <label key={r} title={roleDescriptions[r]} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" aria-label={`${a?.username || id} ${r}`} checked={implicit || !!members[id]?.includes(r)} disabled={(isOwner && r !== "auditor") || a?.disabled} onChange={event => { const assigned = members[id] || []; const next = event.target.checked ? [...assigned, r] : assigned.filter(x => x !== r); const value = { ...members, [id]: next }; if (isOwner && next.length === 0) delete value[id]; onChange(value); }} />{r}</label>;
        })}</div>
      </div>;
    })}</div>
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <AccountPicker namespace={namespace} value={account} onChange={setAccount} exclude={ids} label="查找成员" />
      <select aria-label="成员角色" value={role} onChange={event => setRole(event.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">{namespaceRoles.map(r => <option key={r} value={r}>{r}</option>)}</select>
      <Button type="button" variant="outline" disabled={!account} onClick={() => { onChange({ ...members, [account]: [role] }); setAccount(''); }}>添加成员</Button>
    </div>
    <p className="text-xs leading-5 text-text-3">命名空间管理与私有工作访问是两回事。仅当确需访问全部私有工作时，才显式授予审计员（auditor）角色。</p>
  </div>;
}
