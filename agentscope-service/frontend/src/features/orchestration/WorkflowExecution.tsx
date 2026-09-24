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
  entityDisplayName,
  useEntityIdentities,
} from "@/components/EntityIdentity";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RunGraph } from "@/api/orchestration";
import { signalRun } from "@/api/orchestration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { AgentIdentity } from "@/components/AgentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { WorkflowGraph } from "./WorkflowGraph";
import { summarizeOutput } from "./workflowModel";
import { stateLabel, teamTone } from "@/features/teams/teamActivity";
import { nodeTypeLabels } from "./nodeTypeLabels";
export function WorkflowExecution({
  graph,
  canEdit,
}: {
  graph: RunGraph;
  canEdit: boolean;
}) {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const identities = useEntityIdentities(
    graph.tasks.map((t) => ({ type: "agent", ref: t.agentId })),
  );
  const nodeLabel = (n: RunGraph["nodes"][number]) => {
    const task = graph.tasks.find((t) => t.runNodeId === n.id);
    return n.nodeKey.startsWith("task:") && task
      ? `${n.role || "智能体"} · ${entityDisplayName(identities, "agent", task.agentId)}`
      : n.nodeKey;
  };
  const links: { from: string; to: string; label?: string }[] = graph.edges.map(
    (e) => ({ from: e.fromNodeId, to: e.toNodeId }),
  );
  for (const task of graph.tasks) {
    const parent = graph.tasks.find((t) => t.id === task.parentTaskId);
    if (
      parent &&
      !task.leaderTask &&
      parent.runNodeId !== task.runNodeId &&
      !links.some((e) => e.from === parent.runNodeId && e.to === task.runNodeId)
    )
      links.push({
        from: parent.runNodeId,
        to: task.runNodeId,
        label: "委派",
      });
  }

  const [selected, setSelected] = useState(
    graph.nodes.find((n) => n.state === "failed" || n.state === "waiting")
      ?.id || graph.nodes[0]?.id,
  );
  const [payload, setPayload] = useState("{}");
  const node = graph.nodes.find((n) => n.id === selected) || graph.nodes[0];
  const childRun = graph.childRuns?.find((r) => r.parentNodeId === node?.id);
  const cfg = (node?.config || {}) as Record<string, unknown>;
  const send = useMutation({
    mutationFn: () =>
      signalRun(graph.run.id, String(cfg.signalName), JSON.parse(payload)),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["run-graph", graph.run.id] }),
  });
  const outcome =
    graph.run.failureMessage ||
    graph.run.waitReason ||
    summarizeOutput(graph.run.output) ||
    "No final result has been recorded yet.";
  return (
    <div className="min-w-0 space-y-4">
      {graph.definition && (
        <Link
          className="text-sm text-primary hover:underline"
          to={scope.scopedPath(
            `/agent-center/workflows/${graph.definition.id}`,
          )}
        >
          {graph.definition.name} · Published version {graph.revision?.revision}{" "}
          ↗
        </Link>
      )}
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">结果与当前状态</h2>
        <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm">
          {outcome}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          执行完成与事项验收分开跟踪。
        </p>
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <h2 className="font-semibold">执行路径</h2>
          <WorkflowGraph
            nodes={graph.nodes.map((n) => ({
              id: n.id,
              label: nodeLabel(n),
              type: n.type,
              state: n.state,
            }))}
            edges={links}
            selected={node?.id}
            onSelect={setSelected}
          />
          <p className="text-xs text-muted-foreground">
            该图属于本次执行：跳过的步骤与分支条件仍可见，虚线表示团队委派。
          </p>
        </div>
        {node && (
          <section className="min-w-0 space-y-3 rounded-xl border border-border p-4">
            <div className="flex justify-between gap-2">
              <h3 className="font-semibold">{nodeLabel(node)}</h3>
              <Badge tone={teamTone(node.state)}>
                {stateLabel(node.state)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {nodeTypeLabels[node.type] ?? node.type} · {node.startedAt
                ? `开始于 ${new Date(node.startedAt).toLocaleString()}`
                : "未开始"}
            </p>
            {node.failureMessage && (
              <p className="text-sm text-destructive">
                {node.failureCode}: {node.failureMessage}
              </p>
            )}
            {node.waitReason && (
              <p className="text-sm">等待中：{node.waitReason}</p>
            )}
            {node.type === "timer" && node.state === "waiting" && (
              <p className="text-sm">
                Wake time:{" "}
                {String(
                  (node.output as Record<string, unknown>)?.wakeAt || "待定",
                )}
              </p>
            )}
            {node.type === "approval" && node.state === "waiting" && (
              <Link
                className="block text-sm text-primary"
                to={scope.scopedPath("/work/approvals")}
              >
                查看待审批项 ↗
              </Link>
            )}
            {node.type === "subrun" && !!childRun && (
              <Link
                className="block text-sm text-primary"
                to={scope.scopedPath(`/work/executions/${childRun?.id}`)}
              >
                打开子执行 ↗
              </Link>
            )}
            {["input", "output"].map((field) => (
              <details key={field === "input" ? "输入" : "输出"} open={field === "output"}>
                <summary className="cursor-pointer text-sm font-medium capitalize">
                  {field === "input" ? "输入" : "输出"}
                </summary>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(
                    field === "input" ? node.input : node.output,
                    null,
                    2,
                  ) || "未记录"}
                </pre>
              </details>
            ))}
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                入边
              </summary>
              {graph.edges
                .filter((e) => e.toNodeId === node.id)
                .map((e) => (
                  <p className="mt-2 text-xs" key={e.id}>
                    {graph.nodes.find((n) => n.id === e.fromNodeId)?.nodeKey} →{" "}
                    {node.nodeKey} · {(e.onStates || []).join(", ")}
                    {e.condition ? ` · ${e.condition}` : ""}
                  </p>
                ))}
            </details>
            {graph.tasks
              .filter((t) => t.runNodeId === node.id)
              .map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <AgentIdentity agentId={task.agentId} />
                  <div className="mt-2 flex justify-between gap-2">
                    <Link
                      className="text-primary"
                      to={scope.scopedPath(`/work/executions/tasks/${task.id}`)}
                    >
                      任务 {task.id.slice(0, 8)} ↗
                    </Link>
                    <Badge tone={teamTone(task.status)}>
                      {stateLabel(task.status)}
                    </Badge>
                  </div>
                  {graph.attempts
                    .filter((a) => a.agentTaskId === task.id)
                    .map((a) => (
                      <div className="mt-2 text-xs" key={a.id}>
                        {a.backendKind} · 第 {a.attempt} 次尝试 · {a.state}
                        {a.sessionRef && (
                          <Link
                            className="ml-2 text-primary"
                            to={scope.scopedPath(
                              `/work/sessions/${a.sessionRef}`,
                            )}
                          >
                            会话 ↗
                          </Link>
                        )}
                        {a.sessionId && !a.sessionRef && (
                          <span className="ml-2 text-muted-foreground">会话诊断尚未就绪，请查看该任务的执行详情。</span>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            {canEdit &&
              node.type === "signal" &&
              ["pending", "waiting", "ready"].includes(node.state) && (
                <form
                  className="space-y-2 border-t border-border pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send.mutate();
                  }}
                >
                  <label className="block text-sm">
                    发送信号：{String(cfg.signalName)}
                    <Textarea
                      aria-label="信号负载"
                      className="mt-2 font-mono text-xs"
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                    />
                  </label>
                  {send.error && (
                    <p role="alert" className="text-xs text-destructive">
                      {String(send.error)}
                    </p>
                  )}
                  {send.isSuccess && (
                    <p className="text-xs">信号已记录。</p>
                  )}
                  <Button size="sm" disabled={send.isPending}>
                    发送信号
                  </Button>
                </form>
              )}
          </section>
        )}
      </div>
    </div>
  );
}
