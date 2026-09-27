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

import { useState } from "react";
import type { DefinitionSpec } from "@/api/orchestration";
import { AgentPicker } from "@/components/AgentPicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { WorkflowGraph } from "./WorkflowGraph";
import { nodeTypes } from "./workflowModel";
import { detectCycle, validateWorkflow } from "./workflowValidation";
import { nodeTypeLabels } from "./nodeTypeLabels";
export function WorkflowDesigner({
  spec,
  onChange,
  readOnly = false,
  teams,
  revisions,
  persistKey,
}: {
  spec: DefinitionSpec;
  onChange: (v: DefinitionSpec) => void;
  readOnly?: boolean;
  teams: { id: string; name: string }[];
  revisions: { id: string; name: string }[];
  /** 工作流标识：用于按工作流持久化画布拖拽位置。 */
  persistKey?: string;
}) {
  const [selected, setSelected] = useState(spec.nodes[0]?.key || "");
  const [kind, setKind] = useState("agent");
  const [key, setKey] = useState("");
  const node = spec.nodes.find((n) => n.key === selected);
  const issues = validateWorkflow(
    spec.nodes.map((n) => ({ key: n.key, type: n.type })),
    (spec.edges || []).map((e) => ({ from: e.from, to: e.to })),
  );
  const [rejectedEdge, setRejectedEdge] = useState<string | null>(null);
  /** 成环拒绝（C11）：连线两端变更若引入环，直接拒绝本次编辑。 */
  const patchEdges = (next: DefinitionSpec["edges"]) => {
    if (detectCycle((next || []).map((e) => ({ from: e.from, to: e.to })))) {
      setRejectedEdge("该连线会构成环，工作流不允许成环，已拒绝本次修改。");
      return;
    }
    setRejectedEdge(null);
    onChange({ ...spec, edges: next });
  };
  const patch = (fields: Record<string, unknown>) =>
    onChange({
      ...spec,
      nodes: spec.nodes.map((n) =>
        n.key === selected ? { ...n, ...fields } : n,
      ),
    });
  const add = () => {
    const n: DefinitionSpec["nodes"][number] = {
      key: key.trim(),
      type: kind,
      issueMode: "inherit",
      failurePolicy: "fail_fast",
    };
    if (kind === "join") n.join = { mode: "all" };
    if (kind === "timer") n.timer = { durationSeconds: 60 };
    onChange({ ...spec, nodes: [...spec.nodes, n] });
    setSelected(n.key);
    setKey("");
  };
  const object = (value: unknown) =>
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return (
    <div className="min-w-0 space-y-4">
      {(issues.length > 0 || rejectedEdge) && (
        <div role="alert" className="space-y-1 rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm text-warning-text">
          {rejectedEdge && <p>{rejectedEdge}</p>}
          {issues.map((issue, i) => (
            <p key={i}>{issue.message}</p>
          ))}
        </div>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <WorkflowGraph
            nodes={spec.nodes.map((n) => ({
              id: n.key,
              label: n.key,
              type: n.type,
            }))}
            edges={(spec.edges || []).map((e) => ({ from: e.from, to: e.to }))}
            selected={selected}
            onSelect={setSelected}
            persistKey={persistKey}
          />
          {!readOnly && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <select
                aria-label="新节点类型"
                className="rounded-md border border-border bg-background p-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {nodeTypes.map((type) => (
                  <option key={type}>{nodeTypeLabels[type] ?? type}</option>
                ))}
              </select>
              <Input
                className="min-w-40 flex-1"
                aria-label="新节点 key"
                placeholder="唯一的步骤名"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button
                disabled={
                  !key.trim() || spec.nodes.some((n) => n.key === key.trim())
                }
              >
                添加节点
              </Button>
            </form>
          )}
          <div className="rounded-xl border border-border p-4">
            <h3 className="font-medium">连线与分支条件</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              当连线的源节点进入匹配状态后触发。汇聚节点可配置全部 / 任一 / 法定数量规则。
            </p>
            <div className="mt-3 space-y-3">
              {(spec.edges || []).map((edge, i) => (
                <fieldset
                  disabled={readOnly}
                  key={i}
                  className="grid gap-2 rounded-lg bg-muted/30 p-3"
                >
                  <div className="flex gap-2">
                    <select
                      aria-label={`连线 ${i + 1} 起点`}
                      className="min-w-0 flex-1 rounded border border-border p-2 text-sm"
                      value={edge.from}
                      onChange={(e) =>
  patchEdges(
                          spec.edges!.map((v, j) =>
                            j === i ? { ...v, from: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      {spec.nodes.map((n) => (
                        <option key={n.key}>{n.key}</option>
                      ))}
                    </select>
                    <span className="py-2">→</span>
                    <select
                      aria-label={`连线 ${i + 1} 终点`}
                      className="min-w-0 flex-1 rounded border border-border p-2 text-sm"
                      value={edge.to}
                      onChange={(e) =>
  patchEdges(
                          spec.edges!.map((v, j) =>
                            j === i ? { ...v, to: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      {spec.nodes.map((n) => (
                        <option key={n.key}>{n.key}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    aria-label={`连线 ${i + 1} 触发状态`}
                    value={(edge.on || ["succeeded"]).join(", ")}
                    placeholder="succeeded, skipped, failed"
                    onChange={(e) =>
                      onChange({
                        ...spec,
                        edges: spec.edges!.map((v, j) =>
                          j === i
                            ? {
                                ...v,
                                on: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label={`连线 ${i + 1} 条件`}
                    placeholder="可选的 CEL 分支条件"
                    value={edge.condition || ""}
                    onChange={(e) =>
                      onChange({
                        ...spec,
                        edges: spec.edges!.map((v, j) =>
                          j === i ? { ...v, condition: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
onClick={() =>
                        patchEdges(spec.edges!.filter((_, j) => j !== i))
                      }
                    >
                      删除连线
                    </Button>
                  )}
                </fieldset>
              ))}
            </div>
            {!readOnly && (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={spec.nodes.length < 2}
                onClick={() =>
                  patchEdges([
                    ...(spec.edges || []),
                    {
                      from: spec.nodes[0].key,
                      to: spec.nodes[1].key,
                      on: ["succeeded"],
                    },
                  ])
                }
              >
                添加连线
              </Button>
            )}
          </div>
        </div>
        {node && (
          <div className="min-w-0 rounded-xl border border-border p-4">
            <h3 className="font-semibold">
              {node.key}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {nodeTypeLabels[node.type] ?? node.type}
              </span>
            </h3>
            <fieldset disabled={readOnly} className="mt-4 space-y-4">
              {node.type === "agent" && (
                <label className="block text-sm">
                  Agent
                  <AgentPicker
                    value={String(node.agentId || "")}
                    onChange={(agentId) => patch({ agentId })}
                    disabled={readOnly}
                    aria-label="节点智能体"
                  />
                </label>
              )}
              {node.type === "team" && (
                <label className="block text-sm">
                  Team
                  <select
                    aria-label="节点团队"
                    className="mt-1 block w-full rounded border border-border p-2"
                    value={String(node.teamRef || "")}
                    onChange={(e) => patch({ teamRef: e.target.value })}
                  >
                    <option value="">选择团队</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {node.type === "subrun" && (
                <label className="block text-sm">
                  已发布的工作流版本
                  <select
                    aria-label="子工作流版本"
                    className="mt-1 block w-full rounded border border-border p-2"
                    value={String(node.definitionRevisionId || "")}
                    onChange={(e) =>
                      patch({ definitionRevisionId: e.target.value })
                    }
                  >
                    <option value="">选择已发布版本</option>
                    {revisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {node.type === "signal" && (
                <label className="block text-sm">
                  信号名称
                  <Input
                    value={String(node.signalName || "")}
                    onChange={(e) => patch({ signalName: e.target.value })}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    保留第一个匹配的信号，包括该步骤之前收到的信号。
                  </span>
                </label>
              )}
              {node.type === "timer" && (
                <label className="block text-sm">
                  等待时长（秒）
                  <Input
                    type="number"
                    min={1}
                    value={Number(object(node.timer).durationSeconds || 60)}
                    onChange={(e) =>
                      patch({
                        timer: { durationSeconds: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              )}
              {node.type === "approval" && (
                <>
                  <label className="block text-sm">
                    审批人
                    <Input
                      value={String(object(node.approval).approverRef || "")}
                      onChange={(e) =>
                        patch({
                          approval: {
                            ...object(node.approval),
                            approverRef: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    审批提示
                    <Textarea
                      value={String(object(node.approval).prompt || "")}
                      onChange={(e) =>
                        patch({
                          approval: {
                            ...object(node.approval),
                            prompt: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
              {node.type === "join" && (
                <>
                  <label className="block text-sm">
                    等待策略
                    <select
                      className="mt-1 block w-full rounded border border-border p-2"
                      value={String(object(node.join).mode || "all")}
                      onChange={(e) =>
                        patch({
                          join: { ...object(node.join), mode: e.target.value },
                        })
                      }
                    >
                      <option value="all">全部入边</option>
                      <option value="any">任一入边</option>
                      <option value="quorum">法定数量入边</option>
                    </select>
                  </label>
                  {object(node.join).mode === "quorum" && (
                    <label className="block text-sm">
                      所需入边数量
                      <Input
                        type="number"
                        min={1}
                        value={Number(object(node.join).quorum || 1)}
                        onChange={(e) =>
                          patch({
                            join: {
                              ...object(node.join),
                              quorum: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  )}
                </>
              )}
              <label className="block text-sm">
                执行条件（CEL）
                <Input
                  placeholder="可选的布尔表达式"
                  value={String(node.condition || "")}
                  onChange={(e) => patch({ condition: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                工作上下文
                <select
                  className="mt-1 block w-full rounded border border-border p-2"
                  value={String(node.issueMode || "inherit")}
                  onChange={(e) => patch({ issueMode: e.target.value })}
                >
                  <option value="inherit">沿用原始事项</option>
                  <option value="child">创建子事项</option>
                </select>
              </label>
              <InputMapping
                key={node.key}
                value={object(node.input)}
                onChange={(input) => patch({ input })}
              />
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  失败处理与运行时
                </summary>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    失败策略
                    <select
                      className="mt-1 block w-full rounded border border-border p-2"
                      value={String(node.failurePolicy || "fail_fast")}
                      onChange={(e) => patch({ failurePolicy: e.target.value })}
                    >
                      <option value="fail_fast">终止工作流</option>
                      <option value="continue">继续可行路径，保留失败结果</option>
                      <option value="partial_success">允许部分成功</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    超时（秒，0 = 不限节点时长）
                    <Input
                      min={0}
                      type="number"
                      value={Number(node.timeoutSeconds || 0)}
                      onChange={(e) =>
                        patch({ timeoutSeconds: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    任务最大尝试次数
                    <Input
                      min={1}
                      type="number"
                      value={Number(object(node.retry).maxAttempts || 1)}
                      onChange={(e) =>
                        patch({
                          retry: {
                            ...object(node.retry),
                            maxAttempts: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    重试间隔（秒）
                    <Input
                      min={0}
                      type="number"
                      value={Number(object(node.retry).backoffSeconds || 0)}
                      onChange={(e) =>
                        patch({
                          retry: {
                            ...object(node.retry),
                            backoffSeconds: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    运行时候选覆盖与绝对定时时间可在高级 JSON 中配置。
                  </p>
                </div>
              </details>
            </fieldset>
            {!readOnly && (
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => {
                  onChange({
                    ...spec,
                    nodes: spec.nodes.filter((n) => n.key !== selected),
                    edges: (spec.edges || []).filter(
                      (e) => e.from !== selected && e.to !== selected,
                    ),
                  });
                  setSelected("");
                }}
              >
                删除节点
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function InputMapping({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, string>) => void;
}) {
  const entries = Object.entries(value).map(([key, expression]) => [
    key,
    String(expression),
  ]);
  const update = (index: number, key: string, expression: string) => {
    onChange(
      Object.fromEntries(
        entries.map((entry, i) => (i === index ? [key, expression] : entry)),
      ),
    );
  };
  return (
    <div className="space-y-2">
      <div className="text-sm">输入映射</div>
      {entries.map(([key, expression], i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={`输入 ${i + 1} 名称`}
            className="w-28"
            value={key}
            onChange={(e) => {
              if (!entries.some(([k], j) => j !== i && k === e.target.value))
                update(i, e.target.value, expression);
            }}
          />
          <Input
            aria-label={`输入 ${i + 1} 表达式`}
            className="min-w-0 flex-1 font-mono text-xs"
            value={expression}
            onChange={(e) => update(i, key, e.target.value)}
            placeholder="run.input.request"
          />
          <Button
            type="button"
            variant="ghost"
            aria-label={`删除输入 ${key}`}
            onClick={() =>
              onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))
            }
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let key = "input";
          let i = 1;
          while (key in value) key = `input${i++}`;
          onChange({ ...Object.fromEntries(entries), [key]: "run.input" });
        }}
      >
        添加输入
      </Button>
      <p className="text-xs text-muted-foreground">
        将输入名映射到 CEL 表达式（如 run.input.request），修改即时写入草稿。
      </p>
    </div>
  );
}
