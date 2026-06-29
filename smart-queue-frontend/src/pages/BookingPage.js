import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';

export default function BookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { on, joinRoom } = useSocket();

  const [business, setBusiness] = useState(null);
  const [queues, setQueues] = useState([]);
  const [userTokens, setUserTokens] = useState([]);
  const [booking, setBooking] = useState({ queueId: '', priority: 'normal', notes: '' });
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notification, setNotification] = useState(null);

  // ── Fetch business and queues ───────────────────
  const fetchData = useCallback(async () => {
    try {
      const bizRes = await api.get(`/business/slug/${slug}`);
      setBusiness(bizRes.data);

      const qRes = await api.get(`/queues/list?slug=${slug}`);
      setQueues(qRes.data?.queues || qRes.data || []);

      if (user) {
        try {
          const tRes = await api.get(`/token/user/${user._id || user.id}`);
          setUserTokens(tRes.data || []);
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message || 'Business not found');
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Join socket rooms for real-time updates
  useEffect(() => {
    queues.forEach(q => joinRoom(q._id));
  }, [queues, joinRoom]);

  useEffect(() => {
    const unsubs = [
      on('queueUpdated', () => fetchData()),
      on('tokenCalled', () => fetchData()),
      on('yourTurn', (data) => {
        setNotification(data);
        setTimeout(() => setNotification(null), 15000);
      }),
      on('waitTimeUpdated', () => fetchData()),
    ];
    return () => unsubs.forEach(u => u && u());
  }, [on, fetchData]);

  // ── Book Token ──────────────────────────────────
  const handleBook = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!booking.queueId) {
      setError('Please select a queue');
      return;
    }

    setBookingLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/token/book', {
        queueId: booking.queueId,
        priority: booking.priority,
        notes: booking.notes,
        customerName: user.name,
      });
      setSuccess(`✅ Token booked! Your number: ${res.data?.tokenNumber || res.data?.token?.tokenNumber || 'Confirmed'}`);
      setBooking({ queueId: '', priority: 'normal', notes: '' });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to book token');
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Cancel Token ────────────────────────────────
  const handleCancel = async (tokenId) => {
    if (!window.confirm('Cancel this token?')) return;
    try {
      await api.del(`/token/${tokenId}/cancel`);
      fetchData();
      setSuccess('Token cancelled');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ color: '#64748B' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Business Not Found</h2>
          <p style={{ color: '#64748B', marginBottom: 24 }}>{error}</p>
          <button onClick={() => navigate('/')} style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = business?.primaryColor || '#0F172A';
  const accentColor = business?.accentColor || '#10B981';
  const activeTokens = userTokens.filter(t => t.status === 'waiting' || t.status === 'serving');

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* ── Your Turn Notification ────────────── */}
      {notification && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: 'white', padding: '20px 32px', borderRadius: 20,
          boxShadow: '0 12px 48px rgba(16,185,129,0.4)',
          zIndex: 1000, textAlign: 'center', maxWidth: 420,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>It's Your Turn!</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>{notification.message}</div>
        </div>
      )}

      {/* ── Business Header ──────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
          color: 'white',
          padding: '48px 24px 60px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {business?.logo && <img src={business.logo} alt="" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }} />}
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{business?.name}</h1>
          {business?.tagline && <p style={{ fontSize: 16, opacity: 0.8, marginBottom: 12 }}>{business.tagline}</p>}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, opacity: 0.7 }}>
            {business?.phone && <span>📞 {business.phone}</span>}
            {business?.email && <span>✉️ {business.email}</span>}
            {business?.address && <span>📍 {business.address}{business.city ? `, ${business.city}` : ''}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '-32px auto 0', padding: '0 24px 48px', position: 'relative', zIndex: 1 }}>
        {/* ── Messages ───────────────────────── */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '12px 16px', marginBottom: 16, color: '#DC2626', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: '12px 16px', marginBottom: 16, color: '#059669', fontSize: 14 }}>
            {success}
          </div>
        )}

        {/* ── Active Tokens ──────────────────── */}
        {activeTokens.length > 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>🎫 Your Active Tokens</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeTokens.map(token => (
                <div
                  key={token._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: token.status === 'serving' ? '#ECFDF5' : '#EFF6FF',
                    borderRadius: 16,
                    border: `1px solid ${token.status === 'serving' ? '#A7F3D0' : '#BFDBFE'}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: token.status === 'serving' ? '#059669' : '#2563EB' }}>
                        {token.tokenNumber}
                      </span>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: token.status === 'serving' ? '#D1FAE5' : '#DBEAFE',
                        color: token.status === 'serving' ? '#059669' : '#2563EB',
                      }}>
                        {token.status === 'serving' ? '🟢 YOUR TURN!' : `#${token.position} in line`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B' }}>
                      {token.status === 'waiting' && `~${token.estimatedWaitTime || 0} min wait`}
                      {token.status === 'serving' && token.assignedCounter && `Proceed to your counter`}
                    </div>
                  </div>
                  {token.status === 'waiting' && (
                    <button
                      onClick={() => handleCancel(token._id)}
                      style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Available Queues ───────────────── */}
        <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 20 }}>📋 Available Queues</h3>

          {queues.length === 0 ? (
            <p style={{ color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No queues available right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queues.filter(q => q.status === 'active').map(queue => (
                <label
                  key={queue._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    border: booking.queueId === queue._id ? `2px solid ${accentColor}` : '1.5px solid #E2E8F0',
                    borderRadius: 16,
                    cursor: 'pointer',
                    background: booking.queueId === queue._id ? `${accentColor}08` : '#FAFBFC',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="radio"
                      name="queueId"
                      value={queue._id}
                      checked={booking.queueId === queue._id}
                      onChange={(e) => setBooking(b => ({ ...b, queueId: e.target.value }))}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: booking.queueId === queue._id ? `6px solid ${accentColor}` : '2px solid #CBD5E1',
                      transition: 'all 0.2s',
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{queue.serviceName}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>
                        {queue.category} · ~{queue.estimatedServiceTime}min per person
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6' }}>{queue.currentLength || 0}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>in queue</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Booking Form ───────────────────── */}
        {queues.length > 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 20 }}>🎫 Book Your Token</h3>

            <form onSubmit={handleBook}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Priority</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { value: 'normal', label: '🟢 Normal', color: '#059669' },
                    { value: 'vip', label: '⭐ VIP', color: '#D97706' },
                    { value: 'emergency', label: '🚨 Emergency', color: '#DC2626' },
                  ].map(p => (
                    <label
                      key={p.value}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '10px 12px',
                        border: booking.priority === p.value ? `2px solid ${p.color}` : '1.5px solid #E2E8F0',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        color: booking.priority === p.value ? p.color : '#64748B',
                        background: booking.priority === p.value ? `${p.color}08` : 'white',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input type="radio" name="priority" value={p.value} checked={booking.priority === p.value} onChange={(e) => setBooking(b => ({ ...b, priority: e.target.value }))} style={{ display: 'none' }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Notes (optional)</label>
                <textarea
                  value={booking.notes}
                  onChange={(e) => setBooking(b => ({ ...b, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 12,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: '#F8FAFC',
                    minHeight: 70,
                    resize: 'vertical',
                  }}
                  placeholder="Any special requirements..."
                  maxLength={500}
                />
              </div>

              <button
                type="submit"
                disabled={bookingLoading || !booking.queueId}
                style={{
                  width: '100%',
                  padding: 16,
                  background: bookingLoading || !booking.queueId ? '#94A3B8' : `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: bookingLoading || !booking.queueId ? 'not-allowed' : 'pointer',
                  boxShadow: bookingLoading || !booking.queueId ? 'none' : `0 4px 20px ${accentColor}44`,
                  transition: 'all 0.2s',
                }}
              >
                {bookingLoading ? '⏳ Booking...' : !user ? '🔐 Sign in to Book' : '🎫 Book Token Now'}
              </button>
            </form>
          </div>
        )}

        {/* ── Business Hours ─────────────────── */}
        {business?.operatingHours && (
          <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>🕐 Operating Hours</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                const h = business.operatingHours[day];
                if (!h) return null;
                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{day}</span>
                    <span style={{ color: h.isClosed ? '#DC2626' : '#64748B' }}>
                      {h.isClosed ? 'Closed' : `${h.open} - ${h.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
