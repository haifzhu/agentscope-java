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

import type { AgentDefinition } from "@/api/agents";

export type AgentDetailTabId =
  | "overview"
  | "activity"
  | "definition"
  | "runtime"
  | "connections"
  | "settings";
export interface AgentDetailTab {
  id: AgentDetailTabId;
  label: string;
}

/** 定义六项（PRD 5.7.2）：横向标签切换，不再产生第三层导航。 */
export const definitionSections = [
  { id: "behavior", label: "行为" },
  { id: "workspace", label: "工作区" },
  { id: "skills", label: "技能" },
  { id: "tools", label: "工具与 MCP" },
  { id: "subagents", label: "子智能体" },
  { id: "versions", label: "版本" },
] as const;

export type DefinitionSectionId = (typeof definitionSections)[number]["id"];

export function resolveDefinitionSection(requested: string | null): DefinitionSectionId {
  return definitionSections.some(item => item.id === requested) ? (requested as DefinitionSectionId) : "behavior";
}

/** 运行时形态的业务语言解释（PRD 5.7.2）。 */
export const runtimeKindPresentation: Record<string, { label: string; description: string }> = {
  managed: { label: "平台托管", description: "平台负责运行智能体，你只需配置它的能力" },
  "external-application": { label: "外部应用", description: "你自己开发的应用，注册到平台统一管理" },
  "hosted-runtime": { label: "托管运行时", description: "把成熟的编程助手装到你的机器上，由平台统一调度" },
};

export function agentDetailTabs(runtimeKind?: string): AgentDetailTab[] {
  return [
    { id: "overview", label: "总览" },
    { id: "activity", label: "动态" },
    { id: "definition", label: "定义" },
    { id: "runtime", label: "运行状态" },
    { id: "connections", label: "连接" },
    { id: "settings", label: "设置" },
  ];
}

export function resolveAgentDetailTab(
  requested: string | null,
  runtimeKind?: string,
): AgentDetailTabId {
  const aliases: Record<string, AgentDetailTabId> = {
    sessions: "activity",
    "related-work": "activity",
    entrypoints: "connections",
  };
  const tab = aliases[requested ?? ""] ?? requested;
  return agentDetailTabs(runtimeKind).some((item) => item.id === tab)
    ? (tab as AgentDetailTabId)
    : "overview";
}

export function agentServicePath(agentId: string): string {
  return `/agent-center/agents/${encodeURIComponent(agentId)}`;
}
export function agentDetailPath(
  agent: Pick<AgentDefinition, "id" | "runtimeKind">,
): string {
  return agentServicePath(agent.id);
}

export function legacyAgentManagePath(
  agentId: string,
  section: string,
  search = "",
): string {
  const params = new URLSearchParams(search);
  const base = agentServicePath(agentId);
  params.delete("tab");
  let path = base;
  if (section === "sessions") {
    params.set("tab", "activity");
    params.set("view", "sessions");
  } else if (section === "channels") {
    params.set("tab", "connections");
    params.set("connection", "channels");
  } else if (section === "chat")
    return `/work/chat?${new URLSearchParams({ ...Object.fromEntries(params), agent: agentId })}`;
  else {
    // C6 层级压缩：定义六项以 ?tab=definition&section= 直达，不再走子路由。
    params.set("tab", "definition");
    params.set("section", definitionSections.some((item) => item.id === section) ? section : "behavior");
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}
