import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: '🧠',
    title: 'AI-Powered Predictions',
    desc: 'Machine learning algorithms predict wait times with increasing accuracy, learning from every customer served.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Updates',
    desc: 'WebSocket-powered live queue updates. Customers see their position change instantly — no refresh needed.',
  },
  {
    icon: '📊',
    title: 'Smart Analytics',
    desc: 'Visualize peak hours, category breakdowns, and daily trends to optimize your operations.',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Ready',
    desc: 'Each business gets its own branded public booking page, queues, counters, and analytics.',
  },
  {
    icon: '🔔',
    title: 'Instant Notifications',
    desc: 'Customers receive real-time "Your Turn" alerts with counter directions so they never miss their slot.',
  },
  {
    icon: '🎯',
    title: 'Priority Queuing',
    desc: 'Support for Normal, VIP, and Emergency priority levels with intelligent queue reordering.',
  },
];

const categories = [
  { emoji: '🏥', label: 'Clinics' },
  { emoji: '💇', label: 'Salons' },
  { emoji: '🏦', label: 'Banks' },
  { emoji: '🍽️', label: 'Restaurants' },
  { emoji: '🏛️', label: 'Government' },
  { emoji: '🛒', label: 'Retail' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* ── Hero Section ──────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
          color: 'white',
          padding: '80px 24px 100px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blurred circles */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 250, height: 250, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', filter: 'blur(80px)' }} />

        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#93C5FD',
              marginBottom: 28,
            }}
          >
            🧠 Powered by Machine Learning
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.02em' }}>
            Smart Queue Management
            <br />
            <span style={{ background: 'linear-gradient(90deg, #3B82F6, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Reimagined with AI
            </span>
          </h1>

          <p style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 36px' }}>
            Eliminate long waits, predict service times, and delight your customers with an intelligent queue system that learns and improves continuously.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(59,130,246,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(59,130,246,0.45)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 24px rgba(59,130,246,0.35)'; }}
            >
              {user ? 'Go to Dashboard' : 'Get Started Free'} →
            </button>

            {!user && (
              <button
                onClick={() => navigate('/auth')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 14,
                  padding: '14px 32px',
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────── */}
      <section
        style={{
          maxWidth: 900,
          margin: '-48px auto 0',
          padding: '28px 40px',
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: 24,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {[
          { value: '< 2min', label: 'Avg Wait Prediction' },
          { value: '99.5%', label: 'Uptime SLA' },
          { value: 'Real-Time', label: 'WebSocket Updates' },
          { value: '6+', label: 'Business Categories' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features Grid ─────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '80px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
            Everything You Need
          </h2>
          <p style={{ fontSize: 16, color: '#64748B', maxWidth: 500, margin: '0 auto' }}>
            A complete queue management platform with AI at its core
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '32px 28px',
                border: '1px solid #E2E8F0',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Category Badges ───────────────────────── */}
      <section style={{ maxWidth: 700, margin: '0 auto 80px', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 24 }}>
          Built for Every Industry
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {categories.map((c, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 999,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                color: '#334155',
              }}
            >
              {c.emoji} {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────── */}
      <footer style={{ background: '#0F172A', color: '#94A3B8', textAlign: 'center', padding: '32px 24px', fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: 'white' }}>QueueFlow AI</span> — Smart Queue Management
        </div>
        <div>© {new Date().getFullYear()} All rights reserved.</div>
      </footer>
    </div>
  );
}
