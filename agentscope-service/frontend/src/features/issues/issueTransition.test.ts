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

import { describe, expect, it, vi } from "vitest";
import { allowedIssueTransitions, isLegalIssueTransition, kanbanColumnOf, submitIssueTransition } from "./issueTransition";

vi.mock("@/api/collaboration", () => ({
  acceptIssue: vi.fn(async () => ({ issue: { id: "i", status: "done" } })),
  rejectIssue: vi.fn(async () => ({ issue: { id: "i", status: "in_progress" } })),
  reopenIssue: vi.fn(async () => ({ issue: { id: "i", status: "in_progress" } })),
  archiveIssue: vi.fn(async () => ({ issue: { id: "i", status: "archived" } })),
  transitionIssue: vi.fn(async () => ({ issue: { id: "i", status: "todo" } })),
}));

describe("issue status machine (PRD 5.10.3)", () => {
  it("only offers legal targets from the current status", () => {
    expect(allowedIssueTransitions("in_review")).toEqual(["done", "in_progress"]);
    expect(allowedIssueTransitions("done")).toEqual(["in_progress"]);
    expect(isLegalIssueTransition("todo", "in_review")).toBe(true);
    expect(isLegalIssueTransition("done", "in_review")).toBe(false);
    expect(isLegalIssueTransition("todo", "todo")).toBe(false);
  });
  it("maps review acceptance and reopen onto their dedicated endpoints", async () => {
    const { acceptIssue, rejectIssue, reopenIssue, transitionIssue } = await import("@/api/collaboration");
    await submitIssueTransition({ id: "i", status: "in_review", version: 3 }, "done");
    expect(acceptIssue).toHaveBeenCalledWith("i", 3);
    await submitIssueTransition({ id: "i", status: "in_review", version: 3 }, "in_progress");
    expect(rejectIssue).toHaveBeenCalled();
    await submitIssueTransition({ id: "i", status: "done", version: 3 }, "in_progress");
    expect(reopenIssue).toHaveBeenCalledWith("i", 3);
    await submitIssueTransition({ id: "i", status: "todo", version: 3 }, "in_review");
    expect(transitionIssue).toHaveBeenCalledWith("i", "in_review", 3);
  });
  it("refuses illegal transitions without touching the API", async () => {
    const { transitionIssue } = await import("@/api/collaboration");
    await expect(submitIssueTransition({ id: "i", status: "done", version: 1 }, "in_review")).rejects.toThrow("当前状态不允许变更为");
    expect(transitionIssue).not.toHaveBeenCalled();
  });
  it("folds backlog into the todo kanban column", () => {
    expect(kanbanColumnOf("backlog")).toBe("todo");
    expect(kanbanColumnOf("in_review")).toBe("in_review");
  });
});
