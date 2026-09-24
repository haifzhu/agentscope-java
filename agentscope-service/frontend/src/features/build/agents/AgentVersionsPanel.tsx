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
import { useOutletContext } from 'react-router-dom';
import type { AgentDefinition, AgentVersionEntry } from '@/api/agents';
import { getVersion, listVersions } from '@/api/agents';
import { AsyncState } from '@/components/ui/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { diffKindLabels, diffSnapshots, type VersionDiffEntry } from './versionDiff';
import { useQuery } from '@tanstack/react-query';

/** 版本分页大小：默认只看最近若干条，更早的展开加载。 */
const PAGE_SIZE = 10;

interface DiffSelection {
  baseVersion: number | null;
  targetVersion: number | null;
}

/**
 * 定义「版本」分区（C7）：版本列表 + 版本对比。
 * 对比基线默认为当前版本的前一个快照，字段级差异用 diffSnapshots 计算。
 */
export default function AgentVersionsPanel() {
  const { agentId, agent } = useOutletContext<{
    agentId: string;
    agent: AgentDefinition | null;
    refreshAgent?: () => void | Promise<unknown>;
  }>();
  const currentVersion = agent?.version ?? null;

  const versionsQuery = useQuery({
    queryKey: ['agent-versions', agentId, currentVersion],
    queryFn: () => listVersions(agentId),
    enabled: !!agentId,
    retry: false,
  });

  const versions = versionsQuery.data ?? [];
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<DiffSelection>({ baseVersion: null, targetVersion: null });
  const [snapshots, setSnapshots] = useState<Record<number, AgentVersionEntry>>({});
  const [diffError, setDiffError] = useState<string | null>(null);

  const visibleVersions = useMemo(
    () => (expanded ? versions : versions.slice(0, PAGE_SIZE)),
    [versions, expanded],
  );

  // 默认对比：最新两个版本（或最新版本 vs 当前未保存定义之外的可比对象）。
  useEffect(() => {
    if (versions.length < 2 || selection.baseVersion != null) return;
    setSelection({ baseVersion: versions[1].version, targetVersion: versions[0].version });
  }, [versions, selection.baseVersion]);

  // 对比时按需拉取缺失快照。
  useEffect(() => {
    const wanted = [selection.baseVersion, selection.targetVersion].filter(
      (v): v is number => v != null && !(v in snapshots),
    );
    if (wanted.length === 0) return;
    let cancelled = false;
    setDiffError(null);
    Promise.all(wanted.map((v) => getVersion(agentId, v)))
      .then((entries) => {
        if (cancelled) return;
        setSnapshots((prev) => {
          const next = { ...prev };
          for (const entry of entries) next[entry.version] = entry;
          return next;
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setDiffError(e instanceof Error ? e.message : '快照加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, selection.baseVersion, selection.targetVersion, snapshots]);

  const diffEntries: VersionDiffEntry[] | null = useMemo(() => {
    if (selection.baseVersion == null || selection.targetVersion == null) return null;
    const base = snapshots[selection.baseVersion];
    const target = snapshots[selection.targetVersion];
    if (!base || !target) return null;
    return diffSnapshots(base.snapshot ?? null, target.snapshot ?? null);
  }, [selection, snapshots]);

  if (!agentId) return null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>版本对比</CardTitle>
          <CardDescription>
            选择两个版本，按字段查看定义差异。对比不会改动任何配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-text-2">基线版本</span>
              <Select
                aria-label="基线版本"
                value={selection.baseVersion ?? ''}
                onChange={(e) =>
                  setSelection((prev) => ({
                    ...prev,
                    baseVersion: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              >
                <option value="">未选择</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}
                    {v.version === currentVersion ? '（当前）' : ''}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-text-2">对比版本</span>
              <Select
                aria-label="对比版本"
                value={selection.targetVersion ?? ''}
                onChange={(e) =>
                  setSelection((prev) => ({
                    ...prev,
                    targetVersion: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              >
                <option value="">未选择</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}
                    {v.version === currentVersion ? '（当前）' : ''}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {diffError && (
            <p className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-text">
              快照加载失败：{diffError}
            </p>
          )}

          {selection.baseVersion != null &&
            selection.targetVersion != null &&
            diffEntries === null &&
            !diffError && <p className="text-sm text-text-3">正在载入选中版本的快照…</p>}

          {diffEntries && diffEntries.length === 0 && (
            <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
              v{selection.baseVersion} 与 v{selection.targetVersion} 的定义内容完全一致。
            </p>
          )}

          {diffEntries && diffEntries.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-xs text-text-3">
                    <th scope="col" className="px-4 py-2.5 font-medium">字段</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">差异</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">v{selection.baseVersion}</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">v{selection.targetVersion}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {diffEntries.map((entry) => (
                    <tr key={entry.key} className="align-top">
                      <td className="px-4 py-2.5 font-mono text-xs text-text">{entry.key}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={entry.kind === 'added' ? 'success' : entry.kind === 'removed' ? 'danger' : 'warning'}>
                          {diffKindLabels[entry.kind]}
                        </Badge>
                      </td>
                      <td className="max-w-72 px-4 py-2.5 font-mono text-xs break-all text-text-3">
                        {entry.before ?? '—'}
                      </td>
                      <td className="max-w-72 px-4 py-2.5 font-mono text-xs break-all text-text-3">
                        {entry.after ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>版本历史</CardTitle>
          <CardDescription>每次保存定义都会生成一个版本快照。</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncState
            status={versionsQuery.isPending ? 'loading' : versionsQuery.isError ? 'error' : versions.length === 0 ? 'empty' : 'ready'}
            resource="版本"
            errorDescription={versionsQuery.error instanceof Error ? versionsQuery.error.message : undefined}
            onRetry={() => void versionsQuery.refetch()}
          >
            <ol className="divide-y divide-border">
              {visibleVersions.map((v) => (
                <li key={v.version} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-mono text-sm font-semibold text-text">v{v.version}</span>
                  {v.version === currentVersion && <Badge tone="success">当前</Badge>}
                  <span className="ml-auto text-xs text-text-3">
                    {v.createdAt ? new Date(v.createdAt).toLocaleString() : '时间未知'}
                  </span>
                </li>
              ))}
            </ol>
            {versions.length > PAGE_SIZE && (
              <div className="pt-3">
                <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? '收起更早版本' : `展开全部 ${versions.length} 个版本`}
                </Button>
              </div>
            )}
          </AsyncState>
        </CardContent>
      </Card>
    </div>
  );
}
