import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const CATEGORIES = ['restaurant', 'clinic', 'salon', 'bank', 'government', 'retail', 'education', 'fitness', 'other'];
const QUEUE_CATEGORIES = ['General', 'Support', 'Billing', 'Technical', 'Emergency', 'VIP'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #E2E8F0',
  borderRadius: 12,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
  background: '#F8FAFC',
};

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 };

const btnPrimary = {
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
};

// ── Section Card ──────────────────────────────────
function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', marginBottom: 20, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: open ? '1px solid #E2E8F0' : 'none',
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{icon}</span> {title}
        </h3>
        <span style={{ fontSize: 20, color: '#94A3B8', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </div>
      {open && <div style={{ padding: 24 }}>{children}</div>}
    </div>
  );
}

export default function BusinessSettings() {
  const { business, setBusiness } = useAuth();
  const [form, setForm] = useState({
    name: '', slug: '', tagline: '', about: '', email: '', phone: '', website: '',
    address: '', city: '', state: '', country: '', zipCode: '',
    category: 'other', primaryColor: '#0F172A', secondaryColor: '#3B82F6', accentColor: '#10B981',
    operatingHours: {},
    socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '', whatsapp: '' },
  });
  const [queues, setQueues] = useState([]);
  const [counters, setCounters] = useState([]);
  const [newQueue, setNewQueue] = useState({ serviceName: '', category: 'General', estimatedServiceTime: 5, maxCapacity: 100 });
  const [newCounter, setNewCounter] = useState({ counterName: '', counterNumber: 1 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(!business);

  const fetchBusiness = useCallback(async () => {
    if (!business) return;
    try {
      const res = await api.get('/business/me');
      const b = res.data;
      setForm({
        name: b.name || '', slug: b.slug || '', tagline: b.tagline || '', about: b.about || '',
        email: b.email || '', phone: b.phone || '', website: b.website || '',
        address: b.address || '', city: b.city || '', state: b.state || '', country: b.country || '', zipCode: b.zipCode || '',
        category: b.category || 'other',
        primaryColor: b.primaryColor || '#0F172A',
        secondaryColor: b.secondaryColor || '#3B82F6',
        accentColor: b.accentColor || '#10B981',
        operatingHours: b.operatingHours || {},
        socialLinks: b.socialLinks || {},
      });
    } catch (_) {}
  }, [business]);

  const fetchQueues = useCallback(async () => {
    if (!business) return;
    try {
      const res = await api.get(`/queues/list?slug=${business.slug}`);
      setQueues(res.data?.queues || res.data || []);
    } catch (_) {}
  }, [business]);

  const fetchCounters = useCallback(async () => {
    if (!business) return;
    try {
      const res = await api.get('/admin/analytics?days=1');
      setCounters(res.data?.activeCounters || []);
    } catch (_) {}
  }, [business]);

  useEffect(() => {
    fetchBusiness();
    fetchQueues();
    fetchCounters();
  }, [fetchBusiness, fetchQueues, fetchCounters]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('social.')) {
      setForm(f => ({ ...f, socialLinks: { ...f.socialLinks, [name.split('.')[1]]: value } }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleHoursChange = (day, field, value) => {
    setForm(f => ({
      ...f,
      operatingHours: {
        ...f.operatingHours,
        [day]: { ...(f.operatingHours[day] || {}), [field]: value },
      },
    }));
  };

  // ── Register / Update Business ──────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (isOnboarding) {
        const res = await api.post('/business/register', form);
        const newBiz = res.data;
        setBusiness(newBiz);
        localStorage.setItem('business', JSON.stringify(newBiz));
        setIsOnboarding(false);
        setMessage('✅ Business registered successfully!');
      } else {
        await api.put('/business/me', form);
        setMessage('✅ Settings saved!');
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Create Queue ────────────────────────────────
  const handleCreateQueue = async (e) => {
    e.preventDefault();
    try {
      await api.post('/queues/create', newQueue);
      setNewQueue({ serviceName: '', category: 'General', estimatedServiceTime: 5, maxCapacity: 100 });
      fetchQueues();
      setMessage('✅ Queue created!');
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  // ── Delete Queue ────────────────────────────────
  const handleDeleteQueue = async (id) => {
    if (!window.confirm('Delete this queue?')) return;
    try {
      await api.del(`/queues/${id}`);
      fetchQueues();
      setMessage('✅ Queue deleted');
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  // ── Create Counter ──────────────────────────────
  const handleCreateCounter = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/counters', newCounter);
      setNewCounter({ counterName: '', counterNumber: (counters.length || 0) + 2 });
      fetchCounters();
      setMessage('✅ Counter created!');
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
          {isOnboarding ? '🚀 Set Up Your Business' : '⚙️ Business Settings'}
        </h1>
        <p style={{ color: '#64748B', fontSize: 14 }}>
          {isOnboarding ? 'Register your business to start managing queues' : 'Manage your business profile, queues, and counters'}
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 20,
          fontSize: 14,
          fontWeight: 500,
          background: message.startsWith('✅') ? '#ECFDF5' : '#FEF2F2',
          color: message.startsWith('✅') ? '#059669' : '#DC2626',
          border: `1px solid ${message.startsWith('✅') ? '#A7F3D0' : '#FECACA'}`,
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* ── Business Info ─────────────────────── */}
        <Section title="Business Information" icon="🏢">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Business Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required style={inputStyle} placeholder="My Awesome Business" />
            </div>
            <div>
              <label style={labelStyle}>URL Slug *</label>
              <input name="slug" value={form.slug} onChange={handleChange} required style={inputStyle} placeholder="my-awesome-business" pattern="[a-z0-9\-]+" title="Lowercase letters, numbers, hyphens only" />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required style={inputStyle} placeholder="info@business.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} style={inputStyle} placeholder="+1 234 567 890" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select name="category" value={form.category} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input name="website" value={form.website} onChange={handleChange} style={inputStyle} placeholder="https://mybusiness.com" />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Tagline</label>
            <input name="tagline" value={form.tagline} onChange={handleChange} style={inputStyle} placeholder="A short catchy tagline" maxLength={150} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>About</label>
            <textarea name="about" value={form.about} onChange={handleChange} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Describe your business..." maxLength={2000} />
          </div>
        </Section>

        {/* ── Location ──────────────────────────── */}
        <Section title="Location" icon="📍" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Address</label>
              <input name="address" value={form.address} onChange={handleChange} style={inputStyle} placeholder="123 Main Street" />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input name="city" value={form.city} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input name="state" value={form.state} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input name="country" value={form.country} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Zip Code</label>
              <input name="zipCode" value={form.zipCode} onChange={handleChange} style={inputStyle} />
            </div>
          </div>
        </Section>

        {/* ── Branding ──────────────────────────── */}
        <Section title="Branding Colors" icon="🎨" defaultOpen={false}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { name: 'primaryColor', label: 'Primary' },
              { name: 'secondaryColor', label: 'Secondary' },
              { name: 'accentColor', label: 'Accent' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" name={c.name} value={form[c.name]} onChange={handleChange} style={{ width: 40, height: 40, border: 'none', borderRadius: 10, cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{form[c.name]}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Operating Hours ───────────────────── */}
        <Section title="Operating Hours" icon="🕐" defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DAYS.map(day => {
              const h = form.operatingHours[day] || { open: '09:00', close: '17:00', isClosed: false };
              return (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 100, fontSize: 14, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{day}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
                    <input
                      type="checkbox"
                      checked={!h.isClosed}
                      onChange={(e) => handleHoursChange(day, 'isClosed', !e.target.checked)}
                    />
                    Open
                  </label>
                  {!h.isClosed && (
                    <>
                      <input type="time" value={h.open || '09:00'} onChange={(e) => handleHoursChange(day, 'open', e.target.value)} style={{ ...inputStyle, width: 130, padding: '8px 10px' }} />
                      <span style={{ color: '#94A3B8' }}>to</span>
                      <input type="time" value={h.close || '17:00'} onChange={(e) => handleHoursChange(day, 'close', e.target.value)} style={{ ...inputStyle, width: 130, padding: '8px 10px' }} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Social Links ──────────────────────── */}
        <Section title="Social Links" icon="🔗" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {['facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp'].map(s => (
              <div key={s}>
                <label style={labelStyle}>{s.charAt(0).toUpperCase() + s.slice(1)}</label>
                <input name={`social.${s}`} value={form.socialLinks[s] || ''} onChange={handleChange} style={inputStyle} placeholder={`https://${s}.com/...`} />
              </div>
            ))}
          </div>
        </Section>

        {/* Save Button */}
        <button type="submit" disabled={saving} style={{ ...btnPrimary, width: '100%', padding: 16, fontSize: 16, opacity: saving ? 0.7 : 1 }}>
          {saving ? '⏳ Saving...' : isOnboarding ? '🚀 Register Business' : '💾 Save Settings'}
        </button>
      </form>

      {/* ── Queue Management ───────────────────── */}
      {!isOnboarding && (
        <>
          <div style={{ marginTop: 48, marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>📋 Queue Management</h2>
          </div>

          {/* Existing Queues */}
          {queues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {queues.map(q => (
                <div key={q._id} style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{q.serviceName}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>{q.category} · ~{q.estimatedServiceTime}min · Max {q.maxCapacity}</div>
                  </div>
                  <button onClick={() => handleDeleteQueue(q._id)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🗑 Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create Queue Form */}
          <Section title="Create New Queue" icon="➕" defaultOpen={queues.length === 0}>
            <form onSubmit={handleCreateQueue}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Service Name *</label>
                  <input value={newQueue.serviceName} onChange={(e) => setNewQueue(q => ({ ...q, serviceName: e.target.value }))} required style={inputStyle} placeholder="e.g. Billing Counter" />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={newQueue.category} onChange={(e) => setNewQueue(q => ({ ...q, category: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {QUEUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Est. Service Time (min)</label>
                  <input type="number" min={1} value={newQueue.estimatedServiceTime} onChange={(e) => setNewQueue(q => ({ ...q, estimatedServiceTime: parseInt(e.target.value) || 5 }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max Capacity</label>
                  <input type="number" min={1} value={newQueue.maxCapacity} onChange={(e) => setNewQueue(q => ({ ...q, maxCapacity: parseInt(e.target.value) || 100 }))} style={inputStyle} />
                </div>
              </div>
              <button type="submit" style={btnPrimary}>Create Queue</button>
            </form>
          </Section>

          {/* ── Counter Management ─────────────── */}
          <div style={{ marginTop: 32, marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>🖥 Service Counters</h2>
          </div>

          {counters.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {counters.map(c => (
                <div key={c._id} style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{c.counterName}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    #{c.counterNumber} · {c.status} · {c.totalServed || 0} served
                  </div>
                </div>
              ))}
            </div>
          )}

          <Section title="Create New Counter" icon="➕" defaultOpen={counters.length === 0}>
            <form onSubmit={handleCreateCounter}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Counter Name *</label>
                  <input value={newCounter.counterName} onChange={(e) => setNewCounter(c => ({ ...c, counterName: e.target.value }))} required style={inputStyle} placeholder="e.g. Counter A" />
                </div>
                <div>
                  <label style={labelStyle}>Counter Number *</label>
                  <input type="number" min={1} value={newCounter.counterNumber} onChange={(e) => setNewCounter(c => ({ ...c, counterNumber: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                </div>
              </div>
              <button type="submit" style={btnPrimary}>Create Counter</button>
            </form>
          </Section>
        </>
      )}
    </div>
  );
}
