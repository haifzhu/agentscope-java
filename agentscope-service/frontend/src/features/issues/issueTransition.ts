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

import {
  acceptIssue,
  archiveIssue,
  rejectIssue,
  reopenIssue,
  transitionIssue,
  type Issue,
} from "@/api/collaboration";

/** 看板列（PRD 5.10.2：按 7 个状态分列；backlog 归入待办列）。 */
export const KANBAN_COLUMNS = ["todo", "open", "in_progress", "in_review", "blocked", "done", "cancelled"] as const;

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  backlog: "待办",
  todo: "待办",
  open: "已开放",
  in_progress: "进行中",
  in_review: "评审中",
  blocked: "被阻塞",
  done: "已完成",
  cancelled: "已取消",
};

export function issueStatusLabel(status: string): string {
  return ISSUE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

/**
 * 状态机合法流转表（PRD 5.10.3：按合法路径变更，非法流转在界面上不可选）。
 * 语义与后端端点对应：in_review→done 走 accept，in_review→in_progress 走
 * reject，done→in_progress 走 reopen；其余走 transition。
 */
export const ISSUE_TRANSITIONS: Record<string, readonly string[]> = {
  backlog: ["todo", "open", "in_progress", "cancelled"],
  todo: ["open", "in_progress", "in_review", "cancelled"],
  open: ["in_progress", "in_review", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "todo", "cancelled"],
  in_review: ["done", "in_progress"],
  blocked: ["in_progress", "todo", "open", "cancelled"],
  done: ["in_progress"],
  cancelled: ["open"],
};

export function allowedIssueTransitions(status: string): readonly string[] {
  return ISSUE_TRANSITIONS[status] ?? [];
}

export function isLegalIssueTransition(from: string, to: string): boolean {
  return from !== to && allowedIssueTransitions(from).includes(to);
}

/** 看板列归属：backlog 归入 todo 列。 */
export function kanbanColumnOf(status: string): string {
  return status === "backlog" ? "todo" : status;
}

/**
 * 按状态机提交流转：把目标状态映射到正确的后端端点。
 * 非法目标直接拒绝，不发起请求。
 */
export async function submitIssueTransition(issue: Pick<Issue, "id" | "status" | "version">, next: string): Promise<{ issue: Issue }> {
  if (next === issue.status) throw new Error("目标状态与当前状态相同");
  if (!isLegalIssueTransition(issue.status, next)) {
    throw new Error(`当前状态不允许变更为「${issueStatusLabel(next)}」`);
  }
  if (next === "done" && issue.status === "in_review") return acceptIssue(issue.id, issue.version);
  if (next === "in_progress" && issue.status === "in_review") return rejectIssue(issue.id, issue.version, "看板退回，需修改后重新送审");
  if (next === "in_progress" && issue.status === "done") return reopenIssue(issue.id, issue.version);
  if (next === "archive") return archiveIssue(issue.id, issue.version);
  return transitionIssue(issue.id, next, issue.version);
}
