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
import {
  DRAFT_PREFIX,
  clearDraft,
  readDraft,
  writeDraft,
  type DraftStorage,
} from './useFormDraft';

/**
 * 表单草稿持久化（D 阶段 MEDIUM-1）。
 *
 * 自动化向导此前刷新即回到第一步并清空全部输入。这里对存储层做契约断言：
 * 写入落盘、按 key 隔离、提交后可清空、坏草稿不炸页面。
 */

interface Draft {
  step: number;
  name: string;
}

const INITIAL: Draft = { step: 0, name: '' };
const initial = () => ({ ...INITIAL });

function fakeStorage(seed: Record<string, string> = {}): DraftStorage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

describe('readDraft', () => {
  it('falls back to the initial value when nothing is stored', () => {
    const result = readDraft(fakeStorage(), 'create:t:n', initial);
    expect(result).toEqual({ value: INITIAL, restored: false });
  });

  it('restores a stored draft and flags it as restored', () => {
    const store = fakeStorage({ [`${DRAFT_PREFIX}create:t:n`]: JSON.stringify({ step: 2, name: '每日巡检' }) });
    const result = readDraft(store, 'create:t:n', initial);
    expect(result).toEqual({ value: { step: 2, name: '每日巡检' }, restored: true });
  });

  it('discards a corrupted draft instead of throwing', () => {
    const store = fakeStorage({ [`${DRAFT_PREFIX}create:t:n`]: '{ not json' });
    const result = readDraft(store, 'create:t:n', initial);
    expect(result).toEqual({ value: INITIAL, restored: false });
    // 坏草稿被就地清掉，不会每次进来都再炸一次。
    expect(store.getItem(`${DRAFT_PREFIX}create:t:n`)).toBeNull();
  });

  it('treats a null store (SSR / storage disabled) as no draft', () => {
    expect(readDraft(null, 'create:t:n', initial)).toEqual({ value: INITIAL, restored: false });
  });

  it('treats an empty key as no draft', () => {
    const store = fakeStorage();
    expect(readDraft(store, '', initial)).toEqual({ value: INITIAL, restored: false });
  });
});

describe('writeDraft', () => {
  it('serializes into the prefixed slot', () => {
    const store = fakeStorage();
    writeDraft(store, 'edit:a', { step: 3, name: 'A 的草稿' });
    expect(store.dump()).toEqual({
      [`${DRAFT_PREFIX}edit:a`]: JSON.stringify({ step: 3, name: 'A 的草稿' }),
    });
  });

  it('keeps different keys in separate slots', () => {
    const store = fakeStorage();
    writeDraft(store, 'edit:a', { step: 1, name: 'A' });
    writeDraft(store, 'edit:b', { step: 2, name: 'B' });
    expect(store.getItem(`${DRAFT_PREFIX}edit:a`)).toContain('"A"');
    expect(store.getItem(`${DRAFT_PREFIX}edit:b`)).toContain('"B"');
  });

  it('swallows quota errors rather than breaking the form', () => {
    const store: DraftStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => undefined,
    };
    expect(() => writeDraft(store, 'edit:a', { step: 1, name: 'A' })).not.toThrow();
  });

  it('is a no-op without a store', () => {
    expect(() => writeDraft(null, 'edit:a', { step: 1, name: 'A' })).not.toThrow();
  });
});

describe('clearDraft', () => {
  it('removes only the targeted slot', () => {
    const store = fakeStorage({
      [`${DRAFT_PREFIX}edit:a`]: '{"step":1,"name":"A"}',
      [`${DRAFT_PREFIX}edit:b`]: '{"step":2,"name":"B"}',
    });
    clearDraft(store, 'edit:a');
    expect(store.getItem(`${DRAFT_PREFIX}edit:a`)).toBeNull();
    expect(store.getItem(`${DRAFT_PREFIX}edit:b`)).not.toBeNull();
  });

  it('swallows storage errors', () => {
    const store: DraftStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(() => clearDraft(store, 'edit:a')).not.toThrow();
  });
});
