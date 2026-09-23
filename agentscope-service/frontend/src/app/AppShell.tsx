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

import { useAccountIdentity } from '@/lib/accountIdentity';
import { logoutAccount } from '@/api/auth';
/*
 * Copyright 2024-2026 the original author or authors.
 * Licensed under the Apache License, Version 2.0.
 */

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resourceURL } from '@/api/resourceAccess';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  CircleGauge,
  ClipboardCheck,
  Database,
  FileStack,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { namespaceCan } from '@/lib/namespaceScope';
import { cn } from '@/lib/utils';
import { clearToken, getRoles, getUsername, isAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useControlPlaneScope } from './ScopeContext';
import { NamespaceSwitcher } from './NamespaceSwitcher';
import { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
import { useCollaborationEvents } from './useCollaborationEvents';
import { getInboxSummary } from '@/api/collaboration';
import { formatAttentionCount, type ApprovalAttentionSummary } from './approvalAttention';
import { ThemeToggle } from './theme/theme-toggle';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  admin?: boolean;
  operator?: boolean;
  agentCenter?: boolean;
  configure?: boolean;
};

type NavGroup = { id: string; label?: string; items: NavItem[] };

/**
 * 六分组导航（PRD 5.2 / 技术方案 B1）：
 * Work=我的工作 ｜ Agents=智能体 ｜ Run=运行 ｜ Access=接入 ｜ Resources=资源 ｜ Admin=管理。
 * 显隐在渲染期过滤（visibleNavigation），无权限项不渲染、不重定向。
 */
const navigation: NavGroup[] = [
  {
    id: 'work',
    label: '工作',
    items: [
      { to: '/work/overview', label: '工作台', icon: CircleGauge, end: true },
      { to: '/work/chat', label: '对话', icon: MessageSquare },
      { to: '/work/issues', label: '事项', icon: FileStack },
      { to: '/work/inbox', label: '待办中心', icon: ClipboardCheck },
      { to: '/work/approvals', label: '审批中心', icon: ShieldCheck },
      { to: '/work/automations', label: '自动化', icon: Activity },
    ],
  },
  {
    id: 'agents',
    label: '智能体',
    items: [
      { to: '/agent-center/agents', label: '智能体', icon: Bot, agentCenter: true },
      { to: '/agent-center/teams', label: '团队', icon: UsersRound, agentCenter: true },
      { to: '/agent-center/workflows', label: '工作流', icon: Workflow, agentCenter: true },
    ],
  },
  {
    id: 'run',
    label: '运行',
    items: [
      { to: '/work/executions', label: '执行记录', icon: Activity, operator: true, end: true },
      { to: '/work/sessions', label: '会话', icon: Network, operator: true, end: true },
    ],
  },
  {
    id: 'access',
    label: '接入',
    items: [
      { to: '/agent-center/entrypoints', label: '接入渠道', icon: Plug, agentCenter: true, configure: true },
    ],
  },
  {
    id: 'resources',
    label: '资源',
    items: [
      { to: '/agent-center/workspaces', configure: true, label: '工作空间', icon: FileStack, agentCenter: true },
      { to: '/agent-center/environments', configure: true, label: '运行环境', icon: Settings2, agentCenter: true },
      { to: '/agent-center/memory', configure: true, label: '记忆库', icon: Database, agentCenter: true },
      { to: '/agent-center/vaults', configure: true, label: '密钥库', icon: ShieldCheck, agentCenter: true },
    ],
  },
  {
    id: 'admin',
    label: '管理',
    items: [
      { to: '/settings/namespaces', label: '命名空间', icon: Settings2, admin: true },
      { to: '/settings/users', label: '用户', icon: UsersRound, admin: true },
      { to: '/settings/access-log', label: '访问日志', icon: FileStack, admin: true },
      { to: '/settings/integrations', label: '集成', icon: Plug, admin: true },
    ],
  },
];

const routeLabels: Array<[string, string]> = [
  ['/work/overview', '工作台'],
  ['/work/chat', '对话'],
  ['/work/issues', '事项'],
  ['/work/inbox', '待办中心'],
  ['/work/approvals', '审批中心'],
  ['/work/automations', '自动化'],
  ['/work/activity', '活动'],
  ['/work/executions', '执行记录'],
  ['/work/sessions', '会话'],
  ['/agent-center/agents', '智能体'],
  ['/agent-center/teams', '团队'],
  ['/agent-center/workflows', '工作流'],
  ['/agent-center/endpoints', 'API 详情'],
  ['/agent-center/entrypoints', '接入渠道'],
  ['/agent-center/workspaces', '工作空间'],
  ['/agent-center/environments', '运行环境'],
  ['/agent-center/memory', '记忆库'],
  ['/agent-center/vaults', '密钥库'],
  ['/settings/namespaces', '命名空间'],
  ['/settings/users', '用户'],
  ['/settings/access-log', '访问日志'],
  ['/settings/profile', '个人资料'],
];

function matches(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function SidebarLink({ item, attention }: { item: NavItem; attention?: ApprovalAttentionSummary }) {
  const { scopedPath } = useControlPlaneScope();
  const location = useLocation();
  const Icon = item.icon;
  const active = matches(location.pathname, item.to, item.end);
  return (
    <NavLink
      to={scopedPath(item.to)}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-text-2 hover:bg-hover hover:text-foreground',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-text-3 group-hover:text-current" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!!attention?.total && (
        <span
          className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold leading-none text-warning-text"
          aria-label={`${attention.total} 项待处理`}
          title={`${attention.pending} 项待确认 · ${attention.unread} 条未读通知`}
        >
          {formatAttentionCount(attention.total)}
        </span>
      )}
    </NavLink>
  );
}

export default function AppShell() {
  useAccountIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const username = getUsername();
  const admin = isAdmin();
  const roles = getRoles().map((role) => role.toLowerCase());
  const scope = useControlPlaneScope();
  useCollaborationEvents(scope.tenant, scope.namespace);
  const inboxSummary = useQuery({
    queryKey: ['inbox-summary', scope.tenant, scope.namespace],
    queryFn: () => getInboxSummary(scope.tenant, scope.namespace),
    refetchInterval: 5_000,
  });
  const summary = inboxSummary.data?.summary;
  const approvalAttention = summary ? { total: summary.attentionTotal, unread: summary.unread, pending: summary.pendingApprovals } : undefined;
  // 审批中心角标只数待审批请求（PRD 5.4：审批从收件箱拆分为独立入口）。
  const approvalsAttention = summary ? { total: summary.pendingApprovals, unread: 0, pending: summary.pendingApprovals } : undefined;
  const canAgentCenter = scope.roles.length > 0 || admin || roles.includes('agent_developer') || roles.includes('operator');
  const visibleNavigation = navigation.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (!item.configure || namespaceCan(scope.roles, 'configure')) && (!item.admin || admin) && (!item.operator || admin || roles.includes('operator')) && (!item.agentCenter || canAgentCenter)),
  })).filter((group) => group.items.length > 0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  useCommandPaletteShortcut(openCommand);
  useEffect(() => setMobileNavOpen(false), [location.pathname]);
  // 移动端抽屉（B3）：Escape 可关闭，打开时焦点移入侧栏保证键盘可达。
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);
  const resourceMatch = location.pathname.match(/^\/agent-center\/(agents|teams|workflows|entrypoints|workspaces)\/([^/]+)/);
  const accessLink = resourceMatch && resourceMatch[2] !== 'new' && !location.pathname.includes('/manage') ? resourceURL(scope.namespace, ({ agents: 'agent', teams: 'team', workflows: 'workflow', entrypoints: 'channel', workspaces: 'workspace' } as Record<string, string>)[resourceMatch[1]], decodeURIComponent(resourceMatch[2])) : undefined;
  const context = routeLabels.find(([prefix]) => matches(location.pathname, prefix));

  return (
    <div className="flex h-full min-h-0 bg-canvas">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:translate-y-0"
      >
        跳到主要内容
      </a>
      {mobileNavOpen && <div aria-hidden="true" className="fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setMobileNavOpen(false)} />}
      <aside
        aria-label="侧边栏"
        className={cn('fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform lg:static lg:z-auto lg:translate-x-0', mobileNavOpen ? 'translate-x-0' : '-translate-x-full')}
      >
        <div className="border-b border-border px-4 py-4">
          <Link className="flex items-center gap-3 rounded-lg" to="/work/overview">
            <img src="/logo.svg" alt="AgentScope" className="h-9 w-9 shrink-0" width={36} height={36} />
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight text-foreground">AgentScope 管理平台</div>
              <div className="truncate text-xs text-muted-foreground">管理控制台</div>
            </div>
          </Link>
        </div>

        <NamespaceSwitcher />

        <nav aria-label="主导航" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {visibleNavigation.map((group) => <div key={group.id} className="space-y-1">
            {group.label && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-4">{group.label}</div>}
            {group.items.map((item) => <SidebarLink key={item.to} item={item} attention={item.to === '/work/inbox' ? approvalAttention : item.to === '/work/approvals' ? approvalsAttention : undefined} />)}
          </div>)}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">已登录：{username || '访客'}</div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 px-2" onClick={() => navigate('/settings/namespaces')}>访问设置</Button>
            <Button variant="ghost" size="sm" className="flex-1 px-2" onClick={() => navigate('/settings/profile')}>个人资料</Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => { try { await logoutAccount(); } finally { clearToken(); navigate('/login'); } }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开导航" onClick={() => setMobileNavOpen(true)}><Menu className="h-4 w-4" /></Button>
            <div className="hidden min-w-0 text-sm font-medium text-foreground xl:block">{context?.[1] || 'AgentScope'}</div>
          </div>
          <div className="flex items-center gap-3">
            {accessLink && <Link className="text-xs font-medium text-primary-text" to={accessLink}>访问与依赖</Link>}
            <ThemeToggle />
            <button type="button" onClick={openCommand} className="flex h-8 items-center gap-2 rounded-lg border border-border bg-muted px-2 text-xs text-muted-foreground hover:bg-hover sm:min-w-52 sm:px-3" aria-label="搜索"><Search className="h-3.5 w-3.5" /><span className="hidden flex-1 text-left sm:block">搜索</span><kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] sm:block">⌘K</kbd></button>
            {scope.selectorVisible && <div className="hidden font-mono text-xs text-muted-foreground md:block">{scope.tenant} / {scope.namespace}</div>}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-auto bg-surface focus:outline-none">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
