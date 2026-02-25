import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export function useApi<T>(url: string, params?: Record<string, any>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [url, JSON.stringify(params), ...deps]);

  useEffect(() => {
    // Skip fetch if any required date params are empty (e.g. custom filter not yet filled)
    const p = params || {};
    if (('start_date' in p && !p.start_date) || ('end_date' in p && !p.end_date)) {
      setLoading(false);
      return;
    }
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get('/admin/accounts').then((res) => {
      setAccounts(
        res.data.map((a: any) => ({
          id: a.account_id,
          name: a.account_name,
        }))
      );
    }).catch(() => {
      // User might not be admin — try from user info
    });
  }, []);

  return accounts;
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-US').format(val);
}

export function getDateRange(preset: string): { start: string; end: string; granularity: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: Date;
  let granularity = 'DAILY';

  switch (preset) {
    case '1d':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      granularity = 'DAILY';
      break;
    case '7d':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case '14d':
      start = new Date(now);
      start.setDate(start.getDate() - 14);
      break;
    case '1m':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case '3m':
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      granularity = 'MONTHLY';
      break;
    case '6m':
      start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      granularity = 'MONTHLY';
      break;
    default:
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
  }

  return {
    start: start.toISOString().split('T')[0],
    end,
    granularity,
  };
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
