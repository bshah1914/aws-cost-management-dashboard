import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CostDashboard from './pages/CostDashboard';
import ForecastDashboard from './pages/ForecastDashboard';
import ComputeOptimizerDashboard from './pages/ComputeOptimizerDashboard';
import AnomalyDetectionDashboard from './pages/AnomalyDetectionDashboard';
import OptimizationHubDashboard from './pages/OptimizationHubDashboard';
import NewsDashboard from './pages/NewsDashboard';
import AIRecommendationsDashboard from './pages/AIRecommendationsDashboard';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import { Spinner } from './components/Common';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-dark-950">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-dark-950">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-dark-950">
        <Spinner />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* Protected routes wrapped in Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CostDashboard />} />
        <Route path="forecast" element={<ForecastDashboard />} />
        <Route path="optimizer" element={<ComputeOptimizerDashboard />} />
        <Route path="anomalies" element={<AnomalyDetectionDashboard />} />
        <Route path="optimization-hub" element={<OptimizationHubDashboard />} />
        <Route path="news" element={<NewsDashboard />} />
        <Route path="ai" element={<AIRecommendationsDashboard />} />

        {/* Admin routes */}
        <Route
          path="admin/accounts"
          element={
            <AdminRoute>
              <AdminAccountsPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/activity"
          element={
            <AdminRoute>
              <AdminActivityPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
