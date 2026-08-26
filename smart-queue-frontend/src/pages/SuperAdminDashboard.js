import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';

/* ─────────────────────────────────────────────────────────────
   SuperAdminDashboard
   Route: /superadmin  (superadmin role only)
   Shows: registered-user counts, business counts, pending approvals
   ───────────────────────────────────────────────────────────── */

const STATUS_COLORS = {
  pending:   { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A', label: 'Pending' },
  active:    { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'Active' },
  suspended: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Suspended' },
  cancelled: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', label: 'Cancelled' },
};

const CATEGORY_ICONS = {
  restaurant: '🍽️', clinic: '🏥', salon: '💈', bank: '🏦',
  government: '🏛️', retail: '🛍️', education: '🎓', fitness: '💪', other: '🏢',
};

function StatCard({ icon, label, value, sub, accent = '#3B82F6' }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '24px 28px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>{s.label}</span>
  );
}

function ActionButton({ label, onClick, color = '#3B82F6', disabled = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        background: hover && !disabled ? color : 'transparent',
        color: hover && !disabled ? 'white' : color,
        border: `1px solid ${color}`,
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</button>
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [filter, setFilter] = useState('all');   // 'all' | 'pending' | 'active' | 'suspended'
  const [loading, setLoading] = useState(true);
  const [bizLoading, setBizLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null); // { type: 'success'|'error', text: string }
  const [updatingId, setUpdatingId] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/platform-stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load platform stats', err);
    }
  }, []);

  const fetchBusinesses = useCallback(async (statusFilter) => {
    setBizLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await api.get(`/admin/platform/businesses${params}`);
      setBusinesses(res.data || []);
    } catch (err) {
      console.error('Failed to load businesses', err);
    } finally {
      setBizLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchBusinesses('all')]).finally(() => setLoading(false));
  }, [fetchStats, fetchBusinesses]);

  useEffect(() => {
    fetchBusinesses(filter);
  }, [filter, fetchBusinesses]);

  const handleStatusChange = async (bizId, newStatus) => {
    setUpdatingId(bizId);
    setActionMsg(null);
    try {
      await api.patch(`/admin/platform/businesses/${bizId}/status`, { status: newStatus });
      setActionMsg({ type: 'success', text: `Business ${newStatus === 'active' ? 'approved' : newStatus} successfully.` });
      // Refresh both stats and list
      await Promise.all([fetchStats(), fetchBusinesses(filter)]);
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.response?.data?.message || 'Action failed. Please try again.' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '3px solid #E2E8F0', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: '#94A3B8', fontWeight: 500 }}>Loading platform data…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const u = stats?.users || {};
  const b = stats?.businesses || {};
  const byStatus = b.byStatus || {};

  const FILTERS = [
    { key: 'all',       label: 'All',       count: b.total },
    { key: 'pending',   label: '⏳ Pending', count: byStatus.pending },
    { key: 'active',    label: '✅ Active',  count: byStatus.active },
    { key: 'suspended', label: '🚫 Suspended', count: byStatus.suspended },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛡️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A' }}>Platform Admin Dashboard</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>Manage all registered users and businesses</p>
          </div>
        </div>
      </div>

      {/* ── Action Message ──────────────────── */}
      {actionMsg && (
        <div style={{
          padding: '14px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 500,
          background: actionMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: actionMsg.type === 'success' ? '#059669' : '#DC2626',
          border: `1px solid ${actionMsg.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{actionMsg.type === 'success' ? '✅ ' : '❌ '}{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
        <StatCard icon="👥" label="Total Users"      value={u.total}          sub={`${u.byRole?.owner || 0} owners · ${u.byRole?.user || 0} customers`} accent="#3B82F6" />
        <StatCard icon="🏢" label="Total Businesses"  value={b.total}          sub="All registered businesses"  accent="#7C3AED" />
        <StatCard icon="⏳" label="Pending Approval"  value={byStatus.pending || 0} sub="Awaiting review"      accent="#D97706" />
        <StatCard icon="✅" label="Active Businesses" value={byStatus.active || 0}  sub="Live on the platform"  accent="#059669" />
        <StatCard icon="🚫" label="Suspended"         value={byStatus.suspended || 0} sub="Access restricted"  accent="#DC2626" />
      </div>

      {/* ── Businesses Table ─────────────────── */}
      <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>

        {/* Table header row */}
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Registered Businesses</h2>
            <button
              onClick={() => { fetchStats(); fetchBusinesses(filter); }}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
            >↻ Refresh</button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: filter === f.key ? '#7C3AED' : '#F8FAFC',
                  color: filter === f.key ? 'white' : '#475569',
                  border: `1px solid ${filter === f.key ? '#7C3AED' : '#E2E8F0'}`,
                  transition: 'all 0.15s',
                }}
              >
                {f.label} {f.count !== undefined && <span style={{ opacity: 0.75 }}>({f.count ?? 0})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {bizLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading…
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏜️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>No businesses found</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>No businesses match the selected filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Business', 'Owner', 'Category', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {businesses.map((biz, idx) => (
                  <tr
                    key={biz._id}
                    style={{ background: idx % 2 === 0 ? 'white' : '#FAFBFC', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#FAFBFC'}
                  >
                    {/* Business */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {CATEGORY_ICONS[biz.category] || '🏢'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{biz.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>/{biz.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      {biz.ownerId ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{biz.ownerId.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{biz.ownerId.email}</div>
                        </div>
                      ) : <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: 13, color: '#475569', textTransform: 'capitalize' }}>{biz.category || '—'}</span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <StatusBadge status={biz.status} />
                    </td>

                    {/* Joined */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>
                        {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {biz.status !== 'active' && (
                          <ActionButton label="✅ Approve" color="#059669" disabled={updatingId === biz._id} onClick={() => handleStatusChange(biz._id, 'active')} />
                        )}
                        {biz.status !== 'suspended' && biz.status !== 'cancelled' && (
                          <ActionButton label="🚫 Suspend" color="#DC2626" disabled={updatingId === biz._id} onClick={() => handleStatusChange(biz._id, 'suspended')} />
                        )}
                        {biz.status !== 'pending' && (
                          <ActionButton label="⏳ Set Pending" color="#D97706" disabled={updatingId === biz._id} onClick={() => handleStatusChange(biz._id, 'pending')} />
                        )}
                        {updatingId === biz._id && (
                          <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 500, alignSelf: 'center' }}>Saving…</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Users section ─────────────── */}
      {u.recent && u.recent.length > 0 && (
        <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', marginTop: 32 }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Recently Registered Users</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Name', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {u.recent.map((usr, idx) => {
                  const ROLE_STYLE = {
                    user:       { bg: '#EFF6FF', color: '#2563EB', label: 'Customer' },
                    admin:      { bg: '#ECFDF5', color: '#059669', label: 'Business' },
                    owner:      { bg: '#F0FDF4', color: '#15803D', label: 'Owner' },
                    superadmin: { bg: '#FEF3C7', color: '#D97706', label: 'Super Admin' },
                  };
                  const rs = ROLE_STYLE[usr.role] || { bg: '#F1F5F9', color: '#64748B', label: usr.role };
                  return (
                    <tr key={usr._id} style={{ background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#FAFBFC'}
                    >
                      <td style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{usr.name}</td>
                      <td style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', fontSize: 13, color: '#64748B' }}>{usr.email}</td>
                      <td style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: rs.bg, color: rs.color }}>{rs.label}</span>
                      </td>
                      <td style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', fontSize: 13, color: '#64748B' }}>
                        {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
