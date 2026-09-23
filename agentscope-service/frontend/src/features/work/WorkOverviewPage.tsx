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

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDotDashed, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { getInboxSummary, listInbox, listIssues, listTeams } from "@/api/collaboration";
import { getRoles } from "@/api/auth";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { Page, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { AsyncState, type AsyncStatus } from "@/components/ui/async-state";
import { EntityIdentityText, useEntityIdentities } from "@/components/EntityIdentity";
import { formatRelative } from "@/lib/format";

import { WorkStatusBadge } from "./WorkSurface";

/** 指标卡的目标列表页必须带筛选参数（PRD 5.3：指标卡带筛选跳转）。 */
export const METRIC_LINKS = {
  attention: "/work/inbox?view=attention",
  openIssues: "/work/issues?status=open",
  teams: "/agent-center/teams",
} as const;

export function canUseAgentCenter(roles: string[]): boolean {
  const lowered = roles.map((role) => role.toLowerCase());
  return lowered.includes("admin") || lowered.includes("operator") || lowered.includes("agent_developer");
}

export function asyncStatusOf(state: { isLoading: boolean; isError: boolean; isEmpty: boolean }): AsyncStatus {
  if (state.isLoading) return "loading";
  if (state.isError) return "error";
  return state.isEmpty ? "empty" : "ready";
}

export default function WorkOverviewPage() {
  const scope = useControlPlaneScope();
  const navigate = useNavigate();
  const agentCenterAllowed = canUseAgentCenter(getRoles());
  const issues = useQuery({
    queryKey: ["issues", scope.tenant, scope.namespace, "work-overview"],
    queryFn: () => listIssues(scope.tenant, scope.namespace),
    refetchInterval: 7500,
  });
  const teams = useQuery({
    queryKey: ["teams", scope.tenant, scope.namespace, "work-overview"],
    queryFn: () => listTeams(scope.tenant, scope.namespace),
    enabled: agentCenterAllowed,
  });
  const inbox = useQuery({
    queryKey: ["inbox", scope.tenant, scope.namespace, "work-overview"],
    queryFn: () => listInbox(scope.tenant, scope.namespace, { view: "attention", limit: 6 }),
    refetchInterval: 7500,
  });
  const inboxSummary = useQuery({
    queryKey: ["inbox-summary", scope.tenant, scope.namespace],
    queryFn: () => getInboxSummary(scope.tenant, scope.namespace),
    refetchInterval: 7500,
  });
  const attentionCount = inboxSummary.data?.summary.attentionTotal ?? 0;
  const issueItems = issues.data?.items || [];
  const openIssueCount = issueItems.filter((issue) => !["done", "cancelled"].includes(issue.status)).length;
  const unreadItems = (inbox.data?.items || []).filter((item) => !item.read || item.needsAction);
  const identities = useEntityIdentities([
    ...issueItems.map((issue) => ({ type: issue.assigneeType, ref: issue.assigneeRef })),
    ...unreadItems.map((item) => ({ type: item.actor.type, ref: item.actor.ref })),
  ]);

  // 首屏第一张卡是「需要我处理」（PRD 5.3），指标卡点击跳转到带筛选的列表页。
  const cards = [
    {
      key: "attention",
      label: "需要我处理",
      value: inbox.isLoading ? "—" : attentionCount,
      onClick: () => navigate(scope.scopedPath(METRIC_LINKS.attention)),
    },
    {
      key: "open-issues",
      label: "待办事项",
      value: issues.isLoading ? "—" : openIssueCount,
      onClick: () => navigate(scope.scopedPath(METRIC_LINKS.openIssues)),
    },
    // 无智能体中心权限时不渲染该卡（PRD 5.3：无权限时区块不渲染）
    ...(agentCenterAllowed
      ? [{
          key: "teams",
          label: "协作团队",
          value: teams.isLoading ? "—" : (teams.data?.items.length ?? 0),
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.teams)),
        }]
      : []),
  ];

  return (
    <Page>
      <PageHeader
        title="工作台"
        description="跟踪持久化工作、智能体执行与需要你决策的事项。"
        actions={
          <Button asChild>
            <Link to={scope.scopedPath("/work/issues?new=1")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> 新建事项
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MetricCard key={card.key} label={card.label} value={card.value} onClick={card.onClick} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text">需要我处理</h2>
              <p className="mt-1 text-sm text-text-3">
                {attentionCount ? `${attentionCount} 条消息待处理` : "已全部处理完毕"}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={scope.scopedPath("/work/inbox")}>
                打开收件箱 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <AsyncState
              status={asyncStatusOf({ isLoading: inbox.isLoading, isError: inbox.isError, isEmpty: unreadItems.length === 0 })}
              resource="待处理消息"
              emptyDescription="提及、被阻塞的工作和审批请求会显示在这里。"
              onRetry={() => inbox.refetch()}
            >
              <ul className="divide-y divide-border">
                {unreadItems.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={scope.scopedPath(`/work/inbox?item=${encodeURIComponent(item.id)}`)}
                      className="flex gap-3 px-5 py-4 transition-colors hover:bg-hover"
                    >
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text">{item.title}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-3">{item.body || item.type}</p>
                        <div className="mt-1.5 text-[11px] text-text-4">{formatRelative(item.createdAt)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text">最近事项</h2>
              <p className="mt-1 text-sm text-text-3">
                {scope.selectorVisible ? "本命名空间最近的进展" : "最近的进展"}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={scope.scopedPath("/work/issues")}>
                查看全部 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <AsyncState
              status={asyncStatusOf({ isLoading: issues.isLoading, isError: issues.isError, isEmpty: issueItems.length === 0 })}
              resource="事项"
              emptyDescription="创建第一条事项，开始一个持久化的工作线程。"
              emptyAction={
                <Button size="sm" asChild>
                  <Link to={scope.scopedPath("/work/issues?new=1")}>创建事项</Link>
                </Button>
              }
              onRetry={() => issues.refetch()}
            >
              <ul className="divide-y divide-border">
                {issueItems.slice(0, 8).map((issue) => (
                  <li key={issue.id}>
                    <Link
                      to={scope.scopedPath(`/work/issues/${issue.id}`)}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-hover"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-3">
                        <CircleDotDashed className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text group-hover:text-primary-text">
                          {issue.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-text-3">
                          <span className="font-mono">{issue.identifier || issue.id.slice(0, 8)}</span>
                          <span aria-hidden="true">·</span>
                          {issue.assigneeRef ? (
                            <EntityIdentityText identities={identities} type={issue.assigneeType} entityRef={issue.assigneeRef} />
                          ) : (
                            <span>未分配</span>
                          )}
                        </div>
                      </div>
                      <span className="hidden text-xs text-text-4 sm:block">{formatRelative(issue.updatedAt)}</span>
                      <WorkStatusBadge status={issue.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
