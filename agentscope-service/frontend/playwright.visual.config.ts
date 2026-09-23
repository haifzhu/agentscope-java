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

import { defineConfig } from '@playwright/test';

/**
 * A6 视觉回归专用配置（与功能 e2e 的 playwright.config.ts 分离）。
 *
 * - 只跑 chromium：截图基线跨浏览器不可比，火狐/WebKit 用功能 e2e 覆盖。
 * - 关闭动画与光标：动效会让截图不稳定。
 * - 基线落在 e2e/visual-snapshots/<theme>/<viewport>/，随仓库提交。
 *   更新基线：pnpm test:visual -- --update-snapshots
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/visual-baseline.e2e.ts',
  timeout: 60000,
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  snapshotPathTemplate: '{testDir}/visual-snapshots/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5177',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177',
    reuseExistingServer: !process.env.CI,
  },
});
