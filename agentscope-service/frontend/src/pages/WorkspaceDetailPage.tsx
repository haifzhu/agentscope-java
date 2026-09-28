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

import WorkspacePublications from '../components/WorkspacePublications';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useControlPlaneScope } from '../app/ScopeContext';
import {
  browseMarketplaceSkills,
  createMarketplace,
  deleteMarketplace,
  installMarketplaceSkill,
  listMarketplaces,
  Marketplace,
  MarketplaceSkill,
} from '../api/marketplaces';
import {
  deleteWorkspaceResourceSkill,
  deleteWorkspaceResourceSubagent,
  fetchBuiltinToolCatalog,
  fetchMcpCatalog,
  getWorkspace,
  getWorkspaceResourceSkill,
  getWorkspaceTools,
  listWorkspaceResourceSkills,
  listWorkspaceResourceSubagents,
  putWorkspaceResourceSkill,
  putWorkspaceTools,
  readWorkspaceFile,
  upsertWorkspaceResourceSubagent,
  writeWorkspaceFile,
  WorkspaceSummary,
  BuiltinToolCatalogEntry,
} from '../api/workspaces';
import McpConnectionsEditor from '../components/McpConnectionsEditor';
import { AgentToolset, McpServerSpec } from '../api/agents';
import type { WorkspaceSkillInfo } from '../api/skills';
import type { SubagentInfo } from '../api/subagents';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input, Textarea } from '../components/ui/input';
import { Page, PageHeader } from '../components/Page';
import { cn } from '../lib/utils';
import { apiErrorMessage } from '../lib/apiError';
import { assertHttpUrl } from '../lib/urls';

type Tab = 'agentsmd' | 'skills' | 'tools' | 'subagents';

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

const TAB_LABEL: Record<Tab, string> = {
  agentsmd: 'AGENTS.md',
  skills: '技能',
  tools: '工具',
  subagents: '子智能体',
};

export default function WorkspaceDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scope = useControlPlaneScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tabParam = searchParams.get('tab');
  const initialTab: Tab =
    tabParam === 'skills' ||
    tabParam === 'tools' ||
    tabParam === 'subagents' ||
    tabParam === 'agentsmd'
      ? tabParam
      : tabParam === 'marketplace' ? 'skills' : 'agentsmd';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [skillView, setSkillView] = useState<'installed' | 'browse' | 'sources'>(tabParam === 'marketplace' ? 'browse' : 'installed');
  const [catalogDraft, setCatalogDraft] = useState<McpServerSpec>();
  const [agentsMd, setAgentsMd] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<BuiltinToolCatalogEntry[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<Record<string, unknown>[]>([]);
  const [tools, setTools] = useState<AgentToolset[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerSpec[]>([]);
  const [markets, setMarkets] = useState<Marketplace[]>([]);
  const [browse, setBrowse] = useState<MarketplaceSkill[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [mktName, setMktName] = useState('');
  const [nacosAddr, setNacosAddr] = useState('');
  const [nacosSkills, setNacosSkills] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillMd, setSkillMd] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [saName, setSaName] = useState('');
  const [saDesc, setSaDesc] = useState('');
  const [saBody, setSaBody] = useState('');

  // D 阶段 MEDIUM-2：工作空间元数据/技能/子智能体迁到 Query，id 进 queryKey。
  // 此前 useEffect 无取消逻辑，切换工作空间时旧 id 的迟到响应会覆盖新页面的数据；
  // 按 queryKey 分键后，迟到的响应只会写回它自己那一格。
  const wsQuery = useQuery({
    queryKey: ['workspace', id],
    queryFn: () => getWorkspace(id),
    enabled: !!id,
    retry: false,
  });
  const skillsQuery = useQuery({
    queryKey: ['workspace', id, 'skills'],
    queryFn: () => listWorkspaceResourceSkills(id),
    enabled: !!id,
    retry: false,
  });
  const subagentsQuery = useQuery({
    queryKey: ['workspace', id, 'subagents'],
    queryFn: () => listWorkspaceResourceSubagents(id),
    enabled: !!id,
    retry: false,
  });
  const ws: WorkspaceSummary | null = wsQuery.data ?? null;
  const skills: WorkspaceSkillInfo[] = skillsQuery.data ?? [];
  const subagents: SubagentInfo[] = subagentsQuery.data ?? [];

  const reloadMeta = () =>
    queryClient.invalidateQueries({ queryKey: ['workspace', id] });
  const reloadSkills = () =>
    queryClient.invalidateQueries({ queryKey: ['workspace', id, 'skills'] });
  const reloadSubagents = () =>
    queryClient.invalidateQueries({ queryKey: ['workspace', id, 'subagents'] });

  useEffect(() => {
    if (tabParam === 'marketplace') {
      setTab('skills');
      setSkillView('browse');
      setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('tab', 'skills'); return next; }, { replace: true });
      return;
    }
    if (
      tabParam === 'skills' ||
      tabParam === 'tools' ||
      tabParam === 'subagents' ||
        tabParam === 'agentsmd'
    ) {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!id) return;
    readWorkspaceFile(id, 'AGENTS.md')
      .then(f => setAgentsMd(f.content))
      .catch(() => setAgentsMd(''));
    getWorkspaceTools(id)
      .then(t => {
        setTools(t.tools || []);
        setMcpServers(t.mcpServers || []);
      })
      .catch(() => undefined);
    fetchBuiltinToolCatalog().then(setCatalog).catch(() => undefined);
    fetchMcpCatalog().then(setMcpCatalog).catch(() => undefined);
    listMarketplaces().then(setMarkets).catch(() => undefined);
  }, [id]);

  // 元数据加载失败时给出页面级错误（Query 的 error 不写回本地 err state）。
  useEffect(() => {
    if (wsQuery.error) setErr(apiErrorMessage(wsQuery.error, '工作空间加载失败'));
  }, [wsQuery.error]);

  async function saveAgentsMd() {
    setSaving(true);
    try {
      await writeWorkspaceFile(id, 'AGENTS.md', agentsMd);
      await reloadMeta();
      setErr(null);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  }

  function enabledSet(): Set<string> {
    const set = new Set<string>();
    for (const ts of tools) {
      if (ts.type !== 'agent_toolset') continue;
      const defaultOn = ts.defaultConfig?.enabled !== false;
      if (!ts.configs || ts.configs.length === 0) {
        if (defaultOn) catalog.forEach(c => set.add(c.id));
        continue;
      }
      for (const c of ts.configs) {
        if (c.enabled !== false) set.add(c.name);
      }
    }
    return set;
  }

  async function toggleTool(productId: string) {
    const enabled = enabledSet();
    if (enabled.has(productId)) enabled.delete(productId);
    else enabled.add(productId);
    const next: AgentToolset[] = [
      {
        type: 'agent_toolset',
        defaultConfig: { enabled: false, permissionPolicy: { type: 'always_allow' } },
        configs: [...enabled].map(name => ({
          name,
          enabled: true,
          permissionPolicy: { type: name === 'bash' ? 'always_ask' : 'always_allow' },
        })),
      },
      ...tools.filter(t => t.type === 'mcp_toolset'),
    ];
    setTools(next);
    await putWorkspaceTools(id, next, mcpServers);
  }

  function addMcpFromCatalog(entry: Record<string, unknown>) {
    const name = String(entry.id || entry.name || 'mcp');
    if (mcpServers.some(server => server.name === name)) return;
    setCatalogDraft({ name, transport: String(entry.transport || 'http'),
      url: entry.url ? String(entry.url) : undefined,
      command: entry.command ? String(entry.command) : undefined,
      args: Array.isArray(entry.args) ? entry.args as string[] : undefined,
      env: entry.env as Record<string, string> | undefined,
      headers: entry.headers as Record<string, string> | undefined,
      required: true, timeout: 'PT30S' });
  }

  async function openSkill(name: string) {
    setSelectedSkill(name);
    const detail = await getWorkspaceResourceSkill(id, name);
    setSkillMd(detail.markdown);
  }

  return (
    <Page className="max-w-[1040px]">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(scope.scopedPath('/agent-center/workspaces'))}
      >
        <ArrowLeft className="h-4 w-4" /> 工作空间
      </Button>
      <PageHeader
        title={ws?.name || id}
        description={ws?.description || '与绑定到该工作空间的智能体共享操作说明、技能、工具与子智能体。'}
      />
      <div className="text-xs text-text-3">
        v{ws?.version ?? '?'} · 技能 {ws?.skillCount ?? skills.length} · 子智能体{' '}
        {ws?.subagentCount ?? subagents.length}
        {ws?.agentsMdExists ? ' · AGENTS.md' : ''}
      </div>
      <WorkspacePublications id={id} />
      {err && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">
          {err}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="工作空间分区">
        {(Object.keys(TAB_LABEL) as Tab[]).map(k => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('tab', k); return next; }, { replace: true });
            }}
            className={cn(
              'rounded-lg border px-3.5 py-2 text-sm font-medium',
              tab === k
                ? 'border-primary bg-primary-soft text-primary-text'
                : 'border-border bg-surface text-text-2 hover:text-text',
            )}
          >
            {TAB_LABEL[k]}
          </button>
        ))}
      </div>

      {tab === 'agentsmd' && (
        <div className="space-y-3">
          <Textarea
            value={agentsMd}
            onChange={e => setAgentsMd(e.target.value)}
            className="min-h-[320px] font-mono text-sm"
            aria-label="AGENTS.md 内容"
          />
          <Button onClick={saveAgentsMd} disabled={saving}>
            <Save className="h-4 w-4" /> 保存 AGENTS.md
          </Button>
        </div>
      )}

      {tab === 'skills' && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="技能导航">
          {([['installed', '已安装技能'], ['browse', '从市场安装'], ['sources', '管理市场源']] as const).map(([key, label]) => (
            <button
              key={key}
              className={cn(
                'rounded-lg border border-border px-3 py-2 text-sm',
                skillView === key
                  ? 'border-primary bg-primary-soft font-medium text-primary-text'
                  : 'bg-surface text-text-2 hover:text-text',
              )}
              onClick={() => setSkillView(key)}
            >
              {label}
            </button>
          ))}
          <p className="w-full text-sm text-text-3">
            在草稿中创建或安装技能，发布修订并更新智能体绑定后即可使用。
          </p>
        </div>
      )}
      {tab === 'skills' && skillView === 'installed' && (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="overflow-hidden p-0">
            <div className="flex gap-2 border-b border-border p-3">
              <Input
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                placeholder="skill-name"
                aria-label="新技能名称"
              />
              <Button
                size="sm"
                onClick={async () => {
                  const name = newSkillName.trim();
                  if (!name) return;
                  if (skills.some(skill => skill.dirName === name)) { setErr('同名技能已存在。请打开编辑或换个名称。'); return; }
                  const md = `---\nname: ${name}\ndescription: \n---\n\n# ${name}\n\n`;
                  await putWorkspaceResourceSkill(id, name, md);
                  setNewSkillName('');
                  await reloadSkills();
                  await openSkill(name);
                  await reloadMeta();
                }}
              >
                新建技能
              </Button>
            </div>
            {skills.map(sk => (
              <button
                key={sk.dirName}
                onClick={() => void openSkill(sk.dirName)}
                className={cn(
                  'block w-full border-b border-border px-3.5 py-3 text-left',
                  selectedSkill === sk.dirName ? 'bg-primary-soft' : 'bg-surface hover:bg-hover',
                )}
              >
                <div className="text-sm font-semibold">{sk.name}</div>
                <div className="mt-1 text-xs text-primary-text">
                  {sk.origin === 'marketplace' ? '市场' : '自定义'}
                  {sk.marketplace?.repoLocation ? ` · ${sk.marketplace.repoLocation}` : ''}
                  {sk.marketplace?.version ? ` · ${sk.marketplace.version.slice(0, 12)}` : ''}
                  {sk.modified ? ' · 本地已修改' : ''}
                </div>
                <div className="text-xs text-text-3">{sk.description || sk.dirName}</div>
              </button>
            ))}
            {skills.length === 0 && (
              <div className="p-4 text-sm text-text-3">暂无技能。</div>
            )}
          </Card>
          <Card className="p-4">
            {selectedSkill ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <strong className="flex-1">{selectedSkill}</strong>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await putWorkspaceResourceSkill(id, selectedSkill, skillMd);
                      await reloadSkills();
                      await reloadMeta();
                    }}
                  >
                    <Save className="h-3.5 w-3.5" /> 保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-danger-text"
                    onClick={async () => {
                      if (!confirm(`确认删除技能 ${selectedSkill}？`)) return;
                      await deleteWorkspaceResourceSkill(id, selectedSkill);
                      setSelectedSkill(null);
                      setSkillMd('');
                      await reloadSkills();
                      await reloadMeta();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                </div>
                <Textarea
                  value={skillMd}
                  onChange={e => setSkillMd(e.target.value)}
                  className="min-h-[340px] border-border font-mono text-sm"
                  aria-label="技能 Markdown"
                />
              </>
            ) : (
              <div className="text-text-3">选择或创建一个技能。</div>
            )}
          </Card>
        </div>
      )}

      {tab === 'tools' && (
        <div className="grid gap-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">MCP 目录</h3>
            <div className="grid gap-2.5">
              {mcpCatalog.map(entry => (
                <div key={String(entry.id)} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{String(entry.name)}</div>
                    <div className="text-sm text-text-3">
                      {String(entry.description || '')}
                    </div>
                    {Array.isArray(entry.requiredEnv) && entry.requiredEnv.length > 0 && (
                      <div className="mt-1 text-xs text-warning-text">
                        需要密钥库环境变量：{(entry.requiredEnv as string[]).join('、')}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mcpServers.some(server => server.name === String(entry.id || entry.name))}
                    onClick={() => addMcpFromCatalog(entry)}
                  >
                    {mcpServers.some(server => server.name === String(entry.id || entry.name)) ? '已配置' : '配置连接'}
                  </Button>
                </div>
              ))}
            </div>
            {mcpServers.length > 0 && (
              <div className="mt-3.5 text-sm text-text-3">
                生效中的 MCP：{mcpServers.map(s => s.name).join('、')}
              </div>
            )}
          </Card>
          <McpConnectionsEditor catalogDraft={catalogDraft} onDraftConsumed={() => setCatalogDraft(undefined)} servers={mcpServers} tools={tools} onSave={async (servers, nextTools) => {
            await putWorkspaceTools(id, nextTools, servers);
            setMcpServers(servers); setTools(nextTools); await reloadMeta();
          }} />
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">内置工具集</h3>
            <div className="grid gap-2">
              {catalog.map(t => {
                const on = enabledSet().has(t.id);
                return (
                  <label key={t.id} className="flex items-start gap-2.5">
                    <input type="checkbox" checked={on} onChange={() => void toggleTool(t.id)} />
                    <span>
                      <strong>{t.id}</strong>
                      <span className="ml-2 text-xs text-text-3">{t.group}</span>
                      <div className="text-sm text-text-3">{t.description}</div>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'subagents' && (
        <div className="grid gap-4">
          <Card className="grid gap-2 p-4">
            <h3 className="mb-1 text-sm font-semibold">新增子智能体</h3>
            <Input
              placeholder="名称"
              value={saName}
              onChange={e => setSaName(e.target.value)}
              aria-label="子智能体名称"
            />
            <Input
              placeholder="描述（必填）"
              value={saDesc}
              onChange={e => setSaDesc(e.target.value)}
              aria-label="子智能体描述"
            />
            <Textarea
              placeholder="内联系统提示词"
              value={saBody}
              onChange={e => setSaBody(e.target.value)}
              className="min-h-[100px]"
              aria-label="子智能体内联提示词"
            />
            <Button
              className="w-36"
              onClick={async () => {
                if (!saName.trim() || !saDesc.trim()) {
                  setErr('子智能体的名称与描述为必填项');
                  return;
                }
                await upsertWorkspaceResourceSubagent(id, saName.trim(), {
                  description: saDesc.trim(),
                  inlineBody: saBody,
                  workspaceMode: 'isolated',
                });
                setSaName('');
                setSaDesc('');
                setSaBody('');
                await reloadSubagents();
                await reloadMeta();
                setErr(null);
              }}
            >
              保存子智能体
            </Button>
          </Card>
          <Card className="p-4">
            {subagents.map(sa => (
              <div key={sa.name} className="flex items-center gap-3 border-b border-border py-2.5">
                <div className="flex-1">
                  <strong>{sa.name}</strong>
                  <div className="text-sm text-text-3">{sa.description}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger-text"
                  onClick={async () => {
                    if (!confirm(`确认删除子智能体 ${sa.name}？`)) return;
                    await deleteWorkspaceResourceSubagent(id, sa.name);
                    await reloadSubagents();
                    await reloadMeta();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
              </div>
            ))}
            {subagents.length === 0 && (
              <div className="text-text-3">
                创建子智能体来分担聚焦的局部工作。其运行时必须支持所选能力。
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'skills' && skillView !== 'installed' && (
        <div className="grid gap-4">
          {skillView === 'sources' && <>
          <Card className="grid gap-2.5 p-4">
            <h3 className="mb-1 text-sm font-semibold">注册市场源</h3>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="名称"
                value={mktName}
                onChange={e => setMktName(e.target.value)}
                className="min-w-[160px]"
                aria-label="市场名称"
              />
              <Input
                placeholder="git 远程地址"
                value={gitUrl}
                onChange={e => setGitUrl(e.target.value)}
                className="min-w-[240px] flex-1"
                aria-label="git 远程地址"
              />
              <Button
                onClick={async () => {
                  try {
                    // 安全 LOW-2：git 远程地址限 http(s)，file:/ssh:/git: 等协议
                    // 不再交给服务端去解释。
                    const remoteUrl = assertHttpUrl(gitUrl, 'git 远程地址');
                    await createMarketplace({
                      name: mktName || 'Git skills',
                      type: 'git',
                      config: { remoteUrl, branch: 'main', skillsRoot: 'skills' },
                    });
                    setMarkets(await listMarketplaces());
                    setGitUrl('');
                    setMktName('');
                    setErr(null);
                  } catch (e: unknown) {
                    setErr(apiErrorMessage(e, '操作失败'));
                  }
                }}
              >
                添加 Git 源
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="nacos serverAddr"
                value={nacosAddr}
                onChange={e => setNacosAddr(e.target.value)}
                className="min-w-[200px]"
                aria-label="nacos 地址"
              />
              <Input
                placeholder="skillNames，逗号分隔"
                value={nacosSkills}
                onChange={e => setNacosSkills(e.target.value)}
                className="min-w-[220px] flex-1"
                aria-label="nacos 技能列表"
              />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await createMarketplace({
                      name: mktName || 'Nacos skills',
                      type: 'nacos',
                      config: {
                        serverAddr: nacosAddr,
                        skillNames: nacosSkills
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean),
                      },
                    });
                    setMarkets(await listMarketplaces());
                    setNacosAddr('');
                    setNacosSkills('');
                    setErr(null);
                  } catch (e: unknown) {
                    setErr(apiErrorMessage(e, '操作失败'));
                  }
                }}
              >
                添加 Nacos 源
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">已注册的市场源</h3>
            {markets.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 border-b border-border py-2">
                <div className="flex-1">
                  <strong>{m.name}</strong>{' '}
                  <span className="text-xs text-text-3">({m.type})</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger-text"
                  onClick={async () => {
                    await deleteMarketplace(m.id);
                    setMarkets(await listMarketplaces());
                    if (selectedMarket === m.id) {
                      setSelectedMarket('');
                      setBrowse([]);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
              </div>
            ))}
          </Card>

          </>}
          {skillView === 'browse' && <>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">浏览并安装到该工作空间</h3>
            <select
              aria-label="市场源"
              className={cn(selectClass, 'mb-3')}
              value={selectedMarket}
              onChange={async e => {
                const mid = e.target.value;
                setSelectedMarket(mid);
                if (mid) setBrowse(await browseMarketplaceSkills(mid));
                else setBrowse([]);
              }}
            >
              <option value="">选择市场源</option>
              {markets.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </option>
              ))}
            </select>
            <div className="grid gap-2">
              {browse.map(sk => (
                <div key={sk.dirName || sk.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <strong>{sk.name}</strong>
                    <div className="text-sm text-text-3">{sk.description}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={skills.some(installed => installed.dirName === (sk.dirName || sk.name))}
                    onClick={async () => {
                      try {
                        await installMarketplaceSkill(id, selectedMarket, sk.dirName || sk.name);
                        await reloadSkills();
                        await reloadMeta();
                        setErr(null);
                      } catch (e: unknown) {
                        setErr(e instanceof Error ? e.message : '安装失败');
                      }
                    }}
                  >
                    {skills.some(installed => installed.dirName === (sk.dirName || sk.name)) ? '已安装' : '安装'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
          </>}
        </div>
      )}
    </Page>
  );
}
