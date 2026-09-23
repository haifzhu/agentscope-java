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

import { IssueSharing } from "./IssueSharing";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Archive,
  ArrowLeft,
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  File,
  GitPullRequest,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  PanelRight,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  addComment,
  archiveIssue,
  assignIssue,
  createChildIssue,
  exportIssue,
  downloadIssueArtifact,
  listTeams,
  getIssue,
  getIssueSummary,
  listChildIssues,
  listComments,
  listIssueActivity,
  listIssueArtifacts,
  listIssueSubscribers,
  listIssueTasks,
  resolveComment,
  subscribeIssue,
  unsubscribeIssue,
  updateIssue,
  uploadIssueArtifact,
  type Actor,
  type Comment,
  type IssueActivity,
} from "@/api/collaboration";
import { listRunEvents, listRuns, type RunEvent } from "@/api/orchestration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { AgentPicker } from "@/components/AgentPicker";
import {
  EntityIdentityText,
  entityDisplayName,
  type EntityIdentityMap,
  useEntityIdentities,
} from "@/components/EntityIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Tree, type TreeNode } from "@/components/ui/tree";
import { getUsername } from "@/lib/auth";
import { NamedResourcePicker } from "@/components/NamedResourcePicker";
import { IssueAcceptanceEditor } from "./IssueAcceptanceEditor";
import { allowedIssueTransitions, issueStatusLabel, submitIssueTransition } from "./issueTransition";
import { dateTimeLocal, dueDatePatch, saveIssueDownload, sourceWebUrl } from "./issueProperties";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(actor: Actor, identities: EntityIdentityMap) {
  if (actor.type === "system" || actor.type === "automation") return actor.type === "system" ? "S" : "A";
  const value = entityDisplayName(identities, actor.type, actor.ref);
  return value.slice(0, 1).toUpperCase();
}

function ActorAvatar({ actor, identities, size = "md" }: { actor: Actor; identities: EntityIdentityMap; size?: "sm" | "md" }) {
  const Icon = actor.type === "agent" ? Bot : actor.type === "human" ? UserRound : Sparkles;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-semibold text-text-2",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
      )}
      title={`${entityDisplayName(identities, actor.type, actor.ref)} · ${actor.type}: ${actor.ref || "system"}`}
    >
      {actor.ref ? initials(actor, identities) : (<Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />)}
    </span>
  );
}

function actorName(actor: Actor, identities: EntityIdentityMap) {
  return entityDisplayName(identities, actor.type, actor.ref);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function mutationMessage(error: unknown) {
  if (!(error instanceof Error)) return "操作失败，请重试。";
  if (error.message.includes("store: conflict")) return "该事项已被他人更新，请刷新后重试。";
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    return parsed.error || error.message;
  } catch {
    return error.message;
  }
}

function activityDescription(activity: IssueActivity, identities: EntityIdentityMap) {
  const name = actorName(activity.actor, identities);
  const details = activity.details || {};
  switch (activity.action) {
    case "issue.created":
      return <><strong>{name}</strong> 创建了该事项</>;
    case "issue.updated":
      return <><strong>{name}</strong> 更新了事项详情</>;
    case "issue.assigned":
      if (!activity.objectRef) return <><strong>{name}</strong> 移除了负责人</>;
      return <><strong>{name}</strong> 将事项指派给 <strong>{entityDisplayName(identities, activity.objectType, activity.objectRef)}</strong></>;
    case "issue.status_changed":
      if (details.from === "in_review" && details.to === "in_progress") return <><strong>{name}</strong> 要求修改{typeof details.reason === "string" && details.reason && <span className="mt-1 block whitespace-pre-wrap text-text-2">{details.reason}</span>}</>;
      if (details.from === "in_review" && details.to === "done") return <><strong>{name}</strong> 验收通过了结果</>;
      return <><strong>{name}</strong> 将状态从 <strong>{issueStatusLabel(String(details.from))}</strong> 变更为 <strong>{issueStatusLabel(String(details.to))}</strong></>;
    case "agent_task.completed":
      return <><strong>{name}</strong> 完成了一项智能体任务</>;
    case "issue.archived":
      return <><strong>{name}</strong> 归档了该事项</>;
    default:
      return <><strong>{name}</strong> {activity.action.replace(/[._]/g, " ")}</>;
  }
}

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Circle;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-text-3">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CommentBody({ entry, identities }: { entry: Comment; identities: EntityIdentityMap }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-text">{actorName(entry.author, identities)}</span>
        {entry.type !== "comment" && <Badge tone={entry.type === "result" ? "success" : "info"}>{entry.type === "result" ? "结果" : entry.type}</Badge>}
        <span className="text-xs text-text-3">{formatRelative(entry.createdAt)}</span>
        {entry.resolvedAt && <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text"><CheckCircle2 className="h-3.5 w-3.5" />已解决</span>}
      </div>
      {entry.externalSync?.lastError && <p className="mt-2 text-xs text-danger-text">外部同步：{entry.externalSync.lastError}</p>}
      <div className={cn("md-text mt-2 text-[15px] text-text-2", entry.deletedAt && "italic text-text-3")}>
        {entry.deletedAt ? "该评论已被删除。" : <ReactMarkdown>{entry.content}</ReactMarkdown>}
      </div>
      {!!entry.routes?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.routes.map((route) => (
            <Badge key={`${route.targetType}-${route.targetRef}-${route.outcome}`} tone={route.outcome === "blocked" ? "danger" : "info"}>
              @<EntityIdentityText identities={identities} type={route.targetType} entityRef={route.targetRef} /> · {route.outcome === "blocked" ? "被阻塞" : route.outcome === "delivered" ? "已送达" : route.outcome}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function toolFailures(events: RunEvent[] | undefined) {
  return (events || []).filter((event) => event.type === "agent_tool.failed");
}

function dispatchDeferrals(events: RunEvent[] | undefined) {
  return (events || []).filter((event) => event.type === "agent-task.dispatch_deferred");
}

function toolFailureMessage(event: RunEvent | undefined): string {
  if (!event?.payload || typeof event.payload !== "object") return "工具调用失败";
  const payload = event.payload as Record<string, unknown>;
  const tool = String(payload.toolName || "工具");
  const message = String(payload.message || "工具调用失败");
  return `${tool}: ${message}`;
}

function dispatchDeferredMessage(event: RunEvent | undefined): string {
  if (!event?.payload || typeof event.payload !== "object") return "智能体任务派发被推迟";
  const payload = event.payload as Record<string, unknown>;
  return String(payload.message || "智能体任务派发被推迟");
}

function ExecutionLink({ execution, index, total, identities, scopePath }: {
  execution: { run: { id: string; mode: string; state: string; createdAt: string }; tasks: Array<{ id: string; agentId: string; status: string }>; toolFailures: RunEvent[]; dispatchDeferrals: RunEvent[] };
  index: number;
  total: number;
  identities: EntityIdentityMap;
  scopePath: (path: string) => string;
}) {
  const { run, tasks: runTasks, toolFailures: failures, dispatchDeferrals: deferrals } = execution;
  const stateTone = run.state === "succeeded" ? "success" : run.state === "partial_succeeded" ? "warning" : run.state === "failed" || run.state === "cancelled" ? "danger" : "info";
  return (
    <Link
      to={scopePath(`/work/executions/${run.id}`)}
      className={cn(
        "block rounded-lg bg-surface p-3 text-xs hover:ring-1",
        failures.length ? "ring-1 ring-danger hover:ring-danger" : deferrals.length ? "ring-1 ring-warning hover:ring-warning" : "hover:ring-border-strong",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-medium text-text">执行 #{total - index}</span>
          <span className="text-text-3">{run.mode} · {runTasks.length} 个步骤 · {formatRelative(run.createdAt)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {failures.length > 0 && <Badge tone="danger">{failures.length} 次工具失败</Badge>}
          {deferrals.length > 0 && <Badge tone="warning">派发推迟</Badge>}
          <Badge tone={stateTone}>{run.state.replace(/_/g, " ")}</Badge>
        </span>
      </span>
      {failures.length > 0 && <span className="mt-2 block truncate text-danger-text" title={toolFailureMessage(failures[0])}>首次失败：{toolFailureMessage(failures[0])}</span>}
      {deferrals.length > 0 && <span className="mt-2 block truncate text-warning-text" title={dispatchDeferredMessage(deferrals[0])}>派发推迟：{dispatchDeferredMessage(deferrals[0])}</span>}
      {!!runTasks.length && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {runTasks.slice(0, 3).map((task) => (
            <span key={task.id} className="rounded-full bg-surface-3 px-2 py-1 text-[11px] text-text-2">
              <EntityIdentityText identities={identities} type="agent" entityRef={task.agentId} /> · {task.status}
            </span>
          ))}
          {runTasks.length > 3 && <span className="px-1 py-1 text-[11px] text-text-3">+{runTasks.length - 3} 更多</span>}
        </span>
      )}
    </Link>
  );
}

export default function IssueDetailPage() {
  const { issueId = "" } = useParams();
  return <IssueDetailContent key={issueId} issueId={issueId} />;
}

export function IssueDetailContent({ issueId, embedded = false, focusCommentId, onReady, onBack, onNavigateIssue }: {
  issueId: string;
  embedded?: boolean;
  focusCommentId?: string;
  onReady?: () => void;
  onBack?: () => void;
  onNavigateIssue?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const focused = useRef<string>();
  const scope = useControlPlaneScope();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const username = getUsername();
  const [content, setContent] = useState("");
  const [commentType, setCommentType] = useState("comment");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionType, setMentionType] = useState("agent");
  const [mentionRef, setMentionRef] = useState("");
  const [replyingTo, setReplyingTo] = useState<string>();
  const [replyContent, setReplyContent] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeType, setAssigneeType] = useState("agent");
  const [assigneeRef, setAssigneeRef] = useState("");
  const [childOpen, setChildOpen] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(() => !embedded && typeof window !== "undefined" && window.innerWidth >= 1280);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  const issue = useQuery({ queryKey: ["issue", issueId], queryFn: () => getIssue(issueId), enabled: !!issueId, refetchInterval: 5000 });
  const comments = useQuery({ queryKey: ["comments", issueId, focusCommentId || ""], queryFn: () => listComments(issueId, focusCommentId), enabled: !!issueId, refetchInterval: 5000 });
  const activities = useQuery({ queryKey: ["issue-activity", issueId], queryFn: () => listIssueActivity(issueId), enabled: !!issueId, refetchInterval: 5000 });
  const subscribers = useQuery({ queryKey: ["issue-subscribers", issueId], queryFn: () => listIssueSubscribers(issueId), enabled: !!issueId, refetchInterval: 5000 });
  const artifacts = useQuery({ queryKey: ["issue-artifacts", issueId], queryFn: () => listIssueArtifacts(issueId), enabled: !!issueId, refetchInterval: 5000 });
  const tasks = useQuery({ queryKey: ["issue-tasks", scope.tenant, scope.namespace, issueId], queryFn: () => listIssueTasks(scope.tenant, scope.namespace, issueId), enabled: !!issueId, refetchInterval: 3000 });
  const summary = useQuery({ queryKey: ["issue-summary", issueId], queryFn: () => getIssueSummary(issueId), enabled: !!issueId });
  const children = useQuery({ queryKey: ["issue-children", issueId], queryFn: () => listChildIssues(scope.tenant, scope.namespace, issueId), enabled: !!issueId });
  const runs = useQuery({ queryKey: ["issue-runs", issueId], queryFn: () => listRuns(scope.tenant, scope.namespace, issueId), enabled: !!issueId, refetchInterval: 3000 });
  const runEvents = useQueries({ queries: (runs.data?.runs || []).map((run) => ({
    queryKey: ["run-events", run.id],
    queryFn: () => listRunEvents(run.id),
    refetchInterval: ["succeeded", "partial_succeeded", "failed", "cancelled"].includes(run.state) ? false : 3000,
  })) });

  const teams = useQuery({
    queryKey: ["issue-owner-teams", scope.tenant, scope.namespace],
    queryFn: () => listTeams(scope.tenant, scope.namespace),
    enabled: assigneeOpen && assigneeType === "team",
    staleTime: 10_000,
  });
  const teamOptions = (teams.data?.items || []).filter(team => team.status === "active")
    .map(team => ({ id: team.id, label: team.name, secondary: "团队" }));

  const item = issue.data?.issue;
  useEffect(() => {
    if (issue.isSuccess && (!focusCommentId || comments.isSuccess)) onReady?.();
  }, [issue.isSuccess, comments.isSuccess, focusCommentId, onReady]);
  useEffect(() => {
    if (!focusCommentId || !comments.isSuccess || focused.current === focusCommentId) return;
    const element = container.current?.querySelector(`[id="comment-${focusCommentId}"]`);
    if (element) {
      element.scrollIntoView({ block: "center" });
      focused.current = focusCommentId;
    }
  }, [focusCommentId, comments.data, comments.isSuccess]);
  useEffect(() => {
    if (!editingTitle) setTitleDraft(item?.title || "");
  }, [item?.title, editingTitle]);
  useEffect(() => {
    if (!editingDescription) setDescriptionDraft(item?.description || "");
  }, [item?.description, editingDescription]);

  const refresh = () => Promise.all([
    ...["issue", "issue-summary", "issue-activity"].map(key => qc.invalidateQueries({ queryKey: [key, issueId] })),
    ...["issues", "inbox", "inbox-summary", "inbox-item"].map(key => qc.invalidateQueries({ queryKey: [key] })),
  ]);
  const refreshDiscussion = () => Promise.all(
    ["issue", "comments", "issue-activity", "issue-summary"].map(key => qc.invalidateQueries({ queryKey: [key, issueId] })),
  );

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateIssue(issueId, { ...body, expectedVersion: issue.data?.issue.version }),
    onError: () => { void qc.invalidateQueries({ queryKey: ["issue", issueId] }); },
    onSuccess: async (_data, body) => {
      await refresh();
      if ("title" in body) setEditingTitle(false);
      if ("description" in body) setEditingDescription(false);
      if ("dueAt" in body) setDueDraft(null);
    },
  });
  const comment = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      addComment(issueId, text, parentId, !parentId && mentionRef ? [{ type: mentionType, ref: mentionRef }] : [], parentId ? "comment" : commentType),
    onSuccess: async (_data, variables) => {
      if (variables.parentId) {
        setReplyContent("");
        setReplyingTo(undefined);
      } else {
        setContent("");
        setCommentType("comment");
        setMentionRef("");
        setMentionOpen(false);
      }
      await refreshDiscussion();
    },
  });
  const resolve = useMutation({ mutationFn: ({ id, version, resolved }: { id: string; version: number; resolved: boolean }) => resolveComment(issueId, id, version, resolved), onSuccess: refreshDiscussion });
  const assign = useMutation({
    mutationFn: () => assignIssue(issueId, assigneeType, assigneeType ? assigneeRef.trim() : "", issue.data?.issue.version || 0),
    onSuccess: async () => {
      setAssigneeOpen(false);
      setAssigneeRef("");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["issue-tasks"] });
      await qc.invalidateQueries({ queryKey: ["issue-runs", issueId] });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const child = useMutation({
    mutationFn: () => createChildIssue(issueId, { title: childTitle, priority: "normal" }),
    onSuccess: () => {
      setChildTitle("");
      setChildOpen(false);
      refresh();
      void qc.invalidateQueries({ queryKey: ["issue-children", issueId] });
    },
  });
  const artifact = useMutation({
    mutationFn: () => uploadIssueArtifact(scope.tenant, scope.namespace, issueId, artifactFile!),
    onSuccess: async () => {
      setArtifactFile(null);
      await qc.invalidateQueries({ queryKey: ["issue-artifacts", issueId] });
      await refresh();
    },
  });
  const action = useMutation({
    onError: () => { void qc.invalidateQueries({ queryKey: ["issue", issueId] }); },
    mutationFn: async (next: string) => {
      const current = issue.data?.issue;
      if (!current || next === current.status) return;
      // 状态机合法流转（PRD 5.10.3）：非法目标在此抛错，界面只提供合法选项。
      if (next === "archive") await archiveIssue(issueId, current.version);
      else await submitIssueTransition(current, next);
    },
    onSuccess: async (_data, next) => {
      await refresh();
      if (next === "archive") { if (embedded) onBack?.(); else navigate(scope.scopedPath("/work/issues")); }
    },
  });
  const subscription = useMutation({
    mutationFn: async (subscribed: boolean) => {
      if (subscribed) await unsubscribeIssue(issueId, "human", username);
      else await subscribeIssue(issueId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issue-subscribers", issueId] }),
  });
  const download = useMutation({
    mutationFn: () => exportIssue(issueId),
    onSuccess: (data) => saveIssueDownload(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `issue-${issueId}.json`),
  });
  const artifactDownload = useMutation({
    mutationFn: downloadIssueArtifact,
    onSuccess: (blob, entry) => saveIssueDownload(blob, entry.filename),
  });

  const allTasks = tasks.data?.items || [];
  const issueTasks = allTasks.filter((task) => task.issueId === issueId);
  const issueExecutions = (runs.data?.runs || []).map((run, index) => ({
    run,
    tasks: issueTasks.filter((task) => task.orchestrationRunId === run.id),
    toolFailures: toolFailures(runEvents[index]?.data?.events).filter(event => issueTasks.some(task => task.id === event.agentTaskId)),
    dispatchDeferrals: dispatchDeferrals(runEvents[index]?.data?.events).filter((event) =>
      issueTasks.some((task) => task.id === event.agentTaskId && task.status === "queued"),
    ),
  }));
  const identities = useEntityIdentities([
    { type: item?.assigneeType, ref: item?.assigneeRef },
    { type: item?.executionTargetType, ref: item?.executionTargetRef },
    { type: item?.creator.type, ref: item?.creator.ref },
    { type: item?.sourceType, ref: item?.sourceRef },
    ...(comments.data?.items || []).flatMap((entry) => [
      { type: entry.author.type, ref: entry.author.ref },
      ...(entry.routes || []).map((route) => ({ type: route.targetType, ref: route.targetRef })),
      ...(entry.mentions || []).map((mention) => ({ type: mention.targetType, ref: mention.targetRef })),
    ]),
    ...(activities.data?.items || []).flatMap((entry) => [
      { type: entry.actor.type, ref: entry.actor.ref },
      { type: entry.objectType, ref: entry.objectRef },
    ]),
    ...(subscribers.data?.items || []).map((entry) => ({ type: entry.subscriberType, ref: entry.subscriberRef })),
    ...issueTasks.flatMap((task) => [
      { type: "agent", ref: task.agentId },
      { type: "team", ref: task.teamId },
      { type: task.originator.type, ref: task.originator.ref },
    ]),
  ]);
  const propertiesBusy = update.isPending || assign.isPending || action.isPending || comment.isPending || resolve.isPending || artifact.isPending || issue.isError;
  const dueValue = dueDraft ?? dateTimeLocal(item?.dueAt);
  const sourceUrl = sourceWebUrl(item?.sourceRef);
  const channelSource = item?.sourceType === 'channel' && item.sourceRef ? item.sourceRef.slice(0, item.sourceRef.lastIndexOf(':')) : '';
  const childItems = useMemo(() => children.data?.items || [], [children.data?.items]);
  const doneChildren = childItems.filter((childItem) => childItem.status === "done").length;
  const isSubscribed = !!username && !!subscribers.data?.items.some((subscriber) => subscriber.subscriberType === "human" && subscriber.subscriberRef === username);

  // 七分区（PRD 5.10.2）：讨论与活动分开呈现，不再是混合时间线。
  const discussionThreads = useMemo(() => {
    const roots = (comments.data?.items || [])
      .filter((entry) => !entry.parentId)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    return roots;
  }, [comments.data?.items]);

  const activityTimeline = useMemo(() =>
    (activities.data?.items || [])
      .filter((entry) => !entry.action.startsWith("comment."))
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
  [activities.data?.items]);

  const repliesByRoot = useMemo(() => {
    const grouped = new Map<string, Comment[]>();
    for (const entry of comments.data?.items || []) {
      if (!entry.parentId) continue;
      const list = grouped.get(entry.threadRootId) || [];
      list.push(entry);
      grouped.set(entry.threadRootId, list);
    }
    return grouped;
  }, [comments.data?.items]);

  // 子工单树形呈现（PRD 5.10.1）：按 parentIssueId 组树，父节点显示完成进度。
  const childTree = useMemo((): TreeNode[] => {
    const byParent = new Map<string, typeof childItems>();
    for (const childItem of childItems) {
      if (childItem.parentIssueId === issueId) continue;
      const list = byParent.get(childItem.parentIssueId || "") || [];
      list.push(childItem);
      byParent.set(childItem.parentIssueId || "", list);
    }
    const nodeOf = (entry: typeof childItems[number]): TreeNode => ({
      id: entry.id,
      label: <Link className="truncate hover:text-primary-text" to={scope.scopedPath(`/work/issues/${entry.id}`)}>{entry.title}</Link>,
      meta: <span className={cn("text-xs", entry.status === "done" ? "text-success-text" : "text-text-3")}>{issueStatusLabel(entry.status)}</span>,
      children: (byParent.get(entry.id) || []).map(nodeOf),
    });
    return childItems.filter((entry) => !entry.parentIssueId || entry.parentIssueId === issueId).map(nodeOf);
  }, [childItems, issueId, scope]);

  const mutationError = [update.error, comment.error, resolve.error, assign.error, child.error, artifact.error, action.error, subscription.error, download.error, artifactDownload.error].find(Boolean);

  if (issue.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-text-3"><LoaderCircle className="h-4 w-4 animate-spin" /> 正在加载事项…</div>;
  }
  if (!item) {
    return <div className="mx-auto max-w-xl p-10"><div className="rounded-xl border border-danger bg-danger-soft p-5 text-sm text-danger-text">该事项不可见或不属于当前命名空间。{mutationMessage(issue.error)}</div></div>;
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (content.trim()) comment.mutate({ text: content.trim() });
  }

  return (
    <div ref={container} className="min-h-full bg-surface" onClickCapture={event => {
      if (!embedded || !onNavigateIssue || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest("a");
      if (!link) return;
      const match = new URL(link.href).pathname.match(/\/work\/issues\/([^/]+)$/);
      if (match) { event.preventDefault(); event.stopPropagation(); onNavigateIssue(decodeURIComponent(match[1])); }
    }}>
      <div className="sticky top-0 z-20 flex min-h-12 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="返回上一页" aria-label="返回上一页" onClick={() => embedded ? onBack?.() : navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="hidden text-text-3 sm:inline">事项</span><span className="hidden text-text-4 sm:inline">/</span>
          <span className="truncate font-medium text-text">{item.identifier || item.id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-text-3" disabled={!username || !subscribers.isSuccess || subscription.isPending} onClick={() => subscription.mutate(isSubscribed)} title={isSubscribed ? "停止接收更新" : "接收事项更新"}><MessageSquare className="h-4 w-4" /><span>{subscribers.isSuccess ? subscribers.data.items.length : "…"}</span><span className="hidden sm:inline">{isSubscribed ? "已订阅" : "订阅"}</span></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="导出事项" disabled={download.isPending} onClick={() => download.mutate()}><Download className="h-4 w-4" /></Button>
          {(item.status === "done" || item.status === "cancelled") && !item.archivedAt && <Button variant="ghost" size="icon" className="h-8 w-8" title="归档事项" disabled={propertiesBusy} onClick={() => action.mutate("archive")}><Archive className="h-4 w-4" /></Button>}
          <Button variant={detailsOpen ? "secondary" : "ghost"} size="icon" className="h-8 w-8" title={detailsOpen ? "收起属性面板" : "展开属性面板"} aria-controls="issue-properties" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((value) => !value)}><PanelRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {mutationError && <div role="alert" className="sticky top-12 z-40 flex items-start justify-between gap-2 border-b border-danger bg-danger-soft px-6 py-2.5 text-sm text-danger-text"><span>{mutationMessage(mutationError)}</span><button type="button" aria-label="关闭错误提示" onClick={() => { update.reset(); comment.reset(); resolve.reset(); assign.reset(); child.reset(); artifact.reset(); action.reset(); subscription.reset(); download.reset(); artifactDownload.reset(); }}><X className="h-4 w-4" /></button></div>}
      {item.archivedAt && <div className="border-b bg-surface-2 px-6 py-2 text-sm text-text-3">该事项已归档。</div>}

      <div className={cn("grid min-h-[calc(100vh-7rem)]", detailsOpen && !embedded && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <main className="min-w-0">
          <div className={cn("mx-auto max-w-4xl", embedded ? "px-5 py-6" : "px-5 py-10 sm:px-10 lg:py-14")}>
            {/* 分区 1：标题区 */}
            <div className="group relative">
              {editingTitle ? (
                <div className="flex items-start gap-2">
                  <Input className="h-auto border-0 px-0 py-0 text-3xl font-bold tracking-tight shadow-none focus-visible:ring-0" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} autoFocus onKeyDown={(event) => { if (event.key === "Enter" && titleDraft.trim()) update.mutate({ title: titleDraft.trim() }); if (event.key === "Escape") setEditingTitle(false); }} />
                  <Button size="icon" className="h-8 w-8" disabled={!titleDraft.trim() || update.isPending} onClick={() => update.mutate({ title: titleDraft.trim() })}><Check className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTitleDraft(item.title); setEditingTitle(false); }}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex items-start gap-2"><h1 className="text-3xl font-bold leading-tight tracking-tight text-text">{item.title}</h1><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="编辑标题" onClick={() => setEditingTitle(true)}><Pencil className="h-4 w-4" /></Button></div>
              )}
            </div>

            <div className="mt-6 group">
              {editingDescription ? (
                <div className="space-y-2"><Textarea className="min-h-32 text-[15px] leading-7" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} autoFocus placeholder="补充描述…" /><div className="flex gap-2"><Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ description: descriptionDraft })}>保存</Button><Button size="sm" variant="ghost" onClick={() => { setDescriptionDraft(item.description || ""); setEditingDescription(false); }}>取消</Button></div></div>
              ) : (
                <button type="button" className="flex w-full items-start gap-2 rounded-lg text-left text-[15px] leading-7 text-text-2 hover:bg-hover" onClick={() => setEditingDescription(true)}><div className={cn("md-text min-w-0 flex-1", !item.description && "italic text-text-3")}>{item.description ? <ReactMarkdown>{item.description}</ReactMarkdown> : "补充描述…"}</div><Pencil className="mt-1.5 h-3.5 w-3.5 shrink-0 text-text-4 opacity-0 group-hover:opacity-100" /></button>
              )}
            </div>

            {/* 分区 2：讨论（含 @提及、回复线程、解决/重开） */}
            <section className="mt-10" aria-label="讨论">
              <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold text-text">讨论</h2><div className="flex items-center gap-2 text-sm text-text-3"><MessageSquare className="h-4 w-4" />{summary.data?.summary.commentCount || 0}</div></div>
              <div className="mt-6 space-y-4">
                {!discussionThreads.length && !comments.isLoading && <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-3">还没有讨论，从下方开始对话。</div>}
                {discussionThreads.map((entry) => {
                  const replies = repliesByRoot.get(entry.threadRootId) || [];
                  return (
                    <article id={`comment-${entry.id}`} key={entry.id} className={cn(focusCommentId === entry.id && "ring-2 ring-ring", "overflow-hidden rounded-2xl border bg-surface shadow-1", entry.resolvedAt ? "border-success" : "border-border")}>
                      <div className="flex items-start gap-3 p-4 sm:p-5"><ActorAvatar actor={entry.author} identities={identities} /><CommentBody entry={entry} identities={identities} /></div>
                      {!!replies.length && <div className="border-t border-border bg-surface-2 px-4 py-2 sm:px-5">{replies.map((reply) => <div id={`comment-${reply.id}`} key={reply.id} className={cn("flex items-start gap-3 border-b border-border py-3 last:border-0", focusCommentId === reply.id && "rounded-lg bg-primary-soft ring-2 ring-ring")}><ActorAvatar actor={reply.author} identities={identities} size="sm" /><CommentBody entry={reply} identities={identities} /></div>)}</div>}
                      {!entry.deletedAt && <div className="flex items-center gap-1 border-t border-border px-3 py-2"><Button variant="ghost" size="sm" className="h-8 text-text-3" onClick={() => { setReplyingTo(entry.id); setReplyContent(""); }}><Reply className="h-3.5 w-3.5" />回复</Button><Button variant="ghost" size="sm" className="h-8 text-text-3" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: entry.id, version: entry.version, resolved: !entry.resolvedAt })}>{entry.resolvedAt ? "重开" : "解决"}</Button></div>}
                      {replyingTo === entry.id && <div className="flex gap-2 border-t border-border bg-surface-2 p-3"><Textarea className="min-h-16 bg-surface" value={replyContent} onChange={(event) => setReplyContent(event.target.value)} placeholder={`回复 ${actorName(entry.author, identities)}…`} autoFocus /><Button size="icon" className="h-9 w-9 self-end rounded-full" disabled={!replyContent.trim() || comment.isPending} onClick={() => comment.mutate({ text: replyContent.trim(), parentId: entry.id })}><ArrowUp className="h-4 w-4" /></Button></div>}
                    </article>
                  );
                })}
              </div>

              <form onSubmit={submitComment} className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-1 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-soft">
                <Textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && content.trim()) { event.preventDefault(); comment.mutate({ text: content.trim() }); } }} className="min-h-28 resize-y border-0 px-4 py-4 text-[15px] shadow-none focus-visible:ring-0" placeholder="发表评论…" />
                {mentionOpen && <div className="grid gap-2 border-t border-border bg-surface-2 px-3 py-3 sm:grid-cols-[8rem_1fr]"><select className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text" value={mentionType} onChange={(event) => { setMentionType(event.target.value); setMentionRef(""); }}><option value="agent">智能体</option><option value="team">团队</option><option value="human">成员</option></select>{mentionType === "agent" ? <AgentPicker value={mentionRef} onChange={setMentionRef} emptyLabel="提及一个智能体…" aria-label="被提及的智能体" /> : <Input className="h-9" value={mentionRef} onChange={(event) => setMentionRef(event.target.value)} placeholder={`提及一个${mentionType === "team" ? "团队" : "成员"}…`} />}</div>}
                {artifactFile && <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-2 text-sm"><span className="min-w-0 truncate text-text-2"><Paperclip className="mr-2 inline h-3.5 w-3.5" />{artifactFile.name}</span><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" disabled={artifact.isPending} onClick={() => artifact.mutate()}>{artifact.isPending ? "上传中…" : "上传"}</Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="移除待上传附件" onClick={() => setArtifactFile(null)}><X className="h-3.5 w-3.5" /></Button></div></div>}
                <div className="flex items-center justify-between border-t border-border px-3 py-2"><div className="flex items-center gap-1"><select aria-label="评论类型" className="h-8 rounded-lg border-0 bg-transparent px-2 text-xs text-text-2" value={commentType} onChange={event => setCommentType(event.target.value)}><option value="comment">评论</option><option value="result">结果</option></select><Button type="button" variant={mentionOpen ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setMentionOpen((value) => !value)} title="提及他人"><span className="text-base leading-none">@</span><span className="hidden sm:inline">提及</span></Button><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-text-3 hover:bg-hover"><Paperclip className="h-4 w-4" /><span className="hidden sm:inline">附件</span><input type="file" className="sr-only" onChange={event => { setArtifactFile(event.target.files?.[0] || null); event.target.value = ""; }} /></label></div><Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={!content.trim() || comment.isPending} title="发送评论（⌘ Enter）">{comment.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</Button></div>
              </form>
            </section>

            {/* 分区 3：活动时间线 */}
            <section className="mt-10 border-t border-border pt-8" aria-label="活动">
              <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold text-text">活动</h2><span className="text-sm text-text-3">{activityTimeline.length} 条记录</span></div>
              <div className="mt-6 space-y-4">
                {!activityTimeline.length && !activities.isLoading && <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-3">暂无操作记录。</p>}
                {activityTimeline.map((entry) => <div key={entry.id} className="flex items-start gap-3 px-3 py-1 text-sm text-text-2"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3"><Clock3 className="h-3.5 w-3.5 text-text-3" /></span><div className="min-w-0 flex-1 pt-1">{activityDescription(entry, identities)}</div><span className="shrink-0 pt-1 text-xs text-text-3">{formatRelative(entry.createdAt)}</span></div>)}
              </div>
            </section>
          </div>
        </main>

        {detailsOpen && <button type="button" aria-label="关闭属性面板" className={cn("fixed inset-0 top-14 z-20 bg-scrim", !embedded && "xl:hidden")} onClick={() => setDetailsOpen(false)} />}
        {detailsOpen && (
          <aside id="issue-properties" className={cn("fixed inset-y-14 right-0 z-30 w-[22rem] max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-border bg-surface-2 shadow-2xl", !embedded && "xl:static xl:z-auto xl:w-auto xl:max-w-none xl:overflow-visible xl:border-t-0 xl:shadow-none")}>
            <div className="space-y-7 px-5 py-7 xl:sticky xl:top-12 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
              {[issue, subscribers, artifacts, tasks, runs].some(query => query.isError) && <div role="alert" className="rounded-lg border border-danger bg-danger-soft p-3 text-xs text-danger-text">部分详情加载失败。<button className="underline" onClick={() => { void issue.refetch(); void subscribers.refetch(); void artifacts.refetch(); void tasks.refetch(); void runs.refetch(); }}>重试</button></div>}

              {/* 分区 4：属性 */}
              <section>
                <div className="mb-2 flex items-center justify-between"><h2><button type="button" className="flex items-center gap-2 text-sm font-semibold text-text" aria-expanded={propertiesOpen} aria-controls="issue-property-fields" onClick={() => setPropertiesOpen(value => !value)}>属性 <ChevronDown className={cn("h-4 w-4 text-text-4 transition-transform", !propertiesOpen && "-rotate-90")} /></button></h2><Button variant="ghost" size="icon" className={cn("h-8 w-8", !embedded && "xl:hidden")} aria-label="关闭属性面板" onClick={() => setDetailsOpen(false)}><X className="h-4 w-4" /></Button></div>
                {propertiesOpen && <div id="issue-property-fields">
                <PropertyRow icon={CircleDot} label="状态"><select aria-label="事项状态" className={cn("h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border hover:bg-surface", item.status === "done" && "text-success-text", item.status === "blocked" && "text-danger-text")} value={item.status} disabled={propertiesBusy || !!item.archivedAt} onChange={(event) => action.mutate(event.target.value)}>{[item.status, ...allowedIssueTransitions(item.status)].map((status) => <option key={status} value={status}>{issueStatusLabel(status)}</option>)}</select></PropertyRow>
                <PropertyRow icon={item.assigneeType === "team" ? UsersRound : item.assigneeType === "agent" ? Bot : UserRound} label="负责人">
                  {!assigneeOpen ? <button type="button" aria-label="编辑负责人" disabled={propertiesBusy || !!item.archivedAt} className="min-h-8 w-full rounded-lg px-2 text-left text-sm hover:bg-surface" onClick={() => { setAssigneeType(item.assigneeType || "agent"); setAssigneeRef(item.assigneeRef || ""); setAssigneeOpen(true); }}>{item.assigneeRef ? <EntityIdentityText identities={identities} type={item.assigneeType} entityRef={item.assigneeRef} secondary /> : <span className="text-text-3">未分配</span>}</button> : <div className="space-y-2 rounded-lg border border-border bg-surface p-2">
                    <select aria-label="负责人类型" className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text-2" value={assigneeType} disabled={assign.isPending} onChange={event => { setAssigneeType(event.target.value); setAssigneeRef(""); }}><option value="">未分配</option><option value="agent">智能体</option><option value="team">团队</option><option value="human">成员</option></select>
                    {assigneeType === "agent" ? <AgentPicker value={assigneeRef} onChange={setAssigneeRef} disabled={assign.isPending} emptyLabel="选择智能体…" aria-label="事项负责人智能体" className="[&_[role=listbox]]:right-0" /> : assigneeType === "team" ? <NamedResourcePicker value={assigneeRef} onChange={setAssigneeRef} options={teamOptions} resourceLabel="团队" className="[&_[role=listbox]]:right-0" loading={teams.isLoading || assign.isPending} error={teams.isError} aria-label="事项负责人团队" /> : assigneeType === "human" ? <><Input aria-label="负责人用户名" className="h-8 text-xs" value={assigneeRef} onChange={event => setAssigneeRef(event.target.value)} placeholder="用户名" /><Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => setAssigneeRef(username)}>指派给我</Button></> : null}
                    <p className="text-xs leading-5 text-text-3">{["agent", "team"].includes(assigneeType) ? (["done", "cancelled"].includes(item.status) ? "请先重开事项，再发起新的执行。" : "指派后会发起新的执行，已有执行继续进行。") : "仅变更责任归属，已有执行继续进行。"}</p>
                    <div className="flex gap-1"><Button size="sm" className="h-8" disabled={propertiesBusy || (!!assigneeType && !assigneeRef.trim()) || (assigneeType === (item.assigneeType || "") && assigneeRef.trim() === (item.assigneeRef || "")) || (["agent", "team"].includes(assigneeType) && ["done", "cancelled"].includes(item.status))} onClick={() => assign.mutate()}>指派</Button><Button size="sm" variant="ghost" className="h-8" onClick={() => setAssigneeOpen(false)}>取消</Button></div>
                  </div>}
                </PropertyRow>
                <PropertyRow icon={ClipboardList} label="优先级"><select aria-label="事项优先级" className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm hover:border-border hover:bg-surface" value={item.priority || "none"} disabled={propertiesBusy} onChange={(event) => update.mutate({ priority: event.target.value })}><option value="none">无优先级</option><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></PropertyRow>
                <PropertyRow icon={CalendarDays} label="截止时间"><div className="space-y-1">
                  <input aria-label="事项截止时间" type="datetime-local" className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-xs hover:border-border hover:bg-surface" value={dueValue} onChange={event => setDueDraft(event.target.value)} />
                  <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={dueValue === dateTimeLocal(item.dueAt) || propertiesBusy} aria-label="保存截止时间" onClick={() => update.mutate(dueDatePatch(dueValue))}><Check className="h-3.5 w-3.5" />保存</Button>{item.dueAt && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={propertiesBusy} aria-label="清除截止时间" onClick={() => update.mutate(dueDatePatch(""))}><X className="h-3.5 w-3.5" />清除</Button>}</div>
                </div></PropertyRow>
                {item.executionTargetRef && <PropertyRow icon={Sparkles} label="执行目标"><div className="px-2 py-1 text-sm"><EntityIdentityText identities={identities} type={item.executionTargetType} entityRef={item.executionTargetRef} secondary /></div></PropertyRow>}
                </div>}
              </section>

              <IssueSharing issue={item} />

              {/* 分区 5：子工单（树形） */}
              <section className="border-t border-border pt-5" aria-label="子工单">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-text"><ListChecks className="h-4 w-4" />子工单{!!childItems.length && <span className="text-xs font-normal text-text-3">{doneChildren}/{childItems.length} 已完成</span>}</h2>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setChildOpen(true)}><Plus className="h-4 w-4" />添加</Button>
                </div>
                {childItems.length
                  ? <Tree nodes={childTree} defaultExpanded={childItems.map(entry => entry.id)} aria-label="子工单树" />
                  : <p className="text-xs leading-5 text-text-3">将大事项拆成子工单，逐项跟踪状态与负责人。</p>}
                {(childOpen || !childItems.length) && <div className="mt-3 flex gap-2"><Input value={childTitle} onChange={(event) => setChildTitle(event.target.value)} placeholder="需要完成什么？" onKeyDown={(event) => { if (event.key === "Enter" && childTitle.trim()) child.mutate(); }} /><Button variant="outline" disabled={!childTitle.trim() || child.isPending} onClick={() => child.mutate()}>创建</Button></div>}
              </section>

              {/* 分区 6：验收 */}
              <section className="border-t border-border pt-5" aria-label="验收">
                <IssueAcceptanceEditor value={item.acceptanceCriteria} busy={propertiesBusy} onSave={acceptanceCriteria => update.mutateAsync({ acceptanceCriteria })} />
              </section>

              {/* 分区 7：产物 */}
              <details className="group border-t border-border pt-5" open><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-text"><span className="flex items-center gap-2"><Paperclip className="h-4 w-4" />产物</span><span className="text-xs font-normal text-text-3">{artifacts.isSuccess ? artifacts.data.items.length : "…"}</span></summary><div className="mt-3 space-y-2">{(artifacts.data?.items || []).map((entry) => <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-surface p-2.5 text-xs"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3"><File className="h-4 w-4 text-text-3" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-text" title={entry.filename}>{entry.filename}</span><span className="text-text-3">{formatBytes(entry.sizeBytes)} · {formatRelative(entry.createdAt)}</span></span><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`下载 ${entry.filename}`} disabled={artifactDownload.isPending} onClick={() => artifactDownload.mutate(entry)}><Download className="h-4 w-4" /></Button></div>)}{artifacts.isSuccess && !artifacts.data?.items.length && <p className="text-xs text-text-3">还没有附件产物。</p>}</div></details>

              {/* 分区 8：执行关联 */}
              <details className="group border-t border-border pt-5" open>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-text">
                  <span className="flex items-center gap-2"><GitPullRequest className="h-4 w-4" />执行关联</span>
                  <span className="text-xs font-normal text-text-3">{issueExecutions.length} 次执行</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {issueExecutions.map((execution, index) => (
                    <ExecutionLink key={execution.run.id} execution={execution} index={index} total={issueExecutions.length} identities={identities} scopePath={scope.scopedPath} />
                  ))}
                  {runs.isSuccess && !issueExecutions.length && <p className="text-xs text-text-3">还没有启动执行。</p>}
                </div>
              </details>

              <section className="border-t border-border pt-5"><h2 className="mb-3 text-sm font-semibold text-text">来源</h2>{item.sourceRef ? <div className="rounded-lg bg-surface p-3 text-sm"><div className="text-xs font-medium text-text-3">{item.sourceType?.replace(/_/g, " ") || "外部工作"}</div><EntityIdentityText identities={identities} type={item.sourceType} entityRef={item.sourceRef} secondary className="mt-1 flex" />{channelSource && <Link className="mt-2 block text-xs text-primary-text" to={scope.scopedPath(`/agent-center/entrypoints/${encodeURIComponent(channelSource)}`)}>渠道接待与工作回传</Link>}{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary-text">打开来源<ExternalLink className="h-3 w-3" /></a>}</div> : <p className="text-xs leading-5 text-text-3">创建于当前命名空间，未关联外部来源。</p>}</section>

              <section className="border-t border-border pt-5"><h2 className="mb-3 text-sm font-semibold text-text">详情</h2><dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs"><dt className="text-text-3">创建人</dt><dd className="truncate text-text-2">{actorName(item.creator, identities)}</dd><dt className="text-text-3">创建时间</dt><dd className="text-text-2">{new Date(item.createdAt).toLocaleString()}</dd><dt className="text-text-3">更新时间</dt><dd className="text-text-2">{new Date(item.updatedAt).toLocaleString()}</dd><dt className="text-text-3">完成策略</dt><dd className="text-text-2">{item.completionPolicy === "review" ? "需评审验收" : item.completionPolicy === "automatic" ? "自动完成" : item.completionPolicy}</dd><dt className="text-text-3">事项 ID</dt><dd className="truncate font-mono text-text-2" title={item.id}>{item.id}</dd></dl>{item.parentIssueId && <Button asChild variant="link" size="sm" className="mt-3 h-auto p-0"><Link to={scope.scopedPath(`/work/issues/${item.parentIssueId}`)}>打开父事项</Link></Button>}</section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
