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

import { Bot, Cpu, FolderKanban, Sparkles, Wrench } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AgentCreateRequest,
  DiscoveredRuntimeOption,
  RuntimeCapabilityDescriptor,
  createAgent,
  listHostedRuntimeOptions,
} from '../api/agents';
import { listEnvironments } from '../api/environments';
import { getWorkspace, listWorkspaces, WorkspaceSummary } from '../api/workspaces';
import { useControlPlaneScope } from '../app/ScopeContext';
import { BackButton } from '../components/ui/back-button';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input, Select, Textarea } from '../components/ui/input';
import { Page } from '../components/Page';
import { cn } from '../lib/utils';

const managedRuntime: DiscoveredRuntimeOption = {
  id: 'managed', name: 'AgentScope 托管', provider: 'agentscope', runtimeProfileId: '', runtimePoolId: '', hostCount: 1,
  capabilities: {
    displayName: 'AgentScope 托管', instructions: { supported: true, mode: 'native' },
    workspace: { supported: true, mode: 'native' }, skills: { supported: true, mode: 'native' },
    tools: { supported: true, mode: 'native' }, mcp: { supported: true, mode: 'native' },
    model: { supported: true, mode: 'registry' }, resume: true,
  },
};

const CAPABILITY_LABEL: Record<string, string> = {
  workspace: '工作空间',
  skills: '技能',
  tools: '工具',
  mcp: 'MCP',
  resume: '可恢复',
};

function capabilityKeys(capabilities?: RuntimeCapabilityDescriptor): string[] {
  if (!capabilities) return [];
  const keys: string[] = [];
  if (capabilities.workspace?.supported) keys.push('workspace');
  if (capabilities.skills?.supported) keys.push('skills');
  if (capabilities.tools?.supported) keys.push('tools');
  if (capabilities.mcp?.supported) keys.push('mcp');
  if (capabilities.resume) keys.push('resume');
  return keys;
}

function capabilityDetails(capabilities?: RuntimeCapabilityDescriptor): string {
  if (!capabilities) return '';
  const describe = (label: string, capability?: { supported: boolean; mode?: string; target?: string }) => {
    if (!capability?.supported) return `${label}：不可用`;
    if (capability.target) return `${label} → ${capability.target}`;
    return `${label}：${(capability.mode || 'native').replace(/-/g, ' ')}`;
  };
  return [
    describe('指令', capabilities.instructions),
    describe('技能', capabilities.skills),
    describe('工具', capabilities.tools),
    describe('MCP', capabilities.mcp),
    `会话恢复：${capabilities.resume ? '支持' : '一次性'}`,
  ].join(' · ');
}

const rowClass = 'grid grid-cols-1 gap-4 border-b border-border py-5 last:border-b-0 sm:grid-cols-[210px_minmax(0,1fr)] sm:gap-6 sm:px-6';
const labelClass = 'pt-0 text-sm font-semibold text-text-2 sm:pt-2.5';
const hintClass = 'mt-1.5 text-[13px] leading-5 text-text-3';

export default function AgentCreatePage() {
  const navigate = useNavigate();
  const scope = useControlPlaneScope();
  const [name, setName] = useState('');
  const [agentKey, setAgentKey] = useState('');
  const [agentKeyCustomized, setAgentKeyCustomized] = useState(false);
  const [executionId, setExecutionId] = useState('managed');
  const [executionCustomized, setExecutionCustomized] = useState(false);
  const [runtimes, setRuntimes] = useState<DiscoveredRuntimeOption[]>([]);
  const [description, setDescription] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [preview, setPreview] = useState<WorkspaceSummary | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentId] = useState('');
  const [environments, setEnvironments] = useState<{ id: string; name: string; type: string }[]>([]);
  const [sysPrompt, setSysPrompt] = useState('');
  const [model, setModel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listWorkspaces().then(setWorkspaces).catch(() => undefined);
    listEnvironments().then(setEnvironments).catch(() => undefined);
    listHostedRuntimeOptions(scope.tenant, scope.namespace).then(result => {
      const discovered = result.runtimes ?? [];
      setRuntimes(discovered);
      if (!executionCustomized && discovered.length > 0) {
        setExecutionId((discovered.find(runtime => runtime.provider === 'codex') ?? discovered[0]).id);
      }
    }).catch(() => undefined);
  }, [executionCustomized, scope.tenant, scope.namespace]);

  useEffect(() => {
    if (!workspaceId) { setPreview(null); return; }
    let cancelled = false;
    getWorkspace(workspaceId).then(w => { if (!cancelled) setPreview(w); }).catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const execution = useMemo(
    () => executionId === 'managed' ? managedRuntime : runtimes.find(runtime => runtime.id === executionId),
    [executionId, runtimes],
  );
  const runtimeKind = executionId === 'managed' ? 'managed' : 'hosted-runtime';
  const capKeys = capabilityKeys(execution?.capabilities);
  const capabilityDetail = capabilityDetails(execution?.capabilities);
  const canSubmit = !submitting && !!name.trim() && !!agentKey.trim() && !!execution;

  async function handleSubmit() {
    if (!execution) return;
    setErr(null);
    setSubmitting(true);
    try {
      const req: AgentCreateRequest = {
        name: name.trim(), agentKey: agentKey.trim(), tenant: scope.tenant, namespace: scope.namespace,
        runtimeKind,
        runtimeProfileId: runtimeKind === 'hosted-runtime' ? execution.runtimeProfileId : undefined,
        runtimePoolId: runtimeKind === 'hosted-runtime' ? execution.runtimePoolId : undefined,
        description: description.trim() || undefined, model: model.trim() || undefined,
        system: sysPrompt.trim() || undefined,
        workspacePath: runtimeKind === 'managed' ? workspacePath.trim() || undefined : undefined,
        workspaceId: workspaceId || undefined, defaultEnvironmentId: defaultEnvironmentId || undefined,
      };
      const created = await createAgent(req);
      navigate(scope.scopedPath(`/agent-center/agents/${encodeURIComponent(created.id)}`), { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建失败，请重试');
    } finally { setSubmitting(false); }
  }

  return (
    <Page className="max-w-4xl pb-28">
      <header className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-5 border-b border-border bg-canvas/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3.5">
          <BackButton label="返回" onClick={() => navigate(-1)} />
          <div>
            <h1 className="m-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text">创建智能体</h1>
            <p className="mt-0.5 text-sm text-text-3">确认并完成配置</p>
          </div>
        </div>
        <Badge tone="neutral">{execution?.name ?? '正在探测运行时…'}</Badge>
      </header>

      <div className="mx-auto w-full max-w-[920px] space-y-9 py-9">
        <section aria-labelledby="create-agent-identity">
          <h2 id="create-agent-identity" className="m-0 flex items-center gap-2 text-[17px] font-semibold text-text">
            <Bot size={19} aria-hidden="true" /> 身份
          </h2>
          <p className="mt-1.5 mb-4 text-sm leading-6 text-text-3">
            为智能体取一个可识别的名字，并用一句话说明它的用途。
          </p>
          <Card>
            <div className={rowClass}>
              <label htmlFor="agent-name" className={labelClass}>名称</label>
              <Input
                id="agent-name"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (!agentKeyCustomized) setAgentKey(e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''));
                }}
                placeholder="例如：代码仓库评审员"
                autoFocus
              />
            </div>
            <div className={rowClass}>
              <label htmlFor="agent-description" className={labelClass}>描述</label>
              <div>
                <Textarea
                  id="agent-description"
                  className="min-h-[90px]"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="这个智能体负责做什么？"
                  maxLength={255}
                />
                <div className="mt-1 text-right text-[12.5px] text-text-4">{description.length} / 255</div>
              </div>
            </div>
          </Card>
        </section>

        <section aria-labelledby="create-agent-behavior">
          <h2 id="create-agent-behavior" className="m-0 flex items-center gap-2 text-[17px] font-semibold text-text">
            <Sparkles size={19} aria-hidden="true" /> 行为与能力
          </h2>
          <p className="mt-1.5 mb-4 text-sm leading-6 text-text-3">
            定义它的工作方式，并挂载可依赖的工作空间能力。
          </p>
          <Card>
            <div className={rowClass}>
              <label htmlFor="agent-instructions" className={labelClass}>指令</label>
              <div>
                <Textarea
                  id="agent-instructions"
                  value={sysPrompt}
                  onChange={e => setSysPrompt(e.target.value)}
                  placeholder="写下这个智能体应该做什么、关注什么、避免什么…"
                />
                <p className={hintClass}>所选运行时适配器会把这些指令映射为其原生提示词或配置。</p>
              </div>
            </div>
            <div className={rowClass}>
              <label htmlFor="agent-workspace" className={labelClass}>工作空间</label>
              <div>
                <Select id="agent-workspace" value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                  <option value="">不关联工作空间</option>
                  {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </Select>
                <p className={hintClass}>工作空间是仓库规范、技能、工具与子智能体的可移植来源。</p>
                {preview && (
                  <div className="mt-2.5 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 text-[13px] leading-6 text-text-3">
                    <strong className="text-text-2">{preview.name}</strong> · {preview.agentsMdExists ? 'AGENTS.md · ' : ''}{preview.skillCount ?? 0} 技能 · {preview.subagentCount ?? 0} 子智能体
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>

        <section aria-labelledby="create-agent-execution">
          <h2 id="create-agent-execution" className="m-0 flex items-center gap-2 text-[17px] font-semibold text-text">
            <Cpu size={19} aria-hidden="true" /> 执行
          </h2>
          <p className="mt-1.5 mb-4 text-sm leading-6 text-text-3">
            选择智能体的运行位置。主机、资源池、 profile 与 CLI 命令都在此选择背后完成解析。
          </p>
          <Card>
            <div className={rowClass}>
              <label htmlFor="agent-runtime" className={labelClass}>运行时</label>
              <div>
                <Select id="agent-runtime" value={executionId} onChange={e => { setExecutionCustomized(true); setExecutionId(e.target.value); }}>
                  {runtimes.map(runtime => <option key={runtime.id} value={runtime.id}>{runtime.name}</option>)}
                  <option value="managed">{managedRuntime.name}</option>
                </Select>
                {runtimes.length === 0 && (
                  <p className={hintClass}>当前没有本地智能体运行时在线，已选择 AgentScope 托管。</p>
                )}
                {capKeys.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {capKeys.map(key => (
                      <Badge key={key} tone="neutral">{CAPABILITY_LABEL[key] ?? key}</Badge>
                    ))}
                  </div>
                )}
                {capabilityDetail && <p className={hintClass}>{capabilityDetail}</p>}
              </div>
            </div>
            <div className={rowClass}>
              <label htmlFor="agent-model" className={labelClass}>模型</label>
              <div>
                <Input
                  id="agent-model"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="默认（跟随提供方）"
                />
                <p className={hintClass}>可选覆盖。留空则使用运行时提供方的默认模型。</p>
              </div>
            </div>
          </Card>
        </section>

        <details className="rounded-[14px] border border-border bg-surface px-5">
          <summary className="cursor-pointer py-3.5 text-sm font-semibold text-text-2">高级设置</summary>
          <div className={cn(rowClass, 'px-0')}>
            <label htmlFor="agent-key" className={labelClass}>智能体标识</label>
            <div>
              <Input
                id="agent-key"
                value={agentKey}
                onChange={e => { setAgentKeyCustomized(true); setAgentKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')); }}
                placeholder="repository-reviewer"
              />
              <p className={hintClass}>{scope.selectorVisible ? '当前租户与命名空间内的稳定标识。' : '该智能体的稳定标识。'}</p>
            </div>
          </div>
          {runtimeKind === 'managed' && (
            <div className={cn(rowClass, 'px-0')}>
              <label htmlFor="agent-environment" className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><FolderKanban size={16} aria-hidden="true" /> 运行环境</span>
              </label>
              <Select id="agent-environment" value={defaultEnvironmentId} onChange={e => setDefaultEnvironmentId(e.target.value)}>
                <option value="">自动使用本地默认</option>
                {environments.map(environment => <option key={environment.id} value={environment.id}>{environment.name}（{environment.type}）</option>)}
              </Select>
            </div>
          )}
          {runtimeKind === 'managed' && (
            <div className={cn(rowClass, 'px-0')}>
              <label htmlFor="agent-workspace-path" className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><Wrench size={16} aria-hidden="true" /> 工作空间路径</span>
              </label>
              <Input
                id="agent-workspace-path"
                value={workspacePath}
                onChange={e => setWorkspacePath(e.target.value)}
                placeholder="自动"
              />
            </div>
          )}
        </details>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 -mx-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-canvas/95 px-5 py-3.5 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {err && (
          <span role="alert" className="mr-auto text-[13px] text-danger-text">{err}</span>
        )}
        <Button variant="outline" onClick={() => navigate(scope.scopedPath('/agent-center/agents'))}>取消</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? '创建中…' : '创建并打开智能体'}
        </Button>
      </footer>
    </Page>
  );
}
