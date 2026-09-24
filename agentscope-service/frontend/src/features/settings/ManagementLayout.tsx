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

import { NavLink, Outlet } from 'react-router-dom';
import { isAdmin } from '@/lib/auth';
import { useAccountIdentity } from '@/lib/accountIdentity';

export default function ManagementLayout() {
  useAccountIdentity();
  const links = [{ to: '/settings/namespaces', label: '命名空间' }, ...(isAdmin() ? [{ to: '/settings/users', label: '用户' }, { to: '/settings/access-log', label: '访问日志' }, { to: '/settings/integrations', label: '集成' }] : [])];
  return <div className="min-h-full bg-surface"><div className="border-b px-5 pt-5 sm:px-8 lg:px-10"><p className="text-xs font-semibold uppercase tracking-wider text-text-3">命名空间与访问</p><nav aria-label="访问设置" className="mt-3 flex gap-6 overflow-x-auto">{links.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => `whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${isActive ? 'border-primary text-primary-text' : 'border-transparent text-text-3 hover:text-text'}`}>{link.label}</NavLink>)}</nav></div><Outlet /></div>;
}
