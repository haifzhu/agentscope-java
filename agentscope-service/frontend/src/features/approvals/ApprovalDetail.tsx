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

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import { decideApproval, getApproval } from "@/api/collaboration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { EntityIdentityText, useEntityIdentities } from "@/components/EntityIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { WorkEmpty, WorkLoadingRows, WorkStatusBadge } from "@/features/work/WorkSurface";
import { managedToolApprovalExpiry, managedToolApprovalRequest } from "./managedToolApproval";

/** 驳回理由必填（PRD 5.4.4）。 */
export const REJECTION_REASON_REQUIRED = "请填写驳回理由后再提交";

export default function ApprovalDetail({ approvalId, note, onNoteChange, onReady, embedded = true }: { approvalId: string; note: string; onNoteChange: (note: string) => void; onReady?: () => void; embedded?: boolean }) {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [rejecting, setRejecting] = useState(false);
  const approval = useQuery({ queryKey: ["approval", scope.tenant, scope.namespace, approvalId], queryFn: () => getApproval(approvalId), refetchInterval: 5000 });
  const item = approval.data?.approval;
  const request = managedToolApprovalRequest(item?.request);
  const expiresAt = managedToolApprovalExpiry(request);
  const expired = expiresAt != null && expiresAt <= now;
  const remaining = expiresAt != null ? Math.max(0, expiresAt - now) : null;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (approval.isSuccess) onReady?.(); }, [approval.isSuccess, onReady]);
  const identities = useEntityIdentities(item ? [
    { type: item.targetType, ref: item.targetRef },
    { type: item.requestedBy.type, ref: item.requestedBy.ref },
    { type: "human", ref: item.approverRef },
  ] : []);
  const decide = useMutation({
    mutationFn: (status: "approved" | "rejected") => decideApproval(approvalId, status, item!.version, { note }),
    onSuccess: (data) => {
      qc.setQueryData(["approval", scope.tenant, scope.namespace, approvalId], data);
      onNoteChange("");
      setRejecting(false);
      for (const key of ["approval", "approvals", "inbox", "inbox-item", "inbox-summary", "issue", "issues", "tasks", "issue-runs"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: () => void approval.refetch(),
  });
  if (approval.isPending) return <WorkLoadingRows />;
  if (approval.isError || !item) return <WorkEmpty title="审批不可用" description="该请求加载失败，消息尚未被标记为已读。" action={<Button variant="outline" onClick={() => void approval.refetch()}>重试</Button>} />;
  const remainingLabel = remaining == null ? "" : remaining > 3600_000 ? `约 ${Math.round(remaining / 3600_000)} 小时` : remaining > 60_000 ? `约 ${Math.round(remaining / 60_000)} 分钟` : `${Math.ceil(remaining / 1000)} 秒`;
  const disabled = decide.isPending || expired || item.status !== "pending";

  return (
    <div className={embedded ? "mx-auto max-w-3xl space-y-6 p-6 sm:p-8" : "space-y-6"}>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-warning-soft p-3 text-warning-text"><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-warning-text">审批</span><WorkStatusBadge status={item.status} />{expired && item.status === "pending" && <Badge tone="danger">已过期</Badge>}</div>
          <h2 className="mt-2 break-words text-xl font-semibold text-text">{request ? `确认工具调用：${request.toolName}` : <EntityIdentityText identities={identities} type={item.targetType} entityRef={item.targetRef} />}</h2>
          <p className="mt-1 text-xs text-text-3">请求时间 {new Date(item.createdAt).toLocaleString()}</p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7 text-text-2">{item.reason || "该操作需要你确认后才能继续执行。"}</p>
      <dl className="grid grid-cols-[7rem_1fr] gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <dt className="text-text-3">发起方</dt><dd className="text-text"><EntityIdentityText identities={identities} type={item.requestedBy.type} entityRef={item.requestedBy.ref} /></dd>
        <dt className="text-text-3">审批人</dt><dd className="text-text"><EntityIdentityText identities={identities} type="human" entityRef={item.approverRef} /></dd>
        <dt className="text-text-3">对象</dt><dd className="break-all text-text"><EntityIdentityText identities={identities} type={item.targetType} entityRef={item.targetRef} /></dd>
        {expiresAt != null && <><dt className="text-text-3">{expired ? "过期时间" : "剩余有效"}</dt><dd className={expired ? "text-danger-text" : "text-warning-text"}>{expired ? `${new Date(expiresAt).toLocaleString()} · 已过期` : remainingLabel}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-4 text-sm font-medium text-primary-text">
        {item.issueId && <Link to={scope.scopedPath(`/work/issues/${item.issueId}`)}>关联事项 ↗</Link>}
        {item.runId && <Link to={scope.scopedPath(`/work/executions/${item.runId}`)}>执行记录 ↗</Link>}
        {request && <Link to={scope.scopedPath(`/work/executions/tasks/${request.agentTaskId}`)}>智能体任务 ↗</Link>}
        {request?.sessionRef && <Link to={scope.scopedPath(`/work/sessions/${request.sessionRef}`)}>会话 ↗</Link>}
      </div>
      {request?.inputPreview != null && <div><h3 className="mb-2 text-sm font-semibold text-text">工具参数（已脱敏）</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-2 p-4 text-xs leading-6 text-text-2">{JSON.stringify(request.inputPreview, null, 2)}</pre></div>}
      {item.request != null && <details className="rounded-xl border border-border bg-surface-2 p-4"><summary className="cursor-pointer text-sm font-medium text-text">请求详情</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-text-2">{JSON.stringify(item.request, null, 2)}</pre></details>}
      {item.status === "pending" ? <div className="space-y-3 border-t border-border pt-5">
        {expired ? <p className="text-sm text-warning-text" data-testid="approval-expired">该请求已过期，无法再批准或驳回。智能体已按超时策略处理，执行状态将自动更新。</p> : <>
          <label className="block text-sm font-medium text-text-2" htmlFor="approval-note">{rejecting ? "驳回理由（必填）" : "备注（可选）"}</label>
          {rejecting && <Textarea id="approval-note" value={note} onChange={event => onNoteChange(event.target.value)} placeholder="说明驳回原因，智能体会收到该理由" autoFocus required maxLength={10000} disabled={decide.isPending} aria-required="true" />}
          {!rejecting && note && <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-text-2">{note}</p>}
          {rejecting && !note.trim() && <p className="text-sm text-danger-text" data-testid="rejection-reason-hint">{REJECTION_REASON_REQUIRED}</p>}
          <div className="flex gap-2">
            {rejecting ? <>
              <Button disabled={disabled || !note.trim()} onClick={() => decide.mutate("rejected")}><X className="h-4 w-4" />确认驳回</Button>
              <Button variant="ghost" disabled={decide.isPending} onClick={() => { setRejecting(false); onNoteChange(""); }}>取消</Button>
            </> : <>
              <Button disabled={disabled} onClick={() => decide.mutate("approved")}><Check className="h-4 w-4" />批准</Button>
              <Button variant="outline" disabled={disabled} onClick={() => setRejecting(true)}><X className="h-4 w-4" />驳回</Button>
            </>}
          </div>
        </>}
      </div> : <div className="rounded-xl bg-surface-2 p-4"><p className="text-sm font-medium text-text">该请求{item.status === "approved" ? "已批准" : item.status === "rejected" ? "已驳回" : item.status}。</p>{item.decision != null && <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-text-3">{JSON.stringify(item.decision, null, 2)}</pre>}</div>}
      {decide.isError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-text">决策未能保存。请求已刷新，请确认其当前状态后重试。</p>}
    </div>
  );
}
