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

import { cn } from '@/lib/utils';

/**
 * 焦点环：全站统一的键盘焦点样式。
 * 用 ring 令牌而非字面色值，保证双主题下对比度一致。
 */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

/** 禁用态：控件统一用 opacity + cursor，避免各组件各写一套。 */
export const disabledState = 'disabled:cursor-not-allowed disabled:opacity-50';

/** 浮层表面：卡片 / 下拉 / 弹窗共用的边界与阴影。 */
export const overlaySurface = 'border border-border bg-popover text-popover-foreground shadow-3';

/** 表单控件框：用 border-control 以满足 WCAG 1.4.11 的 3:1 非文本对比。 */
export const controlBorder = 'border border-border-control';

/**
 * 语义色三件套的工具类映射。
 * 组件契约第 1 条要求「令牌-only」：此处是全站唯一允许写语义色的地方。
 */
export const toneClasses = {
  neutral: 'bg-surface-3 text-text-2',
  primary: 'bg-primary-soft text-primary-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text',
} as const;

export type Tone = keyof typeof toneClasses;

/** 实心语义色：用于进度条、状态点、图表填充。 */
/**
 * 实心语义填充。fill-only 契约：这些底色上如需文字，前景一律用
 * 白色（*-foreground / text-white）；语义文字请改用 *-soft 底 + *-text 字。
 * 双主题实心值均满足白字 ≥4.5:1（见 index.css 暗色块注释）。
 */
export const solidToneClasses = {
  neutral: 'bg-text-4',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;

export function toneClass(tone: Tone = 'neutral', className?: string) {
  return cn(toneClasses[tone], className);
}
