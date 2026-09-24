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

/**
 * 8 种节点类型的业务语言标签（PRD 5.9 / C11、C12 共用）。
 * 节点语义保持不变，仅做中文呈现。
 */
export const nodeTypeLabels: Record<string, string> = {
  agent: "智能体",
  team: "团队",
  condition: "条件分支",
  join: "汇聚",
  approval: "人工审批",
  timer: "定时等待",
  signal: "信号等待",
  subrun: "子工作流",
};
