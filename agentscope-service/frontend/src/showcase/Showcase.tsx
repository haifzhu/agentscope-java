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

import * as React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Avatar } from '@/components/ui/avatar';
import { AsyncState } from '@/components/ui/async-state';
import { BackButton } from '@/components/ui/back-button';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartDataFallback } from '@/components/ui/chart-container';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { DrillDown } from '@/components/ui/drill-down';
import { EmptyState } from '@/components/EmptyState';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { MetricCard, StackedBar } from '@/components/ui/metric-card';
import { Pagination } from '@/components/ui/pagination';
import { PressureGauge } from '@/components/PressureGauge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup } from '@/components/ui/radio-group';
import { SideNav, type NavGroup } from '@/components/ui/side-nav';
import { SkeletonText } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { StatusBadge } from '@/components/StatusBadge';
import { Switch } from '@/components/ui/switch';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { Tag } from '@/components/ui/tag';
import { Timeline } from '@/components/ui/timeline';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { Tree } from '@/components/ui/tree';
import { JsonViewer } from '@/components/JsonViewer';

/* ---------- 主题切换（A3 的过渡机制在此先以最小实现验证） ---------- */

type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'agentscope.theme';
const TRANSITION_CLASS = 'theme-transitioning';
const TRANSITION_MS = 200;

function useThemeMode(): [ThemeMode, () => void] {
  const [mode, setMode] = React.useState<ThemeMode>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  const toggle = React.useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    // 仅在切换瞬间挂过渡类，避免常驻 transition 拖慢交互
    document.documentElement.classList.add(TRANSITION_CLASS);
    window.setTimeout(() => document.documentElement.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* 隐私模式下不可写，忽略 */
    }
    setMode(next);
  }, [mode]);

  return [mode, toggle];
}

/* ---------- 各组件示例 ---------- */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-b border-border py-8 last:border-b-0">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-text">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

interface DemoRow {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'failed';
  tokens: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: 'a-1', name: '检索智能体', status: 'active', tokens: 128400 },
  { id: 'a-2', name: '代码审查智能体', status: 'pending', tokens: 42100 },
  { id: 'a-3', name: '运维巡检智能体', status: 'failed', tokens: 9500 },
  { id: 'a-4', name: '数据分析智能体', status: 'active', tokens: 233000 },
];

const DEMO_COLUMNS: ColumnDef<DemoRow>[] = [
  { key: 'name', header: '名称', sortable: true, cell: (r) => <span className="font-medium text-text">{r.name}</span> },
  { key: 'status', header: '状态', cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: 'tokens',
    header: 'Token 消耗',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.tokens,
    cell: (r) => <span className="tabular-nums">{r.tokens.toLocaleString()}</span>,
  },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'work',
    label: '我的工作',
    items: [
      { id: 'workbench', label: '工作台' },
      { id: 'todos', label: '待办中心', badge: 12 },
      { id: 'approvals', label: '审批中心', badge: 3 },
    ],
  },
  {
    id: 'agents',
    label: '智能体',
    items: [
      { id: 'catalog', label: '智能体目录' },
      { id: 'definitions', label: '定义管理' },
      { id: 'runs', label: '执行记录', icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

function ToastDemo() {
  const { toast } = useToast();
  return (
    <Row>
      <Button size="sm" variant="outline" onClick={() => toast({ tone: 'success', title: '保存成功' })}>
        成功提示
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ tone: 'warning', title: '配额即将用尽', description: '剩余额度不足 10%' })}
      >
        警告提示
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ tone: 'danger', title: '执行失败', description: '数据面未响应，可重试', duration: 0 })}
      >
        错误提示
      </Button>
    </Row>
  );
}

function ShowcaseBody() {
  const [theme, toggleTheme] = useThemeMode();
  const [tab, setTab] = React.useState('overview');
  const [page, setPage] = React.useState(3);
  const [pageSize, setPageSize] = React.useState(20);
  const [checked, setChecked] = React.useState<string[]>(['a-1']);
  const [radio, setRadio] = React.useState('medium');
  const [sw, setSw] = React.useState(true);
  const [slider, setSlider] = React.useState(60);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmPhraseOpen, setConfirmPhraseOpen] = React.useState(false);

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-text">组件库 Showcase</h1>
            <p className="text-[12px] text-text-3">
              组件契约第 5 条：每个组件一个可运行示例，同时作为 A6 视觉回归的载体
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            切换到{theme === 'dark' ? '浅色' : '暗色'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 pb-16">
        <Section id="badge" title="Badge / StatusDot / Tag / Avatar">
          <Row>
            {(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).map((t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ))}
          </Row>
          <Row>
            {(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[13px] text-text-3">
                <StatusDot tone={t} label={t} />
                {t}
              </span>
            ))}
          </Row>
          <Row>
            <Tag>默认标签</Tag>
            <Tag tone="primary" onRemove={() => undefined}>
              可移除
            </Tag>
            <Tag tone="danger">阻塞</Tag>
          </Row>
          <Row>
            <Avatar name="张伟" />
            <Avatar name="Ada Lovelace" />
            <Avatar name="运维智能体" size="lg" />
          </Row>
        </Section>

        <Section id="button" title="Button">
          <Row>
            <Button>主要操作</Button>
            <Button variant="secondary">次要</Button>
            <Button variant="outline">描边</Button>
            <Button variant="ghost">幽灵</Button>
            <Button variant="destructive">危险</Button>
            <Button variant="link">链接</Button>
          </Row>
          <Row>
            <Button size="sm">小</Button>
            <Button size="default">中</Button>
            <Button size="lg">大</Button>
            <Button disabled>禁用</Button>
            <BackButton onClick={() => undefined} />
          </Row>
        </Section>

        <Section id="form" title="Input / Select / Textarea / Field / Checkbox / Radio / Switch / Slider">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="智能体名称" hint="用于在目录中展示" required>
              {(p) => <Input {...p} placeholder="例如：检索智能体" />}
            </Field>
            <Field label="命名空间" error="该命名空间已存在">
              {(p) => (
                <Select {...p} defaultValue="">
                  <option value="" disabled>
                    请选择
                  </option>
                  <option value="default">default</option>
                  <option value="ops">ops</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="描述">
            {(p) => <Textarea {...p} placeholder="简要说明该智能体的职责" />}
          </Field>
          <Row>
            <Checkbox
              label="已启用追踪"
              checked={checked.includes('trace')}
              onChange={(e) =>
                setChecked((prev) => (e.target.checked ? [...prev, 'trace'] : prev.filter((k) => k !== 'trace')))
              }
            />
            <Checkbox label="部分选中" indeterminate />
            <Checkbox label="禁用" disabled />
          </Row>
          <RadioGroup
            name="quota"
            aria-label="配额档位"
            value={radio}
            onChange={setRadio}
            options={[
              { value: 'small', label: '小', hint: '≤ 10 万 Token/日' },
              { value: 'medium', label: '中', hint: '≤ 100 万 Token/日' },
              { value: 'large', label: '大', hint: '不限额' },
            ]}
          />
          <Row>
            <Switch checked={sw} onCheckedChange={setSw} label="自动重试" hint="失败时最多重试 3 次" />
            <Switch checked={!sw} onCheckedChange={(v) => setSw(!v)} aria-label="通知开关" />
          </Row>
          <Slider label="上下文压缩阈值" value={slider} onValueChange={setSlider} formatValue={(v) => `${v}%`} />
        </Section>

        <Section id="card" title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>卡片标题</CardTitle>
                <CardDescription>卡片描述文本，双主题下均达到 AA 对比度。</CardDescription>
              </CardHeader>
              <CardContent>卡片正文内容。</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>带操作</CardTitle>
              </CardHeader>
              <CardContent>
                <Row>
                  <Button size="sm">保存</Button>
                  <Button size="sm" variant="outline">
                    取消
                  </Button>
                </Row>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="feedback" title="Progress / Skeleton / AsyncState">
          <div className="grid gap-5 sm:grid-cols-2">
            <Progress value={72} label="Token 配额" showValue />
            <Progress tone="danger" value={92} label="峰值压力" showValue />
            <Progress label="加载中（不确定态）" />
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-text-3">骨架屏</span>
              <SkeletonText rows={3} />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <AsyncState status="loading" resource="智能体">
              {null}
            </AsyncState>
            <AsyncState
              status="empty"
              resource="智能体"
              emptyDescription="还没有创建任何智能体。先定义一个角色与工作区，再把它发布到目录。"
              emptyAction={<Button size="sm">新建智能体</Button>}
            >
              {null}
            </AsyncState>
            <AsyncState
              status="error"
              resource="执行记录"
              errorDescription="数据面未响应，请检查连接后重试。"
              onRetry={() => undefined}
            >
              {null}
            </AsyncState>
          </div>
        </Section>

        <Section id="data" title="DataTable（排序 / 批量选择 / 虚拟滚动 / 行禁用）">
          <DataTable
            columns={DEMO_COLUMNS}
            rows={DEMO_ROWS}
            rowKey={(r) => r.id}
            onRowClick={() => undefined}
            selectedKeys={checked}
            onSelectedKeysChange={setChecked}
            isRowDisabled={(r) => r.status === 'failed'}
            maxHeight={280}
            caption="智能体列表"
          />
          <Pagination page={page} pageSize={pageSize} total={428} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </Section>

        <Section id="metric" title="MetricCard / StackedBar / ChartContainer">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="待我处理" value={12} unit="项" delta={8} onClick={() => undefined} />
            <MetricCard label="执行成功率" value="98.4" unit="%" delta={-1.2} positiveIsGood />
            <MetricCard label="Token 消耗" value="1.28" unit="M" trend={[12, 18, 15, 24, 22, 30, 28]} />
            <MetricCard label="失败执行" value={3} delta={50} positiveIsGood={false} />
          </div>
          <StackedBar
            segments={[
              { label: '成功', value: 812, tone: 'success' },
              { label: '运行中', value: 64, tone: 'info' },
              { label: '失败', value: 21, tone: 'danger' },
            ]}
          />
          <ChartContainer
            title="Token 趋势"
            description="近 7 日消耗"
            legend={[
              { label: '输入', tone: 'primary' },
              { label: '输出', tone: 'info' },
            ]}
            actions={<Button size="sm" variant="ghost">近 7 日</Button>}
          >
            <ChartDataFallback
              caption="Token 趋势数据表"
              columns={['日期', '输入', '输出']}
              rows={[
                ['09-17', '12,400', '3,100'],
                ['09-18', '18,200', '4,050'],
              ]}
            />
          </ChartContainer>
        </Section>

        <Section id="nav" title="Tabs / Breadcrumbs / SideNav / DrillDown">
          <Tabs
            aria-label="详情分区"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'overview', label: '概览' },
              { value: 'runs', label: '执行记录', badge: 5 },
              { value: 'settings', label: '设置' },
              { value: 'disabled', label: '禁用项', disabled: true },
            ]}
          />
          <TabPanel value="overview" activeValue={tab}>
            <p className="pt-3 text-sm text-text-2">概览内容</p>
          </TabPanel>
          <TabPanel value="runs" activeValue={tab}>
            <p className="pt-3 text-sm text-text-2">执行记录内容</p>
          </TabPanel>
          <TabPanel value="settings" activeValue={tab}>
            <p className="pt-3 text-sm text-text-2">设置内容</p>
          </TabPanel>

          <Breadcrumbs
            items={[
              { label: '智能体', onClick: () => undefined },
              { label: '检索智能体', onClick: () => undefined },
              { label: '版本 v3' },
            ]}
          />

          <DrillDown
            levels={[
              { id: 'run', label: '本次执行' },
              { id: 'step', label: '步骤 2' },
              { id: 'tool', label: '工具调用' },
            ]}
            onNavigate={() => undefined}
            actions={<Button size="sm" variant="ghost">原始事件</Button>}
          />

          <div className="max-w-xs">
            <SideNav groups={NAV_GROUPS} activeId="runs" onNavigate={() => undefined} />
          </div>
        </Section>

        <Section id="overlay" title="Dialog / Drawer / ConfirmDialog / Toast">
          <Row>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">打开弹窗</Button>
              </DialogTrigger>
              <DialogContent size="md">
                <DialogHeader>
                  <DialogTitle>弹窗标题</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <p className="text-sm text-text-2">弹窗正文。</p>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline">取消</Button>
                  <Button>确认</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">打开抽屉</Button>
              </DrawerTrigger>
              <DrawerContent size="sm">
                <DrawerHeader>
                  <DrawerTitle>抽屉标题</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>
                  <p className="text-sm text-text-2">抽屉正文。</p>
                </DrawerBody>
              </DrawerContent>
            </Drawer>

            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              普通确认
            </Button>
            <Button variant="destructive" onClick={() => setConfirmPhraseOpen(true)}>
              销毁确认（二次输入）
            </Button>
          </Row>
          <ToastDemo />

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="确认下线该智能体？"
            description="下线后其渠道绑定将暂停，已有会话不受影响。"
            dangerLevel="warning"
            onConfirm={() => setConfirmOpen(false)}
          />
          <ConfirmDialog
            open={confirmPhraseOpen}
            onOpenChange={setConfirmPhraseOpen}
            title="永久删除命名空间"
            description="该操作不可撤销。"
            dangerLevel="danger"
            confirmLabel="永久删除"
            confirmPhrase="ops-prod"
            confirmPhraseHint="将连同该命名空间下的全部智能体、凭据与执行记录一并删除。"
            onConfirm={() => setConfirmPhraseOpen(false)}
          />
        </Section>

        <Section id="display" title="Timeline / Tree / JsonViewer / PressureGauge">
          <div className="grid gap-6 lg:grid-cols-2">
            <Timeline
              items={[
                { id: 't1', title: '执行开始', time: '10:02:11', tone: 'info' },
                { id: 't2', title: '工具调用 · web_search', description: '耗时 1.2s', time: '10:02:14', tone: 'primary' },
                { id: 't3', title: '执行失败', description: '上游超时', time: '10:02:31', tone: 'danger' },
              ]}
            />
            <Tree
              aria-label="子工单树"
              defaultExpanded={['p1']}
              selectedId="c1"
              onSelect={() => undefined}
              nodes={[
                {
                  id: 'p1',
                  label: '主工单 · 渠道接入异常',
                  meta: <StatusBadge status="active" />,
                  children: [
                    { id: 'c1', label: '子工单 · 排查凭据', meta: '进行中' },
                    { id: 'c2', label: '子工单 · 回归验证', meta: '待开始' },
                  ],
                },
              ]}
            />
          </div>
          <Row>
            <PressureGauge value={0.42} />
            <PressureGauge value={0.78} />
            <PressureGauge value={0.93} />
            <PressureGauge value={null} />
          </Row>
          <JsonViewer value={{ agent: 'retriever', tools: ['web_search'], retries: 3 }} />
        </Section>

        <Section id="empty" title="EmptyState（兼容既有调用点）">
          <div className={cn('max-w-md')}>
            <EmptyState
              title="还没有智能体"
              description="先定义一个角色与工作区，再把它发布到目录。"
              action={<Button size="sm">新建智能体</Button>}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}

export function Showcase() {
  return (
    <ToastProvider>
      <ShowcaseBody />
    </ToastProvider>
  );
}
