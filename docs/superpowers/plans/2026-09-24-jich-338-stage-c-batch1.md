---
change: jich-338-stage-c-batch1
design-doc: docs/superpowers/specs/2026-09-23-jich-332-design-tokens.css
base-ref: 78e63e6c
---

# JICH-338 阶段 C 逐域重做第一批（C1–C6）

基线：`agent/2/8255a8329a1b`（15 commit，未 push）。改动收敛在 `agentscope-service/frontend/`。

## 任务

- [ ] C2 待办中心：inboxModel 中文化 + 4 分组（16 类型映射）；InboxPage 令牌化 + 中文化 + 计数条 + URL 筛选（view/group/type/archived）；需要处理的消息不可归档（提示文案）；单测
- [ ] C3 审批中心：独立页 `/work/approvals`（列表 + 批量批准 + 超时置灰）；ApprovalDetail 令牌化中文化，驳回理由必填；导航入口 + 唯一 legacy 重定向；单测
- [ ] C4 工单列表：issueProperties 增加状态机合法流转表（+单测）；IssuesPage 令牌化中文化；列表/看板/分组三视图（URL 参数 layout）；看板拖拽改状态需二次确认且仅合法目标
- [ ] C5 工单详情：IssueDetailPage 重组为七分区（标题区/讨论/活动/属性/子工单树/验收/产物+执行关联）；子工单树形（ui/tree）；状态菜单仅合法流转；令牌化中文化
- [ ] C6 智能体定义层级压缩：定义六项由子路由第三层改为 `?section=` 横向标签；legacy `definition/*` 重定向；tab/文案中文化；令牌化
- [ ] C1 工作台：快捷入口（按权限显隐）；运行健康度 + 异常提醒 + Token 趋势（A5 折线图，运维/管理员可见，无权限整体不渲染）；指标卡带筛选跳转
- [ ] ESLint：域内文件纳入 CONTRACT_ENFORCED（error）
- [ ] 视觉回归：按 README 扩展方式为 6 域页面补基线（双主题 × 4 断点），提取 e2e/visualFixtures.ts
- [ ] 构建验证：lint + test + build 全绿；e2e 视觉基线生成并复跑通过

## 约束

- 不 push，本地 commit，交付分支 + 累计 patch + 本轮 patch
- 术语沿用 A4 既有口径（issues = 事项）
