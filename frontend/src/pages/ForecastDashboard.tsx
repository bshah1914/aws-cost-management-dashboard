import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { StatCard, PageLoader, ErrorBanner, AccountFilter } from '../components/Common';
import { useApi, useAccounts, formatCurrency } from '../hooks/useApi';

export default function ForecastDashboard() {
  const accounts = useAccounts();
  const [accountFilter, setAccountFilter] = useState('');
  const [months, setMonths] = useState(3);

  const { data, loading, error, refetch } = useApi<any>(
    '/forecast/',
    { months_ahead: months, account_ids: accountFilter || undefined },
    [months, accountFilter]
  );

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: 'none',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cost Forecast</h1>
          <p className="text-sm text-dark-500 mt-0.5">Predicted costs based on historical data</p>
        </div>
        <div className="flex items-center gap-3">
          <AccountFilter accounts={accounts} selected={accountFilter} onChange={setAccountFilter} />
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="select text-sm w-auto"
          >
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {loading && <PageLoader />}

      {data && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Forecast"
              value={formatCurrency(data.total_forecast)}
              subtitle={`Next ${months} month${months > 1 ? 's' : ''}`}
              icon={DollarSign}
              color="primary"
            />
            <StatCard
              title="Monthly Average"
              value={formatCurrency(data.total_forecast / (months || 1))}
              subtitle="Projected avg/month"
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Forecast Periods"
              value={data.forecast_periods?.length || 0}
              subtitle="Data points"
              icon={Calendar}
              color="yellow"
            />
          </div>

          {/* Forecast chart */}
          {data.forecast_periods?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Cost Forecast with Confidence Interval</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.forecast_periods}>
                    <defs>
                      <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="upperGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="prediction_interval_upper"
                      stroke="#ef444466"
                      fill="url(#upperGrad)"
                      name="Upper Bound"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="mean_value"
                      stroke="#3b82f6"
                      fill="url(#forecastGrad)"
                      name="Forecast"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="prediction_interval_lower"
                      stroke="#10b98166"
                      fill="none"
                      name="Lower Bound"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Forecast details */}
          {data.forecast_periods?.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-dark-200 dark:border-dark-700">
                <h2 className="font-semibold">Forecast Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Forecast</th>
                      <th className="px-4 py-3 text-right">Lower Bound</th>
                      <th className="px-4 py-3 text-right">Upper Bound</th>
                      <th className="px-4 py-3 text-right">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast_periods.map((p: any, i: number) => (
                      <tr key={i} className="border-t border-dark-100 dark:border-dark-800">
                        <td className="px-4 py-3">{p.date}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.mean_value)}</td>
                        <td className="px-4 py-3 text-right text-green-500">{formatCurrency(p.prediction_interval_lower)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{formatCurrency(p.prediction_interval_upper)}</td>
                        <td className="px-4 py-3 text-right text-dark-500">
                          {formatCurrency(p.prediction_interval_upper - p.prediction_interval_lower)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
