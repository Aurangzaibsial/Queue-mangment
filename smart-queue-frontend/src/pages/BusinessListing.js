import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import BookServiceModal from '../components/BookServiceModal';
import MyTicketsModal from '../components/MyTicketsModal';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'clinic', label: '🏥 Clinic & Healthcare' },
  { value: 'salon', label: '💇 Salon & Beauty Parlor' },
  { value: 'retail', label: '🛒 Grocery & Supermarket' },
  { value: 'restaurant', label: '🍽️ Restaurant & Cafe' },
  { value: 'bank', label: '🏦 Bank & Finance' },
  { value: 'fitness', label: '💪 Fitness & Gym' },
  { value: 'other', label: '📦 Other Services' },
];

const SORT_OPTIONS = [
  { value: 'ai', label: '🤖 AI Smart Rank', color: '#8B5CF6' },
  { value: 'rating', label: '🌟 Best Rating', color: '#F59E0B' },
  { value: 'price', label: '💰 Best Rates (Value)', color: '#22C55E' },
  { value: 'waitTime', label: '⚡ Shortest Queue', color: '#3B82F6' },
];

/* ── inline keyframe styles ─────────────────────────────── */
const pulseKeyframes = `
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(139,92,246,0.3); }
  50%      { box-shadow: 0 0 20px rgba(139,92,246,0.6); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes typingDot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
`;

/* ── tiny star component ────────────────────────────────── */
function Stars({ rating = 0 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push('★');
    else if (i === full && half) stars.push('⯨');
    else stars.push('☆');
  }
  return (
    <span style={{ color: '#F59E0B', fontSize: 13, letterSpacing: 1 }}>
      {stars.join('')}
    </span>
  );
}

export default function BusinessListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Booking & Tickets Modal state
  const [bookingBusiness, setBookingBusiness] = useState(null);
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState(false);
  const [activeTicketsCount, setActiveTicketsCount] = useState(0);

  // AI Advisor state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSortBy, setAiSortBy] = useState('ai');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMaxBudget, setAiMaxBudget] = useState('');
  const [aiMinRating, setAiMinRating] = useState('');
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const fetchActiveTicketsCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/token/user/${user._id || user.id}`);
      const tokens = res.data || [];
      const active = tokens.filter(t => t.status === 'waiting' || t.status === 'serving');
      setActiveTicketsCount(active.length);
    } catch (_) {}
  }, [user]);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);

      const res = await api.get(`/business/all?${params.toString()}`);
      setBusinesses(res.data || []);
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchBusinesses();
    fetchActiveTicketsCount();
  }, [fetchBusinesses, fetchActiveTicketsCount]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const getCategoryLabel = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  /* ── AI Recommendation fetch ─────────────────────────── */
  const fetchRecommendations = useCallback(async (overrideSortBy) => {
    setAiLoading(true);
    setAiError('');
    try {
      const body = {
        sortBy: overrideSortBy || aiSortBy,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        maxBudget: aiMaxBudget ? Number(aiMaxBudget) : undefined,
        minRating: aiMinRating ? Number(aiMinRating) : undefined,
        prompt: aiPrompt || undefined,
      };
      const res = await api.post('/ai/recommendations', body);
      setAiResults(res.data || res);
    } catch (err) {
      setAiError(err.message || 'AI service unavailable');
    } finally {
      setAiLoading(false);
    }
  }, [aiSortBy, selectedCategory, aiMaxBudget, aiMinRating, aiPrompt]);

  const handleAiSortChange = (val) => {
    setAiSortBy(val);
    fetchRecommendations(val);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Inject keyframe animations */}
      <style>{pulseKeyframes}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Find & Book Businesses</h1>
            <p style={{ fontSize: 16, opacity: 0.8, margin: 0 }}>Browse registered businesses and book online service tickets instantly</p>
          </div>

          {user && (
            <button
              onClick={() => setIsMyTicketsOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <span>🎟️</span>
              My Active Tickets
              {activeTicketsCount > 0 && (
                <span style={{
                  background: '#10B981',
                  color: 'white',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 800
                }}>
                  {activeTicketsCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '-32px auto 0', padding: '0 24px 48px', position: 'relative', zIndex: 1 }}>
        {/* Search and Filter Bar */}
        <div style={{ background: 'white', borderRadius: 20, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <input
                type="text"
                placeholder="🔍 Search by name, city, or category..."
                value={searchQuery}
                onChange={handleSearch}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 12,
                  fontSize: 15,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#F8FAFC',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
            <div style={{ minWidth: 200 }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 12,
                  fontSize: 15,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────── */}
        {/* 🤖  AI SMART BUSINESS & QUEUE ADVISOR            */}
        {/* ──────────────────────────────────────────────── */}
        <div
          id="ai-advisor-panel"
          style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)',
            borderRadius: 20,
            padding: aiOpen ? '28px 28px 32px' : '20px 28px',
            marginBottom: 24,
            color: 'white',
            cursor: aiOpen ? 'default' : 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            border: '1px solid rgba(139,92,246,0.3)',
            animation: 'pulse-glow 3s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={() => { if (!aiOpen) setAiOpen(true); }}
        >
          {/* Decorative shimmer overlay */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 4s ease-in-out infinite',
          }} />

          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🤖</span>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  AI Smart Business & Queue Advisor
                </h3>
                {!aiOpen && (
                  <p style={{ fontSize: 13, opacity: 0.7, margin: '4px 0 0' }}>
                    Click to get AI-powered recommendations by Rating, Price & Wait Time
                  </p>
                )}
              </div>
            </div>
            {aiOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); setAiOpen(false); setAiResults(null); }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ✕ Close
              </button>
            )}
          </div>

          {/* Expanded panel content */}
          {aiOpen && (
            <div style={{ marginTop: 24, position: 'relative', zIndex: 1, animation: 'fadeInUp 0.4s ease' }}>
              {/* Sort-by pill buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {SORT_OPTIONS.map(opt => {
                  const active = aiSortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAiSortChange(opt.value)}
                      style={{
                        background: active ? opt.color : 'rgba(255,255,255,0.1)',
                        border: active ? 'none' : '1px solid rgba(255,255,255,0.2)',
                        color: 'white',
                        borderRadius: 999,
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: active ? `0 4px 16px ${opt.color}55` : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Filters row */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <input
                  type="number"
                  placeholder="💰 Max Budget ($)"
                  value={aiMaxBudget}
                  onChange={e => setAiMaxBudget(e.target.value)}
                  style={{
                    flex: 1, minWidth: 140,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="🌟 Min Rating (0-5)"
                  value={aiMinRating}
                  onChange={e => setAiMinRating(e.target.value)}
                  style={{
                    flex: 1, minWidth: 140,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>

              {/* AI prompt input */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder="✨ Ask AI anything... e.g. 'Best rated salon under $30 with lowest wait time'"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchRecommendations(); }}
                  style={{
                    flex: 1,
                    padding: '14px 18px',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => fetchRecommendations()}
                  disabled={aiLoading}
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                    border: 'none',
                    color: 'white',
                    borderRadius: 14,
                    padding: '14px 28px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: aiLoading ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 20px rgba(109,40,217,0.4)',
                    transition: 'all 0.2s',
                    opacity: aiLoading ? 0.7 : 1,
                  }}
                >
                  {aiLoading ? '⏳ Thinking…' : '🚀 Get Recommendations'}
                </button>
              </div>

              {/* Loading animation */}
              {aiLoading && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        style={{
                          width: 10, height: 10,
                          borderRadius: '50%',
                          background: '#A78BFA',
                          display: 'inline-block',
                          animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>AI is analyzing businesses for you…</p>
                </div>
              )}

              {/* Error */}
              {aiError && (
                <div style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  fontSize: 14,
                  marginBottom: 12,
                }}>
                  ⚠️ {aiError}
                </div>
              )}

              {/* AI Results */}
              {aiResults && !aiLoading && (
                <div style={{ animation: 'fadeInUp 0.5s ease' }}>
                  {/* Reasoning card */}
                  {aiResults.reasoning && (
                    <div style={{
                      background: 'rgba(139,92,246,0.15)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      marginBottom: 16,
                      fontSize: 14,
                      lineHeight: 1.5,
                      border: '1px solid rgba(139,92,246,0.25)',
                    }}>
                      <strong>🧠 AI Reasoning:</strong> {aiResults.reasoning}
                      {aiResults.source && (
                        <span style={{
                          display: 'inline-block',
                          marginLeft: 10,
                          padding: '2px 10px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.12)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          via {aiResults.source}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recommendation cards */}
                  {aiResults.recommendations && aiResults.recommendations.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                      {aiResults.recommendations.map((rec, idx) => (
                        <div
                          key={rec.businessId || idx}
                          onClick={() => rec.slug && navigate(`/q/${rec.slug}`)}
                          style={{
                            background: 'rgba(255,255,255,0.07)',
                            borderRadius: 16,
                            padding: 20,
                            border: '1px solid rgba(255,255,255,0.12)',
                            cursor: rec.slug ? 'pointer' : 'default',
                            transition: 'all 0.25s',
                            animation: `fadeInUp 0.4s ease ${idx * 0.08}s both`,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {/* Rank badge */}
                          <div style={{
                            position: 'absolute', top: 12, right: 12,
                            background: idx === 0 ? 'linear-gradient(135deg, #F59E0B, #D97706)' :
                                        idx === 1 ? 'linear-gradient(135deg, #94A3B8, #64748B)' :
                                        idx === 2 ? 'linear-gradient(135deg, #D97706, #92400E)' :
                                        'rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            #{rec.rank}
                          </div>

                          <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', paddingRight: 50 }}>
                            {rec.name}
                          </h4>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {/* Rating badge */}
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(245,158,11,0.15)',
                              border: '1px solid rgba(245,158,11,0.3)',
                              borderRadius: 999, padding: '4px 10px',
                              fontSize: 12, fontWeight: 600,
                            }}>
                              <Stars rating={rec.rating?.average || 0} />
                              <span style={{ marginLeft: 2 }}>{(rec.rating?.average || 0).toFixed(1)}</span>
                              <span style={{ opacity: 0.6 }}>({rec.rating?.count || 0})</span>
                            </span>

                            {/* Price badge */}
                            {(rec.pricing?.baseRate > 0) && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: 'rgba(34,197,94,0.15)',
                                border: '1px solid rgba(34,197,94,0.3)',
                                borderRadius: 999, padding: '4px 10px',
                                fontSize: 12, fontWeight: 600,
                              }}>
                                💵 ${rec.pricing.baseRate}
                              </span>
                            )}

                            {/* Category */}
                            {rec.category && (
                              <span style={{
                                background: 'rgba(99,102,241,0.15)',
                                border: '1px solid rgba(99,102,241,0.25)',
                                borderRadius: 999, padding: '4px 10px',
                                fontSize: 11, fontWeight: 600,
                              }}>
                                {getCategoryLabel(rec.category)}
                              </span>
                            )}
                          </div>

                          {/* AI badges */}
                          {rec.badges && rec.badges.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                              {rec.badges.map((badge, bi) => (
                                <span
                                  key={bi}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    background: `${badge.color}22`,
                                    border: `1px solid ${badge.color}44`,
                                    borderRadius: 999,
                                    padding: '3px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  {badge.icon} {badge.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* AI Score bar */}
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                              <span>AI Score</span>
                              <span>{rec.aiScore}%</span>
                            </div>
                            <div style={{
                              height: 6, borderRadius: 3,
                              background: 'rgba(255,255,255,0.1)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(rec.aiScore, 100)}%`,
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #8B5CF6, #6D28D9)',
                                transition: 'width 0.8s ease',
                              }} />
                            </div>
                          </div>

                          {rec.city && (
                            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>📍 {rec.city}</div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Find full business object if present or pass recommendation data
                              const foundBiz = businesses.find(b => b._id === rec.businessId || b.slug === rec.slug) || rec;
                              setBookingBusiness(foundBiz);
                            }}
                            style={{
                              width: '100%',
                              marginTop: 14,
                              padding: '10px 14px',
                              background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                            }}
                          >
                            <span>🎟️</span> Book Online Ticket
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, opacity: 0.6, fontSize: 14 }}>
                      No recommendations found. Try adjusting your filters.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <div style={{ marginBottom: 16, color: '#64748B', fontSize: 14 }}>
            {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'} found
          </div>
        )}

        {/* Business Grid */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⏳</div>
              <div style={{ color: '#64748B', fontSize: 15 }}>Loading businesses...</div>
            </div>
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: '48px 24px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>No businesses found</h2>
            <p style={{ color: '#64748B', fontSize: 15, marginBottom: 24 }}>
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              style={{
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
            {businesses.map(business => (
              <div
                key={business._id}
                onClick={() => navigate(`/q/${business.slug}`)}
                style={{
                  background: 'white',
                  borderRadius: 20,
                  padding: 24,
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  {business.logo ? (
                    <img
                      src={business.logo}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: `linear-gradient(135deg, ${business.primaryColor || '#0F172A'}, ${business.accentColor || '#10B981'})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      color: 'white',
                      fontWeight: 700,
                    }}>
                      {business.name?.charAt(0) || 'B'}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                      {business.name}
                    </h3>
                    {business.tagline && (
                      <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.4 }}>
                        {business.tagline}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating + Price row */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(business.rating?.average > 0) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: '#FFFBEB', color: '#D97706',
                    }}>
                      ⭐ {business.rating.average.toFixed(1)}
                      <span style={{ opacity: 0.6, marginLeft: 2 }}>({business.rating.count})</span>
                    </span>
                  )}
                  {(business.pricing?.baseRate > 0) && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: '#F0FDF4', color: '#16A34A',
                    }}>
                      💵 ${business.pricing.baseRate}
                      {business.pricing.priceTier && business.pricing.priceTier !== 'standard' && (
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>
                          • {business.pricing.priceTier}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#EFF6FF',
                    color: '#2563EB',
                  }}>
                    {getCategoryLabel(business.category)}
                  </span>
                  {business.city && (
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#F1F5F9',
                      color: '#64748B',
                    }}>
                      📍 {business.city}
                    </span>
                  )}
                </div>

                {business.description && (
                  <p style={{
                    fontSize: 13,
                    color: '#64748B',
                    lineHeight: 1.5,
                    marginBottom: 16,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {business.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94A3B8' }}>
                  {business.phone && <span>📞 {business.phone}</span>}
                  {business.address && <span>📍 {business.address}</span>}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookingBusiness(business);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: `linear-gradient(135deg, ${business.primaryColor || '#0F172A'}, ${business.accentColor || '#10B981'})`,
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <span>🎟️</span> Book Online Ticket
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/q/${business.slug}`);
                    }}
                    style={{
                      padding: '12px 14px',
                      background: '#F1F5F9',
                      color: '#0F172A',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                    onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
                  >
                    View Page →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Book Online Ticket & Service Modal ── */}
      {bookingBusiness && (
        <BookServiceModal
          business={bookingBusiness}
          isOpen={Boolean(bookingBusiness)}
          onClose={() => setBookingBusiness(null)}
          onBookingSuccess={() => {
            fetchActiveTicketsCount();
          }}
        />
      )}

      {/* ── My Booked Online Tickets Modal ── */}
      <MyTicketsModal
        isOpen={isMyTicketsOpen}
        onClose={() => {
          setIsMyTicketsOpen(false);
          fetchActiveTicketsCount();
        }}
      />
    </div>
  );
}
