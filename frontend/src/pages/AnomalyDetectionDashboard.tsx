import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, AccountFilter, EmptyState } from '../components/Common';
import { useApi, useAccounts, formatCurrency } from '../hooks/useApi';
import clsx from 'clsx';

export default function AnomalyDetectionDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [daysBack, setDaysBack] = useState(90);

  const { data, loading, error, refetch } = useApi<any>(
    '/anomalies/',
    { days_back: daysBack, account_ids: accountFilter || undefined },
    [daysBack, accountFilter]
  );

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: 'none',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  const chartData = (data?.anomalies || [])
    .slice(0, 20)
    .map((a: any) => ({
      id: a.anomaly_id?.substring(0, 8),
      impact: a.impact,
      expected: a.expected_spend,
      actual: a.actual_spend,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cost Anomaly Detection</h1>
          <p className="text-sm text-dark-500 mt-0.5">Detect unusual spending patterns</p>
        </div>
        <div className="flex items-center gap-3">
          <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="select text-sm w-auto"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {loading && <PageLoader />}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Anomalies"
              value={data.total_count}
              subtitle={`Last ${daysBack} days`}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              title="Total Impact"
              value={formatCurrency(data.total_impact)}
              subtitle="Unexpected spend"
              icon={DollarSign}
              color="yellow"
            />
            <StatCard
              title="Monitors"
              value={data.monitors?.length || 0}
              subtitle="Active monitors"
              icon={Calendar}
              color="primary"
            />
          </div>

          {/* Impact chart */}
          {chartData.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Anomaly Impact (Top 20)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="id" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`]} />
                    <Bar dataKey="expected" name="Expected" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Anomalies table */}
          <div className="card">
            <div className="p-4 border-b border-dark-200 dark:border-dark-700">
              <h2 className="font-semibold">Detected Anomalies</h2>
            </div>
            {data.anomalies?.length === 0 ? (
              <EmptyState message="No anomalies detected" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3">Anomaly ID</th>
                      <th className="px-4 py-3">Start Date</th>
                      <th className="px-4 py-3">End Date</th>
                      <th className="px-4 py-3 text-right">Expected</th>
                      <th className="px-4 py-3 text-right">Actual</th>
                      <th className="px-4 py-3 text-right">Impact</th>
                      <th className="px-4 py-3">Root Causes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.anomalies.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                        <td className="px-4 py-3 font-mono text-xs">{a.anomaly_id?.substring(0, 12)}...</td>
                        <td className="px-4 py-3">{a.start_date}</td>
                        <td className="px-4 py-3">{a.end_date}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(a.expected_spend)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(a.actual_spend)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={clsx('font-semibold', a.impact > 0 ? 'text-red-500' : 'text-green-500')}>
                            {formatCurrency(a.impact)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {a.root_causes?.slice(0, 2).map((rc: any, j: number) => (
                            <div key={j} className="text-xs text-dark-500">
                              {rc.service} / {rc.region}
                            </div>
                          ))}
                        </td>
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
