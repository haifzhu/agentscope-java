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
import { useNavigate } from 'react-router-dom';
import { Plug, Plus, Trash2 } from 'lucide-react';
import { useControlPlaneScope } from '@/app/ScopeContext';
import {
  ChannelInfo,
  ChannelTypeSpec,
  ChannelUpsertRequest,
  createChannel,
  deleteChannel,
  disableChannel,
  enableChannel,
  listChannelTypes,
  listChannels,
} from '../api/channels';
import PlatformCredentialsForm, {
  credentialsFromProperties,
  propertiesFromCredentials,
} from '../components/PlatformCredentialsForm';
import { AgentPicker } from '../components/AgentPicker';
import { AsyncState } from '@/components/ui/async-state';
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

const DM_SCOPES = ['PER_PEER', 'MAIN'];

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

export default function ChannelsHubPage() {
  const scope = useControlPlaneScope();
  const admin = scope.roles.some(r => ['developer', 'admin'].includes(r));
  const navigate = useNavigate();
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [types, setTypes] = useState<ChannelTypeSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<ChannelInfo | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [c, t] = await Promise.all([listChannels(), listChannelTypes()]);
      setChannels(c);
      setTypes(t);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleDisabled(c: ChannelInfo) {
    try {
      if (c.disabled) await enableChannel(c.channelId);
      else await disableChannel(c.channelId);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function runDelete(c: ChannelInfo) {
    try {
      await deleteChannel(c.channelId);
      await refresh();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, '删除渠道失败'));
    }
  }

  const sorted = useMemo(
    () => [...channels].sort((a, b) => a.channelId.localeCompare(b.channelId)),
    [channels],
  );

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="接入渠道"
        description="渠道是聊天平台与 Webhook 提供方的外部入口连接。在此配置凭据与路由；智能体页面只展示指向该逻辑智能体的子集。"
        actions={
          admin ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> 新建渠道
            </Button>
          ) : undefined
        }
      />
      <AsyncState
        status={loading ? 'loading' : err ? 'error' : sorted.length ? 'ready' : 'empty'}
        resource="接入渠道"
        errorDescription={err ?? undefined}
        onRetry={() => void refresh()}
        emptyDescription="尚未注册任何渠道。点击「新建渠道」添加第一个。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(c => (
            <Card
              key={c.channelId}
              className="cursor-pointer space-y-3 p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              onClick={() => navigate(`/agent-center/entrypoints/${encodeURIComponent(c.channelId)}`)}
            >
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 shrink-0 text-text-3" />
                <span className="flex-1 truncate text-sm font-semibold">{c.channelId}</span>
                <Badge tone={c.type === 'dingtalk' ? 'warning' : c.type === 'wecom' ? 'success' : 'info'}>
                  {c.type}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {c.dmScope && (
                  <Badge>{c.dmScope === 'PER_PEER' ? '按人隔离' : '共享收件箱'}</Badge>
                )}
                {c.defaultAgentId && (
                  <Badge tone="info">默认 → {c.defaultAgentId}</Badge>
                )}
                {c.disabled && <Badge tone="danger">已停用</Badge>}
                {!c.disabled && c.started && <Badge tone="success">运行中</Badge>}
              </div>
              {admin && (
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => void toggleDisabled(c)}>
                    {c.disabled ? '启用' : '停用'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-danger-text" onClick={() => setPending(c)}>
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </AsyncState>

      {creating && (
        <ChannelCreateDialog
          types={types}
          onClose={() => setCreating(false)}
          onCreated={id => {
            setCreating(false);
            void refresh();
            navigate(`/agent-center/entrypoints/${encodeURIComponent(id)}`);
          }}
        />
      )}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? `删除渠道「${pending.channelId}」？` : ''}
        description="该渠道的条目与全部绑定都会被移除，此操作不可恢复。"
        dangerLevel="danger"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          const target = pending;
          setPending(null);
          if (target) void runDelete(target);
        }}
      />

    </Page>
  );
}

interface CreateProps {
  types: ChannelTypeSpec[];
  onClose: () => void;
  onCreated: (channelId: string) => void;
}

function ChannelCreateDialog({ types, onClose, onCreated }: CreateProps) {
  const [channelId, setChannelId] = useState('');
  const [type, setType] = useState(types[0]?.type ?? '');
  const [dmScope, setDmScope] = useState('PER_PEER');
  const [defaultAgentId, setDefaultAgentId] = useState('');
  const [creds, setCreds] = useState<Record<string, string>>(
    () => credentialsFromProperties(types[0], undefined),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const typeSpec = types.find((t) => t.type === type);

  function onTypeChange(next: string) {
    setType(next);
    setCreds(credentialsFromProperties(types.find((t) => t.type === next), undefined));
  }

  async function handleSave() {
    setErr(null);
    if (!channelId.trim()) { setErr('请填写渠道 ID'); return; }
    if (!type) { setErr('请选择平台'); return; }
    const req: ChannelUpsertRequest = {
      channelId: channelId.trim(),
      type,
      dmScope: dmScope || 'PER_PEER',
      defaultAgentId: defaultAgentId.trim() || null,
      properties: propertiesFromCredentials(typeSpec, creds, false),
    };
    setBusy(true);
    try {
      const created = await createChannel(req);
      onCreated(created.channelId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>新建渠道</DialogTitle>
          <DialogDescription>选择平台、配置凭据与默认路由。</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              渠道 ID
              <Input
                value={channelId}
                onChange={e => setChannelId(e.target.value)}
                placeholder="例如 dingtalk-sales"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              平台
              <select className={selectClass} value={type} onChange={e => onTypeChange(e.target.value)}>
                {types.length === 0 && <option value="">— 无可用平台 —</option>}
                {types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              会话隔离
              <select className={selectClass} value={dmScope} onChange={e => setDmScope(e.target.value)}>
                {DM_SCOPES.map(s => (
                  <option key={s} value={s}>
                    {s === 'PER_PEER' ? '按人隔离' : '共享收件箱'}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2">
              <span className="block text-sm font-medium">默认智能体</span>
              <AgentPicker value={defaultAgentId} onChange={setDefaultAgentId} aria-label="渠道默认智能体" />
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium">凭据</span>
            <PlatformCredentialsForm
              spec={typeSpec}
              values={creds}
              onChange={setCreds}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced(v => !v)}
            />
          </div>

          {err && <p role="alert" className="mt-3 text-sm text-danger-text">{err}</p>}

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
            <Button onClick={handleSave} disabled={busy || !channelId.trim() || !type}>
              {busy ? '创建中…' : '创建'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
