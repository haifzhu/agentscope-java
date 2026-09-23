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

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { controlBorder, focusRing, toneClasses, type Tone } from './tokens';

export type DangerLevel = 'normal' | 'warning' | 'danger';

const DANGER_TONE: Record<DangerLevel, Tone> = {
  normal: 'primary',
  warning: 'warning',
  danger: 'danger',
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 危险等级决定确认按钮配色与图标（PRD 5.6 三档视觉分级）。 */
  dangerLevel?: DangerLevel;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 二次确认：要求用户输入该字符串才能提交（销毁类操作）。 */
  confirmPhrase?: string;
  confirmPhraseHint?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}

/**
 * 确认框。危险操作集中走这里，避免各页面自己拼 Dialog + 按钮，
 * 从而保证三档危险等级与二次确认的视觉/交互一致。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  dangerLevel = 'normal',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmPhrase,
  confirmPhraseHint,
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');
  const tone = DANGER_TONE[dangerLevel];

  React.useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;

  const handleConfirm = async () => {
    if (!phraseOk) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {dangerLevel !== 'normal' && (
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  toneClasses[tone],
                )}
              >
                <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" style={{ height: 18, width: 18 }} />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {confirmPhrase && (
          <DialogBody>
            {confirmPhraseHint && (
              <p className="mb-2 text-sm leading-6 text-text-2">{confirmPhraseHint}</p>
            )}
            <label className="mb-1.5 block text-[13px] text-text-3">
              Type <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-text">{confirmPhrase}</code> to continue
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Confirmation input"
              className={cn(
                'h-10 w-full rounded-lg bg-surface px-3.5 text-sm text-text',
                controlBorder,
                'placeholder:text-text-4',
                focusRing,
              )}
              placeholder={confirmPhrase}
            />
          </DialogBody>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={dangerLevel === 'normal' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={busy || !phraseOk}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
