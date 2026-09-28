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

import { useRef, useState } from 'react';

/** 只依赖 Storage 的最小接口，便于在无 DOM 的单测环境里注入假实现。 */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DRAFT_PREFIX = 'form-draft:';

const storageKeyOf = (key: string) => `${DRAFT_PREFIX}${key}`;

export interface DraftReadResult<T> {
  value: T;
  restored: boolean;
}

/**
 * 读取草稿（纯函数）。
 *
 * 草稿损坏（手工改过 / 结构随版本变化）时就地丢弃并回到初始值，
 * 而不是让 JSON.parse 抛错把整个页面带崩——这正是「刷新即白屏」
 * 一类事故的常见来源。
 */
export function readDraft<T>(
  store: DraftStorage | null,
  key: string,
  resolveInitial: () => T,
): DraftReadResult<T> {
  if (!store || !key) return { value: resolveInitial(), restored: false };
  const raw = store.getItem(storageKeyOf(key));
  if (raw == null) return { value: resolveInitial(), restored: false };
  try {
    return { value: JSON.parse(raw) as T, restored: true };
  } catch {
    store.removeItem(storageKeyOf(key));
    return { value: resolveInitial(), restored: false };
  }
}

/** 写入草稿（纯函数）。存储不可用（配额 / 隐私模式）时静默降级。 */
export function writeDraft<T>(store: DraftStorage | null, key: string, value: T): void {
  if (!store || !key) return;
  try {
    store.setItem(storageKeyOf(key), JSON.stringify(value));
  } catch {
    // 存储写入失败不影响内存中的表单状态。
  }
}

/** 清除草稿（纯函数）。 */
export function clearDraft(store: DraftStorage | null, key: string): void {
  if (!store || !key) return;
  try {
    store.removeItem(storageKeyOf(key));
  } catch {
    // 同上，忽略。
  }
}

/** 取浏览器的 sessionStorage；不可用时返回 null 而不是抛错。 */
export function browserDraftStorage(): DraftStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export interface FormDraft<T> {
  value: T;
  /** 写入草稿（同时落盘）。 */
  setValue: (next: T | ((prev: T) => T)) => void;
  /** 主动丢弃草稿并回到初始值（提交成功、显式放弃时调用）。 */
  clear: () => void;
  /** 是否存在恢复出来的未提交草稿。 */
  restored: boolean;
}

/**
 * 表单草稿持久化（D 阶段 MEDIUM-1）。
 *
 * 多步向导（如自动化编辑器）刷新或误关后此前会回到第一步并清空全部输入。
 * 这里把整个草稿按 key 落在 sessionStorage：同一会话内可恢复，关标签页即失效，
 * 不会把半成品长期留在用户机器上。
 *
 * `key` 变化（切换到另一条记录 / 新建）时会重新读取对应草稿，
 * 避免把 A 的输入带进 B。存储不可用时静默降级为纯内存状态。
 */
export function useFormDraft<T>(
  key: string,
  initial: T | (() => T),
  store: DraftStorage | null = browserDraftStorage(),
): FormDraft<T> {
  // initial 允许传惰性工厂：初始值计算（structuredClone 等）不应在每次渲染都跑。
  const resolveInitial = (): T =>
    typeof initial === 'function' ? (initial as () => T)() : initial;

  const [state, setState] = useState(() => readDraft(store, key, resolveInitial));

  // key 变化：重新读取。用「上一 key」比较而非依赖 value，避免把本地编辑覆盖回去。
  const loadedKeyRef = useRef(key);
  if (loadedKeyRef.current !== key) {
    loadedKeyRef.current = key;
    setState(readDraft(store, key, resolveInitial));
  }

  const setValue = (next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev.value) : next;
      writeDraft(store, key, value);
      return { value, restored: prev.restored };
    });
  };

  const clear = () => {
    clearDraft(store, key);
    setState({ value: resolveInitial(), restored: false });
  };

  return { value: state.value, setValue, clear, restored: state.restored };
}
