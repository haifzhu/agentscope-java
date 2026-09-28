import { useState, useId, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Clock3, Webhook, Check } from "lucide-react";
import {
  createAutomation,
  updateAutomation,
  previewAutomationSchedule,
  type Automation,
  type AutomationExecution,
  type AutomationSaved,
  type AutomationTrigger,
} from "@/api/automations";
import { me } from "@/api/auth";
import { listTeams } from "@/api/collaboration";
import { useControlPlaneScope } from "@/app/ScopeContext";
import { AgentPicker } from "@/components/AgentPicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  automationError,
  buildAutomationWrite,
  defaultTrigger,
  executionForForm,
} from "./form";
import { useFormDraft } from "@/lib/useFormDraft";

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm";

/** 四步向导（PRD 5.12）：基本信息 → 执行者与产出 → 触发器 → 高级与确认。 */
const WIZARD_STEPS = [
  { title: "基本信息", hint: "名称与运行手册" },
  { title: "执行者与产出", hint: "交给谁、结果去哪" },
  { title: "触发器", hint: "定时或 Webhook" },
  { title: "高级与确认", hint: "并发、超时与启用" },
] as const;

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
      {WIZARD_STEPS.map((s, i) => {
        const state = i === step ? "current" : i < step ? "done" : "todo";
        return (
          <li key={s.title} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium ${
                state === "current"
                  ? "border-primary bg-primary-soft text-primary-text"
                  : state === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-text-3"
              }`}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={`text-xs ${state === "current" ? "font-medium text-text" : "text-text-3"}`}
            >
              {s.title}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TriggerEditor({
  trigger,
  onChange,
  onRemove,
}: {
  trigger: AutomationTrigger;
  onChange: (next: AutomationTrigger) => void;
  onRemove: () => void;
}) {
  const timezoneList = useId();
  const preview = useQuery({
    queryKey: ["automation-preview", trigger.schedule, trigger.timezone],
    queryFn: () =>
      previewAutomationSchedule(
        trigger.schedule || "",
        trigger.timezone || "UTC",
      ),
    enabled:
      trigger.type === "cron" && !!trigger.schedule && !!trigger.timezone,
    retry: false,
    staleTime: 10000,
  });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        {trigger.type === "cron" ? (
          <Clock3 className="h-4 w-4" />
        ) : (
          <Webhook className="h-4 w-4" />
        )}
        <span className="flex-1 text-sm font-medium">
          {trigger.type === "cron" ? "定时计划" : "Webhook"}
        </span>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={trigger.enabled}
            onChange={(e) =>
              onChange({ ...trigger, enabled: e.target.checked })
            }
          />{" "}
          启用
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="移除触发器"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {trigger.type === "cron" ? (
        <>
          <label className="block space-y-1 text-xs">
            常用频率
            <select
              aria-label="常用频率"
              className={selectClass}
              value={
                [
                  "0 9 * * 1-5",
                  "0 9 * * *",
                  "0 * * * *",
                  "*/30 * * * *",
                ].includes(trigger.schedule || "")
                  ? trigger.schedule
                  : "custom"
              }
              onChange={(e) => {
                if (e.target.value !== "custom")
                  onChange({ ...trigger, schedule: e.target.value });
              }}
            >
              <option value="0 9 * * 1-5">工作日每天 09:00</option>
              <option value="0 9 * * *">每天 09:00</option>
              <option value="0 * * * *">每小时</option>
              <option value="*/30 * * * *">每 30 分钟</option>
              <option value="custom">自定义计划</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            Cron 表达式
            <Input
              aria-label="Cron 表达式"
              value={trigger.schedule || ""}
              onChange={(e) =>
                onChange({ ...trigger, schedule: e.target.value })
              }
              required
              placeholder="0 9 * * 1-5"
            />
          </label>
          <label className="block space-y-1 text-xs">
            时区
            <Input
              aria-label="时区"
              list={timezoneList}
              value={trigger.timezone || ""}
              onChange={(e) =>
                onChange({ ...trigger, timezone: e.target.value })
              }
              required
            />
            <datalist id={timezoneList}>
              <option value="Asia/Shanghai" />
              <option value="UTC" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
          </label>
          <div
            className="border-t border-border pt-2 text-xs text-text-3"
            aria-live="polite"
          >
            {preview.isFetching ? (
              "正在计算接下来的运行时间…"
            ) : preview.error ? (
              <span className="text-danger-text">
                {automationError(preview.error)}
              </span>
            ) : (
              <>
                <p className="mb-1 font-medium">接下来 3 次运行</p>
                {preview.data?.nextRuns.slice(0, 3).map((date) => (
                  <div key={date}>
                    {new Date(date).toLocaleString(undefined, {
                      timeZone: trigger.timezone,
                    })}{" "}
                    · {trigger.timezone}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="block space-y-1 text-xs">
            接受的事件
            <Input
              aria-label="Webhook 事件过滤"
              value={trigger.events?.join(", ") || ""}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  events: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
              placeholder="build.completed, pull_request"
            />
          </label>
          <p className="text-xs leading-5 text-text-3">
            留空表示接受全部事件。保存后会生成受保护的 Webhook 端点与凭据。
          </p>
        </>
      )}
    </div>
  );
}
export function AutomationEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule?: Automation;
  onClose: () => void;
  onSaved: (saved: AutomationSaved) => void;
}) {
  const scope = useControlPlaneScope();
  // 向导草稿（D 阶段 MEDIUM-1）：四步输入整体持久化，刷新/误关后可恢复；
  // 提交成功或显式放弃时清空。新建与编辑用不同 key，互不串草稿。
  const draftKey = rule ? `edit:${rule.id}` : `create:${scope.tenant}:${scope.namespace}`;
  const draft = useFormDraft(draftKey, () => ({
    step: 0,
    name: rule?.name || "",
    description: rule?.description || "",
    enabled: rule?.enabled ?? true,
    execution: executionForForm(rule),
    triggers: (rule ? structuredClone(rule.triggers || []) : [defaultTrigger()]) as AutomationTrigger[],
    contextLinks: (rule?.execution?.contextRefs || [])
      .filter(
        (v): v is { url: string } =>
          !!v &&
          typeof v === "object" &&
          "url" in v &&
          typeof v.url === "string",
      )
      .map((v) => v.url)
      .join("\n"),
  }));
  const { step, name, description, enabled, execution, triggers, contextLinks } = draft.value;
  const setStep = (next: number) => draft.setValue((prev) => ({ ...prev, step: next }));
  const setName = (next: string) => draft.setValue((prev) => ({ ...prev, name: next }));
  const setDescription = (next: string) => draft.setValue((prev) => ({ ...prev, description: next }));
  const setEnabled = (next: boolean) => draft.setValue((prev) => ({ ...prev, enabled: next }));
  const setExecution = (next: AutomationExecution) =>
    draft.setValue((prev) => ({ ...prev, execution: next }));
  const setTriggers = (next: AutomationTrigger[] | ((prev: AutomationTrigger[]) => AutomationTrigger[])) =>
    draft.setValue((prev) => ({
      ...prev,
      triggers: typeof next === "function" ? next(prev.triggers) : next,
    }));
  const setContextLinks = (next: string) => draft.setValue((prev) => ({ ...prev, contextLinks: next }));
  const user = useQuery({ queryKey: ["automation-current-user"], queryFn: me });
  const subscriberRef = user.data?.userId || user.data?.username;
  const teams = useQuery({
    queryKey: ["automation-teams", scope.tenant, scope.namespace],
    queryFn: () => listTeams(scope.tenant, scope.namespace),
  });
  const save = useMutation({
    mutationFn: () => {
      const links = contextLinks
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const link of links) {
        try {
          const url = new URL(link);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw new Error("上下文链接必须以 https:// 或 http:// 开头。");
        }
      }
      const retained = (execution.contextRefs || []).filter(
        (v) => !(v && typeof v === "object" && "url" in v),
      );
      const body = buildAutomationWrite(
        scope.tenant,
        scope.namespace,
        name,
        description,
        enabled,
        {
          ...execution,
          contextRefs: [...retained, ...links.map((url) => ({ url }))],
        },
        triggers,
        rule?.version,
      );
      return rule
        ? updateAutomation(rule.id, { ...body, expectedVersion: rule.version })
        : createAutomation(body);
    },
    onSuccess: (saved) => {
      draft.clear();
      onSaved(saved);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!save.isPending) save.mutate();
  };
  const stepOneValid = !!name.trim() && !!execution.runbook.trim();
  const stepTwoValid = !!execution.assigneeRef;
  const canAdvance =
    step === 0 ? stepOneValid : step === 1 ? stepTwoValid : true;
  const assigneeSummary =
    execution.assigneeType === "agent"
      ? `智能体 ${execution.assigneeRef || "（未选择）"}`
      : `团队 ${execution.assigneeRef || "（未选择）"}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{rule ? "编辑自动化" : "新建自动化"}</DialogTitle>
          <DialogDescription>
            四步完成配置：把重复性工作交给智能体或团队。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="p-0 lg:overflow-hidden">
          <form
            id="automation-editor"
            onSubmit={submit}
            className="grid lg:h-[calc(88vh-165px)] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]"
          >
            <div className="space-y-5 p-6 lg:overflow-y-auto lg:border-r lg:border-border">
              {step === 0 && (
                <>
                  <label className="block space-y-2 text-sm font-medium">
                    名称
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="每日工程动态摘要"
                      required
                      autoFocus
                      maxLength={200}
                      className="text-lg font-semibold"
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    运行手册
                    <span className="block text-xs font-normal text-text-3">
                      智能体每次运行时都会阅读。请写明目标、约束、步骤与期望产出。
                    </span>
                    <Textarea
                      value={execution.runbook}
                      onChange={(e) =>
                        setExecution({ ...execution, runbook: e.target.value })
                      }
                      required
                      className="min-h-[300px] text-sm leading-7 lg:min-h-[400px]"
                      placeholder={
                        "1. 回顾最近的项目动态。\n2. 汇总变更、阻塞与决策。\n3. 附上来源链接和明确的下一步。"
                      }
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    描述{" "}
                    <span className="font-normal text-text-3">（可选）</span>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="用于自动化列表的简短描述"
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    上下文链接{" "}
                    <span className="font-normal text-text-3">（可选）</span>
                    <Textarea
                      value={contextLinks}
                      onChange={(e) => setContextLinks(e.target.value)}
                      placeholder="每行一个项目或文档链接"
                    />
                  </label>
                </>
              )}
              {step === 1 && (
                <>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">执行者</legend>
                    <select
                      aria-label="执行者类型"
                      className={selectClass}
                      value={execution.assigneeType}
                      onChange={(e) =>
                        setExecution({
                          ...execution,
                          assigneeType: e.target.value as "agent" | "team",
                          assigneeRef: "",
                        })
                      }
                    >
                      <option value="agent">智能体</option>
                      <option value="team">团队</option>
                    </select>
                    {execution.assigneeType === "agent" ? (
                      <AgentPicker
                        required
                        value={execution.assigneeRef}
                        onChange={(assigneeRef) =>
                          setExecution({ ...execution, assigneeRef })
                        }
                      />
                    ) : (
                      <select
                        required
                        aria-label="团队"
                        className={selectClass}
                        value={execution.assigneeRef}
                        onChange={(e) =>
                          setExecution({
                            ...execution,
                            assigneeRef: e.target.value,
                          })
                        }
                      >
                        <option value="">选择团队…</option>
                        {teams.data?.items
                          .filter(
                            (team) =>
                              team.status === "active" ||
                              team.id === execution.assigneeRef,
                          )
                          .map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                      </select>
                    )}
                    <p className="text-xs leading-5 text-text-3">
                      运行将使用执行者配置的工作空间、工具与执行环境。
                    </p>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">产出方式</legend>
                    {(
                      [
                        {
                          value: "create_issue",
                          title: "创建事项",
                          detail: "每次结果可跟踪、讨论与评审。",
                        },
                        {
                          value: "run_only",
                          title: "仅运行",
                          detail: "在自动化历史中查看结果。",
                        },
                      ] as const
                    ).map((mode) => (
                      <label
                        key={mode.value}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${execution.outputMode === mode.value ? "border-primary bg-primary-soft" : "border-border"}`}
                      >
                        <input
                          type="radio"
                          name="outputMode"
                          checked={execution.outputMode === mode.value}
                          onChange={() =>
                            setExecution({ ...execution, outputMode: mode.value })
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {mode.title}
                          </span>
                          <span className="text-xs text-text-3">
                            {mode.detail}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {execution.outputMode === "create_issue" && (
                    <label className="block space-y-2 text-sm font-medium">
                      完成策略
                      <select
                        aria-label="完成策略"
                        className={selectClass}
                        value={execution.completionPolicy}
                        onChange={(e) =>
                          setExecution({
                            ...execution,
                            completionPolicy: e.target.value as
                              | "automatic"
                              | "review",
                          })
                        }
                      >
                        <option value="review">需要人工评审</option>
                        <option value="automatic">工作完成即结束</option>
                      </select>
                    </label>
                  )}
                  {execution.outputMode === "create_issue" && subscriberRef && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={
                          execution.subscribers?.includes(subscriberRef) ?? false
                        }
                        onChange={(event) =>
                          setExecution({
                            ...execution,
                            subscribers: event.target.checked
                              ? [...(execution.subscribers || []), subscriberRef]
                              : (execution.subscribers || []).filter(
                                  (ref) => ref !== subscriberRef,
                                ),
                          })
                        }
                      />{" "}
                      订阅每次生成的事项
                    </label>
                  )}
                </>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">触发器</h3>
                  {triggers.length === 0 && (
                    <p className="text-sm text-text-3">
                      当前仅支持手动运行。添加触发器后可自动执行。
                    </p>
                  )}
                  {triggers.map((trigger) => (
                    <TriggerEditor
                      key={trigger.id}
                      trigger={trigger}
                      onChange={(next) =>
                        setTriggers((items) =>
                          items.map((t) => (t.id === next.id ? next : t)),
                        )
                      }
                      onRemove={() =>
                        setTriggers((items) =>
                          items.filter((t) => t.id !== trigger.id),
                        )
                      }
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={triggers.length >= 10}
                      onClick={() =>
                        setTriggers((items) => [...items, defaultTrigger()])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> 定时计划
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={triggers.length >= 10}
                      onClick={() =>
                        setTriggers((items) => [
                          ...items,
                          defaultTrigger("webhook"),
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Webhook
                    </Button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-5">
                  <fieldset className="space-y-3 text-sm">
                    <legend className="mb-2 text-sm font-medium">高级设置</legend>
                    <label className="block space-y-1">
                      并发策略
                      <select
                        className={selectClass}
                        value={execution.concurrencyPolicy}
                        onChange={(e) =>
                          setExecution({
                            ...execution,
                            concurrencyPolicy: e.target.value as "skip" | "queue",
                          })
                        }
                      >
                        <option value="skip">上一轮仍在执行时跳过</option>
                        <option value="queue">排队并按顺序执行</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      最长排队时间（分钟）
                      <Input
                        type="number"
                        min={1}
                        max={10080}
                        value={execution.queueTimeoutSeconds / 60}
                        onChange={(e) =>
                          setExecution({
                            ...execution,
                            queueTimeoutSeconds: Number(e.target.value) * 60,
                          })
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      最长执行时间（分钟）
                      <Input
                        type="number"
                        min={1}
                        max={10080}
                        value={execution.runTimeoutSeconds / 60}
                        onChange={(e) =>
                          setExecution({
                            ...execution,
                            runTimeoutSeconds: Number(e.target.value) * 60,
                          })
                        }
                      />
                    </label>
                  </fieldset>
                  <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-4 text-sm">
                    <h3 className="text-sm font-medium">配置确认</h3>
                    <dl className="space-y-1 text-text-2">
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-3">名称</dt>
                        <dd>{name || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-3">执行者</dt>
                        <dd>{assigneeSummary}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-3">产出方式</dt>
                        <dd>
                          {execution.outputMode === "create_issue"
                            ? "创建事项"
                            : "仅运行"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-3">触发器</dt>
                        <dd>
                          {triggers.length
                            ? triggers
                                .map((t) =>
                                  t.type === "cron"
                                    ? `定时 ${t.schedule}`
                                    : "Webhook",
                                )
                                .join("；")
                            : "仅手动"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />{" "}
                    保存后立即启用
                  </label>
                </div>
              )}
            </div>
            <div className="space-y-4 p-6 lg:overflow-y-auto">
              <StepIndicator step={step} />
              <p className="text-xs leading-5 text-text-3">
                第 {step + 1} / {WIZARD_STEPS.length} 步 ·{" "}
                {WIZARD_STEPS[step].hint}
              </p>
              <div className="flex flex-col gap-2">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                  >
                    上一步
                  </Button>
                )}
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button
                    type="button"
                    disabled={!canAdvance}
                    onClick={() => setStep(step + 1)}
                  >
                    下一步
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    form="automation-editor"
                    disabled={
                      save.isPending ||
                      !stepOneValid ||
                      !stepTwoValid
                    }
                  >
                    {save.isPending
                      ? "保存中…"
                      : rule
                        ? "保存修改"
                        : "创建自动化"}
                  </Button>
                )}
                {step === 0 && !stepOneValid && (
                  <p className="text-xs text-text-3">请先填写名称与运行手册。</p>
                )}
                {step === 1 && !stepTwoValid && (
                  <p className="text-xs text-text-3">请先选择执行者。</p>
                )}
              </div>
            </div>
          </form>
        </DialogBody>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span role="alert" className="max-w-lg text-sm text-danger-text">
            {save.error ? automationError(save.error) : ""}
          </span>
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
