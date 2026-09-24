---
change: jich-340-stage-c-batch2
design-doc: docs/superpowers/specs/2026-09-23-jich-332-frontend-redesign-design.md
base-ref: 4f100d98
---

# JICH-340 阶段 C 逐域重做第二批（C7–C13）

基线：`agent/2/2eb6492bf6ef`（`78e63e6c` + 6 commit，未 push）。改动收敛在 `agentscope-service/frontend/`。

## 任务

- [ ] C7 智能体定义编辑器：六项（行为/工作区/技能/工具与MCP/子智能体/版本）编辑体验重构；新增版本对比；令牌化中文化
- [ ] C8 执行记录：三层钻取（列表→运行→节点/事件）；失败节点折叠态高亮
- [ ] C9 会话运维：危险操作三档视觉分级；全部二次确认
- [ ] C10 团队编排：6 个限额字段折叠 + 业务语言标签；配置摘要预览
- [ ] C11 工作流设计器：拖拽/缩放/自动布局；实时校验；成环拒绝
- [ ] C12 工作流运行追踪：8 种节点语义不变，令牌化中文化
- [ ] C13 API 端点一屏总览：四张卡；凭据一次性明文强引导
- [ ] ESLint：7 域文件纳入 CONTRACT_ENFORCED（error）
- [ ] 视觉回归：按 README 扩展方式为 7 域补基线（双主题 × 4 断点）
- [ ] 构建验证：lint + test + build 全绿；视觉基线生成并复跑通过

## 约束

- 不 push，本地 commit，交付分支 + 累计 patch + 本轮 patch
- 术语沿用 A4 既有口径（issues = 事项）
- C7–C9 完成即达 M1 主干可用
