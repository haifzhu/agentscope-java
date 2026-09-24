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
import { Link, useOutletContext } from 'react-router-dom';
import { Plug, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  AgentPresence,
  ChannelTypeSpec,
  PresenceUpsertRequest,
  createAgentPresence,
  deleteAgentPresence,
  listAgentPresences,
  listChannelTypes,
  resolveCallbackUrl,
  updateAgentPresence,
} from '../api/channels';
import PlatformCredentialsForm, {
  credentialsFromProperties,
  propertiesFromCredentials,
} from '../components/PlatformCredentialsForm';
import ChannelBindingTable from '../components/ChannelBindingTable';
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

const selectClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm disabled:opacity-60';

export default function AgentChannelsPage() {
  const { agentId } = useOutletContext<{ agentId: string }>();
  const [presences, setPresences] = useState<AgentPresence[]>([]);
  const [types, setTypes] = useState<ChannelTypeSpec[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState<AgentPresence | null>(null);

  async function load() {
    setErr(null);
    try {
      const [p, t] = await Promise.all([listAgentPresences(agentId), listChannelTypes()]);
      setPresences(p);
      setTypes(t);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [agentId]);

  return (
    <div className="space-y-6">
      {err && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">{err}</div>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-base font-semibold">默认渠道</h2>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 连接渠道
          </Button>
        </div>
        <p className="text-sm text-text-3">
          连接默认路由到该逻辑智能体的聊天平台或 Webhook 提供方。渠道路由不会绑定到单个运行时实例。
        </p>

        {presences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-3">
            <Plug className="mx-auto mb-2 h-6 w-6 text-text-3" />
            暂无渠道默认指向该智能体。可在此连接一个，或在渠道目录中添加路由规则。
          </div>
        ) : (
          presences.map(p => {
            const spec = types.find(t => t.type === p.platform);
            const cb = p.callbackUrl
              ? (typeof window !== 'undefined' ? `${window.location.origin}${p.callbackUrl}` : p.callbackUrl)
              : resolveCallbackUrl(spec, p.channelId);
            return (
              <div key={p.channelId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-4">
                <span className="flex-1 truncate text-sm font-semibold">{p.channelId}</span>
                <Badge>{spec?.label ?? p.platform}</Badge>
                <Badge>{p.isolation === 'shared' ? '共享收件箱' : '按人隔离'}</Badge>
                <Badge tone={p.started ? 'success' : 'default'}>
                  {p.enabled ? (p.started ? '已连接' : '已停止') : '已停用'}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/agent-center/entrypoints/${encodeURIComponent(p.channelId)}`}>
                    <Settings2 className="h-3.5 w-3.5" /> 高级设置
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEdit(p)}>编辑</Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger-text"
                  onClick={async () => {
                    if (!confirm(`确认断开 ${p.channelId}？`)) return;
                    try {
                      await deleteAgentPresence(agentId, p.channelId);
                      await load();
                    } catch (e: unknown) {
                      setErr(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 断开
                </Button>
                {cb && (
                  <div className="w-full break-all font-mono text-xs text-text-3">{cb}</div>
                )}
                {p.lastError && (
                  <div className="w-full break-all text-xs text-danger-text">{p.lastError}</div>
                )}
              </div>
            );
          })
        )}
      </Card>

      {(showCreate || edit) && (
        <PresenceDialog
          agentId={agentId}
          types={types}
          initial={edit}
          onClose={() => { setShowCreate(false); setEdit(null); }}
          onSaved={async () => {
            setShowCreate(false);
            setEdit(null);
            await load();
          }}
        />
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">转发规则（高级）</h2>
        <p className="text-sm text-text-3">查看把指定联系人、群组或事件路由到该逻辑智能体的规则。</p>
        <ChannelBindingTable agentId={agentId} />
      </div>
    </div>
  );
}

function PresenceDialog({
  agentId,
  types,
  initial,
  onClose,
  onSaved,
}: {
  agentId: string;
  types: ChannelTypeSpec[];
  initial: AgentPresence | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial != null;
  const [platform, setPlatform] = useState(initial?.platform ?? types[0]?.type ?? '');
  const [channelId, setChannelId] = useState(initial?.channelId ?? '');
  const [isolation, setIsolation] = useState<'per_person' | 'shared'>(
    initial?.isolation ?? 'per_person',
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const typeSpec = useMemo(() => types.find(t => t.type === platform), [types, platform]);
  const [creds, setCreds] = useState<Record<string, string>>(() =>
    credentialsFromProperties(
      types.find(t => t.type === (initial?.platform ?? types[0]?.type)),
      initial?.credentials,
    ),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onPlatformChange(next: string) {
    if (isEdit) return;
    setPlatform(next);
    setCreds(credentialsFromProperties(types.find(t => t.type === next), undefined));
    if (!channelId || channelId.startsWith((platform || '') + '-')) {
      setChannelId(`${next}-${agentId}`);
    }
  }

  async function save() {
    setErr(null);
    const req: PresenceUpsertRequest = {
      channelId: channelId.trim() || undefined,
      platform,
      isolation,
      enabled,
      credentials: propertiesFromCredentials(typeSpec, creds, isEdit),
    };
    setBusy(true);
    try {
      if (isEdit && initial) {
        await updateAgentPresence(agentId, initial.channelId, req);
      } else {
        await createAgentPresence(agentId, req);
      }
      onSaved();
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
          <DialogTitle>{isEdit ? '编辑渠道' : '连接渠道'}</DialogTitle>
          <DialogDescription>选择平台、隔离方式并配置凭据。</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              平台
              <select
                className={selectClass}
                value={platform}
                disabled={isEdit}
                onChange={e => onPlatformChange(e.target.value)}
              >
                {types.map(t => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              渠道 ID
              <Input
                value={channelId}
                disabled={isEdit}
                onChange={e => setChannelId(e.target.value)}
                placeholder={`${platform || 'dingtalk'}-${agentId}`}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              会话隔离
              <select
                className={selectClass}
                value={isolation}
                onChange={e => setIsolation(e.target.value as 'per_person' | 'shared')}
              >
                <option value="per_person">按人隔离 —— 每个联系人独立记忆</option>
                <option value="shared">共享收件箱 —— 所有人共用一个会话</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              是否启用
              <select
                className={selectClass}
                value={enabled ? 'yes' : 'no'}
                onChange={e => setEnabled(e.target.value === 'yes')}
              >
                <option value="yes">启用</option>
                <option value="no">停用</option>
              </select>
            </label>
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
            <Button onClick={save} disabled={busy}>
              {busy ? '保存中…' : isEdit ? '保存' : '连接'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
