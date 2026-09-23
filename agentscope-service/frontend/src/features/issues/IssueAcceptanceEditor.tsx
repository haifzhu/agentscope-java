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

import { useState } from "react";
import { Check, ListChecks, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseCriteria, type AcceptanceCriteria } from "./issueProperties";

export function IssueAcceptanceEditor({ value, busy, onSave }: {
  value: unknown;
  busy: boolean;
  onSave: (criteria: AcceptanceCriteria) => Promise<unknown>;
}) {
  const criteria = parseCriteria(value);
  const checklist = criteria.checklist || [];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number>();
  const [editText, setEditText] = useState("");
  const [rules, setRules] = useState<AcceptanceCriteria>();
  const save = async (next: AcceptanceCriteria, complete?: () => void) => {
    if (busy) return;
    try { await onSave(next); complete?.(); } catch { /* 页面统一展示变更错误。 */ }
  };
  const add = () => {
    if (draft.trim()) void save({ ...criteria, checklist: [...checklist, { id: crypto.randomUUID(), text: draft.trim(), required: true, satisfied: false }] }, () => setDraft(""));
  };

  return <section className="border-t border-border pt-5" aria-label="验收标准">
    <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-text">
      <span className="flex items-center gap-2"><ListChecks className="h-4 w-4" />验收</span>
      {!!checklist.length && <span className="text-xs font-normal text-muted-foreground">{checklist.filter(entry => entry.satisfied).length}/{checklist.length} 已满足</span>}
    </h2>
    <p className="mb-2 text-xs leading-5 text-text-3">必选项需全部满足后才能将事项标记为已完成。</p>
    <div className="space-y-2">
      {checklist.map((criterion, index) => {
        const label = criterion.text || criterion.id || `标准 ${index + 1}`;
        return <div key={criterion.id || index} className="rounded-lg bg-surface p-2 text-sm">
          {editing === index ? <form className="space-y-2" onSubmit={event => {
            event.preventDefault();
            if (editText.trim()) void save({ ...criteria, checklist: checklist.map((entry, i) => i === index ? { ...entry, text: editText.trim() } : entry) }, () => setEditing(undefined));
          }}>
            <Input aria-label="标准内容" value={editText} onChange={event => setEditText(event.target.value)} autoFocus />
            <div className="flex gap-1"><Button size="sm" disabled={busy || !editText.trim()}>保存标准</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(undefined)}>取消</Button></div>
          </form> : <div className="flex items-start gap-1">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
              <input type="checkbox" className="mt-1" checked={!!criterion.satisfied} disabled={busy} onChange={() => void save({ ...criteria, checklist: checklist.map((entry, i) => i === index ? { ...entry, satisfied: !entry.satisfied } : entry) })} />
              <span className={cn("break-words", criterion.satisfied && "text-text-3 line-through")}>{label}{criterion.required === false && <span className="block text-xs text-text-3">可选项</span>}</span>
            </label>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`编辑标准：${label}`} disabled={busy} onClick={() => { setEditText(label); setEditing(index); }}><Pencil className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`移除标准：${label}`} disabled={busy} onClick={() => void save({ ...criteria, checklist: checklist.filter((_, i) => i !== index) })}><X className="h-3 w-3" /></Button>
          </div>}
        </div>;
      })}
      <form className="flex gap-1" onSubmit={event => { event.preventDefault(); add(); }}>
        <Input aria-label="新增验收标准" className="h-8 bg-surface text-xs" value={draft} onChange={event => setDraft(event.target.value)} placeholder="添加验收标准" />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={!draft.trim() || busy} aria-label="添加验收标准"><Plus className="h-4 w-4" /></Button>
      </form>
      {rules ? <form className="space-y-3 rounded-lg border border-border bg-surface p-3 text-xs" onSubmit={event => {
        event.preventDefault();
        void save({ ...criteria, requiredResult: !!rules.requiredResult, minimumArtifacts: rules.minimumArtifacts || 0, minimumApprovals: rules.minimumApprovals || 0 }, () => setRules(undefined));
      }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!rules.requiredResult} onChange={event => setRules({ ...rules, requiredResult: event.target.checked })} /> 要求提交结果评论</label>
        <label className="block space-y-1"><span>最少产物数</span><Input type="number" min="0" step="1" required value={rules.minimumArtifacts ?? 0} onChange={event => setRules({ ...rules, minimumArtifacts: Number(event.target.value) })} /></label>
        <label className="block space-y-1"><span>最少批准数</span><Input type="number" min="0" step="1" required value={rules.minimumApprovals ?? 0} onChange={event => setRules({ ...rules, minimumApprovals: Number(event.target.value) })} /></label>
        <div className="flex gap-1"><Button size="sm" disabled={busy}><Check className="h-3 w-3" /> 保存规则</Button><Button type="button" variant="ghost" size="sm" onClick={() => setRules(undefined)}>取消</Button></div>
      </form> : <div className="text-xs leading-5 text-text-3">
        {criteria.requiredResult && <div>要求提交结果评论</div>}
        {!!criteria.minimumArtifacts && <div>{criteria.minimumArtifacts} 个产物必需</div>}
        {!!criteria.minimumApprovals && <div>{criteria.minimumApprovals} 个批准必需</div>}
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => setRules({ ...criteria })}>编辑验收规则</Button>
      </div>}
    </div>
  </section>;
}
