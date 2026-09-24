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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { login, saveToken } from '../api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      saveToken(res.token);
      navigate('/control/overview', { replace: true });
    } catch {
      setError('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface p-10 shadow-xl"
      >
        <div className="flex justify-center">
          <img src="/logo.svg" alt="AgentScope" width={40} height={40} />
        </div>
        <div className="space-y-1 text-center">
          <div className="text-2xl font-bold text-text">AgentScope 管理平台</div>
          <div className="text-sm text-text-3">登录以继续</div>
        </div>
        <label className="block space-y-2 text-sm font-medium text-text-2">
          用户名
          <Input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-text-2">
          密码
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-center text-sm text-danger-text">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || !username || !password}>
          <KeyRound className="h-4 w-4" />
          {loading ? '登录中…' : '登 录'}
        </Button>
      </form>
    </div>
  );
}
