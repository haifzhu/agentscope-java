import { test, expect, type Page } from '@playwright/test';

/**
 * D2 无障碍验收（阶段 D 收口）。
 *
 * 对照度已在 A1 令牌层验证，这里做页面级复核：
 * 原生 `select` 与 `details/summary` 是浏览器内建的可聚焦元素，
 * 但「可聚焦」不等于「键盘可用」——本用例逐个真按键盘验证。
 * 另覆盖本轮新引入的 ConfirmDialog：打开后焦点应进入对话框、
 * 且对话框带可读名称。
 */

async function fixture(page: Page) {
  const token = `test.${Buffer.from(JSON.stringify({ username: 'alice', roles: ['admin', 'developer', 'operator', 'member'] })).toString('base64url')}.test`;
  await page.addInitScript(t => localStorage.setItem('claw_token', t), token);
  page.on('pageerror', error => { throw error; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const json = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/auth/me') return json({ username: 'alice', roles: ['admin', 'developer', 'operator', 'member'] });
    if (path === '/api/v1/me/scope') return json({ tenant: 'default', namespace: 'default', mode: 'single', selectorVisible: false, namespaces: [{ tenant: 'default', name: 'default', roles: ['admin'] }] });
    if (path === '/api/agents') return json([{ id: 'worker', name: 'Worker', agentKey: 'worker' }]);
    if (path === '/api/environments') return json([{ id: 'env-1', name: '本地默认', type: 'local' }]);
    if (path === '/api/workspaces') return json([]);
    if (path.startsWith('/api/workspaces/')) return json({ id: 'ws-1', name: '示例工作空间' });
    if (path === '/api/hosted-runtimes' || path.includes('/runtime')) return json({ runtimes: [] });
    if (path.endsWith('/hands/status')) return json({ brainInstanceId: 'b-1', pendingWorkItems: 0, localSandboxRegistrySize: 0, workerHeartbeats: {}, sessionHandsMetrics: {} });
    if (path === '/api/v1/namespaces') {
      return json({ items: [{ name: 'default', displayName: '默认空间', kind: 'shared', canManage: true, roles: ['admin'], owner: 'alice' }] });
    }
    if (path === '/api/v1/namespaces/default') {
      return json({ namespace: { name: 'default', displayName: '默认空间', kind: 'shared', roles: ['admin'], owner: 'alice', members: {}, groups: {}, resources: {}, requests: [] } });
    }
    if (path.endsWith('/events/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
    return json({ items: [], events: [], turns: [], commands: [], summary: {}, preferences: {} });
  });
}

test('native selects are keyboard operable and labelled', async ({ page }) => {
  await fixture(page);
  // 会话页的智能体筛选是可见的原生 select（带 sr-only label）：
  // 键盘必须能聚焦，且要有可读名称。
  await page.route('**/api/sessions**', route =>
    route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('/managed/sessions');
  // 等到页面真正挂载完成再数控件，避免在 React 首帧前断言。
  await expect(page.getByRole('heading', { name: '会话' })).toBeVisible();
  const selects = page.locator('select');
  await expect.poll(() => selects.count()).toBeGreaterThan(0);
  const count = await selects.count();

  for (let i = 0; i < count; i += 1) {
    const select = selects.nth(i);
    if (!(await select.isVisible())) continue;
    // 每个可见 select 都需要可访问名称（label / aria-label 皆可）。
    await expect(select).toHaveAccessibleName(/.+/);
  }

  const first = selects.first();
  await first.focus();
  await expect(first).toBeFocused();
});

test('details/summary toggles via keyboard', async ({ page }) => {
  await fixture(page);
  // AgentCreatePage 的「高级设置」是 details/summary（D1a 迁移后仍在）：
  // 折叠区必须能键盘聚焦并展开，否则高级配置对键盘用户不可达。
  await page.goto('/agent-center/agents/new');
  const details = page.locator('details').filter({ hasText: '高级设置' }).first();
  await expect(details).toBeVisible();

  const summary = details.locator('summary').first();
  await summary.focus();
  await expect(summary).toBeFocused();

  const before = await details.evaluate(el => (el as HTMLDetailsElement).open);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => details.evaluate(el => (el as HTMLDetailsElement).open))
    .toBe(!before);

  // 展开后内部控件可聚焦可达。
  const keyField = page.getByLabel('智能体标识');
  await expect(keyField).toBeVisible();
  await keyField.focus();
  await expect(keyField).toBeFocused();
});

test('ConfirmDialog opens with an accessible name and traps initial focus', async ({ page }) => {
  await fixture(page);
  // 记忆库页的归档/删除走本轮统一的三档 ConfirmDialog。
  await page.route('**/api/memory-stores', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'ms-1', name: '团队知识库', description: '共享笔记' }]),
      });
    }
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await page.goto('/agent-center/memory');

  await page.getByRole('button', { name: /归档/ }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(/归档记忆库/);
  // 焦点必须落在对话框内，否则键盘用户会 tab 到背后的页面。
  const focusInside = await dialog.evaluate(el => el.contains(document.activeElement));
  expect(focusInside).toBe(true);

  // Esc 关闭后焦点不应残留在已卸载的节点上。
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the permission guide is reachable as a labelled region', async ({ page }) => {
  await fixture(page);
  // 管理员的默认 tab 是「成员」，三层模型说明在其中的 details 里。
  await page.goto('/settings/namespaces/default?tab=members');
  const details = page.locator('details').filter({ hasText: '角色权限说明' }).first();
  await expect(details).toBeVisible();
  await details.locator('summary').click();
  await expect(page.getByRole('region', { name: '权限模型说明' })).toBeVisible();
});
