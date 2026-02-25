import React, { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Cpu, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, AccountFilter, EmptyState } from '../components/Common';
import { useApi, useAccounts, formatCurrency, getChartColor } from '../hooks/useApi';
import clsx from 'clsx';

const RESOURCE_TABS = [
  { key: 'ec2', label: 'EC2 Instances' },
  { key: 'ebs', label: 'EBS Volumes' },
  { key: 'lambda', label: 'Lambda' },
  { key: 'auto_scaling', label: 'Auto Scaling' },
  { key: 'ecs', label: 'ECS Fargate' },
];

export default function ComputeOptimizerDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [activeTab, setActiveTab] = useState('ec2');

  const { data, loading, error, refetch } = useApi<any>(
    '/optimizer/',
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

  const byTypeData = data?.by_resource_type
    ? Object.entries(data.by_resource_type).map(([k, v]: any) => ({
        name: k,
        count: v.count,
        savings: v.savings,
      }))
    : [];

  const findingsData = data?.findings_summary
    ? Object.entries(data.findings_summary).map(([k, v]) => ({
        name: k,
        value: v as number,
      }))
    : [];

  const tabData = data?.[activeTab] || [];
  const validTabData = tabData.filter((r: any) => !r.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compute Optimizer</h1>
          <p className="text-sm text-dark-500 mt-0.5">Right-sizing recommendations for AWS resources</p>
        </div>
        <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {loading && <PageLoader />}

      {data && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Recommendations"
              value={data.total_recommendations}
              icon={Cpu}
              color="primary"
            />
            <StatCard
              title="Est. Monthly Savings"
              value={formatCurrency(data.total_estimated_monthly_savings)}
              subtitle="If all recommendations applied"
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Resource Types"
              value={Object.keys(data.by_resource_type || {}).length}
              icon={CheckCircle}
              color="purple"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Savings by Resource Type</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Savings']} />
                    <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-semibold mb-4">Findings Distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={findingsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {findingsData.map((_, i) => (
                        <Cell key={i} fill={getChartColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Resource tabs */}
          <div className="card">
            <div className="flex items-center gap-1 p-4 border-b border-dark-200 dark:border-dark-700 overflow-x-auto">
              {RESOURCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    activeTab === tab.key
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-800'
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs bg-dark-200 dark:bg-dark-700 px-1.5 py-0.5 rounded-full">
                    {(data[tab.key] || []).filter((r: any) => !r.error).length}
                  </span>
                </button>
              ))}
            </div>

            {validTabData.length === 0 ? (
              <EmptyState message="No recommendations for this resource type" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3">Resource ID</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Finding</th>
                      <th className="px-4 py-3">Current</th>
                      <th className="px-4 py-3">Recommended</th>
                      <th className="px-4 py-3 text-right">Monthly Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validTabData.map((rec: any, i: number) => (
                      <tr key={i} className="border-t border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                        <td className="px-4 py-3 font-medium">{rec.resource_id || rec.resource_name || '-'}</td>
                        <td className="px-4 py-3 text-dark-500">{rec.account_id}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'badge',
                            rec.finding?.includes('OVER') ? 'badge-yellow' :
                            rec.finding?.includes('UNDER') ? 'badge-red' : 'badge-green'
                          )}>
                            {rec.finding}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{JSON.stringify(rec.current_config).substring(0, 50)}</td>
                        <td className="px-4 py-3 text-xs text-primary-500">{JSON.stringify(rec.recommended_config).substring(0, 50)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-500">{formatCurrency(rec.estimated_monthly_savings)}</td>
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
