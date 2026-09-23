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
import type { InboxItem } from "@/api/collaboration";
import {
  INBOX_GROUP_IDS,
  INBOX_GROUPS,
  INBOX_TYPES,
  canArchiveInboxMessage,
  inboxGroupOf,
  inboxTypeLabel,
  retainInboxSelection,
} from "./inboxModel";

const item = (id: string, rest: Partial<InboxItem> = {}): InboxItem => ({ id, type: "mention", severity: "info", actor: { type: "agent", ref: "worker" }, title: id, createdAt: "2026-09-07T08:00:00Z", read: false, archived: false, needsAction: false, ...rest });
describe("Inbox selection and action semantics", () => {
  it("keeps a read message in its original position when unread filtering removes it", () => {
    const selected = item("b", { read: true });
    expect(retainInboxSelection([item("a"), item("c")], selected, 1).map(entry => entry.id)).toEqual(["a", "b", "c"]);
    expect(retainInboxSelection([item("a"), item("c")], undefined, 1).map(entry => entry.id)).toEqual(["a", "c"]);
  });
  it("deduplicates pages and uses the selected item's current state", () => {
    const selected = item("b", { read: true });
    expect(retainInboxSelection([item("a"), item("b"), item("b")], selected, 1)).toEqual([item("a"), selected]);
  });
  it("marks read pending approvals and subscriber blockers without confusing read with resolved", () => {
    expect(inboxTypeLabel(item("a", { approvalId: "approval", needsAction: true, read: true }))).toBe("待审批");
    expect(inboxTypeLabel(item("a", { type: "issue_blocked", needsAction: false }))).toBe("被阻塞");
    expect(inboxTypeLabel(item("a", { type: "issue_blocked", resolvedAt: "2026-09-07T09:00:00Z" }))).toBe("阻塞已解除");
  });
});

describe("Inbox grouping (PRD 5.4.2)", () => {
  it("maps all 16 known types into the four groups with no leftovers", () => {
    const grouped = new Set(INBOX_GROUP_IDS.flatMap(id => INBOX_GROUPS[id].types));
    for (const type of Object.keys(INBOX_TYPES)) {
      if (type === "approval") continue; // 审批走独立中心，收件箱内归入 action 组
      expect(grouped.has(type)).toBe(true);
      expect(typeof inboxGroupOf({ type })).toBe("string");
    }
  });
  it("places review requests, blockers and routing alerts in the action group", () => {
    expect(inboxGroupOf({ type: "review_request" })).toBe("action");
    expect(inboxGroupOf({ type: "issue_blocked" })).toBe("action");
    expect(inboxGroupOf({ type: "routing_blocked" })).toBe("action");
  });
  it("places mentions, replies and assignments in the related group", () => {
    expect(inboxGroupOf({ type: "mention" })).toBe("related");
    expect(inboxGroupOf({ type: "reply" })).toBe("related");
    expect(inboxGroupOf({ type: "issue_assigned" })).toBe("related");
  });
  it("places execution outcomes and failures in the execution group", () => {
    expect(inboxGroupOf({ type: "result" })).toBe("execution");
    expect(inboxGroupOf({ type: "agent_task_failed" })).toBe("execution");
    expect(inboxGroupOf({ type: "dead_letter" })).toBe("execution");
    expect(inboxGroupOf({ type: "outbox_dead_letter" })).toBe("execution");
  });
  it("places issue lifecycle updates in the issue group", () => {
    expect(inboxGroupOf({ type: "issue_update" })).toBe("issue");
    expect(inboxGroupOf({ type: "issue_sla_breached" })).toBe("issue");
    expect(inboxGroupOf({ type: "issue_reopened" })).toBe("issue");
  });
  it("routes approval-bearing messages to the action group even though approvals have their own center", () => {
    expect(inboxGroupOf({ type: "mention", approvalId: "approval-1" })).toBe("action");
  });
});

describe("Archive guard (PRD 5.4.4)", () => {
  it("blocks archiving messages that still need action", () => {
    expect(canArchiveInboxMessage(item("a", { needsAction: true }))).toBe(false);
    expect(canArchiveInboxMessage(item("a", { needsAction: false }))).toBe(true);
  });
});
