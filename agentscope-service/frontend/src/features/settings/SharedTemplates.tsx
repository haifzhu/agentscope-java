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

import { useControlPlaneScope } from '@/app/ScopeContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedTemplates, importTemplate, listResources, type SharedTemplate } from '@/api/resourceAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ErrorNotice } from './AccessComponents';
export function SharedTemplates({ namespace }: { namespace: string }) {
  const query = useQuery({ queryKey: ['shared-templates', namespace], queryFn: () => sharedTemplates(namespace) });
  const [selected, setSelected] = useState<SharedTemplate>();
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold">共享的工作流模板</h2><p className="mt-1 text-sm text-text-3">把已发布的模板导入该命名空间，审阅并发布本地副本。工作与结果都留在本命名空间。</p></div><ErrorNotice error={query.error} />{query.isLoading && <p>正在加载模板…</p>}{query.data?.items.map(t => <article key={`${t.sourceNamespace}/${t.id}`} className="space-y-3 rounded-xl border p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t.name}</h3><Badge>修订 {t.revision}</Badge></div><p className="text-xs text-text-3">由 {t.sourceNamespace} 发布</p><p className="text-sm">{t.description}</p><Button variant="outline" disabled={!query.data?.canImport} onClick={() => setSelected(t)}>导入模板</Button></article>)}{query.data?.items.length === 0 && <p className="text-sm text-text-3">尚无已发布模板共享给该命名空间。</p>}{selected && <ImportForm key={selected.revisionId} namespace={namespace} template={selected} onClose={() => setSelected(undefined)} />}</section>;
}
function ImportForm({ namespace, template, onClose }: { namespace: string; template: SharedTemplate; onClose: () => void }) {
  const scope = useControlPlaneScope(); const qc = useQueryClient(); const [name, setName] = useState(template.name); const [bindings, setBindings] = useState<Record<string, string>>({});
  const resources = useQuery({ queryKey: ['resource-catalog', namespace], queryFn: () => listResources(namespace) });
  const mutation = useMutation({ mutationFn: () => importTemplate(namespace, template, name, bindings), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['resource-catalog'] }); } });
  return <form className="space-y-4 rounded-xl border border-primary-soft bg-primary-soft p-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><h3 className="font-semibold">导入 {template.name}</h3><label className="block space-y-2 text-sm">本地工作流名称<Input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>{template.dependencies.map(key => <label key={key} className="block space-y-2 text-sm"><span className="break-all">Replace {key}</span><select aria-label={`Replace ${key}`} required className="block h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm" value={bindings[key] || ''} onChange={e => setBindings({ ...bindings, [key]: e.target.value })}><option value="">选择本地资源</option>{resources.data?.items.filter(r => r.resource.kind === key.split(':')[0] && r.actions.includes('use')).map(({ resource: r }) => <option key={r.id} value={`${r.kind}:${r.id}`}>{r.name}</option>)}</select></label>)}<p className="text-xs text-text-3">运行时绑定会被移除。每个依赖都必须显式映射到已授权的本地资源。</p><ErrorNotice error={mutation.error || resources.error} />{mutation.data ? <Link className="text-sm font-medium text-primary" to={`/agent-center/workflows/${mutation.data.definition.id}?tenant=${encodeURIComponent(scope.tenant)}&namespace=${encodeURIComponent(namespace)}`}>打开导入的工作流 →</Link> : <Button type="submit" disabled={mutation.isPending || !name.trim() || template.dependencies.some(d => !bindings[d])}>创建本地草稿</Button>}<Button type="button" variant="ghost" onClick={onClose}>关闭</Button></form>;
}
