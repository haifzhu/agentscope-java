# A6 视觉回归基线说明（JICH-337）

## 覆盖范围

| 页面 | 断点 | 主题 |
|---|---|---|
| `/login` 登录页 | 320 / 768 / 1024 / 1440 | light / dark |
| `/work/overview` 工作台（阶段 B 试点页） | 320 / 768 / 1024 / 1440 | light / dark |

共 16 张基线截图，存于 `agentscope-service/frontend/e2e/visual-snapshots/`，随仓库提交。

## 运行方式

```bash
cd agentscope-service/frontend

# 对比基线（CI / 本地回归检查）
pnpm test:visual

# 改动确认后更新基线
pnpm test:visual:update
```

独立配置 `playwright.visual.config.ts`：仅 chromium（截图基线跨浏览器不可比，功能覆盖由既有 e2e 承担）、关闭 CSS 动画与光标、`maxDiffPixelRatio 0.005`、workers=1。功能 e2e 的 `playwright.config.ts` 通过 `testIgnore` 排除视觉用例，互不干扰。

## 确定性保障

- 所有 `/api/**` 请求路由 mock，不依赖后端；
- 外网字体（Google Fonts）在用例内拦截，`document.fonts.ready` 不会挂起，CI 离线可跑；
- 主题通过 `addInitScript` 在首帧前写入 `ags-theme` + `.dark`，与生产防闪烁脚本同路径。

## 阶段 C 扩展方式

每个域重做落地后，在 `e2e/visual-baseline.e2e.ts` 增加对应 `test(\`<page> @ ${theme}/${width}\`)` 块并 `pnpm test:visual:update` 生成基线；之后该域即受像素级回归保护。共享 mock 建议提取到 `e2e/visualFixtures.ts`（当前 2 页面规模暂不需要）。
