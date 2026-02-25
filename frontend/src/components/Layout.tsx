import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, TrendingUp, Cpu, AlertTriangle, PiggyBank,
  Newspaper, Brain, Shield, LogOut, Menu, X, Sun, Moon, ChevronDown, DollarSign
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: 'Cost Dashboard', icon: LayoutDashboard },
  { path: '/forecast', label: 'Forecast', icon: TrendingUp },
  { path: '/optimizer', label: 'Compute Optimizer', icon: Cpu },
  { path: '/anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
  { path: '/optimization-hub', label: 'Optimization Hub', icon: PiggyBank },
  { path: '/news', label: 'AWS News', icon: Newspaper },
  { path: '/ai', label: 'AI Recommendations', icon: Brain },
];

const adminItems = [
  { path: '/admin/accounts', label: 'AWS Accounts', icon: Shield },
  { path: '/admin/users', label: 'Users', icon: Shield },
  { path: '/admin/activity', label: 'User Activity', icon: Shield },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 ease-in-out',
          'bg-white dark:bg-dark-900 border-r border-dark-200 dark:border-dark-700',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-dark-200 dark:border-dark-700">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm">AWS Cost Platform</h1>
            <p className="text-xs text-dark-500">Management & Optimization</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 hover:text-dark-900 dark:hover:text-dark-100'
                )}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* Admin section */}
          {user?.is_admin && (
            <>
              <div className="pt-4 pb-2">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider hover:text-dark-600 dark:hover:text-dark-300"
                >
                  Admin
                  <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', adminOpen && 'rotate-180')} />
                </button>
              </div>
              {adminOpen && adminItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 hover:text-dark-900 dark:hover:text-dark-100'
                    )}
                  >
                    <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User info */}
        <div className="border-t border-dark-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-dark-500">{user?.is_admin ? 'Admin' : 'User'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
