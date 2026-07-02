import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel, getRoleBadgeColor, isBusinessUser, isPlatformAdmin, isCustomer } from '../utils/auth';

export default function Navigation() {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();
  const badge = getRoleBadgeColor(user.role);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ background: "white", borderBottom: "1px solid #E2E8F0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" style={{ textDecoration: 'none', display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#0F172A", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#0F172A" }}>QueueFlow <span style={{ fontWeight: 300, color: "#94A3B8" }}>AI</span></div>
              {business && <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>{business.name}</div>}
            </div>
          </Link>

          {isBusinessUser(user.role) && (
            <div style={{ display: "flex", gap: 16, marginLeft: 24 }}>
              <Link to="/dashboard" style={{ textDecoration: 'none', color: "#64748B", fontWeight: 500, fontSize: 14 }}>Dashboard</Link>
              <Link to="/settings" style={{ textDecoration: 'none', color: "#64748B", fontWeight: 500, fontSize: 14 }}>Business Settings</Link>
              {business?.slug && (
                <Link to={`/q/${business.slug}`} style={{ textDecoration: 'none', color: "#3B82F6", fontWeight: 500, fontSize: 14 }}>Public Page</Link>
              )}
            </div>
          )}

          {isPlatformAdmin(user.role) && (
            <div style={{ display: "flex", gap: 16, marginLeft: 24 }}>
              <Link to="/dashboard" style={{ textDecoration: 'none', color: "#64748B", fontWeight: 500, fontSize: 14 }}>Platform Dashboard</Link>
            </div>
          )}

          {isCustomer(user.role) && (
            <div style={{ display: "flex", gap: 16, marginLeft: 24 }}>
              <Link to="/" style={{ textDecoration: 'none', color: "#64748B", fontWeight: 500, fontSize: 14 }}>Home</Link>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: "#64748B" }}>{user.name}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 999,
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
            }}>
              {getRoleLabel(user.role)}
            </span>
          </div>
          <button onClick={handleLogout}
            style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
