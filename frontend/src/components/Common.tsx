import React from 'react';
import clsx from 'clsx';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, size = 'md' }: Props) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={clsx('border-2 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full animate-spin', sizes[size], className)} />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

export function StatCard({
  title, value, subtitle, change, icon: Icon, color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number | null;
  icon?: React.ElementType;
  color?: 'primary' | 'green' | 'red' | 'yellow' | 'purple';
}) {
  const colorMap = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="stat-card animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-sm text-dark-500 dark:text-dark-400 font-medium">{title}</span>
        {Icon && (
          <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', colorMap[color])}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {change != null && (
          <span className={clsx('text-sm font-medium mb-0.5', change >= 0 ? 'text-red-500' : 'text-green-500')}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      {subtitle && <span className="text-xs text-dark-500">{subtitle}</span>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-4 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
      <div className="flex items-center justify-between">
        <span className="text-sm text-red-600 dark:text-red-400">{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-dark-400 dark:text-dark-500">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function AccountFilter({
  accounts,
  selected,
  onChange,
}: {
  accounts: { id: string; name: string }[];
  selected: string;
  onChange: (val: string) => void;
}) {
  return (
    <select value={selected} onChange={(e) => onChange(e.target.value)} className="select text-sm max-w-xs">
      <option value="">All Accounts</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.id})
        </option>
      ))}
    </select>
  );
}

export function DateRangeFilter({
  preset,
  onPreset,
  startDate,
  endDate,
  onCustom,
}: {
  preset: string;
  onPreset: (p: string) => void;
  startDate: string;
  endDate: string;
  onCustom: (s: string, e: string) => void;
}) {
  const presets = [
    { value: '1d', label: '1 Day' },
    { value: '7d', label: '7 Days' },
    { value: '14d', label: '14 Days' },
    { value: '1m', label: '1 Month' },
    { value: '3m', label: '3 Months' },
    { value: '6m', label: '6 Months' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onPreset(p.value)}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            preset === p.value
              ? 'bg-primary-600 text-white'
              : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
          )}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onCustom(e.target.value, endDate)}
            className="input text-xs px-2 py-1.5 w-auto"
          />
          <span className="text-dark-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onCustom(startDate, e.target.value)}
            className="input text-xs px-2 py-1.5 w-auto"
          />
        </div>
      )}
    </div>
  );
}
