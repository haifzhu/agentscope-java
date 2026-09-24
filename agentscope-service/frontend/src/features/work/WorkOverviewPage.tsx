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
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Bot, CircleDotDashed, Plus, TriangleAlert, UsersRound, Workflow } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { listIssues, listTeams } from "@/api/collaboration";
import { listRuns } from "@/api/orchestration";
import { getRoles } from "@/api/auth";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { Page, PageHeader } from "@/components/Page";
import { AsyncState, type AsyncStatus } from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/ui/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { EntityIdentityText, useEntityIdentities } from "@/components/EntityIdentity";
import { fetchOverviewTimeseries } from "@/features/operate/api";
import { formatRelative } from "@/lib/format";

import { WorkStatusBadge } from "./WorkSurface";
import { rankedAttention, runAlertsOf, runHealthOf } from "./workbenchModel";

/** 指标卡的目标列表页必须带筛选参数（PRD 5.3：指标卡带筛选跳转）。 */
export const METRIC_LINKS = {
  attention: "/work/inbox?view=attention",
  openIssues: "/work/issues?status=open",
  teams: "/agent-center/teams",
  running: "/work/executions?view=running",
  failed: "/work/executions?view=failed",
} as const;

export function canUseAgentCenter(roles: string[]): boolean {
  const lowered = roles.map((role) => role.toLowerCase());
  return lowered.includes("admin") || lowered.includes("operator") || lowered.includes("agent_developer");
}

/** 运行健康度、异常提醒与 Token 趋势仅运维/管理员可见（PRD 5.3.3）。 */
export function canSeeOperations(roles: string[]): boolean {
  const lowered = roles.map((role) => role.toLowerCase());
  return lowered.includes("admin") || lowered.includes("operator");
}

export function asyncStatusOf(state: { isLoading: boolean; isError: boolean; isEmpty: boolean }): AsyncStatus {
  if (state.isLoading) return "loading";
  if (state.isError) return "error";
  return state.isEmpty ? "empty" : "ready";
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

export function formatTokens(value: number | null): string {
  if (value == null) return "—";
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export default function WorkOverviewPage() {
  const scope = useControlPlaneScope();
  const navigate = useNavigate();
  const roles = getRoles();
  const agentCenterAllowed = canUseAgentCenter(roles);
  const operationsVisible = canSeeOperations(roles);
  const [now] = useState(() => Date.now());
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
  // 无运维权限时区块整体不渲染，因此也不发起对应的运维查询（PRD 5.3.3）。
  const runs = useQuery({
    queryKey: ["overview-runs", scope.tenant, scope.namespace],
    queryFn: () => listRuns(scope.tenant, scope.namespace),
    enabled: operationsVisible,
    refetchInterval: 7500,
  });
  const tokens = useQuery({
    queryKey: ["overview-token-trend", scope.tenant, scope.namespace],
    queryFn: () => fetchOverviewTimeseries({ metric: "tokens", bucket: "hour" }),
    enabled: operationsVisible,
    refetchInterval: 60_000,
  });
  const issueItems = useMemo(() => issues.data?.items || [], [issues.data?.items]);
  const runItems = useMemo(() => runs.data?.runs || [], [runs.data?.runs]);
  const health = useMemo(() => runHealthOf(runItems), [runItems]);
  const alerts = useMemo(() => runAlertsOf(runItems, now), [runItems, now]);
  const attention = useMemo(() => rankedAttention(issueItems, 6), [issueItems]);
  const tokenPoints = (tokens.data?.points || []).map(point => point.totalTokens || 0);
  const identities = useEntityIdentities(issueItems.map(issue => ({ type: issue.assigneeType, ref: issue.assigneeRef })));

  const cards = operationsVisible
    ? [
        {
          key: "attention",
          label: "需要我处理",
          value: issues.isLoading ? "—" : attention.length,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.attention)),
        },
        {
          key: "open-issues",
          label: "待办事项",
          value: issues.isLoading ? "—" : issueItems.filter(issue => !["done", "cancelled"].includes(issue.status)).length,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.openIssues)),
        },
        {
          key: "running",
          label: "进行中执行",
          value: runs.isLoading ? "—" : health.running,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.running)),
        },
        {
          key: "failed",
          label: "失败执行",
          value: runs.isLoading ? "—" : health.failed,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.failed)),
        },
        {
          key: "duration",
          label: "平均耗时",
          value: runs.isLoading ? "—" : formatDuration(health.averageDurationMs),
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.running)),
        },
        {
          key: "tokens",
          label: "Token 消耗",
          value: runs.isLoading ? "—" : formatTokens(health.totalTokens),
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.running)),
        },
      ]
    : [
        {
          key: "attention",
          label: "需要我处理",
          value: issues.isLoading ? "—" : attention.length,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.attention)),
        },
        {
          key: "open-issues",
          label: "待办事项",
          value: issues.isLoading ? "—" : issueItems.filter(issue => !["done", "cancelled"].includes(issue.status)).length,
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.openIssues)),
        },
        // 无智能体中心权限时不渲染协作团队卡（PRD 5.3.3）。
        ...(agentCenterAllowed ? [{
          key: "teams",
          label: "协作团队",
          value: teams.isLoading ? "—" : (teams.data?.items.length ?? 0),
          onClick: () => navigate(scope.scopedPath(METRIC_LINKS.teams)),
        }] : []),
      ];

  // 快捷入口按权限显隐（PRD 5.3.1）。
  const quickLinks = [
    { key: "issue", label: "新建事项", to: "/work/issues?new=1", icon: CircleDotDashed },
    ...(agentCenterAllowed ? [
      { key: "agent", label: "新建智能体", to: "/agent-center/agents/new", icon: Bot },
      { key: "team", label: "新建团队", to: "/agent-center/teams", icon: UsersRound },
      { key: "workflow", label: "新建工作流", to: "/agent-center/workflows", icon: Workflow },
    ] : []),
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

      <section aria-label="快捷入口" className="flex flex-wrap gap-2">
        {quickLinks.map(link => {
          const Icon = link.icon;
          return (
            <Button key={link.key} variant="outline" size="sm" asChild>
              <Link to={scope.scopedPath(link.to)}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {link.label}
              </Link>
            </Button>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text">需要我处理</h2>
              <p className="mt-1 text-sm text-text-3">
                {attention.length ? `${attention.length} 条待处理` : "待办已清空"}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={scope.scopedPath("/work/inbox")}>
                打开待办中心 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <AsyncState
              status={asyncStatusOf({ isLoading: issues.isLoading, isError: issues.isError, isEmpty: attention.length === 0 })}
              resource="待处理事项"
              emptyDescription="新的提及、阻塞和审批会出现在这里。"
              onRetry={() => issues.refetch()}
            >
              <ul className="divide-y divide-border">
                {attention.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={scope.scopedPath(entry.href)}
                      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-hover"
                    >
                      <Badge tone={entry.label === "被阻塞" ? "danger" : entry.label === "待验收" ? "warning" : "info"}>{entry.label}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{entry.title}</span>
                      <span className="hidden shrink-0 text-xs text-text-4 sm:block">{formatRelative(entry.at)}</span>
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

      {/* 无运维权限时以下区块整体不渲染（PRD 5.3.3）。 */}
      {operationsVisible && (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-text">运行健康度</h2>
                  <p className="mt-1 text-sm text-text-3">进行中、失败、平均耗时与 Token 消耗</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={scope.scopedPath("/work/executions")}>
                    执行记录 <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <AsyncState
                  status={asyncStatusOf({ isLoading: runs.isLoading, isError: runs.isError, isEmpty: runItems.length === 0 })}
                  resource="执行记录"
                  emptyDescription="指派一个事项、调用一次 API 端点，或启动一个工作流。"
                  emptyAction={
                    <Button size="sm" asChild>
                      <Link to={scope.scopedPath("/agent-center/agents/new")}>创建第一个智能体</Link>
                    </Button>
                  }
                  onRetry={() => runs.refetch()}
                >
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { key: "running", label: "进行中", value: String(health.running) },
                      { key: "failed", label: "失败", value: String(health.failed) },
                      { key: "duration", label: "平均耗时", value: formatDuration(health.averageDurationMs) },
                      { key: "tokens", label: "Token", value: formatTokens(health.totalTokens) },
                    ].map(item => (
                      <div key={item.key} className="rounded-xl border border-border bg-surface-2 p-3">
                        <dt className="text-xs text-text-3">{item.label}</dt>
                        <dd className="mt-1 text-lg font-semibold text-text">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </AsyncState>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-text">异常提醒</h2>
                  <p className="mt-1 text-sm text-text-3">失败与卡住的执行，点击直达详情</p>
                </div>
                {!!alerts.length && <Badge tone="danger">{alerts.length}</Badge>}
              </CardHeader>
              <CardContent className="p-0">
                <AsyncState
                  status={asyncStatusOf({ isLoading: runs.isLoading, isError: runs.isError, isEmpty: alerts.length === 0 })}
                  resource="异常"
                  emptyDescription="当前没有失败或卡住的执行。"
                  onRetry={() => runs.refetch()}
                >
                  <ul className="divide-y divide-border">
                    {alerts.map(alert => (
                      <li key={alert.id}>
                        <Link to={scope.scopedPath(alert.href)} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-hover">
                          <TriangleAlert className={alert.kind === "failed" ? "mt-0.5 h-4 w-4 shrink-0 text-danger-text" : "mt-0.5 h-4 w-4 shrink-0 text-warning-text"} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-text">{alert.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-text-3">{alert.detail}</span>
                          </span>
                          <span className="shrink-0 text-xs text-text-4">{formatRelative(alert.at)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AsyncState>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-[15px] font-semibold text-text">Token 趋势</h2>
              <p className="mt-1 text-sm text-text-3">最近 24 小时每小时用量（非累计快照）</p>
            </CardHeader>
            <CardContent>
              <AsyncState
                status={asyncStatusOf({ isLoading: tokens.isLoading, isError: tokens.isError, isEmpty: tokenPoints.length === 0 })}
                resource="Token 用量"
                emptyDescription="还没有 Token 采样数据。"
                onRetry={() => tokens.refetch()}
              >
                <LineChart
                  series={[{ name: "Token", points: tokenPoints }]}
                  ariaLabel="最近 24 小时 Token 用量折线图"
                  className="h-56"
                />
              </AsyncState>
            </CardContent>
          </Card>
        </>
      )}

      {!operationsVisible && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-3">
          <Activity className="h-4 w-4" aria-hidden="true" />
          运行健康度、异常提醒与 Token 趋势需要运维或管理员权限。
        </p>
      )}
    </Page>
  );
}
