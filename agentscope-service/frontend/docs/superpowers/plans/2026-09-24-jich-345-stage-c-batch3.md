---
change: jich-345-stage-c-batch3
design-doc: docs/superpowers/specs/2026-09-23-jich-332-frontend-redesign-design.md
base-ref: 04dfe314
---

# JICH-345 阶段 C 逐域重做第三批（C14–C19）

基线：`agent/2/c862c768a796-c7c13`（`78e63e6c` + 15 commit，未 push）。改动收敛在 `agentscope-service/frontend/`。

## 任务

- [x] C14 自动化：编辑器改四步向导（基本信息→执行者与产出→触发器→高级与确认）；Cron 实时预览接下来 3 次；令牌化中文化
- [x] C15 资源管理统一：工作空间/运行环境/记忆库/密钥库四类资源统一 Page+AsyncState 范式；清除四页内联样式兼容层（EnvironmentsHub/MemoryStores/Vaults/WorkspaceDetail 全量重写，LoginPage 一并去内联样式）
- [x] C16 权限与治理：三层权限模型解释（PermissionModelGuide）；审计员反直觉规则显式提示（RoleGuide + 模型说明）；settings 域与 AdminUsersPage 令牌化中文化
- [x] C17 工作动态：导航正式入口（/work/activity）；时间线中文化与状态语义化（今天/昨天分组、状态变更中文标签）
- [x] C18 渠道集成：渠道中心/渠道详情/智能体渠道三页重写为组件库范式 + 空状态
- [x] C19 个人资料/登录：令牌化中文化，登录页去内联样式
- [x] ESLint：C14–C19 域内文件纳入 CONTRACT_ENFORCED（error）
- [x] 视觉回归：新增 9 页（17→26 页 × 双主题 × 4 断点 = 208 用例），生成并复跑全绿
- [x] 构建验证：lint 0 错 + 单测 235 全绿 + build 通过

## 约束

- 不动后端；不 push，本地 commit 交付（分支 + 累计 patch + 本轮 patch）
- 语义令牌 only；文案随域中文化

## 备注

- `.console-page-legacy` 全局 CSS 兼容层仍被 `AgentCreatePage` 使用，按其注释约定留待阶段 D1 移除。
- D1 建议纳入 JICH-340 评审记录的 3 个 MEDIUM 项（拖拽位置持久化预期、AgentVersionsPanel 快照缓存失效、端点页 API 透传错误消息中文化）。
