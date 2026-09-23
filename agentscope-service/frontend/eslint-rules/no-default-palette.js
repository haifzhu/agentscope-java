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

/**
 * 禁止在 className 中使用 Tailwind 默认调色板。
 *
 * 背景（JICH-332 技术方案 §2.4）：现有 ui/ 组件用 `bg-emerald-50`
 * 这类默认调色板类名，它们**不经过设计令牌**，因此 §2.3 的
 * `@theme` + `:root`/`.dark` 覆盖机制对它们完全无效 ——
 * 结果是暗色主题下这些元素颜色不跟随，且无法全站统一换肤。
 *
 * 这条规则把「不可按页面自定义语义色」这条 PRD 约束从文档变成
 * 机器可执行的检查：语义色只能走 tokens.ts 里的语义令牌类名。
 *
 * 允许的例外：
 * - `dark:` / `hover:` 等变体前缀本身不受限，只看后面的工具类
 * - `-` 开头的负值类（如 -mt-4）不涉及颜色，天然不匹配
 */

/** Tailwind 默认调色板名（v4 内置）。 */
const PALETTE = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
].join('|');

/** 颜色属性前缀。ring-offset-* 与 placeholder-* 也必须覆盖，
    否则 `ring-offset-slate-200`、`placeholder-slate-400` 会漏检。 */
const COLOR_PREFIX = [
  'bg', 'text', 'border', 'ring', 'ring-offset', 'divide', 'outline', 'decoration',
  'from', 'via', 'to', 'fill', 'stroke', 'accent', 'caret', 'shadow', 'placeholder',
].join('|');

/** 变体前缀链，如 `dark:hover:`、`group-focus:`、`sm:`。 */
const VARIANT = '(?:[a-z-]+(?:-\\[[^\\]]+\\])?:)*';

/** 透明度修饰符与 important 后缀，如 `/35`、`/80`、`!`。 */
const SUFFIX = '(?:\\/\\d+)?!?';

const PALETTE_RE = new RegExp(
  `\\b${VARIANT}(?:${COLOR_PREFIX})-(?:${PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)${SUFFIX}(?![\\w-])`,
  'g',
);

/** 暗色下必然失效的字面色：白底、纯黑字/底，以及其他属性的白/黑。
    覆盖全部颜色前缀，避免 `text-white`、`ring-white`、`fill-white` 漏检。 */
const LITERAL_RE = new RegExp(
  `\\b${VARIANT}(?:${COLOR_PREFIX})-(?:white|black)${SUFFIX}(?![\\w-])`,
  'g',
);

function scan(value, report) {
  if (typeof value !== 'string') return;
  for (const re of [PALETTE_RE, LITERAL_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(value)) !== null) {
      report(match[0], match.index);
    }
  }
}

export const noDefaultPalette = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止使用 Tailwind 默认调色板，语义色必须走设计令牌',
    },
    schema: [],
    messages: {
      defaultPalette:
        "'{{utility}}' 是 Tailwind 默认调色板，不经过设计令牌，暗色主题下不会跟随。" +
        '请改用 src/components/ui/tokens.ts 中的语义令牌类名（如 bg-success-soft / text-danger-text）。',
    },
  },

  create(context) {
    return {
      // className="..." / cn('...') / cva('...') 里的普通字符串
      Literal(node) {
        scan(node.value, (utility) =>
          context.report({ node, messageId: 'defaultPalette', data: { utility } }),
        );
      },

      // 模板字符串：只看静态片段，跳过 ${...} 插值
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          scan(quasi.value.cooked ?? quasi.value.raw, (utility) =>
            context.report({ node: quasi, messageId: 'defaultPalette', data: { utility } }),
          );
        }
      },
    };
  },
};

export default { rules: { 'no-default-palette': noDefaultPalette } };
