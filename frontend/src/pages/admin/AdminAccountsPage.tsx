import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Server, Check, X } from 'lucide-react';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/Common';
import api from '../../api';
import clsx from 'clsx';

interface AWSAccount {
  id: number;
  account_id: string;
  account_name: string;
  is_root: boolean;
  region: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    account_id: '', account_name: '', is_root: false,
    access_key: '', secret_key: '', region: 'us-east-1',
  });
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/accounts');
      setAccounts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/accounts', form);
      setShowForm(false);
      setForm({ account_id: '', account_name: '', is_root: false, access_key: '', secret_key: '', region: 'us-east-1' });
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this AWS account?')) return;
    try {
      await api.delete(`/admin/accounts/${id}`);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      await api.put(`/admin/accounts/${id}`, { is_active: !active });
      fetchAccounts();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AWS Accounts</h1>
          <p className="text-sm text-dark-500 mt-0.5">Manage root and member accounts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="font-semibold">Add AWS Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account ID (12 digits)</label>
              <input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="input" required maxLength={12} minLength={12} placeholder="123456789012" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Account Name</label>
              <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                className="input" required placeholder="My AWS Account" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Access Key</label>
              <input value={form.access_key} onChange={(e) => setForm({ ...form, access_key: e.target.value })}
                className="input" required placeholder="AKIA..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secret Key</label>
              <input value={form.secret_key} onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
                className="input" required type="password" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="select">
                {['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.is_root} onChange={(e) => setForm({ ...form, is_root: e.target.checked })}
                className="rounded border-dark-300" id="is_root" />
              <label htmlFor="is_root" className="text-sm">Root / Management Account</label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Adding...' : 'Add Account'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <PageLoader /> : accounts.length === 0 ? (
        <EmptyState message="No AWS accounts configured" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">Account ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-t border-dark-100 dark:border-dark-800">
                  <td className="px-4 py-3 font-mono text-xs">{acc.account_id}</td>
                  <td className="px-4 py-3 font-medium">{acc.account_name}</td>
                  <td className="px-4 py-3">
                    <span className={acc.is_root ? 'badge-yellow' : 'badge-blue'}>
                      {acc.is_root ? 'Root' : 'Member'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-500">{acc.region}</td>
                  <td className="px-4 py-3">
                    <span className={acc.is_active ? 'badge-green' : 'badge-red'}>
                      {acc.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-500 text-xs">{new Date(acc.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(acc.id, acc.is_active)}
                        className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800"
                        title={acc.is_active ? 'Disable' : 'Enable'}
                      >
                        {acc.is_active ? <X size={14} className="text-red-500" /> : <Check size={14} className="text-green-500" />}
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
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
