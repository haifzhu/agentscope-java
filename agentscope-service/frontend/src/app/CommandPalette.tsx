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

import { useEffect } from 'react'
import { getRoles } from '@/api/auth'

export function useCommandPaletteShortcut(open: () => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [open])
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!open) return null
  const roles = getRoles().map(role => role.toLowerCase())
  const admin = roles.includes('admin')
  const canOperate = admin || roles.includes('operator')
  const canAgentCenter = canOperate || roles.includes('agent_developer')
  const links = [
    ['工作台', '/work/overview'],
    ['对话', '/work/chat'],
    ['事项', '/work/issues'],
    ['收件箱', '/work/inbox'],
    ['自动化', '/work/automations'],
    ...(canAgentCenter ? [
      ['智能体', '/agent-center/agents'],
      ['团队', '/agent-center/teams'],
      ['工作流', '/agent-center/workflows'],
      ...(admin ? [['接入渠道', '/agent-center/entrypoints']] : []),
      ['工作空间', '/agent-center/workspaces'],
      ['运行环境', '/agent-center/environments'],
      ['记忆库', '/agent-center/memory'],
      ['密钥库', '/agent-center/vaults'],
    ] : []),
  ]
  return (
    <div className="fixed inset-0 z-50 bg-scrim p-6" onClick={() => onOpenChange(false)} role="presentation">
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface p-4 shadow-xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="命令面板">
        <div className="mb-3 font-semibold text-text">跳转到</div>
        {links.map(([label, to]) => (
          <a key={to} href={to} className="block rounded-lg px-3 py-2 text-text-2 hover:bg-hover hover:text-text">
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
