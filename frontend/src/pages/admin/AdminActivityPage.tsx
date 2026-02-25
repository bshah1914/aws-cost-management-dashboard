import React, { useState, useEffect } from 'react';
import { Activity, XCircle, Shield } from 'lucide-react';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/Common';
import api from '../../api';
import clsx from 'clsx';

interface Session {
  id: number;
  user_id: number;
  ip_address: string;
  browser: string;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

interface LoginEntry {
  id: number;
  user_id: number;
  ip_address: string;
  browser: string;
  success: boolean;
  timestamp: string;
}

export default function AdminActivityPage() {
  const [tab, setTab] = useState<'sessions' | 'history'>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<LoginEntry[]>([]);
  const [users, setUsers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterUser, setFilterUser] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterUser ? { user_id: filterUser } : {};
      const [sessRes, histRes, usersRes] = await Promise.all([
        api.get('/admin/sessions', { params }),
        api.get('/admin/login-history', { params: { ...params, limit: 200 } }),
        api.get('/admin/users'),
      ]);
      setSessions(sessRes.data);
      setHistory(histRes.data);
      const uMap: Record<number, string> = {};
      usersRes.data.forEach((u: any) => { uMap[u.id] = u.username; });
      setUsers(uMap);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterUser]);

  const revokeSession = async (id: number) => {
    try {
      await api.post(`/admin/sessions/${id}/revoke`);
      fetchData();
    } catch {}
  };

  const revokeAll = async (userId: number) => {
    try {
      await api.post(`/admin/sessions/revoke-all/${userId}`);
      fetchData();
    } catch {}
  };

  const activeSessions = sessions.filter(s => s.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Activity</h1>
          <p className="text-sm text-dark-500 mt-0.5">Monitor sessions, login history, and activity</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value ? Number(e.target.value) : '')}
            className="select text-sm w-auto"
          >
            <option value="">All Users</option>
            {Object.entries(users).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="text-sm text-dark-500">Active Sessions</span>
          <span className="text-2xl font-bold text-green-500">{activeSessions.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-sm text-dark-500">Total Sessions</span>
          <span className="text-2xl font-bold">{sessions.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-sm text-dark-500">Login Events</span>
          <span className="text-2xl font-bold">{history.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex items-center gap-1 p-4 border-b border-dark-200 dark:border-dark-700">
          <button
            onClick={() => setTab('sessions')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'sessions'
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
            )}
          >
            <Activity size={14} /> Sessions
          </button>
          <button
            onClick={() => setTab('history')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'history'
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
            )}
          >
            <Shield size={14} /> Login History
          </button>
        </div>

        {loading ? <PageLoader /> : tab === 'sessions' ? (
          sessions.length === 0 ? <EmptyState message="No sessions found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Browser</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const created = new Date(s.created_at);
                    const last = new Date(s.last_activity);
                    const duration = Math.round((last.getTime() - created.getTime()) / 60000);
                    return (
                      <tr key={s.id} className="border-t border-dark-100 dark:border-dark-800">
                        <td className="px-4 py-3 font-medium">{users[s.user_id] || s.user_id}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.ip_address}</td>
                        <td className="px-4 py-3 text-dark-500">{s.browser}</td>
                        <td className="px-4 py-3 text-xs text-dark-500">{created.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-dark-500">
                          {last.toLocaleString()} ({duration}min)
                        </td>
                        <td className="px-4 py-3">
                          <span className={s.is_active ? 'badge-green' : 'badge-red'}>
                            {s.is_active ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.is_active && (
                            <button
                              onClick={() => revokeSession(s.id)}
                              className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800"
                              title="Revoke"
                            >
                              <XCircle size={14} className="text-red-500" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          history.length === 0 ? <EmptyState message="No login history" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Browser</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-dark-100 dark:border-dark-800">
                      <td className="px-4 py-3 font-medium">{users[h.user_id] || h.user_id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{h.ip_address}</td>
                      <td className="px-4 py-3 text-dark-500">{h.browser}</td>
                      <td className="px-4 py-3">
                        <span className={h.success ? 'badge-green' : 'badge-red'}>
                          {h.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark-500">{new Date(h.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
