import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.post('/auth/login', { email: form.email, password: form.password });
        login(data.data.user, data.data.token, data.data.business);
        navigate(data.data.business ? '/dashboard' : '/settings');
      } else {
        const data = await api.post('/auth/register', { name: form.name, email: form.email, password: form.password, role: form.role });
        login(data.data.user, data.data.token, data.data.business);
        navigate(form.role === 'admin' ? '/settings' : '/');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    border: '1.5px solid #E2E8F0',
    borderRadius: 12,
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#F8FAFC',
  };

  const inputFocusHandler = (e) => {
    e.target.style.borderColor = '#3B82F6';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
    e.target.style.background = 'white';
  };

  const inputBlurHandler = (e) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow = 'none';
    e.target.style.background = '#F8FAFC';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        padding: 24,
      }}
    >
      {/* Decorative */}
      <div style={{ position: 'fixed', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(59,130,246,0.08)', filter: 'blur(100px)' }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 350, height: 350, borderRadius: '50%', background: 'rgba(16,185,129,0.06)', filter: 'blur(100px)' }} />

      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'white',
          borderRadius: 24,
          padding: '48px 36px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#0F172A',
              fontSize: 24,
              marginBottom: 16,
            }}
          >
            🧠
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>
            {isLogin ? 'Sign in to your QueueFlow AI account' : 'Start managing queues intelligently'}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#DC2626',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required style={inputStyle} onFocus={inputFocusHandler} onBlur={inputBlurHandler} />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Email Address</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required style={inputStyle} onFocus={inputFocusHandler} onBlur={inputBlurHandler} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" required minLength={6} style={inputStyle} onFocus={inputFocusHandler} onBlur={inputBlurHandler} />
          </div>

          {!isLogin && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Account Type</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { value: 'user', label: '👤 Customer', desc: 'Book queue tokens' },
                  { value: 'admin', label: '🏢 Business', desc: 'Manage queues' },
                ].map((r) => (
                  <label
                    key={r.value}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '14px 12px',
                      border: form.role === r.value ? '2px solid #3B82F6' : '1.5px solid #E2E8F0',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: form.role === r.value ? '#EFF6FF' : '#F8FAFC',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handleChange} style={{ display: 'none' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{r.label}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{r.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg, #3B82F6, #2563EB)',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
              transition: 'all 0.2s',
              marginBottom: 20,
            }}
          >
            {loading ? '⏳ Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 14, color: '#64748B' }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#3B82F6', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
