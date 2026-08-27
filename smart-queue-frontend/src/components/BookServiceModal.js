import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

/* ── Inline SVG QR Code Generator Component ── */
function TicketQRCode({ tokenNumber = 'T-001', slug = 'business' }) {
  const hashStr = `${tokenNumber}-${slug}-${Date.now().toString(36)}`;
  return (
    <div style={{
      background: 'white',
      padding: 12,
      borderRadius: 12,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
        {/* Border and corner targets */}
        <rect width="100" height="100" fill="white" />
        {/* Top-left target */}
        <rect x="8" y="8" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="14" y="14" width="16" height="16" fill="white" rx="2" />
        <rect x="18" y="18" width="8" height="8" fill="#0F172A" rx="1" />
        {/* Top-right target */}
        <rect x="64" y="8" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="70" y="14" width="16" height="16" fill="white" rx="2" />
        <rect x="74" y="18" width="8" height="8" fill="#0F172A" rx="1" />
        {/* Bottom-left target */}
        <rect x="8" y="64" width="28" height="28" fill="#0F172A" rx="4" />
        <rect x="14" y="70" width="16" height="16" fill="white" rx="2" />
        <rect x="18" y="74" width="8" height="8" fill="#0F172A" rx="1" />
        {/* Simulated data matrix blocks */}
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
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748B', marginTop: 4, letterSpacing: 0.5 }}>
        PASS: {hashStr.substring(0, 14).toUpperCase()}
      </span>
    </div>
  );
}

export default function BookServiceModal({ business, isOpen, onClose, onBookingSuccess }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queues, setQueues] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState(user?.phone || '');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookedPass, setBookedPass] = useState(null);

  // Fetch available service queues for this business
  useEffect(() => {
    if (!isOpen || !business) return;

    setBookedPass(null);
    setError('');
    setLoadingQueues(true);
    setCustomerName(user?.name || '');
    setWhatsappNumber(user?.phone || '');
    setWhatsappOptIn(false);

    const fetchQueues = async () => {
      try {
        const query = business.slug ? `slug=${business.slug}` : `businessId=${business._id}`;
        const res = await api.get(`/queues/list?${query}`);
        const list = res.data?.queues || res.data || [];
        setQueues(list);
        if (list.length > 0) {
          setSelectedQueueId(list[0]._id);
        }
      } catch (err) {
        console.error('Failed to load business queues:', err);
        setError('Failed to load available services for this business.');
      } finally {
        setLoadingQueues(false);
      }
    };

    fetchQueues();
  }, [isOpen, business, user]);

  if (!isOpen || !business) return null;

  const handleBook = async (e) => {
    e.preventDefault();

    if (!user) {
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!selectedQueueId) {
      setError('Please select a service to book');
      return;
    }

    if (whatsappOptIn && !/^\+[1-9]\d{7,14}$/.test(whatsappNumber.trim())) {
      setError('Enter your WhatsApp number in international format, e.g. +923001234567.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.post('/token/book', {
        queueId: selectedQueueId,
        priority,
        customerName: customerName || user.name,
        notes,
        whatsappNumber: whatsappOptIn ? whatsappNumber.trim() : undefined,
        whatsappOptIn,
      });

      const tokenData = res.data?.token || res.data;
      const selectedQueue = queues.find(q => q._id === selectedQueueId);

      setBookedPass({
        token: tokenData,
        queue: selectedQueue,
        business: business,
        position: res.data?.position || tokenData?.position || 1,
        estimatedWaitTime: res.data?.estimatedWaitTime || tokenData?.estimatedWaitTime || 5,
        aiPowered: res.data?.aiPowered || false,
        aiConfidence: res.data?.aiConfidence || 0.85,
        message: res.data?.message || 'Token confirmed',
      });

      if (onBookingSuccess) {
        onBookingSuccess(tokenData);
      }
    } catch (err) {
      setError(err.message || 'Failed to book online service ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintPass = () => {
    window.print();
  };

  const primaryColor = business.primaryColor || '#0F172A';
  const accentColor = business.accentColor || '#10B981';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        width: '100%',
        maxWidth: bookedPass ? 540 : 580,
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid #E2E8F0',
        position: 'relative'
      }}>
        {/* Header Bar */}
        <div style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #1E293B 100%)`,
          padding: '24px 28px',
          color: 'white',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {business.logo ? (
              <img
                src={business.logo}
                alt=""
                style={{ width: 50, height: 50, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
              />
            ) : (
              <div style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                color: 'white'
              }}>
                {business.name?.charAt(0) || 'B'}
              </div>
            )}
            <div>
              <span style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4
              }}>
                Online Booking • {business.category || 'Service'}
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                {business.name}
              </h2>
              {business.city && (
                <p style={{ margin: '3px 0 0', fontSize: 12, opacity: 0.8 }}>
                  📍 {business.city} {business.address ? `• ${business.address}` : ''}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 10,
              width: 34,
              height: 34,
              color: 'white',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 13,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⚠️</span>
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          {/* ── CASE 1: TICKET PASS CONFIRMATION VIEW ── */}
          {bookedPass ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#059669',
                padding: '6px 16px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 18
              }}>
                <span>🎉</span> Online Ticket Confirmed!
              </div>

              {/* Digital Boarding Pass Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: 'white',
                borderRadius: 20,
                padding: 24,
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                marginBottom: 20,
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {/* Decorative background glow */}
                <div style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />

                {/* Ticket Top Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#94A3B8' }}>
                      Digital E-Ticket Pass
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                      {business.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#38BDF8', fontWeight: 600 }}>
                      {bookedPass.queue?.serviceName || 'Standard Service'}
                    </div>
                  </div>

                  <TicketQRCode
                    tokenNumber={bookedPass.token?.tokenNumber || 'T-001'}
                    slug={business.slug}
                  />
                </div>

                {/* Big Token Number & Position */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>Your Token #</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#FCD34D', letterSpacing: 1 }}>
                      {bookedPass.token?.tokenNumber || 'A-001'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>Queue Position</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#4ADE80' }}>
                      #{bookedPass.position} <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8' }}>in line</span>
                    </div>
                  </div>
                </div>

                {/* AI Wait Time & Metadata */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#CBD5E1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      background: 'rgba(139,92,246,0.25)',
                      border: '1px solid rgba(139,92,246,0.4)',
                      padding: '4px 10px',
                      borderRadius: 8,
                      color: '#C4B5FD',
                      fontWeight: 600
                    }}>
                      🤖 AI Wait: ~{Math.round(bookedPass.estimatedWaitTime)} mins
                    </span>
                  </div>

                  {bookedPass.queue?.serviceFee > 0 && (
                    <div style={{ fontWeight: 600, color: '#86EFAC' }}>
                      Fee: ${bookedPass.queue.serviceFee}
                    </div>
                  )}

                  <div style={{ opacity: 0.7 }}>
                    Priority: <strong style={{ textTransform: 'capitalize', color: 'white' }}>{bookedPass.token?.priority || 'normal'}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/q/${business.slug}`);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 160,
                    padding: '14px 18px',
                    background: `linear-gradient(135deg, ${primaryColor}, #1E293B)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                  }}
                >
                  📡 Track Live Queue →
                </button>

                <button
                  onClick={handlePrintPass}
                  style={{
                    padding: '14px 18px',
                    background: '#F1F5F9',
                    color: '#0F172A',
                    border: '1px solid #CBD5E1',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Print Pass
                </button>

                <button
                  onClick={() => {
                    setBookedPass(null);
                  }}
                  style={{
                    padding: '14px 18px',
                    background: 'white',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Book Another
                </button>
              </div>
            </div>
          ) : (
            /* ── CASE 2: BOOKING FORM ── */
            <form onSubmit={handleBook}>
              {/* Not Logged In Notice */}
              {!user && (
                <div style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ fontSize: 13, color: '#1E40AF' }}>
                    🔒 Please log in to complete your online booking and receive digital ticket notifications.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/auth?mode=login&redirect=${encodeURIComponent(window.location.pathname)}`)}
                    style={{
                      background: '#2563EB',
                      color: 'white',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Log In
                  </button>
                </div>
              )}

              {/* Service Selection */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                  1. Select Service / Counter
                </label>

                {loadingQueues ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                    <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1.5s linear infinite' }}>⏳</div>
                    Loading available services...
                  </div>
                ) : queues.length === 0 ? (
                  <div style={{
                    padding: 20,
                    textAlign: 'center',
                    background: '#F8FAFC',
                    borderRadius: 14,
                    border: '1px dashed #CBD5E1',
                    color: '#64748B',
                    fontSize: 13
                  }}>
                    No active queues are currently accepting bookings at this business. Please check back during operating hours.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {queues.map(queue => {
                      const isSelected = selectedQueueId === queue._id;
                      const waitTime = queue.estimatedWaitTime || (queue.estimatedServiceTime * Math.max(queue.waitingCount || 1, 1));
                      return (
                        <div
                          key={queue._id}
                          onClick={() => setSelectedQueueId(queue._id)}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            border: isSelected ? `2px solid ${accentColor || '#3B82F6'}` : '1.5px solid #E2E8F0',
                            background: isSelected ? '#F0FDF4' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input
                              type="radio"
                              name="queueSelection"
                              checked={isSelected}
                              onChange={() => setSelectedQueueId(queue._id)}
                              style={{ cursor: 'pointer', accentColor: accentColor || '#10B981', width: 18, height: 18 }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>
                                {queue.serviceName}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#EFF6FF',
                                  color: '#2563EB',
                                  padding: '2px 8px',
                                  borderRadius: 999
                                }}>
                                  {queue.category || 'General'}
                                </span>
                                <span style={{ fontSize: 12, color: '#64748B' }}>
                                  👥 {queue.waitingCount || 0} in line
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#8B5CF6',
                              background: '#F5F3FF',
                              padding: '4px 10px',
                              borderRadius: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              🤖 ~{Math.round(waitTime)}m wait
                            </div>
                            {queue.serviceFee > 0 && (
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', marginTop: 4 }}>
                                ${queue.serviceFee}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Priority Selector */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                  2. Priority Level
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'normal', label: 'Normal', icon: '👤', desc: 'Standard queue' },
                    { id: 'vip', label: 'VIP Priority', icon: '👑', desc: 'Expedited turn' },
                    { id: 'emergency', label: 'Urgent', icon: '🚨', desc: 'Top priority' },
                  ].map(p => (
                    <div
                      key={p.id}
                      onClick={() => setPriority(p.id)}
                      style={{
                        border: priority === p.id ? '2px solid #3B82F6' : '1.5px solid #E2E8F0',
                        background: priority === p.id ? '#EFF6FF' : '#F8FAFC',
                        borderRadius: 12,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: 18 }}>{p.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp Notifications */}
              <div style={{ marginBottom: 18, padding: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={e => setWhatsappOptIn(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#16A34A' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                    Send booking updates on WhatsApp
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#4D7C0F', marginTop: 3 }}>
                      Confirmation now and a reminder about 30 minutes before your estimated turn.
                    </span>
                  </span>
                </label>
                {whatsappOptIn && (
                  <input
                    type="tel"
                    placeholder="WhatsApp number, e.g. +923001234567"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    required
                    style={{ width: '100%', marginTop: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid #86EFAC', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Customer Notes */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  4. Notes or Reason for Visit <span style={{ fontWeight: 400, color: '#94A3B8' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Routine checkup, Hair styling consultation, Deposit..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={150}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #E2E8F0',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || queues.length === 0}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: queues.length === 0 ? '#94A3B8' : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: queues.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10
                }}
              >
                {submitting ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Booking Ticket...
                  </>
                ) : (
                  <>
                    <span>🎟️</span> Confirm & Book Online Ticket
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
