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

import { describe, expect, it } from "vitest";
import type { Issue } from "@/api/collaboration";
import type { OrchestrationRun } from "@/api/orchestration";
import { hasFailedAttempt, rankedAttention, runAlertsOf, runHealthOf } from "./workbenchModel";

const run = (id: string, rest: Partial<OrchestrationRun> = {}): OrchestrationRun => ({
  id, tenant: "t", namespace: "n", rootIssueId: "issue-1", mode: "direct", triggerType: "issue",
  state: "succeeded", version: 1, createdAt: "2026-09-24T08:00:00Z", ...rest,
});

const issue = (id: string, status: string, rest: Partial<Issue> = {}): Issue => ({
  id, tenant: "t", namespace: "n", title: `issue ${id}`, status, priority: "normal", kind: "user_work",
  visibility: "work_hub", completionPolicy: "review", creator: { type: "human", ref: "alice" },
  version: 1, createdAt: "2026-09-24T08:00:00Z", updatedAt: "2026-09-24T09:00:00Z", ...rest,
});

describe("workbench run health (PRD 5.3.1)", () => {
  it("counts running and failed runs and averages only completed durations", () => {
    const health = runHealthOf([
      run("a", { state: "running", startedAt: "2026-09-24T08:00:00Z" }),
      run("b", { state: "failed", startedAt: "2026-09-24T08:00:00Z", completedAt: "2026-09-24T08:00:30Z", usage: { totalTokens: 100 } }),
      run("c", { state: "succeeded", startedAt: "2026-09-24T08:00:00Z", completedAt: "2026-09-24T08:01:30Z", usage: { totalTokens: 50 } }),
    ]);
    expect(health.running).toBe(1);
    expect(health.failed).toBe(1);
    expect(health.averageDurationMs).toBe(60000);
    expect(health.totalTokens).toBe(150);
  });
  it("reports null metrics instead of fabricating zero when there is no data", () => {
    const health = runHealthOf([run("a", { state: "running", startedAt: "2026-09-24T08:00:00Z" })]);
    expect(health.averageDurationMs).toBeNull();
    expect(health.totalTokens).toBeNull();
  });
});

describe("workbench anomaly alerts (PRD 5.3.1)", () => {
  const now = new Date("2026-09-24T09:00:00Z").getTime();
  it("surfaces failed runs and runs stuck beyond the threshold", () => {
    const alerts = runAlertsOf([
      run("failed-run", { state: "failed", completedAt: "2026-09-24T08:55:00Z", failureMessage: "boom" }),
      run("stuck-run", { state: "running", startedAt: "2026-09-24T08:00:00Z" }),
      run("fresh-run", { state: "running", startedAt: "2026-09-24T08:58:00Z" }),
    ], now);
    expect(alerts.map(alert => alert.id)).toEqual(["failed-run:failed", "stuck-run:stuck"]);
    expect(alerts[0].detail).toBe("boom");
  });
  it("returns no alert for a run that finished successfully or ran briefly", () => {
    expect(runAlertsOf([run("ok", { completedAt: "2026-09-24T08:30:00Z" })], now)).toEqual([]);
  });
});

describe("workbench attention ranking (PRD 5.3.1)", () => {
  it("orders blocked before review before pending and hides finished work", () => {
    const ranked = rankedAttention([
      issue("pending", "todo"),
      issue("done-issue", "done"),
      issue("blocked", "blocked"),
      issue("review", "in_review"),
      issue("archived", "open", { archivedAt: "2026-09-24T08:00:00Z" }),
    ]);
    expect(ranked.map(entry => entry.id)).toEqual(["blocked", "review", "pending"]);
    expect(ranked.map(entry => entry.label)).toEqual(["被阻塞", "待验收", "待处理"]);
  });
  it("limits the list to the requested size", () => {
    const items = Array.from({ length: 10 }, (_, index) => issue(`i${index}`, "todo"));
    expect(rankedAttention(items, 4)).toHaveLength(4);
  });
});

describe("failed node highlight (PRD 5.5.3)", () => {
  it("detects failed attempts in a collapsed tree", () => {
    expect(hasFailedAttempt([{ id: "a", state: "failed" } as never])).toBe(true);
    expect(hasFailedAttempt([{ id: "a", state: "running", failureCode: "x" } as never])).toBe(true);
    expect(hasFailedAttempt([{ id: "a", state: "succeeded", failureCode: null } as never])).toBe(false);
  });
});
