import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';

// ── Stat Card ─────────────────────────────────────
function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 20,
        padding: '24px 20px',
        border: '1px solid #E2E8F0',
        flex: '1 1 200px',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── Queue Card ────────────────────────────────────
function QueueCard({ queue, counters, onCallNext, callingNext }) {
  const queueCounters = counters.filter(c => c.assignedQueue === queue._id || !c.assignedQueue);

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{queue.serviceName}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: queue.status === 'active' ? '#ECFDF5' : '#FEF3C7',
              color: queue.status === 'active' ? '#059669' : '#D97706',
            }}>
              {queue.status}
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{queue.category}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#3B82F6' }}>{queue.currentLength || 0}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>waiting</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ background: '#F1F5F9', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#475569' }}>
          ⏱ ~{queue.estimatedServiceTime}min/person
        </div>
        <div style={{ background: '#F1F5F9', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#475569' }}>
          📊 {queue.analytics?.totalServed || 0} served
        </div>
        <div style={{ background: '#F1F5F9', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#475569' }}>
          🪑 Max {queue.maxCapacity}
        </div>
      </div>

      {/* Counter buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {queueCounters.map(counter => (
          <button
            key={counter._id}
            onClick={() => onCallNext(queue._id, counter._id)}
            disabled={callingNext || counter.status === 'inactive'}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '10px 14px',
              border: 'none',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: counter.status === 'inactive' ? 'not-allowed' : 'pointer',
              background: counter.status === 'busy' ? '#FEF3C7' : counter.status === 'inactive' ? '#F1F5F9' : 'linear-gradient(135deg, #10B981, #059669)',
              color: counter.status === 'busy' ? '#D97706' : counter.status === 'inactive' ? '#94A3B8' : 'white',
              transition: 'all 0.2s',
            }}
          >
            {counter.status === 'busy' ? `🔄 ${counter.counterName} (Busy)` : counter.status === 'inactive' ? `⏸ ${counter.counterName}` : `📢 Call Next → ${counter.counterName}`}
          </button>
        ))}
        {queueCounters.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8', padding: '10px 0' }}>No counters assigned. Create one in Settings.</div>
        )}
      </div>
    </div>
  );
}

// ── Token List ────────────────────────────────────
function TokenList({ tokens, title }) {
  if (!tokens || tokens.length === 0) return null;

  const statusStyles = {
    waiting: { bg: '#EFF6FF', color: '#2563EB' },
    serving: { bg: '#FEF3C7', color: '#D97706' },
    completed: { bg: '#ECFDF5', color: '#059669' },
    skipped: { bg: '#FEF2F2', color: '#DC2626' },
    cancelled: { bg: '#F1F5F9', color: '#64748B' },
  };

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tokens.slice(0, 20).map(token => {
          const st = statusStyles[token.status] || statusStyles.waiting;
          return (
            <div
              key={token._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#F8FAFC',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
                  {token.tokenNumber}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{token.customerName || token.userId?.name || 'Customer'}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    {token.priority !== 'normal' && <span style={{ color: token.priority === 'emergency' ? '#DC2626' : '#D97706', fontWeight: 600 }}>⭐ {token.priority.toUpperCase()} · </span>}
                    Position #{token.position} · ~{token.estimatedWaitTime}min
                  </div>
                </div>
              </div>
              <span style={{ background: st.bg, color: st.color, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                {token.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────
export default function Dashboard() {
  const { business } = useAuth();
  const { on, joinRoom } = useSocket();

  const [queues, setQueues] = useState([]);
  const [counters, setCounters] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [callingNext, setCallingNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [qRes, aRes] = await Promise.all([
        api.get(`/queues/list?slug=${business?.slug || ''}`),
        api.get('/admin/analytics?days=7'),
      ]);

      const fetchedQueues = qRes.data?.queues || qRes.data || [];
      setQueues(fetchedQueues);
      setAnalytics(aRes.data);
      setCounters(aRes.data?.activeCounters || []);

      // Fetch waiting tokens for all queues
      const allTokens = [];
      for (const q of fetchedQueues) {
        try {
          const tRes = await api.get(`/queues/${q._id}`);
          const queueTokens = tRes.data?.tokens || tRes.data?.queue?.tokens || [];
          allTokens.push(...queueTokens);
        } catch (_) {
          // Queue may not have tokens endpoint — skip
        }
      }
      setTokens(allTokens);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [business?.slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Join socket rooms
  useEffect(() => {
    queues.forEach(q => joinRoom(q._id));
  }, [queues, joinRoom]);

  // Socket events
  useEffect(() => {
    const unsubs = [
      on('queueUpdated', () => fetchData()),
      on('tokenCalled', () => fetchData()),
      on('tokenBooked', () => fetchData()),
    ];
    return () => unsubs.forEach(u => u && u());
  }, [on, fetchData]);

  const handleCallNext = async (queueId, counterId) => {
    setCallingNext(true);
    try {
      await api.post('/admin/call-next', { queueId, counterId });
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to call next');
    } finally {
      setCallingNext(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⏳</div>
          <div style={{ color: '#64748B', fontSize: 15 }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const overview = analytics?.overview || {};

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: '#64748B', fontSize: 14 }}>
          {business?.name || 'Your Business'} · Real-time queue overview
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard icon="🎫" label="Total Tokens" value={overview.totalTokens || 0} color="#0F172A" bgColor="#F1F5F9" />
        <StatCard icon="✅" label="Served" value={overview.served || 0} color="#059669" bgColor="#ECFDF5" />
        <StatCard icon="⏱" label="Avg Wait" value={`${(overview.avgWaitTime || 0).toFixed(1)}m`} color="#3B82F6" bgColor="#EFF6FF" />
        <StatCard icon="📢" label="Active Queues" value={queues.filter(q => q.status === 'active').length} color="#D97706" bgColor="#FEF3C7" />
      </div>

      {/* Queue Cards */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Queue Management</h2>
        {queues.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: '48px 24px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ color: '#64748B', fontSize: 15, marginBottom: 4 }}>No queues created yet</p>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Go to Business Settings to create your first queue</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {queues.map(q => (
              <QueueCard key={q._id} queue={q} counters={counters} onCallNext={handleCallNext} callingNext={callingNext} />
            ))}
          </div>
        )}
      </div>

      {/* Active Tokens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <TokenList tokens={tokens.filter(t => t.status === 'waiting')} title="🟡 Waiting Tokens" />
        <TokenList tokens={tokens.filter(t => t.status === 'serving')} title="🟢 Currently Serving" />
      </div>

      {/* Peak Hours (simple bar chart) */}
      {analytics?.peakHours && (
        <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>📊 Peak Hours (Last 7 Days)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {analytics.peakHours.map((h, i) => {
              const maxCount = Math.max(...analytics.peakHours.map(p => p.count), 1);
              const height = (h.count / maxCount) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 28,
                      height: `${Math.max(height, 4)}%`,
                      background: h.count > 0 ? `linear-gradient(180deg, #3B82F6, #2563EB)` : '#E2E8F0',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.3s',
                    }}
                    title={`${h.label}: ${h.count} tokens, avg ${h.avgWait}min wait`}
                  />
                  <span style={{ fontSize: 9, color: '#94A3B8' }}>{h.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
