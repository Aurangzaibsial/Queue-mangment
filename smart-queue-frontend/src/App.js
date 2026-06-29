import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import BusinessSettings from './pages/BusinessSettings';
import BookingPage from './pages/BookingPage';
import Navigation from './components/Navigation';

function ProtectedRoute({ children, requireAdmin, requireBusiness }) {
  const { user, business, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  
  if (requireAdmin && user.role !== 'admin' && user.role !== 'owner' && user.role !== 'superadmin') {
    return <Navigate to="/" />;
  }
  
  if (requireBusiness && !business) {
    // If they need a business but don't have one, send them to settings/onboarding
    return <Navigate to="/settings" />;
  }

  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      {user && <Navigation />}
      
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        
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
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
