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

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Check, CheckCheck, ShieldCheck } from "lucide-react";
import { decideApproval, listApprovals, type Approval } from "@/api/collaboration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { EntityIdentityText, useEntityIdentities } from "@/components/EntityIdentity";
import { Page, PageHeader } from "@/components/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AsyncState } from "@/components/ui/async-state";
import { asyncStatusOf } from "@/features/work/WorkOverviewPage";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import ApprovalDetail from "./ApprovalDetail";
import { managedToolApprovalExpiry, managedToolApprovalRequest } from "./managedToolApproval";

/** 批量批准的分组键：相同来源智能体 + 相同工具的请求（PRD 5.4.3）。 */
function batchKeyOf(approval: Approval): string {
  const request = managedToolApprovalRequest(approval.request);
  return `${approval.targetType}/${approval.targetRef}::${request?.toolName ?? ""}`;
}

function toolNameOf(approval: Approval): string {
  return managedToolApprovalRequest(approval.request)?.toolName ?? "—";
}

function expiryOf(approval: Approval): number | null {
  return managedToolApprovalExpiry(managedToolApprovalRequest(approval.request)) ?? null;
}

export default function ApprovalsCenterPage() {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("item") || "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [batchError, setBatchError] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const approvals = useQuery({
    queryKey: ["approvals", scope.tenant, scope.namespace, "pending"],
    queryFn: () => listApprovals(scope.tenant, scope.namespace, "pending"),
    refetchInterval: 5000,
  });
  const items = useMemo(() => approvals.data?.items ?? [], [approvals.data?.items]);
  const expiredIds = useMemo(() => new Set(items.filter(item => { const at = expiryOf(item); return at != null && at <= now; }).map(item => item.id)), [items, now]);
  const identities = useEntityIdentities(items.map(item => ({ type: item.targetType, ref: item.targetRef })));
  const current = items.find(item => item.id === selectedId);
  // 批量批准仅作用于与已选请求同组（同智能体 + 同工具）且未过期的请求。
  const batchTarget = current ? batchKeyOf(current) : "";
  const batchItems = items.filter(item => batchKeyOf(item) === batchTarget && !expiredIds.has(item.id));
  const batchSelection = batchItems.filter(item => selected.has(item.id));
  const refresh = () => {
    for (const key of ["approvals", "approval", "inbox", "inbox-summary", "inbox-item"]) void qc.invalidateQueries({ queryKey: [key] });
  };
  const batchApprove = useMutation({
    mutationFn: async () => {
      for (const item of batchSelection) {
        await decideApproval(item.id, "approved", item.version, { note: "" });
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      setBatchError("");
      refresh();
    },
    onError: () => {
      setBatchError("部分请求未能批准，可能已被处理或过期，列表已刷新。");
      refresh();
    },
  });
  function toggle(id: string) {
    setSelected(currentSet => {
      const next = new Set(currentSet);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectItem(id: string | undefined) {
    setParams(current => {
      const next = new URLSearchParams(current);
      if (id) next.set("item", id); else next.delete("item");
      return next;
    });
  }

  return (
    <Page>
      <PageHeader
        title="审批中心"
        description="需要你做出决定才能继续的操作：工具调用确认与运行时确认。"
        actions={batchSelection.length > 1 ? (
          <Button disabled={batchApprove.isPending} onClick={() => batchApprove.mutate()}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            批量批准（{batchSelection.length} 条）
          </Button>
        ) : undefined}
      />
      {batchError && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-text">{batchError}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text">待审批请求</h2>
              <p className="mt-1 text-sm text-text-3">{items.length ? `${items.length} 条等待决定` : "全部处理完毕"}</p>
            </div>
            {batchSelection.length > 1 && <Badge tone="info">{batchSelection.length} 条已选 · 同智能体同类请求可批量批准</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            <AsyncState
              status={asyncStatusOf({ isLoading: approvals.isLoading, isError: approvals.isError, isEmpty: items.length === 0 })}
              resource="审批请求"
              emptyDescription="没有等待你决定的请求。新的工具调用确认会出现在这里。"
              onRetry={() => approvals.refetch()}
            >
              <ul className="divide-y divide-border">
                {items.map(item => {
                  const expired = expiredIds.has(item.id);
                  return (
                    <li key={item.id} className={cn("flex items-start gap-3 px-5 py-4 transition-colors", expired ? "opacity-50" : "hover:bg-hover", selectedId === item.id && "bg-primary-soft")}>
                      <Checkbox
                        aria-label={`选择审批 ${item.id}`}
                        disabled={expired}
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="mt-1.5"
                      />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectItem(item.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-warning-soft p-1.5 text-warning-text"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
                          <span className="text-sm font-medium text-text">{toolNameOf(item)}</span>
                          {expired && <Badge tone="danger">已过期</Badge>}
                          {item.status !== "pending" && <Badge>{item.status}</Badge>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-3">
                          <span>来源：<EntityIdentityText identities={identities} type={item.targetType} entityRef={item.targetRef} /></span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelative(item.createdAt)}</span>
                          {(() => { const at = expiryOf(item); if (at == null) return null; const left = at - now; return left > 0 ? <span className="text-warning-text">剩余 {left > 3600_000 ? `约 ${Math.round(left / 3600_000)} 小时` : left > 60_000 ? `约 ${Math.round(left / 60_000)} 分钟` : `${Math.ceil(left / 1000)} 秒`}</span> : null; })()}
                        </div>
                        {item.reason && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-text-3">{item.reason}</p>}
                      </button>
                      {!expired && (
                        <Button size="sm" variant="outline" disabled={batchApprove.isPending} onClick={() => { void decideApproval(item.id, "approved", item.version, { note: "" }).then(refresh).catch(() => { setBatchError("该请求未能批准，可能已被处理或过期。"); refresh(); }); }}>
                          <Check className="h-4 w-4" aria-hidden="true" />批准
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </AsyncState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-[15px] font-semibold text-text">请求详情</h2></CardHeader>
          <CardContent className="p-0">
            {current ? (
              <ApprovalDetail
                key={current.id}
                approvalId={current.id}
                note=""
                onNoteChange={() => undefined}
                onReady={() => undefined}
                embedded={false}
              />
            ) : (
              <p className="px-5 py-10 text-center text-sm text-text-3">选择左侧一条请求查看完整参数与上下文。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
