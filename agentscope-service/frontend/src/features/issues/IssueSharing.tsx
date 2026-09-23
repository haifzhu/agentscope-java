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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Issue } from '@/api/collaboration';
import { updateIssueAccess, type IssueAccess } from '@/api/permissions';
import { getToken, getUsername } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function currentAccount() { try { return String(JSON.parse(atob((getToken() || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''); } catch { return ''; } }
export function IssueSharing({ issue }: { issue: Issue }) {
  const qc = useQueryClient();
  const [policy, setPolicy] = useState<IssueAccess>(issue.access ?? { mode: 'private' });
  const [account, setAccount] = useState('');
  const [role, setRole] = useState<'reader' | 'contributor'>('reader');
  useEffect(() => setPolicy(issue.access ?? { mode: 'private' }), [issue.access, issue.id]);
  const owned = issue.creator.type === 'human' && [currentAccount(), getUsername()].includes(issue.creator.ref || '');
  const save = useMutation({ mutationFn: () => updateIssueAccess(issue.id, issue.version, policy), onSuccess: () => qc.invalidateQueries() });
  if (issue.parentIssueId) return <section className="border-t border-border pt-4 text-xs text-text-3">分享范围继承自根事项。</section>;
  return <section className="space-y-3 border-t pt-4"><h2 className="text-sm font-semibold text-text">分享范围</h2>
    {owned ? <>
      <select aria-label="事项分享范围" className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text" value={policy.mode} onChange={e => setPolicy({ mode: e.target.value as IssueAccess['mode'], members: undefined })}><option value="private">私有</option><option value="shared">指定成员</option><option value="namespace">命名空间成员</option></select>
      {policy.mode === 'shared' && <>
        {Object.entries(policy.members ?? {}).map(([id, r]) => <div key={id} className="flex items-center gap-1 text-xs"><span className="min-w-0 flex-1 truncate" title={id}>{id}</span><span>{r}</span><Button variant="ghost" size="sm" onClick={() => { const members = { ...policy.members }; delete members[id]; setPolicy({ ...policy, members }); }}>移除</Button></div>)}
        <Input aria-label="协作者账号" value={account} onChange={e => setAccount(e.target.value)} placeholder="命名空间成员账号" />
        <div className="flex gap-2"><select aria-label="协作者权限" className="min-w-0 flex-1 rounded border px-2 text-xs" value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="reader">只读</option><option value="contributor">可协作</option></select><Button variant="outline" size="sm" disabled={!account.trim()} onClick={() => { setPolicy({ ...policy, members: { ...policy.members, [account.trim()]: role } }); setAccount(''); }}>添加</Button></div>
      </>}
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>保存分享范围</Button>
      {save.error && <p role="alert" className="text-xs text-destructive">{save.error.message}</p>}
      {save.isSuccess && <p className="text-xs text-success-text">分享范围已保存。</p>}
    </> : <p className="text-xs text-text-2">{issue.access?.mode === 'shared' ? '指定成员' : issue.access?.mode === 'namespace' ? '命名空间成员' : '私有'}</p>}
    <p className="text-xs text-text-3">作用于子事项、评论、执行记录与附件。智能体开发者不会自动获得访问权限。</p>
  </section>;
}
