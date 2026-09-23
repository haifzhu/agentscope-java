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

import { test, expect, type Page } from "@playwright/test";
import type { InboxItem } from "../src/api/collaboration";

test.beforeEach(async ({ page }) => { page.on("pageerror", error => console.error(error.stack)); });

const issueId = "00000000-0000-4000-8000-000000000010";
const approvalId = "00000000-0000-4000-8000-000000000020";
const commentId = "00000000-0000-4000-8000-000000000030";
const createdAt = new Date().toISOString();

async function mockInbox(page: Page, options: { failApproval?: boolean; failRead?: boolean; reviewError?: number; initialIssueStatus?: string } = {}) {
  const items: InboxItem[] = [
    { id: "approval-message", type: "approval", severity: "attention", approvalId, issueId, title: "Confirm deployment command", body: "Review the command before the agent continues.", needsAction: true, read: false, archived: false, actor: { type: "agent", ref: "release-agent" }, createdAt },
    { id: "review-message", type: "review_request", severity: "attention", issueId, commentId, title: "Review requested: Inbox redesign", body: "The implementation is ready for acceptance.", needsAction: true, read: false, archived: false, actor: { type: "agent", ref: "builder" }, createdAt },
    { id: "mention-message", type: "mention", severity: "attention", issueId, commentId, title: "A message from your agent", body: "Please review the attached result.", needsAction: false, read: false, archived: false, actor: { type: "agent", ref: "builder" }, createdAt },
    { id: "system-message", type: "outbox_dead_letter", severity: "error", title: "Delivery requires attention", body: "A delivery failed after all retries.", needsAction: false, read: false, archived: false, actor: { type: "system", ref: "outbox" }, createdAt },
  ];
  const reads: string[] = [];
  const decisions: unknown[] = [];
  const reviews: Array<{ action: string; body: unknown }> = [];
  const reviewActivity: unknown[] = [];
  const approval = { id: approvalId, targetType: "issue", targetRef: issueId, issueId, status: "pending", reason: "Review the deployment command before execution.", requestedBy: { type: "agent", ref: "release-agent" }, approverRef: "alice", version: 1, createdAt, updatedAt: createdAt, decision: undefined as unknown, request: { command: "deploy --dry-run" } };
  const issue = { id: issueId, identifier: "WORK-42", title: "Inbox redesign", description: "A reliable inbox workflow with integrated approvals.", status: options.initialIssueStatus || "in_review", priority: "normal", kind: "user_work", visibility: "work_hub", completionPolicy: "review", tenant: "t", namespace: "n", creator: { type: "human", ref: "alice" }, createdAt, updatedAt: createdAt, version: 1 };
  const token = `test.${Buffer.from(JSON.stringify({ username: "alice", roles: ["admin"] })).toString("base64url")}.test`;
  await page.addInitScript(token => localStorage.setItem("claw_token", token), token);
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/auth/me") return json({ username: "alice", roles: ["admin"], isAdmin: true });
    if (path === "/api/v1/me/scope") return json({ tenant: "t", namespace: "n", mode: "single", selectorVisible: false });
    if (path === "/api/v1/inbox/summary") {
      const active = items.filter(item => !item.archived);
      return json({ summary: { unread: active.filter(item => !item.read).length, actionRequired: active.filter(item => item.needsAction).length, pendingApprovals: active.filter(item => item.approvalId && item.needsAction).length, attentionTotal: active.filter(item => !item.read || item.needsAction).length, byType: {} } });
    }
    if (path === "/api/v1/inbox") {
      const view = url.searchParams.get("view");
      return json({ items: items.filter(item => item.archived === (url.searchParams.get("archived") === "true") && (!url.searchParams.get("type") || item.type === url.searchParams.get("type")) && (view !== "unread" || !item.read) && (view !== "attention" || !item.read || item.needsAction) && (view !== "action" || item.needsAction)), hasMore: false, nextCursor: "" });
    }
    if (path.startsWith("/api/v1/inbox/")) {
      const id = path.split("/")[4]; const item = items.find(item => item.id === id);
      if (!item) return json({ error: "not found" }, 404);
      if (path.endsWith("/read")) { reads.push(id); if (options.failRead) return json({ error: "offline" }, 503); item.read = true; }
      if (path.endsWith("/archive")) item.archived = true;
      return json({ item });
    }
    if (path === "/api/v1/approvals") return json({ items: approval.status === "pending" ? [approval] : [] });
    if (path.startsWith(`/api/v1/approvals/${approvalId}`)) {
      if (options.failApproval) return json({ error: "not found" }, 404);
      if (path.endsWith("/decide")) {
        const body = route.request().postDataJSON(); decisions.push(body);
        approval.status = body.status; approval.version++; approval.decision = body.decision;
        items[0].needsAction = false; items[0].archived = true;
      }
      return json({ approval });
    }
    if (path === `/api/v1/issues/${issueId}/accept` || path === `/api/v1/issues/${issueId}/reject`) {
      const action = path.endsWith('/accept') ? 'accept' : 'reject';
      const body = route.request().postDataJSON(); reviews.push({ action, body });
      if (options.reviewError) return json({ error: options.reviewError === 403 ? 'You do not have permission to review this issue.' : options.reviewError === 409 ? 'This issue changed; refresh before reviewing.' : 'acceptance blocked: child issue is in progress' }, options.reviewError);
      if (body.expectedVersion !== issue.version || issue.status !== 'in_review') return json({ error: 'conflict' }, 409);
      issue.status = action === 'accept' ? 'done' : 'in_progress'; issue.version++;
      items[1].needsAction = false; items[1].archived = true; items[1].resolvedAt = new Date().toISOString();
      reviewActivity.push({ id: 'review-event', issueId, action: 'issue.status_changed', actor: { type: 'human', ref: 'alice' }, objectType: 'issue', objectRef: issueId, createdAt, details: { from: 'in_review', to: issue.status, reason: body.reason || 'accepted' } });
      return json({ issue });
    }
    if (path === `/api/v1/issues/${issueId}/activity`) return json({ items: reviewActivity });
    if (path === `/api/v1/issues/${issueId}`) return json({ issue });
    if (path === `/api/v1/issues/${issueId}/comments`) return json({ items: [{ id: commentId, issueId, threadRootId: commentId, author: { type: "agent", ref: "builder" }, content: "The final result is ready for your review.", type: "result", version: 1, createdAt, updatedAt: createdAt }], nextCursor: "" });
    return json({ items: [], runs: [], events: [], summary: {}, agents: [] });
  });
  return { items, reads, decisions, reviews, issue, options };
}

test("unifies approvals and embeds an issue; viewing marks only the selected message read", async ({ page }) => {
  const state = await mockInbox(page);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/work/inbox");
  await expect(page.getByRole("heading", { name: "选择一条消息" })).toBeVisible();
  expect(state.reads).toEqual([]);
  await expect(page.locator('[data-inbox-id="approval-message"]')).toHaveCount(1);
  await page.locator('[data-inbox-id="review-message"]').click();
  await expect(page.getByTestId("inbox-detail").getByRole("heading", { name: "Inbox redesign" })).toBeVisible();
  await expect(page.getByText("The final result is ready for your review.")).toBeVisible();
  await expect.poll(() => state.reads).toEqual(["review-message"]);
  await expect(page.locator('[data-inbox-id="review-message"]').getByLabel("未读")).toHaveCount(0);
  await expect(page.locator('[data-inbox-id="review-message"]')).toBeVisible();
  await expect(page).toHaveURL(/\/work\/inbox\?item=review-message/);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/agentscope-inbox-issue.png", fullPage: true });
});

test("read pending approval stays actionable and decision is made in the detail pane", async ({ page }) => {
  const state = await mockInbox(page);
  await page.goto("/work/inbox?item=approval-message");
  await expect(page.getByRole("button", { name: "批准", exact: true })).toBeVisible();
  await expect.poll(() => state.reads).toEqual(["approval-message"]);
  await expect(page.locator('[data-inbox-id="approval-message"]').getByText("待审批")).toBeVisible();
  await expect(page.getByText("1 条待审批")).toBeVisible();
  await page.screenshot({ path: "/tmp/agentscope-inbox-approval.png", fullPage: true });
  await page.getByRole("button", { name: "批准", exact: true }).click();
  await expect(page.getByText("该请求已批准。")).toBeVisible();
  expect(state.decisions).toEqual([{ status: "approved", expectedVersion: 1, decision: { note: "" } }]);
  await expect(page).toHaveURL(/item=approval-message/);
});

test("unread filter retains the selected row and filters approvals by type", async ({ page }) => {
  await mockInbox(page);
  await page.goto("/work/inbox?view=unread");
  await page.locator('[data-inbox-id="mention-message"]').click();
  await expect(page.locator('[data-inbox-id="mention-message"]').getByLabel("未读")).toHaveCount(0);
  await expect(page.getByTestId("inbox-detail").getByRole("heading", { name: "Inbox redesign" })).toBeVisible();
  await page.getByRole("button", { name: "筛选待办" }).click();
  await page.getByLabel("消息类型", { exact: true }).selectOption("approval");
  await expect(page.locator("[data-inbox-id]")).toHaveCount(1);
  await expect(page.locator('[data-inbox-id="approval-message"]')).toBeVisible();
});

test("failed approval details do not mark read and read failures can be retried", async ({ page }) => {
  const state = await mockInbox(page, { failApproval: true, failRead: true });
  await page.goto("/work/inbox?item=approval-message");
  await expect(page.getByRole("heading", { name: "审批不可用" })).toBeVisible({ timeout: 15000 });
  expect(state.reads).toEqual([]);
  await page.locator('[data-inbox-id="system-message"]').click();
  await expect(page.getByRole("alert")).toContainText("该消息暂时无法标记为已读");
  expect(state.items[3].read).toBe(false);
  state.options.failRead = false;
  await page.getByRole("alert").getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(state.items[3].read).toBe(true);
});

test("mobile back preserves the inbox and the legacy approval URL redirects", async ({ page }) => {
  await mockInbox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/control/approvals?view=all");
  await expect(page).toHaveURL(/\/work\/inbox\?view=all/);
  await page.locator('[data-inbox-id="approval-message"]').click();
  await expect(page.getByRole("button", { name: "批准", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "待办消息列表" })).toBeHidden();
  await page.screenshot({ path: "/tmp/agentscope-inbox-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "待办", exact: true }).click();
  await expect(page.locator('[data-inbox-id="approval-message"]')).toBeVisible();
  await expect(page).toHaveURL(/view=all/);
});


test("accepts a result directly in Inbox and clears the review action without losing selection", async ({ page }) => {
  const state = await mockInbox(page);
  await page.goto('/work/inbox?item=review-message');
  const panel = page.getByRole('region', { name: '事项评审', exact: true });
  await expect(panel.getByRole('button', { name: '验收结果', exact: true })).toBeVisible();
  expect(state.reviews).toEqual([]);
  await page.screenshot({ path: '/tmp/agentscope-inbox-review-actions.png', fullPage: true });
  await panel.getByRole('button', { name: '验收结果', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('结果已验收，该事项已完成。');
  expect(state.reviews).toEqual([{ action: 'accept', body: { expectedVersion: 1 } }]);
  expect(state.items[1].needsAction).toBe(false);
  await expect(page.locator('[data-inbox-id="review-message"]').getByText('需要评审', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '验收结果', exact: true })).toHaveCount(0);
  await expect(page.getByText('1 条需要处理')).toBeVisible();
  await expect(page).toHaveURL(/item=review-message/);
});

test("requests changes in Inbox, requires feedback and preserves its draft across messages", async ({ page }) => {
  const state = await mockInbox(page);
  await page.goto('/work/inbox?item=review-message');
  await page.getByRole('button', { name: '要求修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '提交评审', exact: true })).toBeDisabled();
  await page.getByLabel('需要修改的内容（必填）').fill('Please add dated sources and complete the missing research.');
  await page.locator('[data-inbox-id="mention-message"]').click();
  await expect(page.getByRole('region', { name: '事项评审', exact: true })).toHaveCount(0);
  await page.locator('[data-inbox-id="review-message"]').click();
  await page.getByRole('button', { name: '要求修改', exact: true }).click();
  await expect(page.getByLabel('需要修改的内容（必填）')).toHaveValue('Please add dated sources and complete the missing research.');
  await page.getByRole('button', { name: '提交评审', exact: true }).click();
  await expect(page.getByRole('region', { name: '事项评审', exact: true }).getByRole('status')).toContainText('已要求修改。');
  expect(state.reviews).toEqual([{ action: 'reject', body: { expectedVersion: 1, reason: 'Please add dated sources and complete the missing research.' } }]);
  expect(state.issue.status).toBe('in_progress');
  await expect(page.getByTestId('inbox-detail').getByText('Please add dated sources and complete the missing research.', { exact: true })).toBeVisible();
});

for (const status of [400, 403, 409]) test(`review failure ${status} preserves the task and reports the reason`, async ({ page }) => {
  const state = await mockInbox(page, { reviewError: status });
  await page.goto('/work/inbox?item=review-message');
  const panel = page.getByRole('region', { name: '事项评审', exact: true });
  await panel.getByRole('button', { name: '验收结果', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  expect(state.reviews).toHaveLength(1);
  expect(state.issue.status).toBe('in_review');
  expect(state.items[1].needsAction).toBe(true);
  await expect(panel.getByRole('status')).toHaveCount(0);
});

test("stale review messages cannot accept an issue that is no longer in review", async ({ page }) => {
  const state = await mockInbox(page, { initialIssueStatus: 'done' });
  await page.goto('/work/inbox?item=review-message');
  const panel = page.getByRole('region', { name: '事项评审', exact: true });
  await expect(panel.getByText('该事项已验收通过。')).toBeVisible();
  await expect(panel.getByRole('button', { name: '验收结果', exact: true })).toHaveCount(0);
  expect(state.reviews).toHaveLength(0);
});

test("mobile reviewers can enter feedback and cancel without changing the issue", async ({ page }) => {
  const state = await mockInbox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/work/inbox?item=review-message');
  const panel = page.getByRole('region', { name: '事项评审', exact: true });
  await panel.getByRole('button', { name: '要求修改', exact: true }).click();
  await panel.getByLabel('需要修改的内容（必填）').fill('Add sources before acceptance.');
  await page.screenshot({ path: '/tmp/agentscope-inbox-review-mobile.png', fullPage: true });
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  await expect(panel.getByRole('button', { name: '验收结果', exact: true })).toBeEnabled();
  expect(state.issue.status).toBe('in_review');
  expect(state.reviews).toEqual([]);
});


test("rejecting an approval requires a reason before the decision can be submitted", async ({ page }) => {
  const state = await mockInbox(page);
  await page.goto("/work/inbox?item=approval-message");
  await page.getByRole("button", { name: "驳回", exact: true }).click();
  await expect(page.getByTestId("rejection-reason-hint")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认驳回", exact: true })).toBeDisabled();
  await page.getByLabel("驳回理由（必填）").fill("命令参数缺少灰度标识。");
  await page.getByRole("button", { name: "确认驳回", exact: true }).click();
  await expect(page.getByText("该请求已驳回。")).toBeVisible();
  expect(state.decisions).toEqual([{ status: "rejected", expectedVersion: 1, decision: { note: "命令参数缺少灰度标识。" } }]);
});

test("approvals center lists pending requests with batch group and approves directly", async ({ page }) => {
  const state = await mockInbox(page);
  await page.goto("/work/approvals");
  await expect(page.getByRole("heading", { name: "审批中心" })).toBeVisible();
  await expect(page.getByText("Review the deployment command before execution.")).toBeVisible();
  await expect(page.getByRole("button", { name: "批准", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "批准", exact: true }).first().click();
  await expect.poll(() => state.decisions).toHaveLength(1);
  expect(state.decisions[0]).toEqual({ status: "approved", expectedVersion: 1, decision: { note: "" } });
});
