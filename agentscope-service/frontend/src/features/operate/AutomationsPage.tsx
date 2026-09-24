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

import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  Clock3,
  Copy,
  Pencil,
  Play,
  Plus,
  Power,
  Workflow,
} from "lucide-react";
import {
  archiveAutomation,
  getAutomation,
  listAutomations,
  listAutomationDeliveries,
  listAutomationRuns,
  replayAutomationDelivery,
  rotateAutomationSecret,
  triggerAutomation,
  updateAutomation,
  type Automation,
  type AutomationSaved,
} from "@/api/automations";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { AgentIdentity } from "@/components/AgentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WorkEmpty,
  WorkLoadingRows,
  WorkPage,
  WorkPageHeader,
  WorkPanel,
  WorkPanelHeader,
} from "@/features/work/WorkSurface";
import { AutomationEditor } from "@/features/automations/AutomationEditor";
import { automationError } from "@/features/automations/form";
import {
  automationDate as date,
  displayValue,
  RunBadge,
  RunDetail,
} from "@/features/automations/RunDetail";
import { formatRelative } from "@/lib/format";

export default function AutomationsPage() {
  const scope = useControlPlaneScope();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const id = params.get("automation") || "";
  const runId = params.get("run") || "";
  const [editor, setEditor] = useState<Automation | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [listOffset, setListOffset] = useState(0);
  const [runOffset, setRunOffset] = useState(0);
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const [tab, setTab] = useState<"runs" | "deliveries">("runs");
  const [secret, setSecret] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Automation>();
  const operationKeys = useRef(new Map<string, string>());
  const navigate = (automation?: string, run?: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("automation");
      next.delete("run");
      if (automation) next.set("automation", automation);
      if (run) next.set("run", run);
      return next;
    });
    setRunOffset(0);
    setDeliveryOffset(0);
  };
  const invalidate = () => {
    for (const key of [
      "automations",
      "automation",
      "automation-runs",
      "automation-run",
      "automation-deliveries",
      "issues",
    ])
      void qc.invalidateQueries({ queryKey: [key] });
  };
  const action = useMutation({
    mutationFn: async ({
      key,
      fn,
    }: {
      key: string;
      fn: (key: string) => Promise<unknown>;
    }) => {
      let token = operationKeys.current.get(key);
      if (!token) {
        token = crypto.randomUUID();
        operationKeys.current.set(key, token);
      }
      const value = await fn(token);
      operationKeys.current.delete(key);
      return value;
    },
    onSuccess: invalidate,
  });
  const command = (key: string, fn: (key: string) => Promise<unknown>) => {
    if (!action.isPending) action.mutate({ key, fn });
  };
  const list = useQuery({
    queryKey: ["automations", scope.tenant, scope.namespace, listOffset],
    queryFn: () => listAutomations(scope.tenant, scope.namespace, listOffset),
    enabled: !id,
    refetchInterval: 10000,
  });
  const detail = useQuery({
    queryKey: ["automation", scope.tenant, scope.namespace, id],
    queryFn: () => getAutomation(id),
    enabled: !!id,
    refetchInterval: 5000,
  });
  const runs = useQuery({
    queryKey: ["automation-runs", id, runOffset],
    queryFn: () => listAutomationRuns(id, runOffset),
    enabled: !!id && !runId && tab === "runs",
    refetchInterval: 2000,
  });
  const deliveries = useQuery({
    queryKey: ["automation-deliveries", id, deliveryOffset],
    queryFn: () => listAutomationDeliveries(id, deliveryOffset),
    enabled: !!id && !runId && tab === "deliveries",
    refetchInterval: 5000,
  });
  const rule = detail.data?.automation;
  const saved = (result: AutomationSaved) => {
    setEditor(null);
    setSecret(result.webhookSecret || "");
    navigate(result.automation.id);
    invalidate();
  };
  const runNow = (item: Automation) =>
    command(`run:${item.id}`, async (key) => {
      const next = await triggerAutomation(
        item.id,
        key,
        undefined,
        !item.enabled,
      );
      navigate(item.id, next.run.id);
    });
  const rows = (list.data?.items || []).filter(
    (item) =>
      (!search ||
        `${item.name} ${item.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "all" || item.enabled === (filter === "enabled")),
  );
  return (
    <WorkPage>
      {id && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(runId ? id : undefined)}
        >
          <ArrowLeft className="h-4 w-4" />
          {runId ? "运行历史" : "自动化"}
        </Button>
      )}
      <WorkPageHeader
        title={id ? rule?.name || "自动化" : "自动化"}
        description={
          id
            ? rule?.description ||
              "附带完整执行历史的可重复工作。"
            : "把重复性工作交给你的智能体与团队。"
        }
        actions={
          !id ? (
            <Button onClick={() => setEditor("new")}>
              <Plus className="h-4 w-4" /> 新建自动化
            </Button>
          ) : rule && !rule.archivedAt ? (
            <>
              <Button
                variant="outline"
                onClick={() => setEditor(rule)}
                disabled={rule.actionType !== "create_issue"}
              >
                <Pencil className="h-4 w-4" /> 编辑
              </Button>
              <Button disabled={action.isPending} onClick={() => runNow(rule)}>
                <Play className="h-4 w-4" />
                {rule.enabled ? "立即运行" : "试运行"}
              </Button>
            </>
          ) : undefined
        }
      />
      {action.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-4 text-sm text-danger-text"
        >
          {automationError(action.error)}
        </p>
      )}
      {!id ? (
        <WorkPanel>
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <Input
              aria-label="搜索自动化"
              placeholder="搜索自动化…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              aria-label="按状态筛选"
              className="rounded-lg border border-border px-3 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="enabled">已启用</option>
              <option value="paused">已暂停</option>
            </select>
          </div>
          {list.isLoading ? (
            <WorkLoadingRows rows={4} />
          ) : list.error ? (
            <WorkEmpty
              title="自动化列表加载失败"
              description={automationError(list.error)}
            />
          ) : rows.length === 0 ? (
            <WorkEmpty
              title={
                list.data?.items.length
                  ? "没有匹配的自动化"
                  : "你的重复性工作从这里开始"
              }
              description="创建运行手册，选择执行者，并设置定时或 Webhook 触发。"
              action={
                <Button onClick={() => setEditor("new")}>
                  创建自动化
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <Workflow className="h-5 w-5 text-text-3" />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(item.id)}
                  >
                    <span className="font-semibold text-text">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-sm text-text-3">
                      {item.description ||
                        item.execution?.runbook.slice(0, 100)}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-4 text-xs text-text-3">
                      <span>{item.triggers?.length || 0} 个触发器</span>
                      <span>下次运行：{date(item.nextRunAt)}</span>
                      <span>
                        {item.lastRunAt
                          ? `上次运行 ${formatRelative(item.lastRunAt)}`
                          : "从未运行"}
                      </span>
                    </span>
                  </button>
                  <Badge tone={item.enabled ? "success" : "default"}>
                    {item.enabled ? "已启用" : "已暂停"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => runNow(item)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {item.enabled ? "立即运行" : "试运行"}
                  </Button>
                </article>
              ))}
            </div>
          )}
          <div className="flex justify-between border-t border-border p-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={listOffset === 0}
              onClick={() => setListOffset((v) => Math.max(0, v - 100))}
            >
              上一页
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={(list.data?.items.length || 0) < 100}
              onClick={() => setListOffset((v) => v + 100)}
            >
              下一页
            </Button>
          </div>
        </WorkPanel>
      ) : detail.isLoading ? (
        <WorkLoadingRows rows={4} />
      ) : !rule ? (
        <WorkEmpty
          title="自动化不存在或已被删除"
          description={automationError(detail.error)}
        />
      ) : (
        <>
          {!runId && (
            <WorkPanel>
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-5">
                <Badge tone={rule.enabled ? "success" : "default"}>
                  {rule.archivedAt
                    ? "已归档"
                    : rule.enabled
                      ? "已启用"
                      : "已暂停"}
                </Badge>
                <span className="flex-1 text-sm text-text-3">
                  {rule.execution?.outputMode === "run_only"
                    ? "仅运行"
                    : "创建事项"}{" "}
                  ·{" "}
                  {rule.execution?.assigneeType === "agent" ? (
                    <AgentIdentity
                      agentId={rule.execution.assigneeRef}
                      showId={false}
                    />
                  ) : rule.execution?.assigneeType === "team" ? (
                    "团队执行"
                  ) : (
                    "高级动作配置"
                  )}
                </span>
                {!rule.archivedAt && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() =>
                        command(`toggle:${id}`, () =>
                          updateAutomation(id, {
                            enabled: !rule.enabled,
                            expectedVersion: rule.version,
                          }),
                        )
                      }
                    >
                      <Power className="h-4 w-4" />
                      {rule.enabled ? "暂停" : "恢复"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchiveTarget(rule)}
                    >
                      <Archive className="h-4 w-4" /> 归档
                    </Button>
                  </>
                )}
              </div>
              <div className="grid gap-6 p-5 lg:grid-cols-2">
                <div>
                  <h2 className="mb-2 text-sm font-semibold">运行手册</h2>
                  <p className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-text-2">
                    {rule.execution?.runbook ||
                      "该规则使用高级动作配置，请通过 API 编辑。"}
                  </p>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold">触发器</h2>
                  {rule.triggers?.map((t) => (
                    <div key={t.id} className="rounded-xl bg-surface-2 p-3">
                      <div className="flex justify-between text-sm">
                        <span>
                          {t.type === "cron"
                            ? `定时 ${t.schedule} · ${t.timezone}`
                            : "Webhook"}
                        </span>
                        <span className="text-xs text-text-3">
                          {t.enabled ? "已启用" : "已停用"}
                        </span>
                      </div>
                      {t.type === "cron" ? (
                        <p className="mt-1 text-xs text-text-3">
                          下次运行：{date(t.nextRunAt)}
                        </p>
                      ) : (
                        <>
                          <code className="mt-2 block break-all text-xs">
                            {window.location.origin}/hooks/v1/automations/{id}/
                            {t.id}
                          </code>
                          <p className="mt-1 text-xs text-text-3">
                            事件：{t.events?.join("、") || "全部事件"}。请附带
                            X-Automation-Secret 与 Idempotency-Key 请求头。
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                  {rule.triggers?.some((t) => t.type === "webhook") &&
                    !rule.archivedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() =>
                          command(`rotate:${id}`, async () => {
                            const updated = await rotateAutomationSecret(
                              id,
                              rule.version,
                            );
                            setSecret(updated.webhookSecret || "");
                          })
                        }
                      >
                        生成新的 Webhook 凭据
                      </Button>
                    )}
                  <p className="text-xs text-text-3">
                    运行将继承执行者的工作空间与执行环境。等待评审的已完成执行不会阻塞下一次调度。
                  </p>
                </div>
              </div>
            </WorkPanel>
          )}
          {runId ? (
            <WorkPanel>
              <WorkPanelHeader title="运行详情" />
              <RunDetail
                automationId={id}
                runId={runId}
                command={command}
                openRun={(run) => navigate(id, run)}
              />
            </WorkPanel>
          ) : (
            <WorkPanel>
              <div className="flex gap-2 border-b border-border p-3">
                <Button
                  variant={tab === "runs" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTab("runs")}
                >
                  运行历史
                </Button>
                <Button
                  variant={tab === "deliveries" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTab("deliveries")}
                >
                  Webhook 投递
                </Button>
              </div>
              {tab === "runs" ? (
                runs.isLoading ? (
                  <WorkLoadingRows rows={3} />
                ) : runs.error ? (
                  <WorkEmpty
                    title="运行历史加载失败"
                    description={automationError(runs.error)}
                  />
                ) : !runs.data?.items.length ? (
                  <WorkEmpty
                    title="暂无运行记录"
                    description="立即运行一次，检查首次结果。"
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {runs.data.items.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => navigate(id, run.id)}
                        className="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-surface-2"
                      >
                        <Clock3 className="h-4 w-4 text-text-3" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {date(run.createdAt)}
                          </span>
                          <span className="text-xs text-text-3">
                            {run.source || run.triggerType}
                            {run.errorMessage ? ` · ${run.errorMessage}` : ""}
                          </span>
                        </span>
                        <RunBadge run={run} />
                      </button>
                    ))}
                  </div>
                )
              ) : deliveries.isLoading ? (
                <WorkLoadingRows rows={3} />
              ) : deliveries.error ? (
                <WorkEmpty
                  title="投递记录加载失败"
                  description={automationError(deliveries.error)}
                />
              ) : !deliveries.data?.items.length ? (
                <WorkEmpty
                  title="暂无 Webhook 投递"
                  description="收到的事件及其处理结果将在此展示。"
                />
              ) : (
                <div className="divide-y divide-border">
                  {deliveries.data.items.map((d) => (
                    <div key={d.id} className="space-y-2 p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex-1 text-sm font-medium">
                          {d.event}{" "}
                          <span className="font-normal text-text-3">
                            · {date(d.createdAt)}
                          </span>
                        </span>
                        <Badge>{d.status}</Badge>
                        {d.runId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(id, d.runId)}
                          >
                            打开运行
                          </Button>
                        )}
                        {d.status !== "queued" && d.status !== "rejected" && (
                          <Button
                            disabled={action.isPending}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              command(`replay:${d.id}`, (key) =>
                                replayAutomationDelivery(id, d.id, key),
                              )
                            }
                          >
                            重放
                          </Button>
                        )}
                      </div>
                      {d.reason && (
                        <p className="text-xs text-text-3">{d.reason}</p>
                      )}
                      <details className="text-xs">
                        <summary className="cursor-pointer">请求负载</summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-surface-2 p-3">
                          {displayValue(d.input)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between border-t border-border p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={(tab === "runs" ? runOffset : deliveryOffset) === 0}
                  onClick={() =>
                    tab === "runs"
                      ? setRunOffset((v) => Math.max(0, v - 25))
                      : setDeliveryOffset((v) => Math.max(0, v - 25))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    (tab === "runs"
                      ? runs.data?.items.length || 0
                      : deliveries.data?.items.length || 0) < 25
                  }
                  onClick={() =>
                    tab === "runs"
                      ? setRunOffset((v) => v + 25)
                      : setDeliveryOffset((v) => v + 25)
                  }
                >
                  Next
                </Button>
              </div>
            </WorkPanel>
          )}
        </>
      )}
      {editor && (
        <AutomationEditor
          key={editor === "new" ? "new" : `${editor.id}:${editor.version}`}
          rule={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      <Dialog
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) setSecret("");
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Webhook 凭据</DialogTitle>
            <DialogDescription>
              该凭据仅显示一次。请保存到你的 Webhook 发送方；生成新凭据后旧凭据立即失效。
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Input
              aria-label="Webhook 凭据"
              type="password"
              readOnly
              value={secret}
            />
            <Button onClick={() => void navigator.clipboard.writeText(secret)}>
              <Copy className="h-4 w-4" /> 复制凭据
            </Button>
            <p className="text-sm text-text-3">
              请以 X-Automation-Secret 请求头发送；每个事件附带稳定的 Idempotency-Key。
            </p>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>归档该自动化？</DialogTitle>
            <DialogDescription>
              新的触发将停止。既有运行及其历史会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Button
              disabled={action.isPending}
              onClick={() => {
                if (archiveTarget)
                  command(`archive:${archiveTarget.id}`, async () => {
                    await archiveAutomation(
                      archiveTarget.id,
                      archiveTarget.version,
                    );
                    setArchiveTarget(undefined);
                    navigate();
                  });
              }}
            >
              确认归档
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </WorkPage>
  );
}
