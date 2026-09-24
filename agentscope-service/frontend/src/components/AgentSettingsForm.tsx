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

import React, { useEffect, useState } from 'react';
import { AgentDefinition, archiveAgent, getAgent, updateAgent, deleteAgent } from '../api/agents';
import { useNavigate, Link } from 'react-router-dom';
import ShareAgentDialog from './ShareAgentDialog';
import { getWorkspace, listWorkspaces, WorkspaceSummary } from '../api/workspaces';
import { Environment, listEnvironments } from '../api/environments';
import { Vault, listVaults } from '../api/vaults';
import { MemoryStore, listMemoryStores } from '../api/memoryStores';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { definitionFormPatch, type DefinitionFormSection } from '@/features/build/agents/agentDefinitionForm';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Field, Input, Select, Textarea } from './ui/input';

const INPUT_CLASS =
  'w-full rounded-lg border border-border-control bg-surface px-3.5 py-2.5 text-sm text-text shadow-1 outline-none transition-colors placeholder:text-text-3 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60';
const HINT_CLASS = 'mt-1.5 text-xs leading-5 text-text-3';
const ROW_CLASS = 'mb-5 last:mb-0';
const CARD_LABEL_CLASS = 'mb-4 block text-xs font-bold tracking-widest text-text-3 uppercase';

/** C7 令牌化重做：行为 / 工作区 / 会话默认 编辑表单。逻辑与旧版一致，样式全部改为语义令牌。 */
export default function AgentSettingsForm({
  agent,
  onSaved,
  section = 'all',
}: {
  agent: AgentDefinition;
  section?: DefinitionFormSection;
  onSaved?: () => void | Promise<unknown>;
}) {
  const navigate = useNavigate();
  const scope = useControlPlaneScope();
  const show = (part: string) => section === 'all' || section === part;
  const isGlobal = agent.scope === 'global';
  const tier = agent.tierForCurrentUser;
  // 后端暂不填充 tierForCurrentUser，因此把拥有者视为可编辑。
  const canEdit = scope.roles.some(role => ['admin', 'developer'].includes(role)) && (agent.scope !== 'global');
  const canShare = canEdit; // 分享需要 EDIT 权限
  const readOnly = !canEdit;
  const [shareOpen, setShareOpen] = useState(false);

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [model, setModel] = useState(agent.model ?? '');
  const [system, setSystem] = useState(agent.workspaceBinding?.instructions ?? agent.system ?? '');
  const [maxIters, setMaxIters] = useState<string>(String(agent.maxIters ?? 12));
  const [workspaceId, setWorkspaceId] = useState(agent.workspaceId ?? '');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [linkedSummary, setLinkedSummary] = useState<WorkspaceSummary | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentId] = useState(agent.defaultEnvironmentId ?? '');
  const [defaultVaultIds, setDefaultVaultIds] = useState<string[]>(agent.defaultVaultIds ?? []);
  const [defaultMemoryStoreIds, setDefaultMemoryStoreIds] = useState<string[]>(agent.defaultMemoryStoreIds ?? []);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [memoryStores, setMemoryStores] = useState<MemoryStore[]>([]);
  const [version, setVersion] = useState<number | undefined>(agent.version);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description ?? '');
    setModel(agent.model ?? '');
    setSystem(agent.workspaceBinding?.instructions ?? agent.system ?? '');
    setMaxIters(String(agent.maxIters ?? 12));
    setWorkspaceId(agent.workspaceId ?? '');
    setDefaultEnvironmentId(agent.defaultEnvironmentId ?? '');
    setDefaultVaultIds(agent.defaultVaultIds ?? []);
    setDefaultMemoryStoreIds(agent.defaultMemoryStoreIds ?? []);
    setVersion(agent.version);
  }, [
    agent.id, agent.version, agent.system, agent.name, agent.description, agent.model, agent.maxIters,
    agent.workspaceId, agent.defaultEnvironmentId,
    agent.defaultVaultIds, agent.defaultMemoryStoreIds,
  ]);

  useEffect(() => {
    listWorkspaces().then(setWorkspaces).catch(() => undefined);
    listEnvironments().then(setEnvironments).catch(() => undefined);
    listVaults().then(setVaults).catch(() => undefined);
    listMemoryStores().then(setMemoryStores).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setLinkedSummary(null);
      return;
    }
    let cancelled = false;
    getWorkspace(workspaceId)
      .then(w => { if (!cancelled) setLinkedSummary(w); })
      .catch(() => { if (!cancelled) setLinkedSummary(null); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  async function handleSave() {
    setOk(false);
    setErr(null);
    setSaving(true);
    try {
      const updated = await updateAgent(agent.id, definitionFormPatch(agent, section, {
        name, description, model, system, maxIters, workspaceId,
        defaultEnvironmentId, defaultVaultIds, defaultMemoryStoreIds, version,
      }));
      setVersion(updated.version);
      setWorkspaceId(updated.workspaceId ?? '');
      setDefaultEnvironmentId(updated.defaultEnvironmentId ?? '');
      setDefaultVaultIds(updated.defaultVaultIds ?? []);
      setDefaultMemoryStoreIds(updated.defaultMemoryStoreIds ?? []);
      setOk(true);
      await onSaved?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`删除智能体「${agent.name}」？其工作区与会话将一并移除。`)) return;
    try {
      await deleteAgent(agent.id);
      navigate(scope.scopedPath('/agent-center/agents'), { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
    }
  }

  async function handleArchive() {
    if (!confirm(`归档智能体「${agent.name}」？归档后不能再创建新的托管会话。`)) return;
    setArchiving(true);
    setErr(null);
    try {
      await archiveAgent(agent.id);
      await getAgent(agent.id);
      await onSaved?.();
      setOk(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '归档失败');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className={section === 'all' ? 'mx-auto w-full max-w-3xl space-y-5 py-8' : 'w-full'}>
      {isGlobal && (
        <p className="rounded-xl border border-info bg-info-soft px-4 py-3 text-sm text-info-text">
          全局智能体在界面内只读。如需修改，请编辑 <code>agentscope.json</code>。
        </p>
      )}
      {!isGlobal && !canEdit && (
        <p className="rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm text-warning-text">
          你对该智能体的权限为 <strong>{tier ?? '无'}</strong>，仅具备 EDIT 权限的协作者可以修改设置。
        </p>
      )}

      {show('settings') && <Card>
        <CardContent className="space-y-5 p-6">
          <span className={CARD_LABEL_CLASS}>基本信息</span>

          <div className={ROW_CLASS}>
            <span className="mb-1.5 block text-sm font-medium text-text-2">智能体 ID</span>
            <div className="font-mono text-sm text-text-3">{agent.id}</div>
          </div>

          {agent.version != null && (
            <div className={ROW_CLASS}>
              <span className="mb-1.5 block text-sm font-medium text-text-2">当前版本</span>
              <div className="font-mono text-sm text-text-3">v{version ?? agent.version}</div>
            </div>
          )}

          {agent.archivedAt != null && (
            <p className="rounded-lg border border-warning bg-warning-soft px-3.5 py-2.5 text-sm text-warning-text">
              已于 {new Date(agent.archivedAt).toLocaleString()} 归档
            </p>
          )}

          <Field label="名称">
            {props => (
              <Input {...props} className={INPUT_CLASS} value={name}
                onChange={e => setName(e.target.value)} disabled={readOnly} />
            )}
          </Field>

          <Field label="描述" hint="展示在卡片与标签页上的简短说明。">
            {props => (
              <Input {...props} className={INPUT_CLASS} value={description}
                onChange={e => setDescription(e.target.value)} disabled={readOnly}
                placeholder="一句话说明这个智能体的用途" />
            )}
          </Field>
        </CardContent>
      </Card>}

      {show('behavior') && <Card>
        <CardContent className="space-y-5 p-6">
          <span className={CARD_LABEL_CLASS}>模型</span>
          <Field label="模型" hint="带提供方前缀的模型 ID，经 ModelRegistry 解析；留空则回退到数据面默认模型。">
            {props => (
              <Input {...props} className={INPUT_CLASS} value={model}
                onChange={e => setModel(e.target.value)} disabled={readOnly}
                placeholder="例如 dashscope:qwen-max、deepseek:deepseek-chat、openai:gpt-4o" />
            )}
          </Field>
        </CardContent>
      </Card>}

      {show('workspace') && <Card>
        <CardContent className="space-y-5 p-6">
          <span className={CARD_LABEL_CLASS}>工作区</span>
          <Field label="关联工作区" hint="更换关联会发布并绑定所选工作区草稿；选择具体修订版本与继承关系请用「定义 → 工作区」。">
            {props => (
              <Select {...props} className={INPUT_CLASS} value={workspaceId}
                onChange={e => setWorkspaceId(e.target.value)} disabled={readOnly}>
                <option value="">不关联（使用智能体私有的技能 / 工具 / 文件）</option>
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            )}
          </Field>
          {linkedSummary && (
            <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-2">
              <div className="mb-1.5 font-semibold text-text">
                {linkedSummary.name}{' '}
                <Link to={scope.scopedPath(`/agent-center/workspaces/${encodeURIComponent(linkedSummary.id)}`)} className="text-primary underline-offset-4 hover:underline">
                  打开 →
                </Link>
              </div>
              <div>
                v{linkedSummary.version}
                {linkedSummary.agentsMdExists ? ' · AGENTS.md' : ''}
                {' · '}技能 {linkedSummary.skillCount ?? 0}
                {' · '}子智能体 {linkedSummary.subagentCount ?? 0}
              </div>
              {linkedSummary.description && (
                <div className="mt-1.5">{linkedSummary.description}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>}

      {show('runtime') && <Card>
        <CardContent className="space-y-5 p-6">
          <span className={CARD_LABEL_CLASS}>会话默认资源</span>
          <p className={HINT_CLASS}>以下资源会成为新建托管会话的默认选择；会话自身显式指定的绑定优先。</p>
          <Field label="默认环境">
            {props => (
              <Select {...props} className={INPUT_CLASS}
                value={defaultEnvironmentId}
                onChange={e => setDefaultEnvironmentId(e.target.value)} disabled={readOnly}>
                <option value="">自动分配默认环境</option>
                {environments.map(env => (
                  <option key={env.id} value={env.id}>{env.name}（{env.type}）</option>
                ))}
              </Select>
            )}
          </Field>
          <div className={HINT_CLASS}>
            <Link to={scope.scopedPath('/agent-center/environments')} className="text-primary underline">管理环境</Link>
            ，可配置本地、远程、沙箱或自托管执行。
          </div>
          <div className={ROW_CLASS}>
            <span className="mb-1.5 block text-sm font-medium text-text-2">默认凭据仓</span>
            {vaults.length === 0 ? (
              <p className={HINT_CLASS}>暂无凭据仓。可在「资源 → 凭据仓」创建。</p>
            ) : (
              <div className="grid gap-2">
                {vaults.map(v => {
                  const on = defaultVaultIds.includes(v.id);
                  return (
                    <label key={v.id} className="flex items-center gap-2.5 text-sm text-text">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={on}
                        disabled={readOnly}
                        onChange={() => {
                          setDefaultVaultIds(prev =>
                            on ? prev.filter(id => id !== v.id) : [...prev, v.id]);
                        }}
                      />
                      <span>{v.displayName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className={ROW_CLASS}>
            <span className="mb-1.5 block text-sm font-medium text-text-2">默认记忆库</span>
            {memoryStores.length === 0 ? (
              <p className={HINT_CLASS}>暂无记忆库。可在「资源 → 记忆」创建。</p>
            ) : (
              <div className="grid gap-2">
                {memoryStores.map(m => {
                  const on = defaultMemoryStoreIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2.5 text-sm text-text">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={on}
                        disabled={readOnly}
                        onChange={() => {
                          setDefaultMemoryStoreIds(prev =>
                            on ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                        }}
                      />
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {show('behavior') && <Card>
        <CardContent className="space-y-5 p-6">
          <span className={CARD_LABEL_CLASS}>行为</span>
          <p className="text-sm text-text-3">保存后的定义用于新会话；既有会话保持自己的配置不变。</p>
          <Field label="系统提示词">
            {props => (
              <Textarea {...props} className={`${INPUT_CLASS} min-h-40 resize-y leading-6`} value={system}
                onChange={e => setSystem(e.target.value)} disabled={readOnly}
                placeholder="可选覆盖。已关联工作区且此处留空时，重新物化会使用工作区的 AGENTS.md。" />
            )}
          </Field>
          <Field label="最大迭代次数" hint="单次任务内模型与工具的往返上限，1–64。">
            {props => (
              <Input {...props} className={`${INPUT_CLASS} w-36`} type="number" min={1} max={64}
                value={maxIters} onChange={e => setMaxIters(e.target.value)} disabled={readOnly} />
            )}
          </Field>
        </CardContent>
      </Card>}

      {canEdit && section !== 'versions' && (
        <div className="flex flex-wrap items-center gap-3.5">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存修改'}
          </Button>
          {show('settings') && canShare && (
            <Button variant="outline" onClick={() => setShareOpen(true)}>↗ 分享</Button>
          )}
          {show('settings') && !agent.archivedAt && agent.status !== 'archived' && (
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving ? '归档中…' : '归档智能体'}
            </Button>
          )}
          {section === 'all' && <Button variant="destructive" onClick={handleDelete}>删除智能体</Button>}
        </div>
      )}
      {ok && <p className="text-sm text-success-text">已保存。</p>}
      {err && <p className="text-sm text-danger-text" role="alert">{err}</p>}

      {shareOpen && (
        <ShareAgentDialog agent={agent} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
