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

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import local from './eslint-rules/no-default-palette.js';

/**
 * 迁移进度（JICH-332 阶段 A）：
 *   ui/ 组件库 + 本次改造的存量组件已令牌化，规则对它们生效（error）。
 *   其余页面/特性目录仍有历史默认调色板用法，需在阶段 C 逐域迁移时清除，
 *   故暂降为 warn。C 阶段收口后把下面的 warn 提升为 error。
 */
const CONTRACT_ENFORCED = [
  'src/components/ui/**/*.{ts,tsx}',
  'src/components/JsonViewer.tsx',
  'src/components/StatusBadge.tsx',
  'src/components/PressureGauge.tsx',
  'src/components/EmptyState.tsx',
  'src/components/Page.tsx',
];

export default tseslint.config(
  { ignores: ['../aistio/ui/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local,
    },
    rules: {
	  'react-hooks/rules-of-hooks': 'error',
	  'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
	  '@typescript-eslint/no-unused-vars': 'warn',
	  'no-unused-vars': 'off',
	  'prefer-const': 'warn',
    },
  },
  {
    // 全站提示：语义色必须走设计令牌，不能写 Tailwind 默认调色板
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'local/no-default-palette': 'warn' },
  },
  {
    // 已迁移区域：硬性禁止，回归即报错
    files: CONTRACT_ENFORCED,
    rules: { 'local/no-default-palette': 'error' },
  },
);
