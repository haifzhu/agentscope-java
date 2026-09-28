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
 * 允许前端提交的远程地址协议白名单。
 *
 * D 阶段安全收口：`file:` / `ssh:` / `git:` 之类的 scheme 会绕过 http(s) 的
 * 传输约束，交给服务端去抓取等于把协议选择权让给用户输入。前端在提交前
 * 先行拦截（服务端仍应独立校验，前端校验只是第一道）。
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export interface HttpUrlCheck {
  ok: boolean;
  /** 校验失败时面向用户的中文原因；通过时为 null。 */
  reason: string | null;
}

/**
 * 校验一个用户输入的远程地址是否为 http(s)。
 *
 * @param raw   用户原始输入（允许前后空格）
 * @param label 字段名，用于拼出可读的错误文案，如「上下文链接」
 */
export function checkHttpUrl(raw: string, label: string): HttpUrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: `请填写${label}。` };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `${label}必须以 https:// 或 http:// 开头。` };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      reason: `${label}只支持 https:// 或 http://，当前为 ${url.protocol.replace(':', '')}://。`,
    };
  }
  return { ok: true, reason: null };
}

/** 校验失败时直接抛出带中文原因的 Error，供 mutationFn 的早失败路径使用。 */
export function assertHttpUrl(raw: string, label: string): string {
  const check = checkHttpUrl(raw, label);
  if (!check.ok) throw new Error(check.reason ?? `${label}不合法。`);
  return raw.trim();
}
