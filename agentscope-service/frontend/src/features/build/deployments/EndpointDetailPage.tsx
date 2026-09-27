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

import { EndpointUsage } from '@/components/EndpointUsage';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, History, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  archiveEndpoint,
  createEndpointCredential,
  disableEndpoint,
  Endpoint,
  getEndpoint,
  getEndpointReadiness,
  listEndpointCredentials,
  listEndpointInvocations,
  listEndpointReleases,
  patchEndpoint,
  publishEndpoint,
  revealEndpointCredential,
  rollbackEndpointRelease,
  revokeEndpointCredential,
  rotateEndpointCredential,
} from '@/api/agentEndpoints';
import { getRoles } from '@/api/auth';
import { useControlPlaneScope } from '@/app/ScopeContext';
import { Page, PageHeader } from '@/components/Page';
import { InvocationPlayground } from '@/components/InvocationPlayground';
import { EntityIdentityText, useEntityIdentities } from '@/components/EntityIdentity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { safeEndpointOwnerPath } from './endpointNavigation';
import { apiErrorMessage } from '@/lib/apiError';

type Tab = 'overview' | 'contract' | 'security' | 'playground' | 'invocations' | 'releases' | 'target';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'contract', label: '契约' },
  { id: 'security', label: '安全' },
  { id: 'playground', label: '测试 API' },
  { id: 'invocations', label: '调用记录' },
  { id: 'releases', label: '版本历史' },
  { id: 'target', label: '目标' },
];

const lifecycleTone = (status: Endpoint['status']) => status === 'published' ? 'success' : status === 'draft' ? 'info' : status === 'disabled' ? 'warning' : 'default';
const readinessTone = (state?: string) => state === 'ready' ? 'success' : state === 'degraded' ? 'warning' : state === 'incompatible' || state === 'unavailable' ? 'danger' : 'default';

export default function EndpointDetailPage() {
  const { endpointId = '' } = useParams();
  const scope = useControlPlaneScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const roles = getRoles().map(role => role.toLowerCase());
  const canEdit = roles.includes('admin') || roles.includes('agent_developer');
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') as Tab | null;
  const tab = tabs.some(item => item.id === requestedTab) ? requestedTab! : 'overview';
  const endpointQuery = useQuery({ queryKey: ['endpoint', endpointId], queryFn: () => getEndpoint(endpointId), enabled: !!endpointId });
  const endpoint = endpointQuery.data?.endpoint;
  const ownerPath = safeEndpointOwnerPath(params.get('returnTo'), endpoint);
  const readiness = useQuery({
    queryKey: ['endpoint-readiness', endpointId],
    queryFn: () => getEndpointReadiness(endpointId),
    enabled: !!endpointId,
    refetchInterval: endpoint?.status === 'published' ? 10_000 : false,
  });
  const credentials = useQuery({ queryKey: ['endpoint-credentials', endpointId], queryFn: () => listEndpointCredentials(endpointId), enabled: !!endpointId && (tab === 'security' || tab === 'overview') });
  const invocations = useQuery({ queryKey: ['endpoint-invocations', endpointId], queryFn: () => listEndpointInvocations(endpointId), enabled: !!endpointId && (tab === 'overview' || tab === 'invocations'), refetchInterval: tab === 'invocations' ? 5_000 : false });
  const releases = useQuery({ queryKey: ['endpoint-releases', endpointId], queryFn: () => listEndpointReleases(endpointId), enabled: !!endpointId && (tab === 'overview' || tab === 'releases') });
  const identities = useEntityIdentities([
    { type: endpoint?.targetType, ref: endpoint?.targetRef },
    ...(releases.data?.items || []).map(release => ({ type: release.targetType, ref: release.targetRef })),
  ]);
  const [secret, setSecret] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [error, setError] = useState('');
  const [editingContract, setEditingContract] = useState(false);
  const [inputSchemaText, setInputSchemaText] = useState('');
  const [outputSchemaText, setOutputSchemaText] = useState('');
  const [timeoutText, setTimeoutText] = useState('300');
  const [maxPayloadText, setMaxPayloadText] = useState('1048576');
  const [rateRequestsText, setRateRequestsText] = useState('60');
  const [rateWindowText, setRateWindowText] = useState('60');
  const [editingDetails, setEditingDetails] = useState(false);
  const [nameText, setNameText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['endpoint', endpointId] });
    void queryClient.invalidateQueries({ queryKey: ['endpoint-readiness', endpointId] });
    void queryClient.invalidateQueries({ queryKey: ['endpoint-credentials', endpointId] });
    void queryClient.invalidateQueries({ queryKey: ['endpoint-invocations', endpointId] });
    void queryClient.invalidateQueries({ queryKey: ['endpoint-releases', endpointId] });
  };
  const lifecycle = useMutation({
    mutationFn: async (action: 'publish' | 'disable' | 'archive') => {
      if (!endpoint) throw new Error('端点当前不可用');
      if (action === 'publish') return publishEndpoint(endpoint);
      if (action === 'disable') return disableEndpoint(endpoint);
      return archiveEndpoint(endpoint);
    },
    onSuccess: (_, action) => {
      if (action === 'archive') navigate(scope.scopedPath(ownerPath));
      else refresh();
    },
    onError: cause => setError(apiErrorMessage(cause, '端点生命周期更新失败')),
  });
  const credentialAction = useMutation({
    mutationFn: async (request: { type: 'create'; name: string } | { type: 'rotate' | 'revoke' | 'reveal'; id: string }) => {
      if (request.type === 'create') return createEndpointCredential(endpointId, { name: request.name });
      if (request.type === 'rotate') return rotateEndpointCredential(endpointId, request.id);
      if (request.type === 'reveal') return revealEndpointCredential(endpointId, request.id);
      return revokeEndpointCredential(endpointId, request.id);
    },
    onSuccess: (result, request) => {
      if ('secret' in result && typeof result.secret === 'string') {
        setSecret(result.secret);
        
      }
      setCredentialName('');
      refresh();
    },
    onError: cause => setError(apiErrorMessage(cause, '凭据更新失败')),
  });
  const updateContract = useMutation({
    mutationFn: async () => {
      if (!endpoint) throw new Error('端点当前不可用');
      const operational = {
        timeoutSeconds: Number(timeoutText),
        maxPayloadBytes: Number(maxPayloadText),
        rateLimit: { requests: Number(rateRequestsText), windowSeconds: Number(rateWindowText) },
      };
      if (endpoint.status === 'published') return patchEndpoint(endpoint, operational);
      return patchEndpoint(endpoint, {
        ...operational,
        inputSchema: inputSchemaText.trim() ? JSON.parse(inputSchemaText) : null,
        outputSchema: outputSchemaText.trim() ? JSON.parse(outputSchemaText) : null,
      });
    },
    onSuccess: () => { setEditingContract(false); refresh(); },
    onError: cause => setError(apiErrorMessage(cause, '契约更新失败')),
  });
  const rollback = useMutation({
    mutationFn: (releaseId: string) => {
      if (!endpoint) throw new Error('端点当前不可用');
      return rollbackEndpointRelease(endpoint, releaseId);
    },
    onSuccess: refresh,
    onError: cause => setError(apiErrorMessage(cause, '回滚失败')),
  });
  const updateDetails = useMutation({
    mutationFn: () => {
      if (!endpoint) throw new Error('端点当前不可用');
      if (!nameText.trim()) throw new Error('请填写接口名称');
      return patchEndpoint(endpoint, { name: nameText.trim(), description: descriptionText.trim() });
    },
    onSuccess: () => { setEditingDetails(false); setError(''); refresh(); },
    onError: cause => setError(apiErrorMessage(cause, '接口信息更新失败')),
  });

  if (endpointQuery.isLoading) return <Page><p className="text-sm text-muted-foreground">正在加载端点…</p></Page>;
  if (!endpoint) return <Page><PageHeader title="端点不可用" /><p className="text-sm text-danger-text">{apiErrorMessage(endpointQuery.error, '未找到该端点。')}</p></Page>;
  const invokePath = `/invoke/v1/endpoints/${endpoint.slug}/${endpoint.invocationMode === 'job' ? 'jobs' : 'conversations'}`;
  const ownerLabel = endpoint.targetType === 'agent' ? 'Agent' : endpoint.targetType === 'team' ? 'Team' : 'Workflow';

  return (
    <Page>
      <button type="button" className="inline-flex cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-sm text-muted-foreground hover:text-foreground" aria-label="Back to previous page" title="Back to previous page" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" />Back</button>
      <PageHeader
        title={endpoint.name}
        description={endpoint.description || 'A stable public API contract governed by AgentScope Service.'}
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" />刷新</Button>{canEdit && <Button variant="outline" size="sm" onClick={() => { setEditingDetails(value => !value); setNameText(endpoint.name); setDescriptionText(endpoint.description ?? ''); }}>{editingDetails ? '取消编辑' : '编辑信息'}</Button>}{canEdit && endpoint.status !== 'published' && <Button size="sm" disabled={lifecycle.isPending || !readiness.data?.readiness.compatible} onClick={() => lifecycle.mutate('publish')}>发布</Button>}{canEdit && endpoint.status === 'published' && <Button size="sm" variant="outline" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate('disable')}>停用新调用</Button>}{canEdit && endpoint.status !== 'archived' && <Button size="sm" variant="destructive" disabled={lifecycle.isPending} onClick={() => { if (window.confirm('归档该端点？新的和既有的公开访问都会停止。')) lifecycle.mutate('archive'); }}>归档</Button>}</div>}
      />
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {editingDetails && <Card><CardHeader><CardTitle>编辑 API 信息</CardTitle><CardDescription>公开 slug 保持不变；名称与描述的修改不会产生新版本。</CardDescription></CardHeader><CardContent><form className="grid gap-3" onSubmit={event => { event.preventDefault(); updateDetails.mutate(); }}><label className="grid gap-1 text-sm">名称<Input value={nameText} onChange={event => setNameText(event.target.value)} required /></label><label className="grid gap-1 text-sm">描述<textarea className="min-h-24 rounded-md border bg-background p-3" value={descriptionText} onChange={event => setDescriptionText(event.target.value)} /></label><div><Button disabled={updateDetails.isPending || !nameText.trim()}>{updateDetails.isPending ? '保存中…' : '保存信息'}</Button></div></form></CardContent></Card>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
        <Badge tone={lifecycleTone(endpoint.status)}>{endpoint.status}</Badge>
        <Badge tone={readinessTone(readiness.data?.readiness.state)}>{readiness.data?.readiness.state ?? 'checking'}</Badge>
        <Badge tone="info">{endpoint.invocationMode}</Badge><Badge>{endpoint.targetType}</Badge>
        <code className="ml-auto max-w-full truncate text-xs text-muted-foreground">{invokePath}</code>
        <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(invokePath)}><Copy className="h-4 w-4" /></Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(item => <button key={item.id} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${tab === item.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('tab', item.id); return next; })}>{item.label}</button>)}
      </div>

      {tab === 'overview' && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle>发布状态</CardTitle><CardDescription>生命周期与目标就绪相互独立。</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div>状态 <Badge className="ml-2" tone={lifecycleTone(endpoint.status)}>{endpoint.status}</Badge></div><div>认证 <span className="font-medium">{endpoint.authPolicy?.type ?? 'api_key'}</span></div><div>生效版本 <span className="font-medium">{endpoint.activeRelease ? `r${endpoint.activeRelease}` : '未部署'}</span></div><div>配置版本 <span className="font-medium">{endpoint.version}</span></div></CardContent></Card>
        <Card><CardHeader><CardTitle>目标就绪</CardTitle><CardDescription>不发送请求即可评估。</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><Badge tone={readinessTone(readiness.data?.readiness.state)}>{readiness.data?.readiness.state ?? '检测中'}</Badge><p className="text-muted-foreground">{readiness.data?.readiness.reason ?? '正在加载目标可用性…'}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>近期流量</CardTitle><CardDescription>持久化的公开调用身份。</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="text-3xl font-semibold">{invocations.data?.items.length ?? '—'}</div><p className="text-muted-foreground">最近保留的调用次数</p></CardContent></Card>
        <Card><CardHeader><CardTitle>凭据与安全</CardTitle><CardDescription>认证方式与 API Key 概览。</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div>认证方式 <span className="font-medium">{endpoint.authPolicy?.type ?? 'api_key'}</span></div><div>凭据 <span className="font-medium">{credentials.data?.items.length ?? '—'} 个</span></div><Button className="mt-1" size="sm" variant="outline" onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('tab', 'security'); return next; })}>管理凭据</Button></CardContent></Card>
      </div>}

      {tab === 'contract' && <EndpointUsage endpoint={endpoint} />}
      {tab === 'contract' && <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>调用契约</CardTitle><CardDescription>目标类型与调用模式不可变；工作流修订以版本发布。</CardDescription></div>{canEdit && <Button size="sm" variant="outline" onClick={() => { setEditingContract(value => !value); setInputSchemaText(endpoint.inputSchema ? JSON.stringify(endpoint.inputSchema, null, 2) : ''); setOutputSchemaText(endpoint.outputSchema ? JSON.stringify(endpoint.outputSchema, null, 2) : ''); setTimeoutText(String(endpoint.timeoutSeconds)); setMaxPayloadText(String(endpoint.maxPayloadBytes)); setRateRequestsText(String(endpoint.rateLimit?.requests ?? 60)); setRateWindowText(String(endpoint.rateLimit?.windowSeconds ?? 60)); }}>{editingContract ? '取消' : '编辑'}</Button>}</div></CardHeader><CardContent className="space-y-3 text-sm"><div><span className="text-muted-foreground">调用模式</span><p>{endpoint.invocationMode}</p></div><div><span className="text-muted-foreground">公开路径</span><p className="break-all font-mono text-xs">{invokePath}</p></div><div><span className="text-muted-foreground">超时</span><p>{endpoint.timeoutSeconds}s</p></div><div><span className="text-muted-foreground">最大负载</span><p>{endpoint.maxPayloadBytes.toLocaleString()} bytes</p></div><div><span className="text-muted-foreground">限流</span><p>{endpoint.rateLimit?.requests ?? 'unlimited'}{endpoint.rateLimit?.requests ? ` 次 / ${endpoint.rateLimit.windowSeconds ?? 60} 秒 / 每主体` : ''}</p></div><div><span className="text-muted-foreground">事件契约</span><p>{endpoint.eventSchemaVersion}</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle>JSON 契约</CardTitle><CardDescription>未配置契约时，目标接受其原生输入。</CardDescription></CardHeader><CardContent className="space-y-4"><div><div className="mb-1 text-sm text-muted-foreground">输入</div><pre className="max-h-64 overflow-auto rounded-lg bg-surface-3 p-3 text-xs text-text">{JSON.stringify(endpoint.inputSchema ?? null, null, 2)}</pre></div><div><div className="mb-1 text-sm text-muted-foreground">输出</div><pre className="max-h-64 overflow-auto rounded-lg bg-surface-3 p-3 text-xs text-text">{JSON.stringify(endpoint.outputSchema ?? null, null, 2)}</pre></div></CardContent></Card>
        {editingContract && <Card className="md:col-span-2"><CardHeader><CardTitle>编辑契约控制项</CardTitle><CardDescription>{endpoint.status === 'published' ? '修改 JSON 契约前需先停用端点。超时、负载与限流始终可调。' : '契约变更将在端点再次发布后生效。'}</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={event => { event.preventDefault(); updateContract.mutate(); }}><label className="grid gap-1 text-sm">超时（秒）<Input type="number" min="1" value={timeoutText} onChange={event => setTimeoutText(event.target.value)} /></label><label className="grid gap-1 text-sm">最大负载（字节）<Input type="number" min="1" value={maxPayloadText} onChange={event => setMaxPayloadText(event.target.value)} /></label><label className="grid gap-1 text-sm">窗口内请求数<Input type="number" min="1" value={rateRequestsText} onChange={event => setRateRequestsText(event.target.value)} /></label><label className="grid gap-1 text-sm">窗口时长（秒）<Input type="number" min="1" value={rateWindowText} onChange={event => setRateWindowText(event.target.value)} /></label><label className="grid gap-1 text-sm">输入 JSON 契约<textarea className="min-h-48 rounded-lg border p-3 font-mono text-xs disabled:bg-muted" disabled={endpoint.status === 'published'} value={inputSchemaText} onChange={event => setInputSchemaText(event.target.value)} /></label><label className="grid gap-1 text-sm">输出 JSON 契约<textarea className="min-h-48 rounded-lg border p-3 font-mono text-xs disabled:bg-muted" disabled={endpoint.status === 'published'} value={outputSchemaText} onChange={event => setOutputSchemaText(event.target.value)} /></label><div className="md:col-span-2"><Button disabled={updateContract.isPending || !Number(timeoutText) || !Number(maxPayloadText) || !Number(rateRequestsText) || !Number(rateWindowText)}>保存契约控制项</Button></div></form></CardContent></Card>}
      </div>}

      {tab === 'security' && <div className="space-y-4">
        {secret && <Card role="alert" className="border-warning bg-warning-soft"><CardHeader><CardTitle>凭据明文（仅此一次展示）</CardTitle><CardDescription>请立即复制并妥善保存：离开此页面后明文不再显示，平台只保留加密后的密钥。若丢失，需要轮换生成新凭据。</CardDescription></CardHeader><CardContent className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-surface p-3 text-xs">{secret}</code><Button variant="outline" onClick={() => void navigator.clipboard.writeText(secret)}><Copy className="h-4 w-4" />复制</Button><Button variant="ghost" onClick={() => setSecret('')}>我已保存，关闭</Button></CardContent></Card>}
        <Card><CardHeader><div className="flex items-start justify-between"><div><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />认证与凭据</CardTitle><CardDescription>凭据值默认打码。显式复制仅解密所选端点凭据，且明文只展示一次。</CardDescription></div>{canEdit && endpoint.authPolicy?.type === 'api_key' && <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (credentialName.trim()) credentialAction.mutate({ type: 'create', name: credentialName.trim() }); }}><Input value={credentialName} onChange={event => setCredentialName(event.target.value)} placeholder="凭据名称" /><Button size="sm" disabled={!credentialName.trim()}>Create</Button></form>}</div></CardHeader><CardContent className="space-y-3">{(credentials.data?.items ?? []).map(credential => <div key={credential.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><KeyRound className="h-4 w-4 text-muted-foreground" /><div className="min-w-36 flex-1"><div className="font-medium">{credential.name}</div><div className="font-mono text-xs text-muted-foreground">asep_{credential.keyPrefix}… · 创建于 {new Date(credential.createdAt).toLocaleString()}</div></div><Badge tone={credential.status === 'active' ? 'success' : 'default'}>{credential.status}</Badge>{credential.lastUsedAt && <span className="text-xs text-muted-foreground">最近使用 {new Date(credential.lastUsedAt).toLocaleString()}</span>}{canEdit && credential.status === 'active' && <><Button size="sm" variant="outline" disabled={credentialAction.isPending} onClick={() => credentialAction.mutate({ type: 'reveal', id: credential.id })}><Copy className="h-3 w-3" />Copy key</Button><Button size="sm" variant="outline" onClick={() => credentialAction.mutate({ type: 'rotate', id: credential.id })}>Rotate</Button><Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`吊销 ${credential.name}？正在使用它的调用方会被拒绝。`)) credentialAction.mutate({ type: 'revoke', id: credential.id }); }}>Revoke</Button></>}</div>)}{!credentials.isLoading && !(credentials.data?.items.length) && <p className="text-sm text-muted-foreground">暂无 API Key 凭据。该端点可能使用平台认证。</p>}</CardContent></Card>
      </div>}

      {tab === 'playground' && <InvocationPlayground endpoint={endpoint} onInvoked={() => void queryClient.invalidateQueries({ queryKey: ['endpoint-invocations', endpointId] })} />}

      {tab === 'invocations' && <Card><CardHeader><CardTitle>调用记录</CardTitle><CardDescription>公开调用身份与内部的事项、运行、任务、尝试、会话相互独立。</CardDescription></CardHeader><CardContent className="space-y-3">{(invocations.data?.items ?? []).map(invocation => <div key={invocation.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[1fr_auto_auto]"><div><div className="font-mono text-xs">{invocation.id}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(invocation.createdAt).toLocaleString()} · correlation {invocation.correlationId}</div>{invocation.errorMessage && <div className="mt-1 text-xs text-danger-text">{invocation.errorMessage}</div>}</div><Badge tone={invocation.status === 'completed' ? 'success' : invocation.status === 'failed' || invocation.status === 'timed_out' ? 'danger' : invocation.status === 'cancelled' ? 'warning' : 'info'}>{invocation.status}</Badge><div className="flex gap-2">{invocation.issueId && <Button asChild size="sm" variant="outline"><Link to={scope.scopedPath(`/work/issues/${invocation.issueId}`)}>事项<ExternalLink className="h-3 w-3" /></Link></Button>}{invocation.runId && <Button asChild size="sm" variant="outline"><Link to={scope.scopedPath(`/work/executions/${invocation.runId}`)}>执行<ExternalLink className="h-3 w-3" /></Link></Button>}{invocation.sessionId && <Button asChild size="sm" variant="outline"><Link to={scope.scopedPath(`/work/sessions/${invocation.sessionId}`)}>会话<ExternalLink className="h-3 w-3" /></Link></Button>}</div></div>)}{!invocations.isLoading && !(invocations.data?.items.length) && <p className="text-sm text-muted-foreground">暂无调用。可通过「测试 API」或公开 API 发起。</p>}</CardContent></Card>}

      {tab === 'releases' && <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />版本历史</CardTitle><CardDescription>每次部署与回滚都会追加一个不可变版本，公开 URL 与凭据保持不变。</CardDescription></CardHeader><CardContent className="space-y-3">{(releases.data?.items ?? []).map(release => <div key={release.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><div className="min-w-48 flex-1"><div className="flex items-center gap-2"><strong>版本 {release.number}</strong>{endpoint.activeReleaseId === release.id && <Badge tone="success">生效中</Badge>}</div><div className="mt-1 text-xs"><EntityIdentityText identities={identities} type={release.targetType} entityRef={release.targetRef} secondary /></div><div className="mt-1 text-xs text-muted-foreground">{release.reason || '部署'} · {new Date(release.activatedAt).toLocaleString()}</div></div>{canEdit && endpoint.activeReleaseId !== release.id && <Button size="sm" variant="outline" disabled={rollback.isPending} onClick={() => { if (window.confirm(`以版本 ${release.number} 创建新版本并回滚？`)) rollback.mutate(release.id); }}>回滚到此版本</Button>}</div>)}{!releases.isLoading && !(releases.data?.items.length) && <p className="text-sm text-muted-foreground">暂无版本。发布该端点后会生成版本 1。</p>}</CardContent></Card>}

      {tab === 'target' && <Card><CardHeader><CardTitle>当前目标</CardTitle><CardDescription>目标类型与调用模式属于稳定契约。工作流修订的变更会生成显式版本。</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div><span className="text-muted-foreground">类型</span><p>{endpoint.targetType}</p></div><div><span className="text-muted-foreground">当前目标</span><p><EntityIdentityText identities={identities} type={endpoint.targetType} entityRef={endpoint.targetRef} secondary /></p></div><div><span className="text-muted-foreground">版本</span><p>{endpoint.activeRelease ? `r${endpoint.activeRelease}` : 'not deployed'}</p></div><Button asChild variant="outline"><Link to={scope.scopedPath(ownerPath)}>打开{ownerLabel}<ExternalLink className="h-4 w-4" /></Link></Button></CardContent></Card>}
    </Page>
  );
}
