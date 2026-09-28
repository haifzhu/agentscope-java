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

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): DraftStorage | null {
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
export function useFormDraft<T>(key: string, initial: T | (() => T)): FormDraft<T> {
  // initial 允许传惰性工厂：初始值计算（structuredClone 等）不应在每次渲染都跑。
  const resolveInitial = (): T =>
    typeof initial === 'function' ? (initial as () => T)() : initial;

  const read = (targetKey: string): { value: T; restored: boolean } => {
    const store = storage();
    if (!store || !targetKey) return { value: resolveInitial(), restored: false };
    const raw = store.getItem(`form-draft:${targetKey}`);
    if (raw == null) return { value: resolveInitial(), restored: false };
    try {
      return { value: JSON.parse(raw) as T, restored: true };
    } catch {
      // 草稿损坏（手工改过 / 版本不兼容）时丢弃，回到初始值，不让页面白屏。
      store.removeItem(`form-draft:${targetKey}`);
      return { value: resolveInitial(), restored: false };
    }
  };

  const [state, setState] = useState(() => read(key));


  // key 变化：重新读取。用「上一 key」比较而非依赖 value，避免把本地编辑覆盖回去。
  const loadedKeyRef = useRef(key);
  if (loadedKeyRef.current !== key) {
    loadedKeyRef.current = key;
    setState(read(key));
  }

  const setValue = (next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev.value) : next;
      const store = storage();
      if (store && key) {
        try {
          store.setItem(`form-draft:${key}`, JSON.stringify(value));
        } catch {
          // 配额或隐私模式：保留内存状态即可。
        }
      }
      return { value, restored: prev.restored };
    });
  };

  const clear = () => {
    const store = storage();
    if (store && key) {
      try {
        store.removeItem(`form-draft:${key}`);
      } catch {
        // 同上，忽略。
      }
    }
    setState({ value: resolveInitial(), restored: false });
  };

  return { value: state.value, setValue, clear, restored: state.restored };
}
