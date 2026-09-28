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
import { assertHttpUrl, checkHttpUrl } from './urls';

/**
 * 远程地址协议白名单（D 阶段安全 LOW-2）。
 * 市场源 git 地址只接受 http(s)：file:/ssh:/git: 等 scheme 不应交给服务端解释。
 */
describe('checkHttpUrl', () => {
  it('accepts plain http and https remotes', () => {
    expect(checkHttpUrl('https://github.com/acme/skills.git', 'git 远程地址').ok).toBe(true);
    expect(checkHttpUrl('http://git.internal/acme/skills', 'git 远程地址').ok).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    const result = checkHttpUrl('  https://github.com/acme/skills.git  ', 'git 远程地址');
    expect(result.ok).toBe(true);
  });

  it.each(['file:///etc/passwd', 'ssh://git@host/repo', 'git://host/repo', 'ftp://host/repo'])(
    'rejects the %s scheme',
    (raw) => {
      const result = checkHttpUrl(raw, 'git 远程地址');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('git 远程地址');
    },
  );

  it('rejects input that is not a URL at all', () => {
    const result = checkHttpUrl('acme/skills', 'git 远程地址');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('https://');
  });

  it('rejects blank input and names the field', () => {
    const result = checkHttpUrl('   ', '上下文链接');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('请填写上下文链接。');
  });

  it('names the offending scheme in the message', () => {
    const result = checkHttpUrl('ssh://git@host/repo', 'git 远程地址');
    expect(result.reason).toContain('ssh://');
  });
});

describe('assertHttpUrl', () => {
  it('returns the trimmed value when valid', () => {
    expect(assertHttpUrl('  https://example.com/x  ', 'git 远程地址')).toBe('https://example.com/x');
  });

  it('throws a Chinese-reasoned error when invalid', () => {
    expect(() => assertHttpUrl('file:///etc/passwd', 'git 远程地址')).toThrowError(/git 远程地址/);
  });
});
