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

import { describe, expect, it } from 'vitest';
import { ApiError } from './apiClient';
import { apiErrorMessage } from './apiError';

/**
 * API 错误中文化（D 阶段 MEDIUM-3）。
 * 后端正文常为英文；直出界面会中英混排，这里固定「中文前缀 + 原文详情」的口径。
 */
describe('apiErrorMessage', () => {
  it('maps known statuses to Chinese', () => {
    expect(apiErrorMessage(new ApiError(404, 'not found'), '兜底')).toBe('目标不存在或已被删除');
    expect(apiErrorMessage(new ApiError(403, 'forbidden'), '兜底')).toBe('没有权限执行该操作');
    // 非通用正文会作为详情保留在中文前缀之后。
    expect(apiErrorMessage(new ApiError(429, 'rate limit exceeded'), '兜底'))
      .toBe('操作过于频繁，请稍后重试：rate limit exceeded');
  });

  it('folds generic English status bodies instead of repeating them', () => {
    // 「目标不存在或已被删除：Not Found」是噪音，正文落到通用词表时不再拼接。
    expect(apiErrorMessage(new ApiError(404, 'Not Found'), '兜底')).toBe('目标不存在或已被删除');
    expect(apiErrorMessage(new ApiError(500, 'Internal Server Error'), '兜底')).toBe('服务内部错误');
  });

  it('keeps a substantive body as detail after the Chinese prefix', () => {
    const message = apiErrorMessage(new ApiError(409, 'runbook 不能为空'), '兜底');
    expect(message).toBe('当前状态不允许该操作：runbook 不能为空');
  });

  it('renders an unknown status as a readable HTTP prefix', () => {
    expect(apiErrorMessage(new ApiError(418, 'teapot'), '兜底')).toBe('请求失败（HTTP 418）：teapot');
  });

  it('treats an empty body as no detail', () => {
    expect(apiErrorMessage(new ApiError(503, ''), '兜底')).toBe('服务暂时不可用');
  });

  it('passes through plain Error messages unchanged', () => {
    expect(apiErrorMessage(new Error('上下文链接必须以 https:// 或 http:// 开头。'), '兜底'))
      .toBe('上下文链接必须以 https:// 或 http:// 开头。');
  });

  it('falls back for non-Error values', () => {
    expect(apiErrorMessage(undefined, '操作失败')).toBe('操作失败');
    expect(apiErrorMessage('boom', '操作失败')).toBe('操作失败');
  });
});
