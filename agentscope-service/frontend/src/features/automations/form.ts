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

import type {
  Automation,
  AutomationExecution,
  AutomationTrigger,
  AutomationWrite,
} from "@/api/automations";

export const defaultExecution = (): AutomationExecution => ({
  runbook: "",
  assigneeType: "agent",
  assigneeRef: "",
  outputMode: "create_issue",
  completionPolicy: "review",
  concurrencyPolicy: "skip",
  queueTimeoutSeconds: 3600,
  runTimeoutSeconds: 3600,
  contextRefs: [],
  subscribers: [],
});
export const defaultTrigger = (
  type: "cron" | "webhook" = "cron",
): AutomationTrigger => ({
  id: crypto.randomUUID(),
  type,
  enabled: true,
  ...(type === "cron"
    ? {
        schedule: "0 9 * * 1-5",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }
    : { events: [] }),
});
export function executionForForm(rule?: Automation): AutomationExecution {
  if (rule?.execution) return structuredClone(rule.execution);
  const action = (
    rule?.actionConfig && typeof rule.actionConfig === "object"
      ? rule.actionConfig
      : {}
  ) as Record<string, unknown>;
  return {
    ...defaultExecution(),
    runbook: typeof action.description === "string" ? action.description : "",
    assigneeType: action.assigneeType === "team" ? "team" : "agent",
    assigneeRef:
      typeof action.assigneeRef === "string" ? action.assigneeRef : "",
  };
}
export function buildAutomationWrite(
  tenant: string,
  namespace: string,
  name: string,
  description: string,
  enabled: boolean,
  execution: AutomationExecution,
  triggers: AutomationTrigger[],
  version?: number,
): AutomationWrite {
  if (!name.trim()) throw new Error("请填写自动化名称。");
  if (!execution.runbook.trim())
    throw new Error("请在运行手册中描述要执行的工作。");
  if (!execution.assigneeRef) throw new Error("请选择执行者（智能体或团队）。");
  return {
    tenant,
    namespace,
    name: name.trim(),
    description: description.trim(),
    enabled,
    execution: {
      ...execution,
      runbook: execution.runbook.trim(),
      completionPolicy:
        execution.outputMode === "run_only"
          ? "automatic"
          : execution.completionPolicy,
    },
    triggers: triggers.map(
      ({ nextRunAt: _next, lastFiredAt: _last, ...trigger }) => trigger,
    ),
    ...(version === undefined ? {} : { expectedVersion: version }),
  };
}
export function automationError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "请求未能完成，请稍后重试。";
  try {
    const body = JSON.parse(message) as { error?: string };
    return body.error || message;
  } catch {
    return message;
  }
}
export const terminalRun = (status: string) =>
  ["completed", "failed", "skipped", "cancelled", "duplicate"].includes(status);
export function runLabel(status: string, waitReason?: string) {
  if (status === "waiting" && waitReason === "review") return "待评审";
  return (
    (
      {
        queued: "排队中",
        dispatching: "派发中",
        running: "运行中",
        waiting: "等待中",
        completed: "已完成",
        failed: "失败",
        skipped: "已跳过",
        cancelled: "已取消",
      } as Record<string, string>
    )[status] || status
  );
}
