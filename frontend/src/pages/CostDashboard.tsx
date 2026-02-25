import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Download, Layers, Globe, Users, Database } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, DateRangeFilter, AccountFilter, EmptyState } from '../components/Common';
import { useApi, useAccounts, formatCurrency, getDateRange, getChartColor } from '../hooks/useApi';
import api from '../api';
import clsx from 'clsx';

export default function CostDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [preset, setPreset] = useState('1m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'service' | 'region' | 'account' | 'usage'>('service');
  const [resourcePage, setResourcePage] = useState(1);

  const { start, end, granularity } = preset === 'custom'
    ? { start: customStart, end: customEnd, granularity: 'DAILY' }
    : getDateRange(preset);

  const acctParam = accountFilter || undefined;

  const { data: overview, loading: loadingOverview, error: errorOverview } = useApi<any>(
    '/costs/overview',
    { start_date: start, end_date: end, granularity, account_ids: acctParam },
    [start, end, granularity, acctParam]
  );

  const { data: serviceData, loading: loadingService } = useApi<any[]>(
    '/costs/by-service',
    { start_date: start, end_date: end, account_ids: acctParam },
    [start, end, acctParam]
  );
  const { data: regionData } = useApi<any[]>(
    '/costs/by-region',
    { start_date: start, end_date: end, account_ids: acctParam },
    [start, end, acctParam]
  );
  const { data: accountData } = useApi<any[]>(
    '/costs/by-account',
    { start_date: start, end_date: end, account_ids: acctParam },
    [start, end, acctParam]
  );
  const { data: usageData } = useApi<any[]>(
    '/costs/by-usage-type',
    { start_date: start, end_date: end, account_ids: acctParam },
    [start, end, acctParam]
  );
  const { data: comparison } = useApi<any[]>(
    '/costs/six-month-comparison',
    { account_ids: acctParam },
    [acctParam]
  );
  const { data: topResources, loading: loadingResources } = useApi<any>(
    '/costs/top-resources',
    { start_date: start, end_date: end, account_ids: acctParam, page: resourcePage },
    [start, end, acctParam, resourcePage]
  );

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== 'custom') { setCustomStart(''); setCustomEnd(''); }
  };

  const handleExport = async (format: string) => {
    try {
      const res = await api.get('/costs/export', {
        params: { start_date: start, end_date: end, account_ids: acctParam, format },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `costs_${start}_${end}.${format}`;
      a.click();
    } catch {}
  };

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: 'none',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  const breakdownData = activeTab === 'service' ? serviceData
    : activeTab === 'region' ? regionData
    : activeTab === 'account' ? accountData
    : usageData;

  const breakdownKey = activeTab === 'service' ? 'service'
    : activeTab === 'region' ? 'region'
    : activeTab === 'account' ? 'account_id'
    : 'usage_type';

  if (errorOverview) return <ErrorBanner message={errorOverview} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cost Dashboard</h1>
          <p className="text-sm text-dark-500 mt-0.5">AWS Cost Explorer analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
          <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1 text-sm" title="Export CSV">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-1 text-sm" title="Export Excel">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Date filter */}
      <DateRangeFilter
        preset={preset}
        onPreset={handlePreset}
        startDate={customStart}
        endDate={customEnd}
        onCustom={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
      />

      {/* Stat cards */}
      {loadingOverview ? <PageLoader /> : overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cost"
            value={formatCurrency(overview.total_cost)}
            subtitle={`${start} — ${end}`}
            change={overview.change_percent}
            icon={DollarSign}
            color="primary"
          />
          <StatCard
            title="Previous Period"
            value={overview.previous_period_cost != null ? formatCurrency(overview.previous_period_cost) : 'N/A'}
            subtitle="Same duration, prior period"
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Daily Average"
            value={formatCurrency(overview.daily_costs?.length ? overview.total_cost / overview.daily_costs.length : 0)}
            subtitle="Avg cost per day"
            icon={Layers}
            color="yellow"
          />
          <StatCard
            title="Services"
            value={serviceData?.length || 0}
            subtitle="Active services"
            icon={Database}
            color="purple"
          />
        </div>
      )}

      {/* Cost trend chart */}
      {overview?.daily_costs?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Cost Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.daily_costs}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#costGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6 month comparison */}
      {comparison && comparison.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold mb-4">6-Month Cost Comparison</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...comparison].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
                <Bar dataKey="total_cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdown tabs */}
      <div className="card">
        <div className="flex items-center gap-1 p-4 border-b border-dark-200 dark:border-dark-700 overflow-x-auto">
          {[
            { key: 'service', label: 'By Service', icon: Layers },
            { key: 'region', label: 'By Region', icon: Globe },
            { key: 'account', label: 'By Account', icon: Users },
            { key: 'usage', label: 'By Usage Type', icon: Database },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
              )}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(breakdownData || []).slice(0, 10)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="cost"
                  nameKey={breakdownKey}
                  label={({ name, value }) => `${(name || '').substring(0, 15)}: $${value.toFixed(0)}`}
                  labelLine={false}
                >
                  {(breakdownData || []).slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={getChartColor(i)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2">{activeTab === 'service' ? 'Service' : activeTab === 'region' ? 'Region' : activeTab === 'account' ? 'Account' : 'Usage Type'}</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  {activeTab === 'service' && <th className="px-3 py-2 text-right">Change</th>}
                </tr>
              </thead>
              <tbody>
                {(breakdownData || []).slice(0, 20).map((item: any, i: number) => (
                  <tr key={i} className="border-t border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                    <td className="px-3 py-2 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getChartColor(i) }} />
                      <span className="truncate max-w-[200px]">{item[breakdownKey]}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.cost)}</td>
                    {activeTab === 'service' && (
                      <td className="px-3 py-2 text-right">
                        {item.change_percent != null && (
                          <span className={clsx('text-xs font-medium', item.change_percent >= 0 ? 'text-red-500' : 'text-green-500')}>
                            {item.change_percent >= 0 ? '+' : ''}{item.change_percent.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Resources */}
      <div className="card">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
          <h2 className="font-semibold">Top Costly Resources</h2>
          <span className="text-xs text-dark-500">
            {topResources?.total || 0} total resources
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Resource Name</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {(topResources?.resources || []).map((r: any, i: number) => (
                <tr key={i} className="border-t border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                  <td className="px-4 py-2.5 text-dark-500">{(resourcePage - 1) * 20 + i + 1}</td>
                  <td className="px-4 py-2.5">{r.service}</td>
                  <td className="px-4 py-2.5 font-medium">{r.name || 'Untagged'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {topResources && topResources.total > 20 && (
          <div className="p-4 border-t border-dark-200 dark:border-dark-700 flex items-center justify-between">
            <span className="text-xs text-dark-500">
              Page {resourcePage} of {Math.ceil(topResources.total / 20)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setResourcePage((p) => Math.max(1, p - 1))}
                disabled={resourcePage === 1}
                className="btn-secondary text-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setResourcePage((p) => p + 1)}
                disabled={resourcePage * 20 >= topResources.total}
                className="btn-secondary text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
