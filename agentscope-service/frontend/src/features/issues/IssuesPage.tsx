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

import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleDotDashed, KanbanSquare, List, Plus, Rows3, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { createIssue, listIssues, listTeams, type Issue } from "@/api/collaboration";
import { listDefinitions } from "@/api/orchestration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { Page, PageHeader } from "@/components/Page";
import { AgentPicker } from "@/components/AgentPicker";
import { EntityIdentityText, type EntityIdentityMap, useEntityIdentities } from "@/components/EntityIdentity";
import { NamedResourcePicker } from "@/components/NamedResourcePicker";
import { AsyncState } from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ConfirmDialog,
} from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { filtersForIssueSource, issueSourceFromParam } from "@/features/issues/issueSource";
import { WorkStatusBadge } from "@/features/work/WorkSurface";
import { asyncStatusOf } from "@/features/work/WorkOverviewPage";
import {
  KANBAN_COLUMNS,
  isLegalIssueTransition,
  issueStatusLabel,
  kanbanColumnOf,
  submitIssueTransition,
} from "./issueTransition";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type IssueView = "all" | "active" | "review" | "done" | "archived";
type IssueLayout = "list" | "board" | "grouped";

const issueViews: Array<{ value: IssueView; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "review", label: "评审中" },
  { value: "done", label: "已完成" },
  { value: "archived", label: "已归档" },
];

const layouts: Array<{ value: IssueLayout; label: string; icon: typeof List }> = [
  { value: "list", label: "列表", icon: List },
  { value: "board", label: "看板", icon: KanbanSquare },
  { value: "grouped", label: "分组", icon: Rows3 },
];

const priorityLabels: Record<string, string> = { low: "低", normal: "普通", high: "高", urgent: "紧急", critical: "紧急" };

function priorityLabel(priority: string): string {
  return priorityLabels[priority] ?? priority;
}

function priorityTone(priority: string): "default" | "warning" | "danger" {
  if (["urgent", "critical"].includes(priority)) return "danger";
  if (priority === "high") return "warning";
  return "default";
}

function IssueOwnerOrTarget({ issue, identities }: { issue: Issue; identities: EntityIdentityMap }) {
  if (issue.assigneeRef) {
    return <EntityIdentityText identities={identities} type={issue.assigneeType} entityRef={issue.assigneeRef} />;
  }
  if (issue.executionTargetRef) {
    return <EntityIdentityText identities={identities} type={issue.executionTargetType} entityRef={issue.executionTargetRef} secondary />;
  }
  return <span className="text-text-4">未分配</span>;
}

export default function IssuesPage() {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const [title, setTitle] = useState(() => urlParams.get("title") ?? "");
  const [description, setDescription] = useState(() => urlParams.get("description") ?? "");
  const [priority, setPriority] = useState("normal");
  const [accessMode, setAccessMode] = useState<"private" | "namespace">("private");
  const [assigneeRef, setAssigneeRef] = useState("");
  const [assigneeType, setAssigneeType] = useState("agent");
  const [search, setSearch] = useState("");
  const [pendingTransition, setPendingTransition] = useState<{ issue: Issue; next: string }>();
  const requestedView = urlParams.get("status");
  const view: IssueView = issueViews.some((item) => item.value === requestedView) ? requestedView as IssueView : "all";
  const requestedLayout = urlParams.get("layout");
  const layout: IssueLayout = layouts.some((item) => item.value === requestedLayout) ? requestedLayout as IssueLayout : "list";
  const dialogOpen = urlParams.get("new") === "1";
  const source = issueSourceFromParam(urlParams.get("source"));
  const sourceFilters = filtersForIssueSource(source);
  const archived = view === "archived";
  const issues = useQuery({
    queryKey: ["issues", scope.tenant, scope.namespace, search, archived, source],
    queryFn: () => listIssues(scope.tenant, scope.namespace, "", search, archived, sourceFilters),
    refetchInterval: 7500,
  });
  const teams = useQuery({
    queryKey: ["issue-owner-teams", scope.tenant, scope.namespace],
    queryFn: () => listTeams(scope.tenant, scope.namespace),
    enabled: dialogOpen && assigneeType === "team",
    staleTime: 10_000,
  });
  const workflows = useQuery({
    queryKey: ["issue-owner-workflows", scope.tenant, scope.namespace],
    queryFn: () => listDefinitions(scope.tenant, scope.namespace),
    enabled: dialogOpen && assigneeType === "workflow",
    staleTime: 10_000,
  });
  const teamOptions = useMemo(() => (teams.data?.items ?? [])
    .filter(team => team.status === "active")
    .map(team => ({ id: team.id, label: team.name, secondary: "团队" })), [teams.data?.items]);
  const workflowOptions = useMemo(() => (workflows.data?.definitions ?? [])
    .filter(workflow => !workflow.archivedAt)
    .map(workflow => ({ id: workflow.id, label: workflow.name, secondary: "工作流" })), [workflows.data?.definitions]);
  const create = useMutation({
    mutationFn: () => createIssue({
      tenant: scope.tenant,
      namespace: scope.namespace,
      access: { mode: accessMode },
      title: title.trim(),
      description: description.trim(),
      priority,
      assigneeType: assigneeRef && assigneeType !== "workflow" ? assigneeType : undefined,
      assigneeRef: assigneeRef && assigneeType !== "workflow" ? assigneeRef : undefined,
      executionTargetType: assigneeRef && assigneeType === "workflow" ? "workflow" : undefined,
      executionTargetRef: assigneeRef && assigneeType === "workflow" ? assigneeRef : undefined,
      sourceType: urlParams.get("fromChat") ? "chat" : undefined,
      sourceRef: urlParams.get("fromChat") || undefined,
      contextRefs: urlParams.get("fromChat") ? { chatId: urlParams.get("fromChat") } : undefined,
    }),
    onSuccess: (data) => {
      setTitle("");
      setDescription("");
      setPriority("normal");
      setAssigneeRef("");
      void qc.invalidateQueries({ queryKey: ["issues"] });
      navigate(scope.scopedPath(`/work/issues/${data.issue.id}`));
    },
  });
  const transition = useMutation({
    mutationFn: ({ issue, next }: { issue: Issue; next: string }) => submitIssueTransition(issue, next),
    onSuccess: async () => {
      setPendingTransition(undefined);
      await qc.invalidateQueries({ queryKey: ["issues"] });
      await qc.invalidateQueries({ queryKey: ["issue"] });
    },
    onError: () => { /* 错误信息由 pendingTransition 弹层展示 */ },
  });

  const items = useMemo(() => {
    const rows = issues.data?.items || [];
    if (view === "active") return rows.filter((item) => !["done", "cancelled"].includes(item.status));
    if (view === "review") return rows.filter((item) => item.status === "in_review");
    if (view === "done") return rows.filter((item) => item.status === "done");
    return rows;
  }, [issues.data?.items, view]);
  const identities = useEntityIdentities(items.flatMap((item) => [
    { type: item.assigneeType, ref: item.assigneeRef },
    { type: item.executionTargetType, ref: item.executionTargetRef },
  ]));
  // 分组视图：按指派对象分组（PRD 5.10.1 列表/看板/分组三视图）。
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; issues: Issue[] }>();
    for (const item of items) {
      const key = item.assigneeRef ? `${item.assigneeType}/${item.assigneeRef}` : "unassigned";
      const label = item.assigneeRef
        ? `${item.assigneeType === "agent" ? "智能体" : item.assigneeType === "team" ? "团队" : item.assigneeType === "human" ? "成员" : item.assigneeType} · ${item.assigneeRef}`
        : "未分配";
      const group = map.get(key) ?? { key, label, issues: [] };
      group.issues.push(item);
      map.set(key, group);
    }
    return [...map.values()].sort((left, right) => {
      if (left.key === "unassigned") return 1;
      if (right.key === "unassigned") return -1;
      return left.label.localeCompare(right.label);
    });
  }, [items]);

  function setParam(name: string, value?: string) {
    const next = new URLSearchParams(urlParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setUrlParams(next, { replace: true });
  }

  function closeCreate() {
    const next = new URLSearchParams(urlParams);
    ["new", "fromChat", "title", "description"].forEach((name) => next.delete(name));
    setUrlParams(next, { replace: true });
    setTitle("");
    setDescription("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) create.mutate();
  }

  function onDropCard(event: DragEvent<HTMLDivElement>, column: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/issue-id");
    const issue = items.find(item => item.id === id);
    if (!issue) return;
    if (kanbanColumnOf(issue.status) === column) return; // 同列放置是无操作
    if (!isLegalIssueTransition(issue.status, column)) return; // 非法流转不可选（PRD 5.10.3）
    setPendingTransition({ issue, next: column });
  }

  const emptyDescription = source === "endpoint_jobs"
    ? "该范围内还没有端点任务生成的运维事项。"
    : search
      ? "换个关键词，或清除当前筛选。"
      : view === "archived"
        ? "已归档的事项会保留在这里备查。"
        : "创建第一条事项，开始一条可追踪的工作线。";

  return (
    <Page>
      <PageHeader
        title="事项"
        description="计划工作、在上下文中讨论，并跟踪每次执行直到验收。"
        actions={
          <Button onClick={() => setParam("new", "1")}>
            <Plus className="h-4 w-4" /> 新建事项
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {layout === "list" && <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-3 p-1">
          {issueViews.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setParam("status", item.value === "all" ? undefined : item.value)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
                view === item.value
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-3 hover:text-text",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>}
        {layout !== "list" && <span className="text-sm text-text-3">{layout === "board" ? "按状态分列，拖拽卡片变更状态（需确认，仅合法流转）" : `按指派对象分组 · ${groups.length} 组`}</span>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-4" />
            <Input
              className="pl-9 shadow-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、标识、描述"
            />
          </label>
          <select
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-2 outline-none focus:ring-2 focus:ring-ring"
            aria-label="事项来源"
            value={source}
            onChange={(event) => setParam("source", event.target.value === "all" ? undefined : event.target.value)}
          >
            <option value="all">全部来源</option>
            <option value="work">工作台</option>
            <option value="endpoint_jobs">端点任务</option>
          </select>
          <div className="flex rounded-lg bg-surface-3 p-0.5" role="group" aria-label="视图布局">
            {layouts.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={layout === item.value}
                  title={`${item.label}视图`}
                  onClick={() => setParam("layout", item.value === "list" ? undefined : item.value)}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", layout === item.value ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />{item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AsyncState
        status={asyncStatusOf({ isLoading: issues.isLoading, isError: issues.isError, isEmpty: items.length === 0 })}
        resource="事项"
        emptyDescription={emptyDescription}
        onRetry={() => issues.refetch()}
      >
        {layout === "board" ? (
          <div className="grid gap-4 overflow-x-auto pb-2 md:grid-flow-col md:auto-cols-[minmax(240px,1fr)]" data-testid="issues-board">
            {KANBAN_COLUMNS.map(column => {
              const columnIssues = items.filter(item => kanbanColumnOf(item.status) === column);
              return (
                <div
                  key={column}
                  className="flex min-h-64 flex-col rounded-xl border border-border bg-surface-2"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => onDropCard(event, column)}
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                    <span className="text-xs font-semibold text-text-2">{issueStatusLabel(column)}</span>
                    <Badge>{columnIssues.length}</Badge>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {columnIssues.map(issue => (
                      <div
                        key={issue.id}
                        draggable
                        onDragStart={event => event.dataTransfer.setData("text/issue-id", issue.id)}
                        className="cursor-grab rounded-lg border border-border bg-surface p-3 shadow-1 transition hover:border-border-strong"
                      >
                        <Link className="block text-sm font-medium text-text hover:text-primary-text" to={scope.scopedPath(`/work/issues/${issue.id}`)}>{issue.title}</Link>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-4">
                          <span className="font-mono">{issue.identifier || issue.id.slice(0, 8)}</span>
                          <Badge tone={priorityTone(issue.priority)}>{priorityLabel(issue.priority)}</Badge>
                        </div>
                      </div>
                    ))}
                    {!columnIssues.length && <p className="px-1 py-3 text-center text-xs text-text-4">暂无事项</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : layout === "grouped" ? (
          <div className="space-y-5" data-testid="issues-grouped">
            {groups.map(group => (
              <Card key={group.key}>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <span className="text-sm font-semibold text-text">{group.label}</span>
                  <Badge>{group.issues.length}</Badge>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {group.issues.map(issue => (
                      <IssueRow key={issue.id} issue={issue} identities={identities} scopePath={scope.scopedPath} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden" data-testid="issues-list">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-text-3">
              <span>{items.length} 条事项</span>
              <span className="hidden sm:block">自动更新</span>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-4">
                  <tr>
                    <th className="px-5 py-3">事项</th>
                    <th className="px-4 py-3">优先级</th>
                    <th className="px-4 py-3">负责人 / 目标</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="w-12 px-4 py-3"><span className="sr-only">打开</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((issue) => (
                    <tr key={issue.id} className="group transition hover:bg-hover">
                      <td className="px-5 py-4">
                        <Link className="font-medium text-text group-hover:text-primary-text" to={scope.scopedPath(`/work/issues/${issue.id}`)}>
                          {issue.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-text-4">
                          <span>{issue.identifier || issue.id.slice(0, 8)}</span>
                          {issue.kind === "endpoint_job" && <Badge>端点任务</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-4"><Badge tone={priorityTone(issue.priority)}>{priorityLabel(issue.priority)}</Badge></td>
                      <td className="max-w-52 truncate px-4 py-4 text-text-2"><IssueOwnerOrTarget issue={issue} identities={identities} /></td>
                      <td className="px-4 py-4"><WorkStatusBadge status={issue.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-text-3">{formatRelative(issue.updatedAt)}</td>
                      <td className="px-4 py-4 text-text-4"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {items.map((issue) => (
                <Link key={issue.id} to={scope.scopedPath(`/work/issues/${issue.id}`)} className="flex gap-3 px-4 py-4 hover:bg-hover">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-4">
                    <CircleDotDashed className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{issue.title}</div>
                    <div className="mt-1 truncate text-xs text-text-3"><IssueOwnerOrTarget issue={issue} identities={identities} /> · {formatRelative(issue.updatedAt)}</div>
                    <div className="mt-2 flex items-center gap-2"><WorkStatusBadge status={issue.status} /><Badge tone={priorityTone(issue.priority)}>{priorityLabel(issue.priority)}</Badge></div>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-text-4" />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </AsyncState>

      <ConfirmDialog
        open={!!pendingTransition}
        onOpenChange={open => { if (!open) { setPendingTransition(undefined); transition.reset(); } }}
        title={pendingTransition ? `将「${pendingTransition.issue.title}」变更为「${issueStatusLabel(pendingTransition.next)}」？` : ""}
        description="看板拖拽变更状态需要二次确认（PRD 5.10.2）。确认后按状态机提交。"
        confirmLabel="确认变更"
        cancelLabel="取消"
        busy={transition.isPending}
        onConfirm={() => pendingTransition && transition.mutate(pendingTransition)}
      />
      {transition.isError && pendingTransition && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-text">
          {transition.error instanceof Error ? transition.error.message : "状态变更失败，请刷新后重试。"}
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={(nextOpen) => nextOpen ? setParam("new", "1") : closeCreate()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>新建事项</DialogTitle>
            <DialogDescription>写下目标、上下文，以及第一位负责人或执行工作流。</DialogDescription>
          </DialogHeader>
          <DialogBody>
          <label className="grid gap-2 text-sm font-medium text-text-2">分享范围<select aria-label="新事项分享范围" className="h-9 rounded-md border border-border bg-surface px-2 text-text" value={accessMode} onChange={e => setAccessMode(e.target.value as typeof accessMode)}><option value="private">私有 — 仅自己可见</option><option value="namespace">命名空间成员可见</option></select><span className="text-xs font-normal text-text-3">执行记录与附件遵循同一范围，创建后可再添加协作者。</span></label>
            <form onSubmit={submit} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium text-text-2">
                标题
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="需要完成什么？" required autoFocus />
              </label>
              <label className="block space-y-2 text-sm font-medium text-text-2">
                描述
                <Textarea className="min-h-32" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充背景、约束或验收说明…" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium text-text-2">
                  优先级
                  <select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium text-text-2">
                  负责人 / 执行类型
                  <select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text" value={assigneeType} onChange={(event) => { setAssigneeType(event.target.value); setAssigneeRef(""); }}>
                    <option value="agent">智能体</option>
                    <option value="team">团队</option>
                    <option value="workflow">工作流</option>
                    <option value="human">成员</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-2 text-sm font-medium text-text-2">
                {assigneeType === "workflow" ? "执行工作流" : "负责人"} <span className="font-normal text-text-4">（可选）</span>
                {assigneeType === "agent" ? (
                  <AgentPicker value={assigneeRef} onChange={setAssigneeRef} emptyLabel="选择智能体" aria-label="事项负责人智能体" />
                ) : assigneeType === "team" ? (
                  <NamedResourcePicker
                    value={assigneeRef}
                    onChange={setAssigneeRef}
                    options={teamOptions}
                    resourceLabel="团队"
                    loading={teams.isLoading}
                    error={teams.isError}
                    emptyLabel="选择团队"
                    aria-label="事项负责人团队"
                  />
                ) : assigneeType === "workflow" ? (
                  <NamedResourcePicker
                    value={assigneeRef}
                    onChange={setAssigneeRef}
                    options={workflowOptions}
                    resourceLabel="工作流"
                    loading={workflows.isLoading}
                    error={workflows.isError}
                    emptyLabel="选择工作流"
                    aria-label="事项执行工作流"
                  />
                ) : (
                  <Input value={assigneeRef} onChange={(event) => setAssigneeRef(event.target.value)} placeholder={`${assigneeType} 引用`} />
                )}
                {assigneeType === "workflow" && (
                  <span className="block text-xs font-normal text-text-3">
                    将启动最新发布的修订版本，并记录为该事项的执行目标。
                  </span>
                )}
              </label>
              {create.isError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">{create.error instanceof Error ? create.error.message : "事项创建失败，请检查字段后重试。"}</p>}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={closeCreate}>取消</Button>
                <Button type="submit" disabled={create.isPending || !title.trim()}>
                  {create.isPending ? "创建中…" : "创建事项"}
                </Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function IssueRow({ issue, identities, scopePath }: { issue: Issue; identities: EntityIdentityMap; scopePath: (path: string) => string }) {
  return (
    <Link to={scopePath(`/work/issues/${issue.id}`)} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-hover">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{issue.title}</div>
        <div className="mt-1 font-mono text-[11px] text-text-4">{issue.identifier || issue.id.slice(0, 8)}</div>
      </div>
      <IssueOwnerOrTarget issue={issue} identities={identities} />
      <Badge tone={priorityTone(issue.priority)}>{priorityLabel(issue.priority)}</Badge>
      <WorkStatusBadge status={issue.status} />
      <span className="hidden whitespace-nowrap text-xs text-text-4 sm:block">{formatRelative(issue.updatedAt)}</span>
    </Link>
  );
}
