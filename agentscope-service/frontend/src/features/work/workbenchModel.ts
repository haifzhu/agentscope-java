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

import type { AgentTask, Issue } from "@/api/collaboration";
import type { ExecutionAttempt, OrchestrationRun } from "@/api/orchestration";

const TERMINAL_RUN_STATES = ["succeeded", "partial_succeeded", "failed", "cancelled"];

export function isTerminalRun(state: string): boolean {
  return TERMINAL_RUN_STATES.includes(state);
}

/** 运行健康度（PRD 5.3.1）：进行中、失败、平均耗时、Token。 */
export interface RunHealth {
  running: number;
  failed: number;
  averageDurationMs: number | null;
  totalTokens: number | null;
}

function usageTokens(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const value = (usage as Record<string, unknown>).totalTokens;
  return typeof value === "number" ? value : null;
}

function durationOf(run: OrchestrationRun): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  const started = new Date(run.startedAt).getTime();
  const completed = new Date(run.completedAt).getTime();
  return Number.isFinite(started) && Number.isFinite(completed) && completed >= started ? completed - started : null;
}

export function runHealthOf(runs: OrchestrationRun[]): RunHealth {
  const running = runs.filter(run => !isTerminalRun(run.state)).length;
  const failed = runs.filter(run => run.state === "failed").length;
  const durations = runs.map(durationOf).filter((value): value is number => value != null);
  const tokens = runs.map(run => usageTokens(run.usage)).filter((value): value is number => value != null);
  return {
    running,
    failed,
    averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    totalTokens: tokens.length ? tokens.reduce((sum, value) => sum + value, 0) : null,
  };
}

/** 异常提醒（PRD 5.3.1）：最近失败的执行、卡住的执行、失败的投递。 */
export interface RunAlert {
  id: string;
  kind: "failed" | "stuck";
  title: string;
  detail: string;
  at: string;
  href: string;
  issueId?: string;
}

const STUCK_AFTER_MS = 15 * 60 * 1000;

export function runAlertsOf(runs: OrchestrationRun[], now: number): RunAlert[] {
  const alerts: RunAlert[] = [];
  for (const run of runs) {
    if (run.state === "failed") {
      alerts.push({
        id: `${run.id}:failed`,
        kind: "failed",
        title: "执行失败",
        detail: run.failureMessage || run.failureCode || `执行 ${run.id.slice(0, 8)} 失败`,
        at: run.completedAt || run.createdAt,
        href: `/work/executions/${run.id}`,
        issueId: run.rootIssueId,
      });
      continue;
    }
    if (!isTerminalRun(run.state) && run.startedAt) {
      const started = new Date(run.startedAt).getTime();
      if (Number.isFinite(started) && now - started > STUCK_AFTER_MS) {
        alerts.push({
          id: `${run.id}:stuck`,
          kind: "stuck",
          title: "执行长时间无进展",
          detail: run.waitReason || `已等待 ${Math.round((now - started) / 60000)} 分钟`,
          at: run.startedAt,
          href: `/work/executions/${run.id}`,
          issueId: run.rootIssueId,
        });
      }
    }
  }
  return alerts.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).slice(0, 8);
}

/** 「需要我处理」（PRD 5.3.1）：按紧急度排序的待处理事项。 */
export interface AttentionEntry {
  id: string;
  label: string;
  title: string;
  at: string;
  href: string;
}

const ATTENTION_WEIGHT: Record<string, number> = { blocked: 0, in_review: 1, todo: 2, open: 2, in_progress: 3, backlog: 4 };

export function rankedAttention(issues: Issue[], limit = 6): AttentionEntry[] {
  return issues
    .filter(issue => !issue.archivedAt && !["done", "cancelled"].includes(issue.status))
    .map(issue => ({
      id: issue.id,
      label: issue.status === "blocked" ? "被阻塞" : issue.status === "in_review" ? "待验收" : "待处理",
      title: issue.title,
      at: issue.updatedAt,
      href: `/work/issues/${issue.id}`,
    }))
    .sort((left, right) => {
      const leftRank = ATTENTION_WEIGHT[issues.find(issue => issue.id === left.id)?.status || ""] ?? 5;
      const rightRank = ATTENTION_WEIGHT[issues.find(issue => issue.id === right.id)?.status || ""] ?? 5;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return new Date(right.at).getTime() - new Date(left.at).getTime();
    })
    .slice(0, limit);
}

/** 失败节点在折叠态即高亮的判定（PRD 5.5.3），供工作台与执行记录复用。 */
export function hasFailedAttempt(attempts: ExecutionAttempt[]): boolean {
  return attempts.some(attempt => attempt.state === "failed" || attempt.failureCode != null);
}

export function failedTasksOf(tasks: AgentTask[]): AgentTask[] {
  return tasks.filter(task => task.status === "failed" || task.errorCode != null);
}
