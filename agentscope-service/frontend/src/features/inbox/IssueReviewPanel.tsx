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

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare } from "lucide-react";
import { acceptIssue, getIssue, rejectIssue, type InboxItem } from "@/api/collaboration";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { Textarea } from "@/components/ui/input";

function reviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "你没有权限评审该事项。";
  if (error instanceof ApiError && error.status === 409) return "该事项已变更或不再等待评审，请查看最新结果后重试。";
  if (!(error instanceof Error)) return "评审结果未能保存。";
  try {
    const body = JSON.parse(error.message) as { error?: string };
    return typeof body.error === "string" ? body.error : error.message;
  } catch { return error.message; }
}

// 收件箱的评审动作始终作用于被通知的事项本身，而不是预览中打开的子事项。
export default function IssueReviewPanel({ item, note, onNoteChange }: {
  item: InboxItem;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  const qc = useQueryClient();
  const issueId = item.issueId!;
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState("");
  const issue = useQuery({ queryKey: ["issue", issueId], queryFn: () => getIssue(issueId), refetchInterval: 5000 });
  const current = issue.data?.issue;
  const actionable = !issue.isError && item.needsAction && !item.resolvedAt && !item.archived && current?.status === "in_review" && !current.archivedAt;
  const refresh = () => Promise.all([
    ...["issue", "issue-summary", "issue-activity"].map(key => qc.invalidateQueries({ queryKey: [key, issueId] })),
    ...["issues", "inbox", "inbox-summary", "inbox-item"].map(key => qc.invalidateQueries({ queryKey: [key] })),
  ]);
  const decision = useMutation({
    mutationFn: async (action: "accept" | "reject") => {
      if (!actionable || !current) throw new Error("该事项已不再等待你的评审，请刷新查看当前状态。");
      if (action === "reject" && !note.trim()) throw new Error("请先说明需要修改的内容。");
      // 提交评审人看到的版本，绝不静默接受更新的修订。
      return action === "accept" ? acceptIssue(issueId, current.version) : rejectIssue(issueId, current.version, note.trim());
    },
    onSuccess: async (data, action) => {
      qc.setQueryData(["issue", issueId], data);
      setOutcome(action === "accept" ? "结果已验收，该事项已完成。" : "已要求修改。该事项回到进行中，你的评审意见已记录到活动。");
      setEditing(false);
      onNoteChange("");
      await refresh();
    },
    onError: () => { void refresh(); },
  });
  const busy = decision.isPending;
  return <section aria-label="事项评审" className="max-h-[60%] shrink-0 space-y-3 overflow-y-auto border-b border-border bg-primary-soft/60 px-5 py-4">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-text">评审结果</h2>
        <p className="mt-1 text-xs leading-5 text-text-2">{actionable ? "先查看下方结果与子事项，再验收或说明需要修改的内容。解决一条评论不等于验收。" : issue.isPending ? "正在加载当前评审状态…" : current?.archivedAt ? "该事项已归档，无法评审。" : current?.status === "done" ? "该事项已验收通过。" : current?.status === "in_review" ? "该通知已不可操作，请打开最新的评审请求。" : current ? `该事项当前状态为 ${current.status.replace(/_/g, " ")}，不在等待验收。` : "评审状态不可用。"}</p>
      </div>
      {actionable && <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || editing} onClick={() => decision.mutate("accept")}><Check className="h-4 w-4" />验收结果</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { decision.reset(); setEditing(true); }}><MessageSquare className="h-4 w-4" />要求修改</Button>
      </div>}
    </div>
    {editing && actionable && <form className="space-y-2" onSubmit={event => { event.preventDefault(); decision.mutate("reject"); }}>
      <label className="block text-xs font-medium text-text-2" htmlFor={`review-note-${item.id}`}>需要修改的内容（必填）</label>
      <Textarea id={`review-note-${item.id}`} autoFocus required maxLength={10000} disabled={busy} className="min-h-24 max-h-40 bg-surface" value={note} onChange={event => onNoteChange(event.target.value)} placeholder="说明结果缺少什么、达到什么标准可以通过验收…" />
      <p className="text-xs text-text-3">提交后事项回到进行中并记录该反馈，不会自动发起下一次执行。</p>
      <div className="flex gap-2"><Button size="sm" type="submit" disabled={busy || !note.trim()}>{busy ? "提交中…" : "提交评审"}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>取消</Button></div>
    </form>}
    {outcome && <p role="status" className="text-sm text-success-text">{outcome}</p>}
    {(decision.isError || issue.isError) && <div role="alert" className="text-sm text-danger-text"><p>{decision.isError ? reviewErrorMessage(decision.error) : "事项加载失败，评审操作不可用。"}</p><p className="mt-1 text-xs">请确认当前结果与验收标准后再重试。</p><Button size="sm" variant="ghost" disabled={busy} onClick={() => void refresh()}>刷新评审</Button></div>}
  </section>;
}
