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

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  CircleDotDashed,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { listIssueActivity, listIssues, type Issue, type IssueActivity } from "@/api/collaboration";
import { listDeadLetters, replayDeadLetter } from "@/api/operations";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { Button } from "@/components/ui/button";
import { entityDisplayName, type EntityIdentityMap, useEntityIdentities } from "@/components/EntityIdentity";
import { Input } from "@/components/ui/input";
import {
  WorkEmpty,
  WorkLoadingRows,
  WorkPage,
  WorkPageHeader,
  WorkPanel,
  WorkPanelHeader,
} from "./WorkSurface";
import { formatRelative } from "@/lib/format";
import { issueStatusLabel } from "@/features/issues/issueStatus";
import { getRoles } from "@/lib/auth";

type ActivityWithIssue = IssueActivity & { issue: Issue };

function actionIcon(action: string) {
  if (action.startsWith("comment.")) return MessageSquare;
  if (action.includes("assigned")) return UserPlus;
  if (action.includes("completed") || action.includes("accepted")) return CheckCircle2;
  if (action.includes("archived")) return Archive;
  if (action.includes("task")) return Bot;
  if (action.includes("updated") || action.includes("status")) return Pencil;
  return CircleDotDashed;
}

function actorName(activity: IssueActivity, identities: EntityIdentityMap) {
  return entityDisplayName(identities, activity.actor.type, activity.actor.ref);
}

function activityText(activity: IssueActivity, identities: EntityIdentityMap) {
  const details = activity.details || {};
  switch (activity.action) {
    case "issue.created": return "创建了事项";
    case "issue.updated": return "更新了事项详情";
    case "issue.assigned": return `将事项指派给 ${entityDisplayName(identities, activity.objectType, activity.objectRef)}`;
    case "issue.status_changed": return `把状态从「${issueStatusLabel(String(details.from || ""))}」改为「${issueStatusLabel(String(details.to || ""))}」`;
    case "issue.archived": return "归档了事项";
    case "comment.created": return "发表了评论";
    case "comment.resolved": return "解决了讨论串";
    case "comment.unresolved": return "重新打开了讨论串";
    case "comment.updated": return "编辑了评论";
    case "comment.deleted": return "删除了评论";
    case "agent_task.completed": return "完成了一项智能体任务";
    default: return activity.action.replace(/[._]/g, " ");
  }
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export default function WorkActivityPage() {
  const scope = useControlPlaneScope();
  const queryClient = useQueryClient();
  const roles = getRoles().map((role) => role.toLowerCase());
  const canOperate = roles.includes("admin") || roles.includes("operator");
  const [search, setSearch] = useState("");
  const feed = useQuery({
    queryKey: ["work-activity", scope.tenant, scope.namespace],
    queryFn: async () => {
      const issueResponse = await listIssues(scope.tenant, scope.namespace);
      const recentIssues = issueResponse.items.slice(0, 30);
      const activityResponses = await Promise.all(recentIssues.map(async (issue) => {
        try {
          const response = await listIssueActivity(issue.id);
          return response.items.map((activity) => ({ ...activity, issueId: activity.issueId || issue.id, issue }));
        } catch {
          return [] as ActivityWithIssue[];
        }
      }));
      return activityResponses.flat().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },
    refetchInterval: 10000,
  });
  const deadLetters = useQuery({
    queryKey: ["dead-letters", scope.tenant, scope.namespace],
    queryFn: () => listDeadLetters(scope.tenant, scope.namespace),
    enabled: canOperate,
  });
  const replay = useMutation({
    mutationFn: replayDeadLetter,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dead-letters"] }),
  });
  const identities = useEntityIdentities((feed.data || []).flatMap((activity) => [
    { type: activity.actor.type, ref: activity.actor.ref },
    { type: activity.objectType, ref: activity.objectRef },
  ]));
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return feed.data || [];
    return (feed.data || []).filter((activity) => [
      activity.issue.title,
      activity.issue.identifier,
      activity.action,
      actorName(activity, identities),
      activityText(activity, identities),
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [feed.data, identities, search]);
  const groups = useMemo(() => {
    const result: Array<{ label: string; items: ActivityWithIssue[] }> = [];
    for (const activity of filtered) {
      const label = dayLabel(activity.createdAt);
      const current = result[result.length - 1];
      if (current?.label === label) current.items.push(activity);
      else result.push({ label, items: [activity] });
    }
    return result;
  }, [filtered]);

  return (
    <WorkPage>
      <WorkPageHeader
        title="工作动态"
        description="按时间顺序查看工作变更、决策、评论与智能体执行。"
        actions={
          <Button variant="outline" onClick={() => void feed.refetch()} disabled={feed.isFetching}>
            <RefreshCw className={feed.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> 刷新
          </Button>
        }
      />

      <div className="flex justify-end">
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-4" />
          <Input className="pl-9 shadow-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索动态" />
        </label>
      </div>

      {canOperate && !!deadLetters.data?.items.length && (
        <WorkPanel>
          <WorkPanelHeader
            title="投递失败"
            description="自动重试耗尽的控制面事件。修复底层问题后可重放。"
          />
          <div className="divide-y divide-border">
            {deadLetters.data.items.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-text">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text">{event.eventType}</div>
                  <div className="truncate text-xs text-text-3">
                    {event.aggregateType}/{event.aggregateId} · 已尝试 {event.attempts} 次 · {event.lastError}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={replay.isPending} onClick={() => replay.mutate(event.id)}>
                  重放
                </Button>
              </div>
            ))}
          </div>
        </WorkPanel>
      )}

      <WorkPanel>
        <WorkPanelHeader
          title="工作区时间线"
          description={feed.isLoading ? "正在加载动态…" : `近期事项共 ${filtered.length} 条动态`}
        />
        {feed.isLoading ? (
          <WorkLoadingRows rows={7} />
        ) : feed.isError ? (
          <WorkEmpty title="动态加载失败" description="请检查控制面连接后重试。" />
        ) : groups.length ? (
          <div>
            {groups.map((group) => (
              <section key={group.label}>
                <div className="border-y border-border bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-4 first:border-t-0">
                  {group.label}
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((activity) => {
                    const Icon = actionIcon(activity.action);
                    return (
                      <Link
                        key={activity.id}
                        to={scope.scopedPath(`/work/issues/${activity.issue.id}`)}
                        className="group flex gap-3 px-5 py-4 transition hover:bg-hover"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-3">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-5 text-text-2">
                            <strong className="font-semibold text-text">{actorName(activity, identities)}</strong> {activityText(activity, identities)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-4">
                            <span className="truncate font-medium text-text-3 group-hover:text-primary-text">{activity.issue.title}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{activity.issue.identifier || activity.issue.id.slice(0, 8)}</span>
                          </div>
                        </div>
                        <time className="shrink-0 text-xs text-text-4">{formatRelative(activity.createdAt)}</time>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <WorkEmpty
            title={search ? "没有匹配的动态" : "暂无动态"}
            description={search ? "换个关键词试试。" : "事项更新、讨论与智能体结果会在这里呈现。"}
          />
        )}
      </WorkPanel>
    </WorkPage>
  );
}
