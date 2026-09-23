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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * 组件库 Showcase 专用构建配置。
 *
 * 刻意与 vite.config.ts 分离：
 * - 生产构建（vite.config.ts）产物进 ../aistio/ui，由 Go 服务静态托管，
 *   不应包含 showcase 页面；
 * - showcase 产物进 dist-showcase（已 gitignore），仅用于本地验收与
 *   A6 视觉回归截图。
 *
 * showcase 对 CSS 的影响用 index.css 里的 `@source not` 控制：
 * 生产构建不扫描 src/showcase，避免把示例用到的全部变体打进首屏 CSS。
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-showcase',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./showcase.html', import.meta.url)),
    },
  },
});
