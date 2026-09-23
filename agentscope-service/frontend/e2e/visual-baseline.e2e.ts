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

import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * A6 视觉回归基线：关键页面 × 断点 320/768/1024/1440 × 双主题。
 *
 * 这是阶段 C 铺开 19 个域时不回归的闸门：任何令牌/布局改动
 * 跑 `pnpm test:visual` 即可发现像素级差异。
 * 数据全部路由 mock，截图确定性不依赖后端。
 */

const BREAKPOINTS = [320, 768, 1024, 1440] as const;
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

async function mockApi(page: Page, roles: string[] = ['admin']) {
  const token = `test.${Buffer.from(JSON.stringify({ username: 'alice', roles })).toString('base64url')}.test`;
  await page.addInitScript((t) => localStorage.setItem('claw_token', t), token);
  // 离线/CI 环境拦截外网字体，避免 document.fonts.ready 永不完成
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.route('**/api/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/auth/me') return json({ username: 'alice', roles, isAdmin: true });
    if (path === '/api/v1/me/scope') return json({ tenant: 'default', namespace: 'default', mode: 'single', selectorVisible: false, namespaces: [{ tenant: 'default', name: 'default', roles }] });
    if (path === '/api/v1/inbox/summary') return json({ summary: { attentionTotal: 2, unread: 1, pendingApprovals: 1 } });
    if (path === '/api/v1/inbox') return json({ items: [
      { id: 'in-1', title: '审批请求：发布 v1.4.0', body: '发布审批需要你确认。', type: 'approval', read: false, needsAction: true, createdAt: hoursAgo(2), actor: { type: 'human', ref: 'bob' } },
      { id: 'in-2', title: '评审助手提及了你', body: '@alice 请查看第 3 轮评审结论。', type: 'mention', read: false, createdAt: hoursAgo(5), actor: { type: 'agent', ref: 'reviewer' } },
    ] });
    if (path === '/api/v1/issues') return json({ items: [
      { id: 'issue-1', identifier: 'JICH-101', title: '工作台视觉基线落地', status: 'in_progress', updatedAt: hoursAgo(1), assigneeType: 'human', assigneeRef: 'alice' },
      { id: 'issue-2', identifier: 'JICH-102', title: '阶段 C 铺开前的清单确认', status: 'open', updatedAt: hoursAgo(26), assigneeType: 'agent', assigneeRef: 'reviewer' },
    ] });
    if (path === '/api/v1/teams') return json({ items: [{ id: 'team-1', name: '评审机器人组' }, { id: 'team-2', name: '值班分派组' }] });
    if (path.endsWith('/events/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
    return json({ items: [], summary: {} });
  });
}

async function applyTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    localStorage.setItem('ags-theme', t);
    if (t === 'dark') document.documentElement.classList.add('dark');
  }, theme);
}

for (const theme of THEMES) {
  for (const width of BREAKPOINTS) {
    test(`login @ ${theme}/${width}`, async ({ page }) => {
      await applyTheme(page, theme);
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
      await page.goto('/login');
      await expect(page.getByText('AgentScope 管理平台')).toBeVisible();
      await expect(page).toHaveScreenshot(`login-${theme}-${width}.png`, { fullPage: true });
    });

    test(`workbench overview @ ${theme}/${width}`, async ({ page }) => {
      await applyTheme(page, theme);
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
      await page.goto('/work/overview');
      await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();
      await expect(page.getByRole('button', { name: '需要我处理' })).toBeVisible();
      await expect(page).toHaveScreenshot(`workbench-${theme}-${width}.png`, { fullPage: true });
    });
  }
}
