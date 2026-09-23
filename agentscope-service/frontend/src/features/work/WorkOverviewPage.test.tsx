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

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import WorkOverviewPage, { METRIC_LINKS, asyncStatusOf, canUseAgentCenter } from './WorkOverviewPage';
import { ScopeProvider } from '@/app/ScopeContext';

/**
 * 工作台试点（JICH-336）回归测试：
 * 1. 首屏第一张指标卡是「Needs attention」（PRD 5.3）；
 * 2. 指标卡是带筛选跳转的可交互元素（PRD 5.3）；
 * 3. 无智能体中心权限时不渲染 Teams 卡（PRD 5.3：无权限区块不渲染）。
 */

const rolesOf = vi.hoisted(() => ({ value: [] as string[] }));

// node 环境无 localStorage；ScopeProvider 在无 token 时回退默认空间。
beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
});

vi.mock('@/api/auth', () => ({
  getRoles: () => rolesOf.value,
}));

vi.mock('@/api/collaboration', () => ({
  listIssues: () => Promise.resolve({ items: [{ id: 'i-1', title: 'Fix login', status: 'open', updatedAt: '2026-09-23T00:00:00Z', assigneeType: 'user', assigneeRef: 'u1' }] }),
  listTeams: () => Promise.resolve({ items: [{ id: 't-1' }] }),
  listInbox: () => Promise.resolve({ items: [] }),
  getInboxSummary: () => Promise.resolve({ summary: { attentionTotal: 3, unread: 2, pendingApprovals: 1 } }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        null,
        createElement(ScopeProvider, null, createElement(WorkOverviewPage)),
      ),
    ),
  );
}

describe('canUseAgentCenter', () => {
  it('grants agent-center access to the three build-side roles only', () => {
    expect(canUseAgentCenter(['admin'])).toBe(true);
    expect(canUseAgentCenter(['Operator'])).toBe(true);
    expect(canUseAgentCenter(['agent_developer'])).toBe(true);
    expect(canUseAgentCenter(['viewer'])).toBe(false);
    expect(canUseAgentCenter([])).toBe(false);
  });
});

describe('asyncStatusOf', () => {
  it('maps query state to the four AsyncState statuses with loading first', () => {
    expect(asyncStatusOf({ isLoading: true, isError: false, isEmpty: false })).toBe('loading');
    expect(asyncStatusOf({ isLoading: false, isError: true, isEmpty: false })).toBe('error');
    expect(asyncStatusOf({ isLoading: false, isError: false, isEmpty: true })).toBe('empty');
    expect(asyncStatusOf({ isLoading: false, isError: false, isEmpty: false })).toBe('ready');
  });
});

describe('WorkOverviewPage (pilot render)', () => {
  it('renders "Needs attention" as the first metric card', () => {
    rolesOf.value = [];
    const html = renderPage();
    const firstCard = html.indexOf('Needs attention');
    expect(firstCard).toBeGreaterThan(-1);
    expect(html.indexOf('Open issues')).toBeGreaterThan(firstCard);
  });

  it('hides the Teams card without agent-center roles', () => {
    rolesOf.value = ['viewer'];
    const html = renderPage();
    expect(html).not.toContain('>Teams<');
  });

  it('shows the Teams card for agent-center roles', () => {
    rolesOf.value = ['agent_developer'];
    const html = renderPage();
    expect(html).toContain('Teams');
  });

  it('links attention metrics to the filtered inbox view', () => {
    expect(METRIC_LINKS.attention).toBe('/work/inbox?view=attention');
    expect(METRIC_LINKS.openIssues).toBe('/work/issues?status=open');
  });
});
