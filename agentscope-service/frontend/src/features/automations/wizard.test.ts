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
import { WIZARD_STEPS, canAdvanceFromStep, defaultTrigger } from './form';

/**
 * C14 四步向导（PRD 5.12）。
 * 步骤顺序与「每一步能否前进」是向导的核心契约：放宽一步就会把无效配置
 * 带到确认页，收紧一步会让合法配置卡住。
 */
describe('WIZARD_STEPS', () => {
  it('keeps the four-step order defined by the PRD', () => {
    expect(WIZARD_STEPS.map((s) => s.title)).toEqual([
      '基本信息',
      '执行者与产出',
      '触发器',
      '高级与确认',
    ]);
  });

  it('gives every step a hint for the footer counter', () => {
    for (const step of WIZARD_STEPS) expect(step.hint).toBeTruthy();
  });
});

describe('canAdvanceFromStep', () => {
  const filled = {
    name: '每日构建巡检',
    execution: { runbook: '检查夜间构建并汇总失败用例', assigneeRef: 'agent-1' },
  };

  it('blocks step 1 without a name', () => {
    expect(canAdvanceFromStep(0, { ...filled, name: '   ' })).toBe(false);
  });

  it('blocks step 1 without a runbook', () => {
    expect(canAdvanceFromStep(0, { ...filled, execution: { ...filled.execution, runbook: '' } })).toBe(false);
  });

  it('allows step 1 once name and runbook are non-blank', () => {
    expect(canAdvanceFromStep(0, filled)).toBe(true);
  });

  it('blocks step 2 until an assignee is chosen', () => {
    expect(canAdvanceFromStep(1, { ...filled, execution: { ...filled.execution, assigneeRef: '' } })).toBe(false);
  });

  it('allows step 2 with an assignee', () => {
    expect(canAdvanceFromStep(1, filled)).toBe(true);
  });

  it('leaves trigger and advanced steps unconditionally passable', () => {
    // 触发器与高级步骤没有必填项：可直接进入确认页。
    expect(canAdvanceFromStep(2, { name: '', execution: { runbook: '', assigneeRef: '' } })).toBe(true);
    expect(canAdvanceFromStep(3, { name: '', execution: { runbook: '', assigneeRef: '' } })).toBe(true);
  });
});

describe('defaultTrigger', () => {
  it('defaults to a weekday-morning cron in the local timezone', () => {
    const trigger = defaultTrigger();
    expect(trigger.type).toBe('cron');
    expect(trigger.enabled).toBe(true);
    expect(trigger.schedule).toBe('0 9 * * 1-5');
    expect(trigger.timezone).toBeTruthy();
  });

  it('builds a webhook trigger with an event list instead of a schedule', () => {
    const trigger = defaultTrigger('webhook');
    expect(trigger.type).toBe('webhook');
    expect(trigger.events).toEqual([]);
    expect(trigger.schedule).toBeUndefined();
  });

  it('mints a distinct id per trigger', () => {
    expect(defaultTrigger().id).not.toBe(defaultTrigger().id);
  });
});
