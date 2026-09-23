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

import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, ArrowLeft, CircleAlert, Filter, Inbox, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { archiveInboxMessage, getInbox, getInboxSummary, listInbox, readInbox, type InboxItem } from "@/api/collaboration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { entityDisplayName, useEntityIdentities } from "@/components/EntityIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ApprovalDetail from "@/features/approvals/ApprovalDetail";
import { IssueDetailContent } from "@/features/issues/IssueDetailPage";
import { WorkEmpty, WorkLoadingRows } from "@/features/work/WorkSurface";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import IssueReviewPanel from "./IssueReviewPanel";
import {
  ARCHIVE_BLOCKED_MESSAGE,
  INBOX_GROUPS,
  INBOX_GROUP_IDS,
  INBOX_TYPES,
  canArchiveInboxMessage,
  inboxGroupOf,
  inboxTypeLabel,
  retainInboxSelection,
  type InboxGroupId,
} from "./inboxModel";

export default function InboxPage() {
  const scope = useControlPlaneScope();
  return <InboxWorkspace key={`${scope.tenant}/${scope.namespace}`} />;
}

function InboxWorkspace() {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("item") || "";
  const view = ["attention", "unread", "all", "action"].includes(params.get("view") || "") ? params.get("view")! : "attention";
  const groupParam = params.get("group") || "";
  const group: InboxGroupId | "" = INBOX_GROUP_IDS.includes(groupParam as InboxGroupId) ? (groupParam as InboxGroupId) : "";
  const type = params.get("type") || "";
  const archived = params.get("archived") === "true";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectionIndex, setSelectionIndex] = useState(0);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [archiveBlocked, setArchiveBlocked] = useState("");
  const [preview, setPreview] = useState<{ itemId: string; issueId: string }>();
  const previewIssueId = preview?.itemId === selectedId ? preview.issueId : "";
  const setPreviewIssueId = (issueId: string) => setPreview({ itemId: selectedId, issueId });
  const attemptedRead = useRef(new Set<string>());
  const [readErrors, setReadErrors] = useState(new Set<string>());
  const list = useInfiniteQuery({
    queryKey: ["inbox", scope.tenant, scope.namespace, view, type, archived],
    queryFn: ({ pageParam }) => listInbox(scope.tenant, scope.namespace, { view, type, archived: String(archived), cursor: pageParam || undefined, limit: 50 }),
    initialPageParam: "", getNextPageParam: last => last.nextCursor || undefined, refetchInterval: 5000,
  });
  const summary = useQuery({ queryKey: ["inbox-summary", scope.tenant, scope.namespace], queryFn: () => getInboxSummary(scope.tenant, scope.namespace), refetchInterval: 5000 });
  const selected = useQuery({ queryKey: ["inbox-item", scope.tenant, scope.namespace, selectedId], queryFn: () => getInbox(selectedId, scope.tenant, scope.namespace), enabled: !!selectedId, refetchInterval: 5000 });
  const item = selected.data?.item;
  // 分组筛选在客户端执行（PRD 5.4.3：按分组筛选，条件写入地址栏可分享）。
  const allItems = list.data?.pages.flatMap(page => page.items) || [];
  const items = retainInboxSelection(
    group ? allItems.filter(entry => inboxGroupOf(entry) === group) : allItems,
    selected.isError ? undefined : item,
    selectionIndex,
  );
  const identities = useEntityIdentities(items.map(entry => ({ type: entry.actor.type, ref: entry.actor.ref })));
  const counts = summary.data?.summary;
  const refreshInbox = useCallback(() => {
    for (const key of ["inbox", "inbox-summary", "inbox-item"]) void qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);
  const mark = useMutation({
    mutationFn: (id: string) => readInbox(id, scope.tenant, scope.namespace),
    onSuccess: (data, id) => {
      qc.setQueryData(["inbox-item", scope.tenant, scope.namespace, id], data);
      setReadErrors(current => { const next = new Set(current); next.delete(id); return next; });
      refreshInbox();
    },
    onError: (_error, id) => setReadErrors(current => new Set(current).add(id)),
  });
  const markViewed = useCallback(() => {
    if (!item || item.read || attemptedRead.current.has(item.id)) return;
    attemptedRead.current.add(item.id); mark.mutate(item.id);
  }, [item, mark.mutate]);
  const archive = useMutation({
    mutationFn: (id: string) => archiveInboxMessage(id, scope.tenant, scope.namespace),
    onSuccess: (data, id) => {
      setArchiveBlocked("");
      qc.setQueryData(["inbox-item", scope.tenant, scope.namespace, id], data);
      refreshInbox();
    },
  });
  function requestArchive(target: InboxItem) {
    // 需要处理的消息不可归档（PRD 5.4.4），就地提示而不是静默隐藏入口。
    if (!canArchiveInboxMessage(target)) {
      setArchiveBlocked(ARCHIVE_BLOCKED_MESSAGE);
      return;
    }
    setArchiveBlocked("");
    archive.mutate(target.id);
  }
  function changeParams(values: Record<string, string | undefined>) {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
      return next;
    });
  }
  const activeIssueId = previewIssueId || item?.issueId;
  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas" data-testid="inbox-page">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
        <div><h1 className="text-xl font-semibold text-text">待办中心</h1><p className="mt-1 text-sm text-text-3">通知、协作消息与需要你处理的工作。</p></div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-3" aria-live="polite">
          {counts ? <>
            <span><strong className="text-text">{counts.unread}</strong> 条未读</span>
            <span><strong className="text-warning-text">{counts.actionRequired}</strong> 条需要处理</span>
            {counts.pendingApprovals > 0 && <Link to={scope.scopedPath("/work/approvals")}><Badge tone="warning">{counts.pendingApprovals} 条待审批</Badge></Link>}
          </> : <span>{summary.isError ? "计数不可用" : "计数加载中…"}</span>}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 md:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
        <section aria-label="待办消息列表" className={cn("flex min-h-0 flex-col border-r border-border bg-surface", selectedId && "hidden md:flex")}>
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-lg bg-surface-3 p-0.5" aria-label="待办视图">
                {(["attention", "unread", "all"] as const).map(value => <button key={value} type="button" aria-pressed={view === value && !archived} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", view === value && !archived ? "bg-surface text-text shadow-sm" : "text-text-3")} onClick={() => changeParams({ view: value, archived: undefined, item: undefined })}>{value === "attention" ? "需要处理" : value === "unread" ? "未读" : "全部"}</button>)}
              </div>
              <Button variant={filtersOpen || type || archived || view === "action" ? "secondary" : "ghost"} size="sm" aria-label="筛选待办" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter className="h-3.5 w-3.5" />筛选</Button>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="消息分组">
              <button type="button" aria-pressed={!group} className={cn("rounded-full border px-2.5 py-1 text-xs", !group ? "border-primary bg-primary-soft font-medium text-primary-text" : "border-border text-text-3 hover:text-text")} onClick={() => changeParams({ group: undefined, item: undefined })}>全部分组</button>
              {INBOX_GROUP_IDS.map(id => <button key={id} type="button" aria-pressed={group === id} title={INBOX_GROUPS[id].description} className={cn("rounded-full border px-2.5 py-1 text-xs", group === id ? "border-primary bg-primary-soft font-medium text-primary-text" : "border-border text-text-3 hover:text-text")} onClick={() => changeParams({ group: id, item: undefined })}>{INBOX_GROUPS[id].label}</button>)}
            </div>
            {filtersOpen && <div className="grid gap-3 rounded-lg bg-surface-2 p-3">
              <label className="grid gap-1 text-xs font-medium text-text-2">消息类型<select aria-label="消息类型" className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text" value={type} onChange={event => changeParams({ type: event.target.value || undefined, item: undefined })}><option value="">全部类型</option>{Object.entries(INBOX_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-medium text-text-2">状态<select aria-label="消息状态" className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text" value={archived ? "archived" : view} onChange={event => changeParams({ view: event.target.value === "archived" ? "all" : event.target.value, archived: event.target.value === "archived" ? "true" : undefined, item: undefined })}><option value="attention">需要处理</option><option value="action">需要动作</option><option value="unread">未读</option><option value="all">全部消息</option><option value="archived">已归档</option></select></label>
            </div>}
            {(group || type || archived) && <p className="text-xs text-text-3">{group ? INBOX_GROUPS[group].label : "全部分组"}{type ? ` · ${INBOX_TYPES[type] || type}` : ""}{archived && " · 已归档"}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="inbox-list">
            {list.isPending ? <WorkLoadingRows /> : list.isError ? <WorkEmpty title="消息不可用" description="待办列表加载失败，请稍后重试。" action={<Button variant="outline" onClick={() => void list.refetch()}>重试</Button>} /> : items.length ? items.map((entry, index) => <InboxRow key={entry.id} item={entry} selected={selectedId === entry.id} actor={entityDisplayName(identities, entry.actor.type, entry.actor.ref)} onSelect={() => { setSelectionIndex(index); changeParams({ item: entry.id }); }} />) : <WorkEmpty title="待办已清空" description="新的提及、阻塞和审批会出现在这里。" />}
            {list.hasNextPage && <div className="p-4"><Button variant="outline" className="w-full" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{list.isFetchingNextPage ? "加载中…" : "加载更多"}</Button></div>}
          </div>
        </section>
        <section aria-label="消息详情" className={cn("flex min-h-0 min-w-0 flex-col bg-surface", !selectedId && "hidden md:flex")}>
          {!selectedId ? <div className="flex flex-1 items-center justify-center"><WorkEmpty title="选择一条消息" description="阅读一条动态、评审一个事项，或处理一条审批。" /></div> : <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
              <div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="sm" onClick={() => changeParams({ item: undefined })}><ArrowLeft className="h-4 w-4" /><span className="md:hidden">待办</span></Button><span className="truncate text-xs text-text-3">{item ? inboxTypeLabel(item) : "消息"}{item?.archived && " · 已归档"}</span></div>
              <div className="flex items-center gap-1">{item?.issueId && !item.approvalId && <Button asChild variant="ghost" size="sm"><Link to={scope.scopedPath(`/work/issues/${activeIssueId}`)}>打开事项 ↗</Link></Button>}{item && !item.archived && <Button variant="ghost" size="sm" disabled={archive.isPending} onClick={() => requestArchive(item)} title={item.needsAction ? ARCHIVE_BLOCKED_MESSAGE : "移入已归档"}><Archive className="h-3.5 w-3.5" />归档</Button>}</div>
            </div>
            {item && readErrors.has(item.id) && <div role="alert" className="flex items-center justify-between bg-warning-soft px-4 py-2 text-xs text-warning-text">该消息暂时无法标记为已读。<Button size="sm" variant="ghost" disabled={mark.isPending} onClick={() => mark.mutate(item.id)}>重试</Button></div>}
            {archive.isError && <p role="alert" className="bg-danger-soft px-4 py-2 text-xs text-danger-text">该消息无法归档。需要处理的消息必须先完成动作。</p>}
            {archiveBlocked && item && !canArchiveInboxMessage(item) && <p role="status" className="bg-warning-soft px-4 py-2 text-xs text-warning-text" data-testid="archive-blocked">{archiveBlocked}</p>}
            {item?.type === "review_request" && item.issueId && !item.approvalId && activeIssueId === item.issueId && !selected.isError && <IssueReviewPanel key={item.id} item={item} note={reviewNotes[item.id] || ""} onNoteChange={note => setReviewNotes(current => ({ ...current, [item.id]: note }))} />}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="inbox-detail">
              {selected.isPending ? <WorkLoadingRows /> : selected.isError || !item ? <WorkEmpty title="消息不可见" description="该消息不可见或不属于当前命名空间。" action={<Button variant="outline" onClick={() => void selected.refetch()}>重试</Button>} /> : item.approvalId ? <ApprovalDetail key={item.id} approvalId={item.approvalId} note={approvalNotes[item.approvalId] || ""} onNoteChange={note => setApprovalNotes(current => ({ ...current, [item.approvalId!]: note }))} onReady={markViewed} /> : activeIssueId ? <>
                <div className="border-b border-border bg-surface-2 px-5 py-3"><p className="text-xs font-medium text-text-2">{item.title} · {formatRelative(item.createdAt)}</p>{item.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-text-3">{item.body}</p>}{previewIssueId && previewIssueId !== item.issueId && <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => setPreviewIssueId("")}>返回通知事项</Button>}</div>
                <IssueDetailContent key={`${item.id}/${activeIssueId}`} issueId={activeIssueId} embedded focusCommentId={activeIssueId === item.issueId ? item.commentId : undefined} onReady={markViewed} onBack={() => previewIssueId ? setPreviewIssueId("") : changeParams({ item: undefined })} onNavigateIssue={setPreviewIssueId} />
              </> : <MessageDetail key={item.id} item={item} onReady={markViewed} />}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}

function InboxRow({ item, selected, actor, onSelect }: { item: InboxItem; selected: boolean; actor: string; onSelect: () => void }) {
  const approval = !!item.approvalId;
  const alert = item.severity === "error" || item.type === "issue_blocked";
  return <button type="button" data-inbox-id={item.id} aria-current={selected ? "true" : undefined} className={cn("flex w-full gap-3 border-b border-border px-4 py-4 text-left transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected ? "bg-primary-soft ring-1 ring-inset ring-primary-soft" : !item.read && "bg-primary-soft/40")} onClick={onSelect}>
    <span className={cn("mt-0.5 shrink-0 rounded-lg p-2", approval ? "bg-warning-soft text-warning-text" : alert ? "bg-danger-soft text-danger-text" : "bg-surface-3 text-text-3")}>{approval ? <ShieldCheck className="h-4 w-4" /> : alert ? <CircleAlert className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}</span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2"><span className={cn("truncate text-sm text-text", !item.read ? "font-semibold" : "font-medium")}>{item.title}</span>{!item.read && <span aria-label="未读" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}</span>
      <span className="mt-1.5 flex"><Badge tone={approval ? "warning" : alert ? "danger" : "info"}>{inboxTypeLabel(item)}</Badge></span>
      <span className="mt-2 line-clamp-2 break-words text-xs leading-5 text-text-3">{item.body || "打开查看详情"}</span>
      {item.type === "review_request" && item.needsAction && <span className="mt-2 block text-xs font-medium text-primary-text">评审结果 →</span>}
      <span className="mt-2 block truncate text-[11px] text-text-4">{actor} · {formatRelative(item.createdAt)}</span>
    </span>
  </button>;
}

function MessageDetail({ item, onReady }: { item: InboxItem; onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return <article className="mx-auto max-w-3xl p-6 sm:p-8"><h2 className="text-xl font-semibold text-text">{item.title}</h2><p className="mt-2 text-xs text-text-3">{new Date(item.createdAt).toLocaleString()}</p><div className="md-text mt-6 break-words text-sm leading-7 text-text-2"><ReactMarkdown>{item.body || "暂无更多详情。"}</ReactMarkdown></div></article>;
}
