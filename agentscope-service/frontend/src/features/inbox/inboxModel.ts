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

import type { InboxItem } from "@/api/collaboration";

/** 待办中心消息类型（PRD 5.4：除审批外的 15 类 + 审批本身）。 */
export const INBOX_TYPES: Record<string, string> = {
  approval: "审批请求", review_request: "评审请求", issue_blocked: "被阻塞的工作",
  mention: "提及", reply: "回复", result: "智能体结果", issue_update: "事项更新",
  issue_completed: "已完成", issue_cancelled: "已取消", issue_reopened: "已恢复",
  issue_assigned: "指派", routing_blocked: "路由告警", agent_task_failed: "执行失败",
  dead_letter: "投递失败", outbox_dead_letter: "事件投递告警", issue_sla_breached: "超期工作",
};

export const INBOX_GROUP_IDS = ["action", "related", "execution", "issue"] as const;
export type InboxGroupId = (typeof INBOX_GROUP_IDS)[number];

/** 16 种消息分 4 组（PRD 5.4.2），解决现状类型无分组的问题。 */
export const INBOX_GROUPS: Record<InboxGroupId, { label: string; description: string; types: string[] }> = {
  action: {
    label: "需要我处理",
    description: "评审请求、被阻塞的工作与路由告警",
    types: ["review_request", "issue_blocked", "routing_blocked"],
  },
  related: {
    label: "与我相关",
    description: "提及、回复与指派",
    types: ["mention", "reply", "issue_assigned"],
  },
  execution: {
    label: "执行动态",
    description: "智能体结果与各类执行、投递失败",
    types: ["result", "agent_task_failed", "dead_letter", "outbox_dead_letter"],
  },
  issue: {
    label: "事项动态",
    description: "事项更新、完成、取消、恢复与超期",
    types: ["issue_update", "issue_completed", "issue_cancelled", "issue_reopened", "issue_sla_breached"],
  },
};

/** 带审批的消息归入「需要我处理」组（审批中心是独立入口，但收件箱仍可呈现）。 */
export function inboxGroupOf(item: Pick<InboxItem, "type"> & { approvalId?: string }): InboxGroupId {
  if (item.approvalId) return "action";
  const group = INBOX_GROUP_IDS.find((id) => INBOX_GROUPS[id].types.includes(item.type));
  return group ?? "related";
}

export function inboxTypeLabel(item: InboxItem): string {
  if (item.approvalId) return item.needsAction ? "待审批" : "审批";
  if (item.type === "review_request") return item.needsAction ? "需要评审" : "评审请求";
  if (item.type === "issue_blocked") return item.resolvedAt ? "阻塞已解除" : "被阻塞";
  return INBOX_TYPES[item.type] || item.type.replace(/_/g, " ");
}

/** 需要处理的消息不可归档（PRD 5.4.4）。 */
export function canArchiveInboxMessage(item: Pick<InboxItem, "needsAction">): boolean {
  return !item.needsAction;
}

export const ARCHIVE_BLOCKED_MESSAGE = "该消息有未完成的动作，请先处理";

// Reading the selected item must not remove its detail or shift to another row.
export function retainInboxSelection(items: InboxItem[], selected: InboxItem | undefined, index: number): InboxItem[] {
  const unique = [...new Map(items.map(item => [item.id, item])).values()];
  if (!selected) return unique;
  const position = unique.findIndex(item => item.id === selected.id);
  if (position >= 0) unique[position] = selected;
  else unique.splice(Math.max(0, Math.min(index, unique.length)), 0, selected);
  return unique;
}
