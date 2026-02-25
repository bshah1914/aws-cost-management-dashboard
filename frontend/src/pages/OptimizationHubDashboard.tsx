import React, { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { PiggyBank, DollarSign, ShieldCheck, Zap } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, AccountFilter, EmptyState } from '../components/Common';
import { useApi, useAccounts, formatCurrency, getChartColor } from '../hooks/useApi';
import clsx from 'clsx';

export default function OptimizationHubDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [tab, setTab] = useState<'recommendations' | 'savings' | 'reservations'>('recommendations');

  const { data: recsData, loading: loadingRecs, error: errorRecs, refetch: refetchRecs } = useApi<any>(
    '/optimization-hub/recommendations',
    { account_ids: accountFilter || undefined },
    [accountFilter]
  );

  const { data: savingsData, loading: loadingSavings } = useApi<any>(
    '/optimization-hub/savings-plans',
    { account_ids: accountFilter || undefined },
    [accountFilter]
  );

  const { data: resData, loading: loadingRes } = useApi<any>(
    '/optimization-hub/reservations',
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

  const byActionData = recsData?.summary?.by_action_type
    ? Object.entries(recsData.summary.by_action_type).map(([k, v]) => ({ name: k, value: v as number }))
    : [];

  const byResourceData = recsData?.summary?.by_resource_type
    ? Object.entries(recsData.summary.by_resource_type).map(([k, v]) => ({ name: k, value: v as number }))
    : [];

  const loading = loadingRecs || loadingSavings || loadingRes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cost Optimization Hub</h1>
          <p className="text-sm text-dark-500 mt-0.5">Savings Plans, reservations & optimization recommendations</p>
        </div>
        <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
      </div>

      {errorRecs && <ErrorBanner message={errorRecs} onRetry={refetchRecs} />}
      {loading && <PageLoader />}

      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              title="Total Recommendations"
              value={recsData?.summary?.total_recommendations || 0}
              icon={PiggyBank}
              color="primary"
            />
            <StatCard
              title="Est. Monthly Savings"
              value={formatCurrency(recsData?.summary?.total_estimated_monthly_savings || 0)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Savings Plans"
              value={savingsData?.summary?.total_plans || 0}
              subtitle={formatCurrency(savingsData?.summary?.total_estimated_monthly_savings || 0)}
              icon={ShieldCheck}
              color="yellow"
            />
            <StatCard
              title="RI Recommendations"
              value={resData?.summary?.total_reservations || 0}
              subtitle={formatCurrency(resData?.summary?.total_estimated_monthly_savings || 0)}
              icon={Zap}
              color="purple"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Savings by Action Type</h2>
              <div className="h-64">
                {byActionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byActionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" angle={-20} />
                      <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Savings']} />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No data" />}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-semibold mb-4">Savings by Resource Type</h2>
              <div className="h-64">
                {byResourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byResourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                           label={({ name, value }) => `${name}: $${(value as number).toFixed(0)}`}>
                        {byResourceData.map((_, i) => <Cell key={i} fill={getChartColor(i)} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No data" />}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="card">
            <div className="flex items-center gap-1 p-4 border-b border-dark-200 dark:border-dark-700">
              {[
                { key: 'recommendations', label: 'Recommendations' },
                { key: 'savings', label: 'Savings Plans' },
                { key: 'reservations', label: 'Reservations' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    tab === t.key
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'recommendations' && (
              <div className="overflow-x-auto">
                {(recsData?.recommendations || []).length === 0 ? (
                  <EmptyState message="No recommendations available" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-3">Resource Type</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Effort</th>
                        <th className="px-4 py-3 text-right">Monthly Savings</th>
                        <th className="px-4 py-3 text-right">Savings %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recsData?.recommendations || []).map((r: any, i: number) => (
                        <tr key={i} className="border-t border-dark-100 dark:border-dark-800">
                          <td className="px-4 py-3">{r.resource_type}</td>
                          <td className="px-4 py-3"><span className="badge-blue">{r.action_type}</span></td>
                          <td className="px-4 py-3 text-dark-500">{r.account_id}</td>
                          <td className="px-4 py-3 text-dark-500">{r.implementation_effort || '-'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-500">{formatCurrency(r.estimated_monthly_savings)}</td>
                          <td className="px-4 py-3 text-right">{r.estimated_savings_percentage?.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'savings' && (
              <div className="overflow-x-auto">
                {(savingsData?.plans || []).length === 0 ? (
                  <EmptyState message="No Savings Plans recommendations" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Term</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right">Hourly Commit</th>
                        <th className="px-4 py-3 text-right">Monthly Savings</th>
                        <th className="px-4 py-3 text-right">Savings %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(savingsData?.plans || []).map((p: any, i: number) => (
                        <tr key={i} className="border-t border-dark-100 dark:border-dark-800">
                          <td className="px-4 py-3">{p.savings_plan_type}</td>
                          <td className="px-4 py-3">{p.term}</td>
                          <td className="px-4 py-3">{p.payment_option}</td>
                          <td className="px-4 py-3 text-right">${p.hourly_commitment?.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-500">{formatCurrency(p.estimated_monthly_savings)}</td>
                          <td className="px-4 py-3 text-right">{p.estimated_savings_percentage?.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'reservations' && (
              <div className="overflow-x-auto">
                {(resData?.reservations || []).length === 0 ? (
                  <EmptyState message="No reservation recommendations" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Count</th>
                        <th className="px-4 py-3 text-right">Upfront Cost</th>
                        <th className="px-4 py-3 text-right">Recurring/mo</th>
                        <th className="px-4 py-3 text-right">Monthly Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resData?.reservations || []).map((r: any, i: number) => (
                        <tr key={i} className="border-t border-dark-100 dark:border-dark-800">
                          <td className="px-4 py-3">{r.account_id}</td>
                          <td className="px-4 py-3">{r.recommended_count}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(r.upfront_cost)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(r.recurring_cost)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-500">{formatCurrency(r.estimated_monthly_savings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
