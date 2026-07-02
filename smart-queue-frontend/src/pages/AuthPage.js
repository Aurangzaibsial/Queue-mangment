import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import {
  getPostAuthRedirect,
  getPasswordStrength,
  validateSignupForm,
  getRoleLabel,
} from '../utils/auth';

const ACCOUNT_TYPES = [
  {
    value: 'user',
    icon: '👤',
    label: 'Customer',
    desc: 'Book queue tokens at any business',
  },
  {
    value: 'admin',
    icon: '🏢',
    label: 'Business',
    desc: 'Manage queues, counters & analytics',
  },
];

const FEATURES = [
  'AI-powered wait time predictions',
  'Real-time queue updates via WebSocket',
  'Branded public booking pages',
  'Multi-tenant business management',
];

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? false : true;
  const initialType = searchParams.get('type') === 'business' ? 'admin' : 'user';
  const redirectTo = searchParams.get('redirect') || '';

  const [isLogin, setIsLogin] = useState(initialMode);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: initialType,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, business, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect already-authenticated users away from auth page
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getPostAuthRedirect(user, business, redirectTo), { replace: true });
    }
  }, [authLoading, user, business, navigate, redirectTo]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      const validationError = validateSignupForm({ ...form, agreedToTerms });
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await api.post('/auth/login', {
          email: form.email.trim(),
          password: form.password,
        });
        login(data.data.user, data.data.token, data.data.business);
        navigate(getPostAuthRedirect(data.data.user, data.data.business, redirectTo));
      } else {
        const data = await api.post('/auth/register', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });
        login(data.data.user, data.data.token, data.data.business);
        navigate(getPostAuthRedirect(data.data.user, data.data.business, redirectTo));
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(form.password);

  if (authLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={{ color: '#64748B', marginTop: 16, fontSize: 14 }}>Restoring your session…</p>
      </div>
    );
  }

  return (
    <div style={styles.page} className="auth-page">
      {/* Left branding panel */}
      <div style={styles.brandPanel} className="auth-brand-panel">
        <div style={styles.brandGlow1} />
        <div style={styles.brandGlow2} />
        <div style={styles.brandContent}>
          <Link to="/" style={styles.logoLink}>
            <div style={styles.logoIcon}>🧠</div>
            <span style={styles.logoText}>
              QueueFlow <span style={{ fontWeight: 300, opacity: 0.7 }}>AI</span>
            </span>
          </Link>

          <h2 style={styles.brandHeadline}>
            Intelligent queue management for modern businesses
          </h2>
          <p style={styles.brandSubtext}>
            Join thousands of businesses and customers using AI-powered queue predictions.
          </p>

          <ul style={styles.featureList}>
            {FEATURES.map((f) => (
              <li key={f} style={styles.featureItem}>
                <span style={styles.featureCheck}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <div style={styles.roleGuide}>
            <p style={styles.roleGuideTitle}>Who should sign up?</p>
            <div style={styles.roleGuideGrid}>
              <div style={styles.roleGuideCard}>
                <span>👤</span>
                <strong>Customer</strong>
                <span>Book tokens at clinics, salons & more</span>
              </div>
              <div style={styles.roleGuideCard}>
                <span>🏢</span>
                <strong>Business</strong>
                <span>Run queues, counters & live analytics</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={styles.formPanel}>
        <div style={styles.formContainer}>
          {/* Mode toggle tabs */}
          <div style={styles.tabBar}>
            {['Sign In', 'Create Account'].map((label, idx) => {
              const active = idx === 0 ? isLogin : !isLogin;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setIsLogin(idx === 0);
                    setError('');
                  }}
                  style={{
                    ...styles.tab,
                    ...(active ? styles.tabActive : {}),
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <h1 style={styles.formTitle}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={styles.formSubtitle}>
            {isLogin
              ? 'Enter your credentials to access your account'
              : 'Choose your account type and get started in seconds'}
          </p>

          {error && (
            <div style={styles.errorBox} role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Account type</label>
                  <div style={styles.accountTypeGrid}>
                    {ACCOUNT_TYPES.map((type) => (
                      <label
                        key={type.value}
                        style={{
                          ...styles.accountTypeCard,
                          ...(form.role === type.value ? styles.accountTypeCardActive : {}),
                        }}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={type.value}
                          checked={form.role === type.value}
                          onChange={handleChange}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 22 }}>{type.icon}</span>
                        <span style={styles.accountTypeLabel}>{type.label}</span>
                        <span style={styles.accountTypeDesc}>{type.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label htmlFor="name" style={styles.label}>Full name</label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    autoComplete="name"
                    style={styles.input}
                  />
                </div>
              </>
            )}

            <div style={styles.fieldGroup}>
              <label htmlFor="email" style={styles.label}>Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <div style={styles.passwordWrapper}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={isLogin ? 'Enter your password' : 'Min. 8 chars, letter + number'}
                  required
                  minLength={isLogin ? 1 : 8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  style={{ ...styles.input, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {!isLogin && form.password && (
                <div style={styles.strengthBar}>
                  <div style={styles.strengthTrack}>
                    <div
                      style={{
                        ...styles.strengthFill,
                        width: `${(passwordStrength.score / 4) * 100}%`,
                        background: passwordStrength.color,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: passwordStrength.color, fontWeight: 600 }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {!isLogin && (
              <>
                <div style={styles.fieldGroup}>
                  <label htmlFor="confirmPassword" style={styles.label}>Confirm password</label>
                  <div style={styles.passwordWrapper}>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                      style={{
                        ...styles.input,
                        paddingRight: 44,
                        borderColor:
                          form.confirmPassword && form.password !== form.confirmPassword
                            ? '#FCA5A5'
                            : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.passwordToggle}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <label style={styles.termsLabel}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      setError('');
                    }}
                    style={styles.checkbox}
                  />
                  <span>
                    I agree to the{' '}
                    <span style={{ color: '#3B82F6', fontWeight: 600 }}>Terms of Service</span>
                    {' '}and{' '}
                    <span style={{ color: '#3B82F6', fontWeight: 600 }}>Privacy Policy</span>
                  </span>
                </label>
              </>
            )}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={styles.btnSpinner} />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : isLogin ? (
                'Sign In'
              ) : (
                `Create ${getRoleLabel(form.role === 'admin' ? 'admin' : 'user')} Account`
              )}
            </button>
          </form>

          <p style={styles.switchMode}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              style={styles.switchBtn}
            >
              {isLogin ? 'Create one free' : 'Sign in instead'}
            </button>
          </p>

          {!isLogin && form.role === 'admin' && (
            <p style={styles.hintBox}>
              💡 After signup you'll complete your business profile, then access your dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'DM Sans', sans-serif",
  },
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8FAFC',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E2E8F0',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  brandPanel: {
    flex: '0 0 45%',
    background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)',
    color: 'white',
    padding: '48px 56px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  brandGlow1: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'rgba(59,130,246,0.12)',
    filter: 'blur(80px)',
  },
  brandGlow2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.08)',
    filter: 'blur(80px)',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 420,
  },
  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    textDecoration: 'none',
    color: 'white',
    marginBottom: 40,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
  },
  brandHeadline: {
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1.2,
    marginBottom: 16,
    letterSpacing: '-0.02em',
  },
  brandSubtext: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 1.7,
    marginBottom: 32,
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 36px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 12,
  },
  featureCheck: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.2)',
    color: '#10B981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  roleGuide: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 28,
  },
  roleGuideTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748B',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  roleGuideGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  roleGuideCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 12,
    color: '#94A3B8',
  },
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background: '#F8FAFC',
  },
  formContainer: {
    width: '100%',
    maxWidth: 440,
    background: 'white',
    borderRadius: 24,
    padding: '40px 36px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    border: '1px solid #E2E8F0',
  },
  tabBar: {
    display: 'flex',
    background: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    fontSize: 14,
    fontWeight: 600,
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: 'white',
    color: '#0F172A',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 20,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '13px 16px',
    border: '1.5px solid #E2E8F0',
    borderRadius: 12,
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#F8FAFC',
    color: '#0F172A',
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    lineHeight: 1,
  },
  strengthBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    background: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s, background 0.3s',
  },
  accountTypeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  accountTypeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '16px 12px',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    cursor: 'pointer',
    background: '#F8FAFC',
    transition: 'all 0.2s',
    textAlign: 'center',
  },
  accountTypeCardActive: {
    border: '2px solid #3B82F6',
    background: '#EFF6FF',
  },
  accountTypeLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
  },
  accountTypeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 1.4,
  },
  termsLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
    cursor: 'pointer',
    lineHeight: 1.5,
  },
  checkbox: {
    marginTop: 2,
    width: 16,
    height: 16,
    accentColor: '#3B82F6',
    flexShrink: 0,
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    marginBottom: 20,
  },
  btnSpinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  switchMode: {
    textAlign: 'center',
    fontSize: 14,
    color: '#64748B',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#3B82F6',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  hintBox: {
    marginTop: 16,
    padding: '12px 16px',
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 12,
    fontSize: 13,
    color: '#1D4ED8',
    textAlign: 'center',
    lineHeight: 1.5,
  },
};
