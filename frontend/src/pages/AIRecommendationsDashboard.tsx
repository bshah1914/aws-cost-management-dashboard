import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Brain, ArrowDown, ArrowUp, DollarSign } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, AccountFilter, EmptyState } from '../components/Common';
import { useApi, useAccounts, formatCurrency } from '../hooks/useApi';
import clsx from 'clsx';

export default function AIRecommendationsDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [tab, setTab] = useState<'downscale' | 'upscale'>('downscale');

  const { data, loading, error, refetch } = useApi<any>(
    '/ai/recommendations',
    { account_ids: accountFilter || undefined },
    [accountFilter]
  );

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: 'none',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  const downscaleByType: Record<string, number> = {};
  (data?.downscale_recommendations || []).forEach((r: any) => {
    downscaleByType[r.resource_type] = (downscaleByType[r.resource_type] || 0) + (r.estimated_monthly_savings || 0);
  });
  const chartData = Object.entries(downscaleByType).map(([k, v]) => ({ type: k, savings: v }));

  const activeData = tab === 'downscale'
    ? data?.downscale_recommendations || []
    : data?.upscale_recommendations || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Recommendations</h1>
          <p className="text-sm text-dark-500 mt-0.5">Amazon Q-powered compute optimization insights</p>
        </div>
        <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {loading && <PageLoader />}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Downscale Opportunities"
              value={data.summary?.total_downscale || 0}
              subtitle="Over-provisioned resources"
              icon={ArrowDown}
              color="green"
            />
            <StatCard
              title="Upscale Opportunities"
              value={data.summary?.total_upscale || 0}
              subtitle="Under-provisioned resources"
              icon={ArrowUp}
              color="red"
            />
            <StatCard
              title="Est. Monthly Savings"
              value={formatCurrency(data.summary?.total_estimated_monthly_savings || 0)}
              subtitle="From downscaling"
              icon={DollarSign}
              color="primary"
            />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Potential Savings by Resource Type</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Savings']} />
                    <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recommendation tabs */}
          <div className="card">
            <div className="flex items-center gap-1 p-4 border-b border-dark-200 dark:border-dark-700">
              <button
                onClick={() => setTab('downscale')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  tab === 'downscale'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
                )}
              >
                <ArrowDown size={14} /> Downscale ({data.summary?.total_downscale || 0})
              </button>
              <button
                onClick={() => setTab('upscale')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  tab === 'upscale'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
                )}
              >
                <ArrowUp size={14} /> Upscale ({data.summary?.total_upscale || 0})
              </button>
            </div>

            {activeData.length === 0 ? (
              <EmptyState message={`No ${tab} recommendations`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Recommendation</th>
                      <th className="px-4 py-3">Confidence</th>
                      {tab === 'downscale' && <th className="px-4 py-3 text-right">Monthly Savings</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.map((rec: any, i: number) => (
                      <tr key={i} className="border-t border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                        <td className="px-4 py-3 font-medium">{rec.resource_id}</td>
                        <td className="px-4 py-3"><span className="badge-blue">{rec.resource_type}</span></td>
                        <td className="px-4 py-3 text-dark-500">{rec.account_id}</td>
                        <td className="px-4 py-3 text-xs max-w-[200px] truncate">{rec.reason}</td>
                        <td className="px-4 py-3 text-xs text-primary-500 max-w-[200px] truncate">{rec.recommendation}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'badge',
                            rec.confidence === 'high' ? 'badge-green' : 'badge-yellow'
                          )}>
                            {rec.confidence}
                          </span>
                        </td>
                        {tab === 'downscale' && (
                          <td className="px-4 py-3 text-right font-semibold text-green-500">
                            {formatCurrency(rec.estimated_monthly_savings || 0)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
