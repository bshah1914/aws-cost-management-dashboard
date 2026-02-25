import React, { useState } from 'react';
import { Newspaper, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { PageLoader, ErrorBanner, EmptyState } from '../components/Common';
import { useApi } from '../hooks/useApi';

export default function NewsDashboard() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const { data: catData } = useApi<{ categories: string[] }>('/news/categories');
  const { data, loading, error, refetch } = useApi<any>(
    '/news/',
    { category: category || undefined, limit: 50 },
    [category]
  );

  const items = (data?.items || []).filter((item: any) =>
    !search || item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.summary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AWS News</h1>
          <p className="text-sm text-dark-500 mt-0.5">Latest updates from AWS</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="btn-secondary flex items-center gap-1 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news..."
            className="input pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="select text-sm w-auto"
        >
          <option value="">All Categories</option>
          {(catData?.categories || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {loading && <PageLoader />}

      {!loading && items.length === 0 && <EmptyState message="No news articles found" />}

      {!loading && items.length > 0 && (
        <div className="grid gap-4">
          {items.map((item: any, i: number) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge-blue">{item.category}</span>
                    {item.published && (
                      <span className="text-xs text-dark-500">{item.published}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary-500 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  {item.summary && (
                    <p className="text-xs text-dark-500 mt-1.5 line-clamp-2"
                       dangerouslySetInnerHTML={{ __html: item.summary }}
                    />
                  )}
                </div>
                <ExternalLink size={14} className="text-dark-400 flex-shrink-0 mt-1 group-hover:text-primary-500" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
