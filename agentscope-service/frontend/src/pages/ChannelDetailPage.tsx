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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useControlPlaneScope } from '@/app/ScopeContext';
import ChannelWorkPanel from '@/components/ChannelWorkPanel';
import {
  BindingConfigEntry,
  ChannelDetail,
  ChannelTypeSpec,
  ChannelUpsertRequest,
  deleteChannel,
  disableChannel,
  enableChannel,
  getChannelDetail,
  listChannelTypes,
  resolveCallbackUrl,
  updateChannel,
} from '../api/channels';
import PlatformCredentialsForm, {
  credentialsFromProperties,
  propertiesFromCredentials,
} from '../components/PlatformCredentialsForm';
import { AgentIdentity, AgentPicker } from '../components/AgentPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Page, PageHeader } from '@/components/Page';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiErrorMessage } from '@/lib/apiError';

const DM_SCOPES = ['MAIN', 'PER_PEER'];

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

const STATUS_LABEL: Record<string, string> = {
  disabled: '已停用', running: '运行中', stopped: '已停止',
};

function describe(b: BindingConfigEntry): string {
  const parts: string[] = [];
  if (b.peer) parts.push(`peer=${b.peer}`);
  if (b.parentPeer) parts.push(`parentPeer=${b.parentPeer}`);
  if (b.guild) parts.push(`guild=${b.guild}`);
  if (b.roles && b.roles.length) parts.push(`roles=${b.roles.join('|')}`);
  if (b.team) parts.push(`platformTeam=${b.team}`);
  if (b.account) parts.push(`account=${b.account}`);
  return parts.join(', ') || '（兜底）';
}

interface BindingForm {
  agentId: string;
  peer: string;
  parentPeer: string;
  guild: string;
  roles: string;
  team: string;
  account: string;
  sessionScope: string;
}

function emptyBindingForm(): BindingForm {
  return { agentId: '', peer: '', parentPeer: '', guild: '', roles: '', team: '', account: '', sessionScope: '' };
}

function bindingToForm(b: BindingConfigEntry): BindingForm {
  return {
    agentId: b.agentId ?? '',
    peer: b.peer ?? '',
    parentPeer: b.parentPeer ?? '',
    guild: b.guild ?? '',
    roles: (b.roles ?? []).join(', '),
    team: b.team ?? '',
    account: b.account ?? '',
    sessionScope: b.sessionScope ?? '',
  };
}

function formToBinding(f: BindingForm): BindingConfigEntry {
  const entry: BindingConfigEntry = { agentId: f.agentId.trim() };
  if (f.peer.trim()) entry.peer = f.peer.trim();
  if (f.parentPeer.trim()) entry.parentPeer = f.parentPeer.trim();
  if (f.guild.trim()) entry.guild = f.guild.trim();
  if (f.roles.trim()) entry.roles = f.roles.split(',').map(s => s.trim()).filter(Boolean);
  if (f.team.trim()) entry.team = f.team.trim();
  if (f.account.trim()) entry.account = f.account.trim();
  if (f.sessionScope) entry.sessionScope = f.sessionScope;
  return entry;
}

export default function ChannelDetailPage() {
  const scope = useControlPlaneScope();
  const admin = scope.roles.some(r => ['developer', 'admin'].includes(r));
  const { channelId = '' } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [types, setTypes] = useState<ChannelTypeSpec[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<
    { kind: 'channel' } | { kind: 'binding'; index: number }
  >();
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [type, setType] = useState('');
  const [dmScope, setDmScope] = useState('PER_PEER');
  const [defaultAgentId, setDefaultAgentId] = useState('');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bindings, setBindings] = useState<BindingConfigEntry[]>([]);

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BindingForm | null>(null);

  const typeSpec = useMemo(() => types.find(t => t.type === type), [types, type]);
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(typeSpec, channelId),
    [typeSpec, channelId],
  );

  async function load() {
    setErr(null);
    try {
      const [d, t] = await Promise.all([getChannelDetail(channelId), listChannelTypes()]);
      setDetail(d);
      setTypes(t);
      setType(d.type);
      setDmScope(d.dmScope ?? 'PER_PEER');
      setDefaultAgentId(d.defaultAgentId ?? '');
      const spec = t.find(x => x.type === d.type);
      setCreds(credentialsFromProperties(spec, d.properties));
      setBindings(d.bindings ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { if (admin) void load(); /* eslint-disable-next-line */ }, [channelId, admin]);

  function onTypeChange(next: string) {
    if (next === type) return;
    // 切平台会丢弃已填凭据，走三档分级的确认框而非原生 confirm。
    setPendingType(next);
  }

  function applyTypeChange(next: string) {
    setType(next);
    const spec = types.find(t => t.type === next);
    setCreds(credentialsFromProperties(spec, undefined));
  }

  async function persist(overrides?: Partial<ChannelUpsertRequest>) {
    setErr(null);
    setInfo(null);
    const props = overrides?.properties
      ?? propertiesFromCredentials(typeSpec, creds, true);
    const req: ChannelUpsertRequest = {
      type: overrides?.type ?? type,
      dmScope: overrides?.dmScope !== undefined ? overrides.dmScope : (dmScope || 'PER_PEER'),
      defaultAgentId: overrides?.defaultAgentId !== undefined
        ? overrides.defaultAgentId
        : (defaultAgentId.trim() || null),
      properties: props,
      bindings: overrides?.bindings ?? bindings,
    };
    try {
      const updated = await updateChannel(channelId, req);
      setDetail(updated);
      setBindings(updated.bindings ?? []);
      const spec = types.find(x => x.type === updated.type);
      setCreds(credentialsFromProperties(spec, updated.properties));
      setInfo('已保存。调度器会在下次刷新时生效。');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleDisabled() {
    if (!detail) return;
    try {
      if (detail.disabled) await enableChannel(channelId);
      else await disableChannel(channelId);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function runDeleteChannel() {
    try {
      await deleteChannel(channelId);
      navigate('/agent-center/entrypoints');
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '删除渠道失败'));
    }
  }

  function startEditBinding(i: number) {
    setEditIdx(i);
    setEditForm(bindingToForm(bindings[i]));
  }

  function startAddBinding() {
    setEditIdx(bindings.length);
    setEditForm(emptyBindingForm());
  }

  async function saveBinding() {
    if (editForm == null || editIdx == null) return;
    if (!editForm.agentId.trim()) { setErr('请填写目标智能体'); return; }
    const next = [...bindings];
    const entry = formToBinding(editForm);
    if (editIdx >= bindings.length) next.push(entry);
    else next[editIdx] = entry;
    setBindings(next);
    setEditIdx(null);
    setEditForm(null);
    await persist({ bindings: next });
  }

  async function runDeleteBinding(i: number) {
    const next = bindings.filter((_, idx) => idx !== i);
    setBindings(next);
    await persist({ bindings: next });
  }

  const status = useMemo(() => {
    if (!detail) return '';
    if (detail.disabled) return 'disabled';
    return detail.started ? 'running' : 'stopped';
  }, [detail]);

  if (!admin) {
    return <Page className="max-w-[1100px]"><PageHeader title={channelId} /><ChannelWorkPanel channelId={channelId} canConfigure={false} /></Page>;
  }

  if (!detail && !err) {
    return <Page className="max-w-[1100px]"><p className="text-sm text-text-3">正在加载…</p></Page>;
  }

  return (
    <Page className="max-w-[1100px]">
      <Button variant="ghost" size="sm" onClick={() => navigate('/agent-center/entrypoints')}>
        <ArrowLeft className="h-4 w-4" /> 全部渠道
      </Button>
      <PageHeader title={channelId} description="连接平台、配置工作接待，并按已授权的工作关联回传消息。" />

      {err && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">{err}</div>}
      {info && <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">{info}</p>}

      <ChannelWorkPanel channelId={channelId} canConfigure={admin} />
      {detail && (
        <>
          <Card className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">平台连接与普通会话</h2>
              <Badge tone={status === 'running' ? 'success' : status === 'disabled' ? 'danger' : 'default'}>
                {STATUS_LABEL[status] ?? status}
              </Badge>
              {detail.lastError && <Badge tone="danger">{detail.lastError}</Badge>}
              <span className="flex-1" />
              <Button variant="outline" onClick={() => void toggleDisabled()}>
                {detail.disabled ? '启用' : '停用'}
              </Button>
              <Button variant="outline" className="text-danger-text" onClick={() => setPending({ kind: 'channel' })}>
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                平台
                <select className={selectClass} value={type} onChange={e => onTypeChange(e.target.value)}>
                  {types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                会话隔离
                <select className={selectClass} value={dmScope} onChange={e => setDmScope(e.target.value)}>
                  {DM_SCOPES.map(s => (
                    <option key={s} value={s}>
                      {s === 'PER_PEER' ? '按人隔离（PER_PEER）' : '共享收件箱（MAIN）'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2 sm:col-span-2">
                <span className="block text-sm font-medium">普通私聊默认智能体</span>
                <AgentPicker value={defaultAgentId} onChange={setDefaultAgentId} aria-label="渠道默认智能体" />
              </div>
            </div>
            <div>
              <h3 className="mb-2.5 text-sm font-semibold">凭据</h3>
              <PlatformCredentialsForm
                spec={typeSpec}
                values={creds}
                onChange={setCreds}
                showAdvanced={showAdvanced}
                onToggleAdvanced={() => setShowAdvanced(v => !v)}
              />
            </div>
            {callbackUrl && (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
                <strong>回调 / Webhook URL</strong>
                <div className="mt-1.5 break-all font-mono text-xs">{callbackUrl}</div>
                <div className="mt-1.5 text-xs text-text-3">请粘贴到平台开发者控制台。</div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => void persist()}>
                <Save className="h-4 w-4" /> 保存配置
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">转发规则</h2>
              <span className="text-sm text-text-3">（{bindings.length}）</span>
              <span className="flex-1" />
              <Button onClick={startAddBinding}>
                <Plus className="h-4 w-4" /> 添加规则
              </Button>
            </div>
            <p className="text-sm text-text-3">
              把指定联系人 / 群组路由到另一个智能体。选择器留空即为兜底。
            </p>
            {bindings.length === 0 ? (
              <div className="text-sm text-text-3">
                暂无规则。入站消息会路由到 <code>defaultAgentId</code>。
              </div>
            ) : bindings.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5 text-sm">
                <Badge tone="info">→ <AgentIdentity agentId={b.agentId} showId={false} /></Badge>
                <span className="flex-1 break-all font-mono text-xs text-text-2">{describe(b)}</span>
                {b.sessionScope && <Badge>{b.sessionScope}</Badge>}
                <Button size="sm" variant="outline" onClick={() => startEditBinding(i)}>编辑</Button>
                <Button size="sm" variant="outline" className="text-danger-text" onClick={() => setPending({ kind: 'binding', index: i })}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
              </div>
            ))}
          </Card>
        </>
      )}

      {editForm && editIdx != null && (
        <BindingDialog
          form={editForm}
          isNew={editIdx >= bindings.length}
          onChange={setEditForm}
          onCancel={() => { setEditForm(null); setEditIdx(null); }}
          onSave={saveBinding}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(undefined); }}
        title={
          pending?.kind === 'channel'
            ? `删除渠道「${channelId}」？`
            : pending?.kind === 'binding'
              ? `删除规则 #${pending.index}（${describe(bindings[pending.index])}）？`
              : ''
        }
        description={
          pending?.kind === 'channel'
            ? '该渠道的条目与全部绑定都会被移除，此操作不可恢复。'
            : pending?.kind === 'binding'
              ? '删除后该规则不再生效，消息将不再路由到对应智能体。'
              : undefined
        }
        dangerLevel="danger"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          if (!pending) return;
          const target = pending;
          setPending(undefined);
          if (target.kind === 'channel') void runDeleteChannel();
          else void runDeleteBinding(target.index);
        }}
      />

      <ConfirmDialog
        open={!!pendingType}
        onOpenChange={(open) => { if (!open) setPendingType(null); }}
        title="切换平台会清空已填写的凭据"
        description="不同平台的凭据字段不同，继续将丢弃当前表单内容。渠道本身的绑定不受影响。"
        dangerLevel="warning"
        confirmLabel="继续切换"
        cancelLabel="取消"
        onConfirm={() => {
          const next = pendingType;
          setPendingType(null);
          if (next) applyTypeChange(next);
        }}
      />
    </Page>
  );
}

interface DialogProps {
  form: BindingForm;
  isNew: boolean;
  onChange: (f: BindingForm) => void;
  onCancel: () => void;
  onSave: () => void;
}

function BindingDialog({ form, isNew, onChange, onCancel, onSave }: DialogProps) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? '添加转发规则' : '编辑转发规则'}</DialogTitle>
          <DialogDescription>
            填写最具体的选择器（例如钉钉员工 ID 作为 peer），其余留空。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-sm font-medium">转交给智能体</span>
              <AgentPicker
                value={form.agentId}
                onChange={agentId => onChange({ ...form, agentId })}
                required
                aria-label="转发目标智能体"
              />
            </div>
            <label className="block space-y-2 text-sm font-medium">
              隔离覆盖
              <select
                className={selectClass}
                value={form.sessionScope}
                onChange={e => onChange({ ...form, sessionScope: e.target.value })}
              >
                <option value="">— 继承渠道设置 —</option>
                {DM_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              peer（例如 direct:staffId）
              <Input value={form.peer} onChange={e => onChange({ ...form, peer: e.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              parentPeer
              <Input value={form.parentPeer} onChange={e => onChange({ ...form, parentPeer: e.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              guild
              <Input value={form.guild} onChange={e => onChange({ ...form, guild: e.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              roles（逗号分隔）
              <Input value={form.roles} onChange={e => onChange({ ...form, roles: e.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              team
              <Input value={form.team} onChange={e => onChange({ ...form, team: e.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              account
              <Input value={form.account} onChange={e => onChange({ ...form, account: e.target.value })} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onCancel}>取消</Button>
            <Button onClick={onSave} disabled={!form.agentId.trim()}>{isNew ? '创建' : '保存'}</Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
