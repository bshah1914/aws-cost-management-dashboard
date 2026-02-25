import React, { useState, useEffect } from 'react';
import { Plus, Trash2, UserX, UserCheck, KeyRound, Eye, EyeOff, Shield } from 'lucide-react';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/Common';
import api from '../../api';
import clsx from 'clsx';

interface UserData {
  id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  login_attempts: number;
  created_at: string;
  account_ids: number[];
  plain_password?: string;
}

interface AWSAccount {
  id: number;
  account_id: string;
  account_name: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [resetModal, setResetModal] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    username: '', password: '', is_admin: false, account_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, acctsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/accounts'),
      ]);
      setUsers(usersRes.data);
      setAccounts(acctsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/admin/users', form);
      setShowForm(false);
      setForm({ username: '', password: '', is_admin: false, account_ids: [] });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      await api.put(`/admin/users/${id}`, { is_active: !active });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return;
    try {
      await api.post(`/admin/users/${resetModal}/reset-password`, { new_password: newPassword });
      setResetModal(null);
      setNewPassword('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleAccountChange = (userId: number, accountIds: number[]) => {
    api.put(`/admin/users/${userId}`, { account_ids: accountIds }).then(() => fetchData()).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-dark-500 mt-0.5">Create and manage platform users</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Add User
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="font-semibold">Create User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input" required minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input" required minLength={6} type="password" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Assign AWS Accounts</label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <label key={acc.id} className="flex items-center gap-1.5 text-sm bg-dark-50 dark:bg-dark-800 px-3 py-1.5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.account_ids.includes(acc.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, account_ids: [...form.account_ids, acc.id] });
                      } else {
                        setForm({ ...form, account_ids: form.account_ids.filter(x => x !== acc.id) });
                      }
                    }}
                    className="rounded border-dark-300"
                  />
                  {acc.account_name} ({acc.account_id})
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
              className="rounded border-dark-300" id="is_admin" />
            <label htmlFor="is_admin" className="text-sm">Admin privileges</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Creating...' : 'Create User'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Password reset modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Reset Password</h2>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="New password (min 6 chars)"
              minLength={6}
            />
            <div className="flex gap-2">
              <button onClick={handleResetPassword} className="btn-primary text-sm">Reset</button>
              <button onClick={() => { setResetModal(null); setNewPassword(''); }} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : users.length === 0 ? (
        <EmptyState message="No users created" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">Accounts</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-dark-100 dark:border-dark-800">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={u.is_admin ? 'badge-yellow' : 'badge-blue'}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-500">{u.login_attempts}/5</td>
                  <td className="px-4 py-3">
                    {u.plain_password ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {showPasswords[u.id] ? u.plain_password : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPasswords(p => ({ ...p, [u.id]: !p[u.id] }))}
                          className="text-dark-400 hover:text-dark-600"
                        >
                          {showPasswords[u.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-dark-500">
                    {u.account_ids?.length || 0} assigned
                  </td>
                  <td className="px-4 py-3 text-dark-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setResetModal(u.id)} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800" title="Reset password">
                        <KeyRound size={14} className="text-primary-500" />
                      </button>
                      <button onClick={() => toggleActive(u.id, u.is_active)} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800"
                        title={u.is_active ? 'Disable' : 'Enable'}>
                        {u.is_active ? <UserX size={14} className="text-yellow-500" /> : <UserCheck size={14} className="text-green-500" />}
                      </button>
                      {u.username !== 'kpiadmin' && (
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800" title="Delete">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
