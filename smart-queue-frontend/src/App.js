import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { isBusinessUser, isPlatformAdmin } from './utils/auth';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import BusinessSettings from './pages/BusinessSettings';
import BookingPage from './pages/BookingPage';
import BusinessListing from './pages/BusinessListing';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Navigation from './components/Navigation';

function AuthLoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin, requireBusiness, requireSuperAdmin }) {
  const { user, business, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  if (requireSuperAdmin && user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isBusinessUser(user.role) && !isPlatformAdmin(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Platform admins bypass business requirement; business users need onboarding
  if (requireBusiness && !business && !isPlatformAdmin(user.role)) {
    return <Navigate to="/settings" replace />;
  }

  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      {user && <Navigation />}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/businesses" element={<BusinessListing />} />

        <Route path="/dashboard" element={
          <ProtectedRoute requireAdmin requireBusiness>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute requireAdmin>
            <BusinessSettings />
          </ProtectedRoute>
        } />

        {/* Public booking page for a specific business */}
        <Route path="/q/:slug" element={<BookingPage />} />

        {/* Super Admin portal */}
        <Route path="/superadmin" element={
          <ProtectedRoute requireSuperAdmin>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
