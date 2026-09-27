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

import { ApiError } from './apiClient';

/**
 * HTTP 状态的中文口径（A4 术语层收口）。
 * 后端正文往往是英文，直出界面会中英混排；这里给出中文前缀，
 * 原文仍作为详情保留，便于排查，不丢信息。
 */
const STATUS_LABEL: Record<number, string> = {
  400: '请求参数有误',
  401: '登录已过期，请重新登录',
  403: '没有权限执行该操作',
  404: '目标不存在或已被删除',
  409: '当前状态不允许该操作',
  412: '前置条件未满足',
  422: '提交内容未通过校验',
  429: '操作过于频繁，请稍后重试',
  500: '服务内部错误',
  502: '上游服务不可用',
  503: '服务暂时不可用',
  504: '上游服务响应超时',
};

/** 后端偶尔把英文状态短语本身当正文返回，这类内容与中文前缀重复，不再拼进提示。 */
const GENERIC_BODIES = new Set([
  'unauthorized', 'forbidden', 'not found', 'bad request', 'conflict',
  'internal server error', 'service unavailable', 'gateway timeout',
]);

/** 把任意异常收敛成一句面向用户的中文提示；未知异常回落到调用方给的兜底文案。 */
export function apiErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    const prefix = STATUS_LABEL[cause.status] ?? `请求失败（HTTP ${cause.status}）`;
    const detail = cause.body?.trim();
    if (!detail || GENERIC_BODIES.has(detail.toLowerCase())) return prefix;
    return `${prefix}：${detail}`;
  }
  if (cause instanceof Error && cause.message) return cause.message;
  return fallback;
}
