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
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, GitBranch } from "lucide-react";
import { updateTeam, type Team, type TeamOverview } from "@/api/collaboration";
import { AgentIdentity, AgentPicker } from "@/components/AgentPicker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MembersEditor } from "./TeamMembersEditor";
import { teamTone } from "./teamActivity";
import { LIMIT_DESCRIPTORS, isLimitDefault, limitSummary } from "./limitSummary";

const limits = LIMIT_DESCRIPTORS.map((d) => [d.field, d.label, d.zeroMeaning, d.max] as const);
function patchTeam(team: Team, fields: Record<string, unknown>) {
  return updateTeam(team.id, {
    name: team.name,
    description: team.description || "",
    instructions: team.instructions || "",
    leaderAgentId: team.leaderAgentId,
    policy: team.policy || {},
    status: team.status,
    expectedVersion: team.version,
    ...fields,
  });
}
export function TeamStructure({
  team,
  overview,
  compact = false,
}: {
  team: Team;
  overview: TeamOverview;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(team.leaderAgentId);
  const member = overview.members.find((item) => item.agentId === selected);
  const definition = team.members?.find((item) => item.agentId === selected);
  return (
    <Card>
      <CardHeader>
        <CardTitle>团队结构</CardTitle>
        <CardDescription>
          {compact
            ? `${overview.members.length} 个智能体 · 主管协调并验收结果`
            : "已配置的角色与当前运行时状态。主管按请求挑选参与成员。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <button
            onClick={() => setSelected(team.leaderAgentId)}
            className={`mx-auto block w-full max-w-72 rounded-lg border border-border bg-surface p-3 text-left shadow-sm ${selected === team.leaderAgentId ? "border-primary" : ""}`}
          >
            <div className="text-xs font-medium text-primary">LEAD</div>
            <div className="mt-1 font-medium">
              <AgentIdentity agentId={team.leaderAgentId} showId={false} />
            </div>
          </button>
          {!!team.members?.length && (
            <>
              <div className="flex flex-col items-center py-2 text-xs text-muted-foreground">
                <ArrowDown className="h-5 w-5" />
                <span>委派 · 回传结果</span>
              </div>
              <div
                className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}
              >
                {team.members.map((item) => {
                  const readiness =
                    overview.members.find((m) => m.agentId === item.agentId)
                      ?.readiness.state || "unknown";
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item.agentId)}
                      className={`rounded-lg border border-border bg-surface p-3 text-left shadow-sm ${selected === item.agentId ? "border-primary" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {item.role}
                        </span>
                        <Badge tone={teamTone(readiness)}>{readiness}</Badge>
                      </div>
                      <div className="mt-1 text-sm">
                        <AgentIdentity agentId={item.agentId} showId={false} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {member && (
          <div className="mt-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {member.leader ? "Lead" : member.role}
              </span>
              <Badge tone={teamTone(member.readiness.state)}>
                {member.readiness.state}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.readiness.reason}
            </p>
            {!compact && (
              <p className="mt-3 whitespace-pre-wrap">
                {member.leader
                  ? "Coordinates requests, delegates work, reviews results and submits the final response."
                  : definition?.instructions ||
                    "No role-specific instructions configured."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export function TeamOrchestration({
  team,
  overview,
  canEdit,
  onSaved,
}: {
  team: Team;
  overview: TeamOverview;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const section = ["rules", "limits"].includes(params.get("section") || "")
    ? params.get("section")!
    : "roles";
  const setSection = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("section", value);
    setParams(next);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {[
            ["roles", "角色与成员"],
            ["rules", "协作规则"],
            ["limits", "执行限额"],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={section === key ? "secondary" : "ghost"}
              aria-pressed={section === key}
              onClick={() => setSection(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          修改仅对新协作生效。
        </p>
      </div>
      {section === "roles" && (
        <div className="grid items-start gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <TeamStructure team={team} overview={overview} />
          <div className="space-y-5">
            <LeaderEditor
              key={team.version}
              team={team}
              canEdit={canEdit}
              onSaved={onSaved}
            />
            <div>
              <h3 className="mb-3 font-semibold">
                成员 · {team.members?.length || 0}
              </h3>
              <MembersEditor
                teamId={team.id}
                teamVersion={team.version}
                leaderAgentId={team.leaderAgentId}
                members={team.members || []}
                canEdit={canEdit}
              />
            </div>
          </div>
        </div>
      )}
      <div className={section === "roles" ? "hidden" : ""}>
        <RulesEditor
          key={team.version}
          team={team}
          canEdit={canEdit}
          section={section}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
function LeaderEditor({
  team,
  canEdit,
  onSaved,
}: {
  team: Team;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [leader, setLeader] = useState(team.leaderAgentId);
  const save = useMutation({
    mutationFn: () => patchTeam(team, { leaderAgentId: leader }),
    onSuccess: onSaved,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>主管智能体</CardTitle>
        <CardDescription>
          The entry point for new requests and owner of the final response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <AgentPicker
            value={leader}
            onChange={setLeader}
            disabled={!canEdit}
            excludeIds={(team.members || []).map((member) => member.agentId)}
            required
            aria-label="团队主管智能体"
          />
          {canEdit && (
            <Button
              type="submit"
              size="sm"
              disabled={save.isPending || leader === team.leaderAgentId}
            >
              保存主管
            </Button>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {String(save.error)}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
function RulesEditor({
  team,
  canEdit,
  section,
  onSaved,
}: {
  team: Team;
  canEdit: boolean;
  section: string;
  onSaved: () => void;
}) {
  const [instructions, setInstructions] = useState(team.instructions || "");
  const [policy, setPolicy] = useState<Record<string, unknown>>(
    (team.policy || {}) as Record<string, unknown>,
  );
  const save = useMutation({
    mutationFn: () => patchTeam(team, { instructions, policy }),
    onSuccess: onSaved,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {section === "limits" ? "执行限额" : "协作规则"}
        </CardTitle>
        <CardDescription>
          既有协作继续使用其已保存的团队配置。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={!canEdit || save.isPending} className="space-y-5">
            <div className={section === "rules" ? "space-y-5" : "hidden"}>
              <label className="block text-sm font-medium">
                团队协作指令
                <Textarea
                  className="mt-2 min-h-60"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="说明主管如何分配工作、验收结果、处理失败并提交最终答复。"
                />
              </label>
              <div className="grid gap-4">
                {[
                  [
                    "allowExternalDelegation",
                    "允许向团队外委派",
                    "主管可以调用名单之外的智能体或团队。",
                  ],
                  [
                    "allowMentionAll",
                    "允许委派给全部成员",
                    "允许一次请求面向整个名单派发。",
                  ],
                  [
                    "requireReview",
                    "需要人工审核",
                    "按执行策略要求审核。",
                  ],
                ].map(([field, label, help]) => (
                  <label
                    key={field}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={Boolean(policy[field])}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, [field]: e.target.checked }))
                      }
                    />
                    <span>
                      <span className="text-sm font-medium">{label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {help}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className={section === "limits" ? "space-y-4" : "hidden"}>
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="text-xs font-semibold tracking-wide text-text-3 uppercase">
                  配置摘要
                </div>
                <p className="mt-1.5 text-sm text-text-2">
                  {limitSummary(policy) ?? "全部限额使用平台默认值，未做团队级定制。"}
                </p>
              </div>
              <details className="rounded-xl border border-border">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text hover:bg-hover">
                  高级限额（6 项）
                  {isLimitDefault(policy) ? (
                    <span className="ml-2 text-xs font-normal text-text-3">全部默认，通常无需展开</span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-primary">已定制</span>
                  )}
                </summary>
                <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {limits.map(([field, label, help, max]) => (
                    <label key={field} className="text-sm font-medium">
                      {label}
                      <Input
                        className="mt-2"
                        type="number"
                        min={0}
                        max={max}
                        step={1}
                        required
                        value={String(policy[field] ?? 0)}
                        onChange={(e) =>
                          setPolicy((p) => ({
                            ...p,
                            [field]:
                              e.target.value === "" ? "" : Number(e.target.value),
                          }))
                        }
                      />
                      <span className="mt-2 block text-xs font-normal text-muted-foreground">
                        {help}
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </fieldset>
          {canEdit && (
            <Button type="submit" disabled={save.isPending}>
              保存协作规则与限额
            </Button>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {String(save.error)}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
export function TeamSettings({
  team,
  canEdit,
  onSaved,
}: {
  team: Team;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [status, setStatus] = useState(team.status);
  const save = useMutation({
    mutationFn: () =>
      patchTeam(team, { name: name.trim(), description, status }),
    onSuccess: onSaved,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team settings</CardTitle>
        <CardDescription>
          Identity and availability of this Team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={!canEdit || save.isPending} className="space-y-4">
            <label className="block text-sm">
              Name
              <Input
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Description
              <Textarea
                className="mt-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Availability
              <select
                className="mt-2 block w-full rounded-md border border-border bg-background p-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </fieldset>
          <p className="break-all text-xs text-muted-foreground">
            Team ID: {team.id} · Version {team.version}
          </p>
          {canEdit && (
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              Save settings
            </Button>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {String(save.error)}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
