import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';

export default function MyTicketsModal({ isOpen, onClose, onOpenBookModal }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { on } = useSocket();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState('active'); // 'active' | 'history'
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingSubmitting, setRatingSubmitting] = useState(null);
  const [ratedTickets, setRatedTickets] = useState({});

  const fetchMyTokens = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/token/user/${user._id || user.id}`);
      setTokens(res.data || []);
    } catch (err) {
      console.error('Failed to fetch user tokens:', err);
      setError(err.message || 'Failed to load your booked tickets.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchMyTokens();
    }
  }, [isOpen, user, fetchMyTokens]);

  // Real-time socket events
  useEffect(() => {
    if (!isOpen) return;
    const unsubs = [
      on('queueUpdated', () => fetchMyTokens()),
      on('tokenCalled', () => fetchMyTokens()),
      on('waitTimeUpdated', () => fetchMyTokens()),
    ];
    return () => unsubs.forEach(u => u && u());
  }, [isOpen, on, fetchMyTokens]);

  if (!isOpen) return null;

  const activeTokens = tokens.filter(t => t.status === 'waiting' || t.status === 'serving');
  const pastTokens = tokens.filter(t => t.status === 'completed' || t.status === 'cancelled' || t.status === 'skipped');
  const displayedTokens = filterTab === 'active' ? activeTokens : pastTokens;

  const handleCancelToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to cancel this online ticket booking?')) return;
    setCancellingId(tokenId);
    try {
      await api.del(`/token/${tokenId}/cancel`);
      fetchMyTokens();
    } catch (err) {
      setError(err.message || 'Failed to cancel token.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleRateBusiness = async (ticket) => {
    const rating = ratingDrafts[ticket._id];
    if (!rating) return;
    setRatingSubmitting(ticket._id);
    setError('');
    try {
      await api.post(`/business/${ticket.businessId?._id}/rate`, { tokenId: ticket._id, rating });
      setRatedTickets(current => ({ ...current, [ticket._id]: true }));
    } catch (err) {
      setError(err.message || 'Failed to submit rating.');
    } finally {
      setRatingSubmitting(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'serving':
        return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A', label: '🔔 Now Serving' };
      case 'waiting':
        return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: '⏳ In Queue' };
      case 'completed':
        return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: '✅ Completed' };
      case 'cancelled':
        return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA', label: '❌ Cancelled' };
      default:
        return { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', label: status };
    }
  };

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
        maxWidth: 620,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '24px 28px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🎟️</span>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                My Online Booked Tickets
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>
                Track and manage your online tickets across registered businesses
              </p>
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

        {/* Tab Filters */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 28px',
          background: '#F8FAFC'
        }}>
          <button
            onClick={() => setFilterTab('active')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              borderBottom: filterTab === 'active' ? '3px solid #3B82F6' : '3px solid transparent',
              color: filterTab === 'active' ? '#1D4ED8' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            Active Tickets
            <span style={{
              background: filterTab === 'active' ? '#DBEAFE' : '#E2E8F0',
              color: filterTab === 'active' ? '#1E40AF' : '#64748B',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 800
            }}>
              {activeTokens.length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('history')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              borderBottom: filterTab === 'history' ? '3px solid #3B82F6' : '3px solid transparent',
              color: filterTab === 'history' ? '#1D4ED8' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            History
            <span style={{
              background: '#E2E8F0',
              color: '#64748B',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 800
            }}>
              {pastTokens.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 13,
              marginBottom: 16
            }}>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
              <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1.5s linear infinite' }}>⏳</div>
              <p style={{ margin: 0, fontSize: 14 }}>Loading your tickets...</p>
            </div>
          ) : displayedTokens.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: 20,
              border: '1.5px dashed #E2E8F0',
              margin: '12px 0'
            }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>🎫</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                {filterTab === 'active' ? 'No active online tickets' : 'No ticket history yet'}
              </h3>
              <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 20px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                {filterTab === 'active'
                  ? 'You do not have any active queue tickets. Browse registered businesses and book a service anytime!'
                  : 'Your past completed and cancelled service tickets will show up here.'}
              </p>
              {filterTab === 'active' && (
                <button
                  onClick={onClose}
                  style={{
                    background: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 24px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Browse Registered Businesses →
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {displayedTokens.map(ticket => {
                const badge = getStatusBadge(ticket.status);
                const bizName = ticket.businessId?.name || 'Registered Business';
                const bizSlug = ticket.businessId?.slug;
                const serviceName = ticket.queueId?.serviceName || 'Service Desk';
                const isWaiting = ticket.status === 'waiting';
                const isServing = ticket.status === 'serving';

                return (
                  <div
                    key={ticket._id}
                    style={{
                      background: 'white',
                      borderRadius: 18,
                      border: isServing ? '2px solid #F59E0B' : '1.5px solid #E2E8F0',
                      padding: 20,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'transform 0.15s',
                    }}
                  >
                    {/* Top row: Business name + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 2
                        }}>
                          {ticket.businessId?.category || 'Service'}
                        </span>
                        <h4 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          {bizName}
                        </h4>
                        <div style={{ fontSize: 13, color: '#3B82F6', fontWeight: 600, marginTop: 2 }}>
                          {serviceName}
                        </div>
                      </div>

                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Middle grid: Token Number + Position + Wait Time */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isWaiting ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                      gap: 10,
                      background: '#F8FAFC',
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 14
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Token</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>
                          {ticket.tokenNumber}
                        </div>
                      </div>

                      {isWaiting && (
                        <div>
                          <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Position</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>
                            #{ticket.position} <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>in line</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                          {isServing ? 'Status' : 'Est. Wait'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED', marginTop: 2 }}>
                          {isServing ? '🔔 Go to Counter' : `🤖 ~${Math.round(ticket.estimatedWaitTime || 5)}m`}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    {ticket.status === 'completed' && (
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
                        {ratedTickets[ticket._id] ? (
                          <span style={{ color: '#92400E', fontSize: 13, fontWeight: 700 }}>Thank you for rating {bizName}.</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ color: '#92400E', fontSize: 13, fontWeight: 700 }}>Rate this business</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {[1, 2, 3, 4, 5].map(value => (
                                <button key={value} onClick={() => setRatingDrafts(current => ({ ...current, [ticket._id]: value }))} aria-label={`${value} stars`} style={{ border: 'none', background: 'none', padding: 2, fontSize: 22, color: value <= (ratingDrafts[ticket._id] || 0) ? '#F59E0B' : '#CBD5E1', cursor: 'pointer' }}>★</button>
                              ))}
                              <button onClick={() => handleRateBusiness(ticket)} disabled={!ratingDrafts[ticket._id] || ratingSubmitting === ticket._id} style={{ marginLeft: 6, padding: '7px 10px', border: '1px solid #FCD34D', borderRadius: 8, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{ratingSubmitting === ticket._id ? 'Saving...' : 'Submit'}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        Booked: {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {ticket.priority && ticket.priority !== 'normal' && (
                          <span style={{ marginLeft: 6, fontWeight: 700, color: '#D97706' }}>
                            • {ticket.priority.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {bizSlug && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate(`/q/${bizSlug}`);
                            }}
                            style={{
                              padding: '8px 14px',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Live View →
                          </button>
                        )}

                        {isWaiting && (
                          <button
                            onClick={() => handleCancelToken(ticket._id)}
                            disabled={cancellingId === ticket._id}
                            style={{
                              padding: '8px 14px',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {cancellingId === ticket._id ? 'Cancelling...' : 'Cancel Ticket'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
