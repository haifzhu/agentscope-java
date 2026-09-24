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

import { useSearchParams } from "react-router-dom";
import { resolveDefinitionSection } from "./agentNavigation";

/**
 * 定义六项的统一挂载点（C6 层级压缩）：六个编辑器从子路由第三层
 * 改为 `?section=` 页内横向标签，路由树不再多出一层。各编辑器经由
 * 父级 Outlet context 获取 agent / refreshAgent。
 */
export default function AgentDefinitionPanel() {
  const [params] = useSearchParams();
  const section = resolveDefinitionSection(params.get("section"));
  switch (section) {
    case "workspace":
      return <AgentWorkspaceSection />;
    case "skills":
      return <AgentSkillsSection />;
    case "tools":
      return <AgentToolsSection />;
    case "subagents":
      return <AgentSubagentsSection />;
    case "versions":
      return <AgentVersionsSection />;
    default:
      return <AgentBehaviorSection />;
  }
}

// 直接复用既有编辑器页面组件：它们只依赖 useOutletContext，
// 在本面板下渲染仍取到父级 <Outlet context> 提供的数据。
import AgentWorkspacePage from "@/pages/AgentWorkspacePage";
import AgentSkillsPage from "@/pages/AgentSkillsPage";
import AgentToolsPage from "@/pages/AgentToolsPage";
import AgentSubagentsPage from "@/pages/AgentSubagentsPage";
import AgentSettingsPage from "@/pages/AgentSettingsPage";

function AgentBehaviorSection() {
  return <AgentSettingsPage section="behavior" />;
}

function AgentWorkspaceSection() {
  return <AgentWorkspacePage />;
}

function AgentSkillsSection() {
  return <AgentSkillsPage />;
}

function AgentToolsSection() {
  return <AgentToolsPage />;
}

function AgentSubagentsSection() {
  return <AgentSubagentsPage />;
}

function AgentVersionsSection() {
  return <AgentSettingsPage section="versions" />;
}
