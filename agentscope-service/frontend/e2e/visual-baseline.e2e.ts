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

import { test, expect, type Page } from '@playwright/test';
import { mockVisualApi } from './visualFixtures';

/**
 * A6 视觉回归基线：关键页面 × 断点 320/768/1024/1440 × 双主题。
 *
 * 这是阶段 C 铺开 19 个域时不回归的闸门：任何令牌/布局改动
 * 跑 `pnpm test:visual` 即可发现像素级差异。
 * 数据全部路由 mock，截图确定性不依赖后端。
 *
 * JICH-338 阶段 C 第一批（C1–C6）按 A6 说明扩展：每个域落地后
 * 补上对应页面，双主题 × 4 断点全部纳入。
 */

const BREAKPOINTS = [320, 768, 1024, 1440] as const;
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** 页面清单：id 决定截图文件名，goto 决定入口，assert 保证页面已就绪。 */
const PAGES: Array<{ id: string; path: string; assert: (page: Page) => Promise<unknown> }> = [
  {
    id: 'login',
    path: '/login',
    assert: page => expect(page.getByText('AgentScope 管理平台')).toBeVisible(),
  },
  {
    id: 'workbench',
    path: '/work/overview',
    assert: page => expect(page.getByRole('heading', { name: '工作台' })).toBeVisible(),
  },
  // C1 工作台快捷入口与运维区块
  {
    id: 'workbench-quicklinks',
    path: '/work/overview',
    assert: page => expect(page.getByRole('region', { name: '快捷入口' })).toBeVisible(),
  },
  // C2 待办中心
  {
    id: 'inbox',
    path: '/work/inbox',
    assert: page => expect(page.getByRole('heading', { name: '待办中心' })).toBeVisible(),
  },
  // C3 审批中心
  {
    id: 'approvals-center',
    path: '/work/approvals',
    assert: page => expect(page.getByRole('heading', { name: '审批中心' })).toBeVisible(),
  },
  // C4 事项列表（列表 / 看板 / 分组三视图）
  {
    id: 'issues-list',
    path: '/work/issues',
    assert: page => expect(page.getByRole('heading', { name: '事项' })).toBeVisible(),
  },
  {
    id: 'issues-board',
    path: '/work/issues?layout=board',
    assert: page => expect(page.getByTestId('issues-board')).toBeVisible(),
  },
  {
    id: 'issues-grouped',
    path: '/work/issues?layout=grouped',
    assert: page => expect(page.getByTestId('issues-grouped')).toBeVisible(),
  },
  // C5 事项详情（七分区）
  {
    id: 'issue-detail',
    path: '/work/issues/issue-1',
    assert: page => expect(page.getByRole('heading', { name: '工作台视觉基线落地' })).toBeVisible(),
  },
  // C6 智能体定义（横向标签，不再有第三层）
  {
    id: 'agent-definition',
    path: '/agent-center/agents/worker?tab=definition&section=behavior',
    assert: page => expect(page.getByRole('navigation', { name: '智能体定义' })).toBeVisible(),
  },
];

async function applyTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    localStorage.setItem('ags-theme', t);
    if (t === 'dark') document.documentElement.classList.add('dark');
  }, theme);
}

for (const theme of THEMES) {
  for (const width of BREAKPOINTS) {
    for (const target of PAGES) {
      test(`${target.id} @ ${theme}/${width}`, async ({ page }) => {
        await applyTheme(page, theme);
        await page.setViewportSize({ width, height: 900 });
        await mockVisualApi(page);
        await page.goto(target.path);
        await target.assert(page);
        await expect(page).toHaveScreenshot(`${target.id}-${theme}-${width}.png`, { fullPage: true });
      });
    }
  }
}
