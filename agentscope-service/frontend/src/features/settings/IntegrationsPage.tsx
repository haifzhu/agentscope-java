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

import { useEffect, useState } from 'react';
import { getGitHubApplication, saveGitHubApplication, type GitHubApplication } from '@/api/mcpOAuth';
import { isAdmin } from '@/lib/auth';

export default function IntegrationsPage() {
  const [app, setApp] = useState<GitHubApplication>();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = isAdmin();
  useEffect(() => {
    if (admin) getGitHubApplication().then(setApp).catch(e => setError(e.message));
  }, [admin]);
  if (!admin) return <p className="p-8">集成由平台管理员管理。</p>;
  const input = 'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2';
  return <main className="max-w-3xl p-5 sm:p-8">
    <h1 className="text-xl font-semibold">集成</h1>
    <p className="mt-2 text-sm text-text-3">应用统一配置一次。用户从智能体的 MCP 连接中授权自己的账号。</p>
    {error && <p role="alert" className="my-4 text-danger-text">{error}</p>}
    {notice && <p role="status" className="my-4 text-success-text">{notice}</p>}
    {!app && !error && <p className="mt-4">正在加载…</p>}
    {app && <form className="mt-6 grid gap-4 rounded-lg border p-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(''); setNotice('');
      try {
        setApp(await saveGitHubApplication({ enabled: app.enabled, clientId: app.clientId, scope: app.scope, revision: app.revision, clientSecret: secret }));
        setSecret(''); setNotice('GitHub 应用已保存。用户可在「工具与 MCP」中连接。等待中的授权需要重新发起。');
      } catch (e) { setError(e instanceof Error ? e.message : 'GitHub 应用保存失败'); }
      finally { setBusy(false); }
    }}>
      <h2 className="font-semibold">GitHub</h2>
      <p className="text-sm text-text-2">在 GitHub 上注册一个支持用户授权的 OAuth App 或 GitHub App，使用其 Client ID 与客户端密钥。这里连接的是 GitHub 工具，不影响平台登录。</p>
      <a className="text-sm text-primary underline" href="https://github.com/settings/developers" target="_blank" rel="noreferrer">打开 GitHub 开发者设置</a>
      <label>回调 URL<input className={input} readOnly value={app.callbackUrl} onFocus={e => e.target.select()} /></label>
      <p className="text-sm text-text-3">请在 GitHub 应用中注册这个准确的回调 URL。该部署上的所有账号连接共用它。</p>
      <fieldset disabled={busy} className="grid gap-4">
        <label><input type="checkbox" checked={app.enabled} onChange={e => setApp({ ...app, enabled: e.target.checked })} /> 启用 GitHub 账号连接</label>
        <label>Client ID<input className={input} required={app.enabled} value={app.clientId} onChange={e => setApp({ ...app, clientId: e.target.value })} /></label>
        <label>客户端密钥<input className={input} type="password" autoComplete="new-password" value={secret} placeholder={app.hasClientSecret ? '已安全保存；留空即保持不变' : 'GitHub 应用客户端密钥'} onChange={e => setSecret(e.target.value)} /></label>
        <label>OAuth 作用域<input className={input} value={app.scope} placeholder="read:user" onChange={e => setApp({ ...app, scope: e.target.value })} /></label>
        <p className="text-sm text-text-3">OAuth App 只申请必要的作用域。私有仓库通常需要 repo（同时授予写权限）。GitHub App 使用在 GitHub 上配置的权限与仓库访问，该方式请留空作用域。可能需要组织审批。</p>
        <p className="text-sm text-text-3">停用只会阻止新授权，不会撤销既有授权；需要时请在 GitHub 上撤销。更换 Client ID 需要新密钥，且用户必须重新连接。</p>
        <button type="submit" className="justify-self-start rounded-md bg-primary px-4 py-2 text-primary-foreground">{busy ? '保存中…' : '保存 GitHub 应用'}</button>
      </fieldset>
    </form>}
  </main>;
}
