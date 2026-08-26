import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';

/* ── Inline SVG QR Code Generator Component ── */
function TicketQRCode({ tokenNumber = 'T-001', slug = 'business' }) {
  const hashStr = `${tokenNumber}-${slug}-${Date.now().toString(36)}`;
  return (
    <div style={{
      background: 'white',
      padding: 10,
      borderRadius: 12,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <svg width="88" height="88" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
        <rect width="100" height="100" fill="white" />
        <rect x="8" y="8" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="14" y="14" width="16" height="16" fill="white" rx="2" />
        <rect x="18" y="18" width="8" height="8" fill="#0F172A" rx="1" />
        <rect x="64" y="8" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="70" y="14" width="16" height="16" fill="white" rx="2" />
        <rect x="74" y="18" width="8" height="8" fill="#0F172A" rx="1" />
        <rect x="8" y="64" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="14" y="70" width="16" height="16" fill="white" rx="2" />
        <rect x="18" y="74" width="8" height="8" fill="#0F172A" rx="1" />
        <rect x="42" y="10" width="6" height="6" fill="#3B82F6" />
        <rect x="52" y="18" width="6" height="6" fill="#0F172A" />
        <rect x="42" y="26" width="6" height="6" fill="#0F172A" />
        <rect x="52" y="34" width="6" height="6" fill="#10B981" />
        <rect x="12" y="44" width="6" height="6" fill="#0F172A" />
        <rect x="22" y="44" width="6" height="6" fill="#3B82F6" />
        <rect x="32" y="44" width="6" height="6" fill="#0F172A" />
        <rect x="42" y="44" width="16" height="16" fill="#0F172A" rx="2" />
        <rect x="62" y="44" width="6" height="6" fill="#10B981" />
        <rect x="72" y="44" width="6" height="6" fill="#0F172A" />
        <rect x="82" y="44" width="6" height="6" fill="#3B82F6" />
        <rect x="42" y="68" width="6" height="6" fill="#0F172A" />
        <rect x="52" y="76" width="6" height="6" fill="#3B82F6" />
        <rect x="64" y="68" width="8" height="8" fill="#0F172A" />
        <rect x="76" y="68" width="8" height="8" fill="#10B981" />
        <rect x="64" y="80" width="8" height="8" fill="#0F172A" />
        <rect x="76" y="80" width="8" height="8" fill="#3B82F6" />
      </svg>
      <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#64748B', marginTop: 3 }}>
        {hashStr.substring(0, 10).toUpperCase()}
      </span>
    </div>
  );
}

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
  const [recentPass, setRecentPass] = useState(null);
  const [notification, setNotification] = useState(null);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  // ── Fetch business and queues ───────────────────
  const fetchData = useCallback(async () => {
    try {
      const bizRes = await api.get(`/business/slug/${slug}`);
      setBusiness(bizRes.data);

      const qRes = await api.get(`/queues/list?slug=${slug}`);
      const qList = qRes.data?.queues || qRes.data || [];
      setQueues(qList);

      if (qList.length > 0 && !booking.queueId) {
        setBooking(b => ({ ...b, queueId: qList[0]._id }));
      }

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
  }, [slug, user, booking.queueId]);

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
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(`/q/${slug}`)}`);
      return;
    }
    if (!booking.queueId) {
      setError('Please select a service to book');
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

      const tokenData = res.data?.token || res.data;
      const chosenQueue = queues.find(q => q._id === booking.queueId);

      setRecentPass({
        token: tokenData,
        queue: chosenQueue,
        position: res.data?.position || tokenData?.position || 1,
        estimatedWaitTime: res.data?.estimatedWaitTime || tokenData?.estimatedWaitTime || 5,
        peopleAhead: res.data?.peopleAhead ?? Math.max((res.data?.position || tokenData?.position || 1) - 1, 0),
        avgServiceTime: res.data?.avgServiceTime || chosenQueue?.estimatedServiceTime || 5,
        estimatedTurnAt: res.data?.estimatedTurnAt,
        aiConfidence: res.data?.aiConfidence || 0.85,
      });

      setSuccess(`✅ Online Ticket Booked! Your number: ${tokenData?.tokenNumber || 'Confirmed'}`);
      setBooking({ queueId: queues[0]?._id || '', priority: 'normal', notes: '' });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to book token');
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Cancel Token ────────────────────────────────
  const handleCancel = async (tokenId) => {
    if (!window.confirm('Cancel this online ticket reservation?')) return;
    try {
      await api.del(`/token/${tokenId}/cancel`);
      fetchData();
      setSuccess('Token cancelled');
      if (recentPass?.token?._id === tokenId) {
        setRecentPass(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const askAssistant = async (e) => {
    e.preventDefault();
    if (!assistantQuestion.trim()) return;
    setAssistantLoading(true);
    try {
      const res = await api.post('/ai/assistant', { slug, question: assistantQuestion });
      setAssistantAnswer(res.data?.text || res.text || 'Please contact the business for help.');
    } catch (err) {
      setAssistantAnswer(err.message || 'Assistant unavailable right now.');
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1.5s linear infinite' }}>⏳</div>
          <p style={{ color: '#64748B' }}>Loading business & online services...</p>
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
          <button
            onClick={() => navigate('/businesses')}
            style={{
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Browse All Businesses
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
          background: `linear-gradient(135deg, ${primaryColor}, #1E293B)`,
          color: 'white',
          padding: '48px 24px 64px',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {business?.logo ? (
              <img src={business.logo} alt="" style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', border: '3px solid rgba(255,255,255,0.2)' }} />
            ) : (
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 800,
                color: 'white',
                border: '3px solid rgba(255,255,255,0.2)'
              }}>
                {business?.name?.charAt(0) || 'B'}
              </div>
            )}
          </div>

          <span style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            Online Service Booking • {business?.category || 'General'}
          </span>

          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '12px 0 6px' }}>{business?.name}</h1>
          {business?.tagline && <p style={{ fontSize: 16, opacity: 0.85, margin: '0 0 16px' }}>{business.tagline}</p>}

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, opacity: 0.8 }}>
            {business?.rating?.average > 0 && (
              <span>⭐ <strong>{business.rating.average.toFixed(1)}</strong> ({business.rating.count} reviews)</span>
            )}
            {business?.pricing?.baseRate > 0 && <span>💵 From ${business.pricing.baseRate}</span>}
            {business?.phone && <span>📞 {business.phone}</span>}
            {business?.address && <span>📍 {business.address}{business.city ? `, ${business.city}` : ''}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '-32px auto 0', padding: '0 24px 48px', position: 'relative', zIndex: 1 }}>
        {/* ── Messages ───────────────────────── */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '14px 18px', marginBottom: 16, color: '#DC2626', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚠️</span> {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: '14px 18px', marginBottom: 16, color: '#059669', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎉</span> {success}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 20, padding: 22, border: '1px solid #E2E8F0', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '0 0 12px' }}>Ask about this business</h3>
          <form onSubmit={askAssistant} style={{ display: 'flex', gap: 10 }}>
            <input value={assistantQuestion} onChange={(e) => setAssistantQuestion(e.target.value)} placeholder="Ask about services, hours, or booking" style={{ flex: 1, padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14 }} />
            <button type="submit" disabled={assistantLoading} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: 10, padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}>{assistantLoading ? '...' : 'Ask'}</button>
          </form>
          {assistantAnswer && <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5, margin: '14px 0 0' }}>{assistantAnswer}</p>}
        </div>

        {/* ── Newly Booked Digital E-Ticket Pass ─ */}
        {recentPass && (
          <div style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: 'white',
            borderRadius: 24,
            padding: 28,
            marginBottom: 24,
            boxShadow: '0 15px 40px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.12)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: 18, marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Your Digital E-Ticket Pass
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>{business?.name}</h2>
                <div style={{ fontSize: 14, color: '#94A3B8' }}>{recentPass.queue?.serviceName}</div>
              </div>

              <TicketQRCode tokenNumber={recentPass.token?.tokenNumber || 'T-001'} slug={business?.slug} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, background: 'rgba(255,255,255,0.06)', padding: 18, borderRadius: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>Token Number</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#FCD34D', letterSpacing: 1 }}>
                  {recentPass.token?.tokenNumber}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>Position</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#4ADE80' }}>
                  #{recentPass.position} <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8' }}>in line</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>Est. Wait Time</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#C084FC', marginTop: 4 }}>
                  🤖 ~{Math.round(recentPass.estimatedWaitTime)} mins
                </div>
              </div>
            </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#CBD5E1', fontSize: 13, marginBottom: 18 }}>
                <span>{recentPass.peopleAhead} {recentPass.peopleAhead === 1 ? 'person' : 'people'} ahead</span>
                <span>Avg. service: {recentPass.avgServiceTime} min/customer</span>
                {recentPass.estimatedTurnAt && <span>Estimated turn: {new Date(recentPass.estimatedTurnAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
              </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '10px 18px',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🖨️ Print Pass
              </button>
            </div>
          </div>
        )}

        {/* ── Active User Tokens ──────────────── */}
        {activeTokens.length > 0 && (
          <div style={{ background: 'white', borderRadius: 24, padding: 28, border: '1px solid #E2E8F0', marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎫</span> Your Live Tokens for this Business
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeTokens.map(token => (
                <div
                  key={token._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '18px 20px',
                    background: token.status === 'serving' ? '#ECFDF5' : '#F8FAFC',
                    borderRadius: 18,
                    border: token.status === 'serving' ? '2px solid #10B981' : '1.5px solid #E2E8F0',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: token.status === 'serving' ? '#059669' : '#0F172A' }}>
                        {token.tokenNumber}
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: token.status === 'serving' ? '#D1FAE5' : '#EFF6FF',
                        color: token.status === 'serving' ? '#059669' : '#2563EB',
                        border: `1px solid ${token.status === 'serving' ? '#A7F3D0' : '#BFDBFE'}`
                      }}>
                        {token.status === 'serving' ? '🔔 NOW SERVING — PROCEED TO COUNTER' : `#${token.position} in line`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B' }}>
                      Service: <strong>{token.queueId?.serviceName || 'General Desk'}</strong> • {token.peopleAhead ?? Math.max((token.position || 1) - 1, 0)} ahead • Avg. {token.avgServiceTime || token.queueId?.estimatedServiceTime || 5} min/customer • Turn: {token.estimatedTurnAt ? new Date(token.estimatedTurnAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : `~${Math.round(token.estimatedWaitTime || 5)} mins`}
                    </div>
                  </div>
                  {token.status === 'waiting' && (
                    <button
                      onClick={() => handleCancel(token._id)}
                      style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        padding: '10px 16px',
                        fontSize: 13,
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

        {/* ── Available Services & Online Booking ── */}
        <div style={{ background: 'white', borderRadius: 24, padding: 28, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 16px' }}>
            ⚡ 1. Choose an Online Service / Queue
          </h3>

          {queues.length === 0 ? (
            <p style={{ color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No active services available at the moment.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {queues.filter(q => q.status === 'active').map(queue => {
                const isSelected = booking.queueId === queue._id;
                const waitTime = queue.estimatedWaitTime || (queue.estimatedServiceTime * Math.max(queue.waitingCount || 1, 1));
                return (
                  <label
                    key={queue._id}
                    onClick={() => setBooking(b => ({ ...b, queueId: queue._id }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '18px 20px',
                      border: isSelected ? `2px solid ${accentColor}` : '1.5px solid #E2E8F0',
                      borderRadius: 18,
                      cursor: 'pointer',
                      background: isSelected ? '#F0FDF4' : 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <input
                        type="radio"
                        name="queueId"
                        value={queue._id}
                        checked={isSelected}
                        onChange={() => setBooking(b => ({ ...b, queueId: queue._id }))}
                        style={{ width: 20, height: 20, accentColor: accentColor }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>{queue.serviceName}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#EFF6FF',
                            color: '#2563EB',
                            padding: '2px 8px',
                            borderRadius: 6
                          }}>
                            {queue.category || 'General'}
                          </span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            👥 {queue.waitingCount || 0} waiting
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#7C3AED',
                        background: '#F5F3FF',
                        padding: '4px 10px',
                        borderRadius: 8
                      }}>
                        🤖 ~{Math.round(waitTime)}m wait
                      </div>
                      {queue.serviceFee > 0 && (
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A', marginTop: 4 }}>
                          ${queue.serviceFee}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* ── Booking Form ── */}
          {queues.length > 0 && (
            <form onSubmit={handleBook} style={{ marginTop: 24, borderTop: '1px solid #E2E8F0', paddingTop: 24 }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                  2. Priority Level
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { value: 'normal', label: 'Normal (Standard)', color: '#059669' },
                    { value: 'vip', label: '👑 VIP Priority', color: '#D97706' },
                    { value: 'emergency', label: '🚨 Urgent / Emergency', color: '#DC2626' },
                  ].map(p => (
                    <div
                      key={p.value}
                      onClick={() => setBooking(b => ({ ...b, priority: p.value }))}
                      style={{
                        textAlign: 'center',
                        padding: '12px 14px',
                        border: booking.priority === p.value ? `2px solid ${p.color}` : '1.5px solid #E2E8F0',
                        borderRadius: 14,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        color: booking.priority === p.value ? p.color : '#64748B',
                        background: booking.priority === p.value ? `${p.color}0c` : '#F8FAFC',
                        transition: 'all 0.15s',
                      }}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  3. Reason / Notes <span style={{ fontWeight: 400, color: '#94A3B8' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={booking.notes}
                  onChange={(e) => setBooking(b => ({ ...b, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 14,
                    fontSize: 14,
                    outline: 'none',
                    background: '#F8FAFC',
                    boxSizing: 'border-box'
                  }}
                  placeholder="e.g. Consultation, Checkup, Prescription renewal..."
                  maxLength={200}
                />
              </div>

              <button
                type="submit"
                disabled={bookingLoading || !booking.queueId}
                style={{
                  width: '100%',
                  padding: 18,
                  background: bookingLoading || !booking.queueId ? '#94A3B8' : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: 16,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: bookingLoading || !booking.queueId ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10
                }}
              >
                {bookingLoading ? '⏳ Booking Ticket...' : !user ? '🔐 Sign In to Book Online Ticket' : '🎟️ Book Online Ticket Now'}
              </button>
            </form>
          )}
        </div>

        {/* ── Business Hours ─────────────────── */}
        {business?.operatingHours && (
          <div style={{ background: 'white', borderRadius: 24, padding: 28, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>🕐 Operating Hours</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                const h = business.operatingHours[day];
                if (!h) return null;
                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{day}</span>
                    <span style={{ color: h.isClosed ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
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
