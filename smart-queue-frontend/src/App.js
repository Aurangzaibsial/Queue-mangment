/**
 * ============================================================
 * SmartQueueSystem — Fully Integrated with Backend API
 * ============================================================
 * Integration Map:
 *   AUTH         → POST /api/auth/login | /api/auth/register
 *   QUEUES       → GET  /api/queue/list | /api/queue/:id
 *   TOKEN BOOK   → POST /api/token/book
 *   CANCEL TOKEN → DELETE /api/token/:id/cancel
 *   CALL NEXT    → POST /api/admin/call-next
 *   ANALYTICS    → GET  /api/admin/analytics
 *   SOCKET       → queueUpdated | tokenCalled | newTokenAdded
 *                  waitTimeUpdated | yourTurn
 *
 * ► Change API_BASE + SOCKET_URL below to match your server.
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─────────────────────────────────────────────
// ► CONFIGURE YOUR BACKEND URL HERE
// ─────────────────────────────────────────────
const API_BASE   = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const CATEGORIES = ["General", "Support", "Billing", "Technical"];
const CAT_COLORS = {
  General: "#3B82F6", Support: "#10B981",
  Billing: "#F59E0B", Technical: "#8B5CF6"
};

// ─────────────────────────────────────────────
// LOCAL AI ENGINE
// Mirrors backend logic — used for instant UI
// predictions before server round-trip returns.
// Backend predictions override these once received.
// ─────────────────────────────────────────────
class AIEngine {
  constructor() {
    this.weights = { General: 4, Support: 6, Billing: 5, Technical: 8 };
    this.lr = 0.1;
  }
  predict({ peopleAhead, category, activeCounters }) {
    const base = this.weights[category] || 5;
    const h = new Date().getHours();
    const peak = h >= 11 && h <= 14 ? 1.3 : h >= 9 && h <= 10 ? 1.1 : 1.0;
    return Math.max(0.5, parseFloat(((peopleAhead * base * peak) / Math.max(activeCounters, 1)).toFixed(1)));
  }
  learn({ category, actual }) {
    this.weights[category] = parseFloat(
      (this.weights[category] + this.lr * (actual - this.weights[category])).toFixed(2)
    );
  }
  sync(serverWeights) { if (serverWeights) Object.assign(this.weights, serverWeights); }
  globalAvg() {
    const v = Object.values(this.weights);
    return parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1));
  }
}
const ai = new AIEngine();

// ─────────────────────────────────────────────
// API CLIENT — Authenticated fetch wrapper
// All requests include JWT Bearer token.
// ─────────────────────────────────────────────
const api = {
  _token: null,
  setToken(t) { this._token = t; },

  async req(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },

  get:    (p)    => api.req("GET", p),
  post:   (p, b) => api.req("POST", p, b),
  put:    (p, b) => api.req("PUT", p, b),
  del:    (p)    => api.req("DELETE", p),
};

// ─────────────────────────────────────────────
// HOOK: useSocket
// Loads socket.io-client from CDN, authenticates
// with JWT, joins queue room, returns on() and
// connected status.
// ─────────────────────────────────────────────
function useSocket(token, queueId) {
  const sockRef  = useRef(null);
  const cbsRef   = useRef({});
  const [connected, setConnected] = useState(false);

  // Boot socket once token is available
  useEffect(() => {
    if (!token) return;

    const loadScript = () => new Promise((resolve) => {
      if (window.io) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.socket.io/4.6.1/socket.io.min.js";
      s.onload = resolve;
      document.head.appendChild(s);
    });

    loadScript().then(() => {
      const sock = window.io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 8,
        reconnectionDelay: 1500,
      });

      sock.on("connect",    () => setConnected(true));
      sock.on("disconnect", () => setConnected(false));
      sock.on("connect_error", () => setConnected(false));

      // Re-attach any registered listeners
      Object.entries(cbsRef.current).forEach(([ev, fn]) => sock.on(ev, fn));
      sockRef.current = sock;
    });

    return () => { sockRef.current?.disconnect(); sockRef.current = null; };
  }, [token]);

  // Subscribe to a queue room whenever queueId changes
  useEffect(() => {
    if (queueId && sockRef.current?.connected) {
      sockRef.current.emit("joinQueue", { queueId });
    }
  }, [queueId, connected]);

  // Register event listener
  const on = useCallback((event, fn) => {
    cbsRef.current[event] = fn;
    sockRef.current?.on(event, fn);
    return () => {
      delete cbsRef.current[event];
      sockRef.current?.off(event, fn);
    };
  }, []);

  const joinRoom = useCallback((qId) => {
    sockRef.current?.emit("joinQueue", { queueId: qId });
  }, []);

  return { connected, on, joinRoom };
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const initials = (name = "") =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

const fmtMins = (m) => {
  if (!m || m <= 0) return "< 1 min";
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
};

const ago = (ts) => {
  const m = Math.round((Date.now() - new Date(ts)) / 60000);
  return m < 1 ? "just now" : `${m}m ago`;
};

// ─────────────────────────────────────────────
// COMPONENT: QueueProgressBar
// ─────────────────────────────────────────────
function QueueProgressBar({ position, total, color }) {
  const pct = total <= 1 ? 100 : Math.round(((total - position) / total) * 100);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:500, color, opacity:.7, marginBottom:5 }}>
        <span>Queue Progress</span><span>{pct}%</span>
      </div>
      <div style={{ height:8, background:"rgba(0,0,0,.08)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color, opacity:.4, marginTop:4 }}>
        <span>Start</span><span>Counter</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT: WaitTimePredictor
// Reads backend estimatedWaitTime; falls back to
// local AI if server value not yet available.
// ─────────────────────────────────────────────
function WaitTimePredictor({ customer, position, activeCounters, total, compact = false }) {
  // Backend-provided prediction takes priority
  const wait = (customer.estimatedWaitTime > 0)
    ? customer.estimatedWaitTime
    : ai.predict({ peopleAhead: position, category: customer.category, activeCounters });

  const urgency = position === 0 ? "now"
    : position <= 2 ? "soon"
    : position <= 5 ? "mid" : "later";

  const cfg = {
    now:   { bg:"#F0FDF4", bd:"#86EFAC", tx:"#15803D", lbl:"Your turn now!" },
    soon:  { bg:"#EFF6FF", bd:"#93C5FD", tx:"#1D4ED8", lbl:`~${Math.round(wait)} min` },
    mid:   { bg:"#FFFBEB", bd:"#FCD34D", tx:"#B45309", lbl:`~${fmtMins(wait)}` },
    later: { bg:"#F9FAFB", bd:"#E5E7EB", tx:"#6B7280", lbl:fmtMins(wait) },
  }[urgency];

  const msg = position === 0 ? "🎉 It's your turn! Please proceed to the counter."
    : position === 1 ? "⚡ You're next! Get ready."
    : position <= 3 ? `👀 You are ${position} people away from your turn`
    : `⏳ Your turn is in approximately ${fmtMins(wait)}`;

  if (compact) return (
    <div style={{ background:cfg.bg, border:`1px solid ${cfg.bd}`, borderRadius:8, padding:"3px 10px", fontSize:12, fontWeight:600, color:cfg.tx, whiteSpace:"nowrap" }}>
      ⏱ {cfg.lbl}
    </div>
  );

  return (
    <div style={{ background:cfg.bg, border:`1.5px solid ${cfg.bd}`, borderRadius:16, padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:cfg.tx, letterSpacing:1.5, marginBottom:4 }}>AI PREDICTION</div>
          <div style={{ fontSize:32, fontWeight:700, color:cfg.tx, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
            {position === 0 ? "NOW" : fmtMins(wait)}
          </div>
          <div style={{ fontSize:13, color:cfg.tx, marginTop:8, opacity:.85 }}>{msg}</div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:11, color:cfg.tx, opacity:.5, marginBottom:2 }}>TOKEN</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:700, color:cfg.tx }}>
            {customer.tokenNumber || customer.id || "—"}
          </div>
          <div style={{ fontSize:11, color:cfg.tx, opacity:.5, marginTop:6 }}>Position #{position + 1}</div>
        </div>
      </div>
      <div style={{ marginTop:14 }}>
        <QueueProgressBar position={position} total={total} color={cfg.tx} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT: LiveQueueStatus
// Subscribes to Socket.io events — board updates
// automatically on every backend change.
// ─────────────────────────────────────────────
function LiveQueueStatus({ queue, serving, activeCounters, connected }) {
  return (
    <div style={{ background:"white", border:"1px solid #EBEBEB", borderRadius:16, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ background:"#0F172A", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, background: connected ? "#10B981" : "#EF4444", borderRadius:"50%", animation: connected ? "livePulse 1.5s infinite" : "none" }} />
          <span style={{ color:"white", fontWeight:600, fontSize:14 }}>LIVE QUEUE</span>
          {!connected && <span style={{ fontSize:11, color:"#EF4444" }}> — Reconnecting…</span>}
        </div>
        <div style={{ display:"flex", gap:16 }}>
          <span style={{ fontSize:12, color:"#94A3B8" }}>Waiting: <b style={{ color:"white" }}>{queue.length}</b></span>
          <span style={{ fontSize:12, color:"#94A3B8" }}>Counters: <b style={{ color:"#10B981" }}>{activeCounters}</b></span>
        </div>
      </div>

      {/* Now Serving bar */}
      {serving && (
        <div style={{ background:"linear-gradient(90deg,#065F46,#047857)", padding:"12px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:"#10B981", color:"white", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700 }}>NOW SERVING</div>
          <span style={{ color:"white", fontWeight:600, fontSize:15 }}>{serving.customerName || serving.name}</span>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#6EE7B7", marginLeft:"auto" }}>{serving.tokenNumber}</span>
        </div>
      )}

      {/* Queue rows */}
      <div style={{ maxHeight:280, overflowY:"auto" }}>
        {queue.length === 0
          ? <div style={{ textAlign:"center", padding:"36px 0", color:"#9CA3AF", fontSize:14 }}>Queue is empty</div>
          : queue.slice(0, 8).map((c, i) => (
            <div key={c._id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 20px", borderBottom:"1px solid #F1F5F9", background: i === 0 ? "#F0F9FF" : "white" }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#94A3B8", width:22 }}>#{i+1}</span>
              <div style={{ width:34, height:34, borderRadius:10, background:(CAT_COLORS[c.category]||"#3B82F6")+"20", color:CAT_COLORS[c.category]||"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>
                {initials(c.customerName)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:14 }}>{c.customerName}</div>
                <div style={{ fontSize:11, color:"#94A3B8" }}>{c.category} · {ago(c.createdAt)}</div>
              </div>
              {c.priority === "vip" && <span style={{ fontSize:10, fontWeight:700, background:"#FEF2F2", color:"#DC2626", borderRadius:6, padding:"2px 7px" }}>VIP</span>}
              <WaitTimePredictor customer={c} position={i} activeCounters={activeCounters} total={queue.length} compact />
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT: PredictionChart
// Data sourced from GET /api/admin/analytics
// ─────────────────────────────────────────────
function PredictionChart({ analytics }) {
  const TT = { background:"#1E293B", border:"none", borderRadius:10, color:"white", fontSize:13 };

  if (!analytics) return (
    <div style={{ textAlign:"center", padding:"60px", color:"#94A3B8" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
      <div>Loading analytics from backend…</div>
    </div>
  );

  const { peakHours = [], categoryBreakdown = [], dailyTrend = [], mlWeights = {} } = analytics;

  const peakData = peakHours.filter(h => h.hour >= 8 && h.hour <= 18)
    .map(h => ({ hour: h.label, customers: h.count, avgWait: h.avgWait }));

  const catData = CATEGORIES.map(cat => ({
    category: cat,
    avg: mlWeights[cat] || ai.weights[cat] || 5,
  }));

  const trendData = dailyTrend.slice(-10).map((d, i) => ({
    day: `D${i+1}`, total: d.count, served: d.served,
  }));

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

      {/* Peak Hours */}
      <div style={{ background:"white", border:"1px solid #EBEBEB", borderRadius:16, padding:"20px" }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Peak Hours</div>
        <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>Customer volume — from backend historical data</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={peakData.length > 0 ? peakData : [{ hour:"—", customers:0 }]}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
            <XAxis dataKey="hour" tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TT}/>
            <Area type="monotone" dataKey="customers" stroke="#3B82F6" strokeWidth={2} fill="url(#pg)" name="Customers"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI-Learned Service Times */}
      <div style={{ background:"white", border:"1px solid #EBEBEB", borderRadius:16, padding:"20px" }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>AI-Learned Service Times</div>
        <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>Backend ML weights per category (EMA α=0.1)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={catData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="category" tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TT} formatter={v => [`${v} min`, "Avg Time"]}/>
            <Bar dataKey="avg" fill="#3B82F6" radius={[6,6,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Trend */}
      <div style={{ background:"white", border:"1px solid #EBEBEB", borderRadius:16, padding:"20px", gridColumn:"1/-1" }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Daily Queue Trend</div>
        <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>Total vs. served tokens per day — MongoDB aggregation</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={trendData.length > 1 ? trendData : [{ day:"Today", total:0, served:0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
            <XAxis dataKey="day" tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:"#94A3B8" }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TT}/>
            <Legend wrapperStyle={{ fontSize:12 }}/>
            <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} name="Total Tokens"/>
            <Line type="monotone" dataKey="served" stroke="#10B981" strokeWidth={2} dot={false} name="Served"/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown table */}
      {categoryBreakdown.length > 0 && (
        <div style={{ background:"white", border:"1px solid #EBEBEB", borderRadius:16, padding:"20px", gridColumn:"1/-1" }}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>Category Breakdown</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {categoryBreakdown.map(c => (
              <div key={c._id} style={{ background:"#F8FAFC", borderRadius:12, padding:"14px 16px", borderLeft:`4px solid ${CAT_COLORS[c._id]||"#94A3B8"}` }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{c._id}</div>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace", color:CAT_COLORS[c._id]||"#94A3B8", margin:"6px 0" }}>{c.count}</div>
                <div style={{ fontSize:12, color:"#94A3B8" }}>{c.served} served · {(c.avgWait||0).toFixed(1)}m avg</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT: AuthGate — Login / Register
// Calls POST /api/auth/login or /api/auth/register
// ─────────────────────────────────────────────
function AuthGate({ onAuth }) {
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", password:"", role:"user" });
  const [loading, setL]   = useState(false);
  const [error, setErr]   = useState("");

  async function submit() {
    setErr(""); setL(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, role: form.role };
      const res = await api.post(path, body);
      api.setToken(res.data.token);
      onAuth(res.data.user, res.data.token);
    } catch(e) { setErr(e.message); }
    finally { setL(false); }
  }

  const field = (ph, key, type = "text") => (
    <input type={type} placeholder={ph} value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      onKeyDown={e => e.key === "Enter" && submit()}
      style={{ border:"1.5px solid #E2E8F0", borderRadius:10, padding:"11px 14px", fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", background:"#FAFAFA" }}
    />
  );

  return (
    <div style={{ minHeight:"100vh", background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');* {box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width:400, background:"white", borderRadius:20, padding:"40px", border:"1px solid #E2E8F0", boxShadow:"0 8px 40px rgba(0,0,0,.08)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ background:"#0F172A", borderRadius:14, width:52, height:52, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 14px" }}>🧠</div>
          <div style={{ fontWeight:700, fontSize:22 }}>QueueFlow AI</div>
          <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>Smart Queue Management · Backend Integrated</div>
        </div>

        <div style={{ display:"flex", background:"#F1F5F9", borderRadius:10, padding:4, marginBottom:24 }}>
          {["login","register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              style={{ flex:1, border:"none", borderRadius:8, padding:"8px", fontSize:14, fontWeight:500, cursor:"pointer", background: mode===m ? "white" : "transparent", color: mode===m ? "#0F172A" : "#94A3B8", boxShadow: mode===m ? "0 1px 4px rgba(0,0,0,.08)" : "none", transition:"all .15s", fontFamily:"inherit" }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {mode === "register" && field("Full name", "name")}
          {field("Email address", "email", "email")}
          {field("Password (min 6 chars)", "password", "password")}
          {mode === "register" && (
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ border:"1.5px solid #E2E8F0", borderRadius:10, padding:"11px 14px", fontSize:14, outline:"none", fontFamily:"inherit", background:"#FAFAFA" }}>
              <option value="user">User (Customer)</option>
              <option value="admin">Admin (Operator)</option>
            </select>
          )}
          {error && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#DC2626" }}>
              ⚠ {error}
            </div>
          )}
          <button onClick={submit} disabled={loading}
            style={{ background: loading ? "#E2E8F0" : "#0F172A", color: loading ? "#94A3B8" : "white", border:"none", borderRadius:10, padding:"13px", fontSize:14, fontWeight:600, cursor: loading ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
            {loading ? "Connecting to backend…" : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </div>

        <div style={{ marginTop:20, padding:"14px", background:"#F8FAFC", borderRadius:10, fontSize:12, color:"#64748B" }}>
          <b>Backend must be running</b> at <code style={{ fontSize:11 }}>{API_BASE}</code><br />
          Run: <code style={{ fontSize:11 }}>cd smart-queue-backend && npm run dev</code>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT: SmartQueueSystem
// ─────────────────────────────────────────────
export default function SmartQueueSystem() {
  // ── Auth ────────────────────────────────────
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);

  // ── Queue state (from backend) ──────────────
  const [activeQueueId, setActiveQueueId] = useState(null);
  const [waitingTokens, setWaitingTokens] = useState([]);
  const [servingToken, setServingToken]   = useState(null);
  const [counters, setCounters]           = useState([]);
  const [analytics, setAnalytics]         = useState(null);
  const [aiWeights, setAiWeights]         = useState({ ...ai.weights });

  // ── UI ──────────────────────────────────────
  const [tab, setTab]             = useState("admin");
  const [notif, setNotif]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [addForm, setAddForm]     = useState({ name:"", category:"General", priority:"normal" });
  const [myToken, setMyToken]     = useState(null);
  const [joinForm, setJoinForm]   = useState({ name:"", priority:"normal" });
  const [snapshots, setSnapshots] = useState([]);

  // ── Socket ──────────────────────────────────
  const { connected, on, joinRoom } = useSocket(token, activeQueueId);

  // ─────────────────────────────────────────────
  // SOCKET EVENTS — all real-time backend updates
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeQueueId) return;

    // Backend signals queue changed → refetch
    const offQU = on("queueUpdated", ({ queueId, queueLength }) => {
      if (queueId === activeQueueId) {
        refreshQueue(queueId);
        setSnapshots(s => [...s.slice(-19), { q: queueLength, t: Date.now() }]);
      }
    });

    // A token was called to counter
    const offTC = on("tokenCalled", ({ token: t, counter }) => {
      refreshQueue(activeQueueId);
      toast(`Now serving ${t.customerName} → ${counter.name}`, "info");
    });

    // New customer joined
    const offNT = on("newTokenAdded", ({ token: t, queueLength }) => {
      // Optimistic: add to local state immediately for snappy UX
      setWaitingTokens(prev => [...prev, t]);
      setSnapshots(s => [...s.slice(-19), { q: queueLength, t: Date.now() }]);
    });

    // Backend AI recalculated wait times
    const offWT = on("waitTimeUpdated", ({ tokens }) => {
      if (!tokens) return;
      setWaitingTokens(prev => prev.map(wt => {
        const fresh = tokens.find(x => x.id === wt._id);
        return fresh ? { ...wt, estimatedWaitTime: fresh.estimatedWaitTime, position: fresh.position } : wt;
      }));
    });

    // Personal alert: it's your turn
    const offYT = on("yourTurn", ({ message }) => {
      toast(`🎉 ${message}`, "success");
    });

    return () => { offQU(); offTC(); offNT(); offWT(); offYT(); };
  }, [activeQueueId, on]);

  // ─────────────────────────────────────────────
  // API HELPERS
  // ─────────────────────────────────────────────
  const toast = (msg, type = "success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3200);
  };

  async function refreshQueue(qId) {
    if (!qId) return;
    try {
      const res = await api.get(`/queue/${qId}`);
      setWaitingTokens(res.data.waitingTokens || []);
      setServingToken(res.data.servingToken || null);
      setCounters(res.data.activeCounters || []);
    } catch(e) { /* queue not yet created */ }
  }

  async function loadAnalytics() {
    try {
      const res = await api.get("/admin/analytics");
      setAnalytics(res.data);
      // Sync AI weights from backend ML model
      if (res.data.mlWeights) {
        ai.sync(res.data.mlWeights);
        setAiWeights({ ...ai.weights });
      }
    } catch(e) { toast(e.message, "warn"); }
  }

  // On login: fetch queues, create demo queue if none
  async function handleAuth(authUser, authToken) {
    setUser(authUser);
    setToken(authToken);
    api.setToken(authToken);

    try {
      const listRes = await api.get("/queue/list");
      let queues = listRes.data || [];

      // Auto-create demo queue + counter for fresh installs
      if (queues.length === 0 && (authUser.role === "admin" || authUser.role === "superadmin")) {
        const qRes = await api.post("/queue/create", {
          serviceName: "Main Service Queue", category: "General",
          estimatedServiceTime: 5, maxCapacity: 200,
        });
        queues = [qRes.data];
        // Create a default counter
        await api.post("/admin/counters", {
          counterName: "Counter 1", counterNumber: 1,
          assignedQueue: qRes.data._id,
        });
        toast("Demo queue & counter created!", "success");
      }

      if (queues.length > 0) {
        const qId = queues[0]._id;
        setActiveQueueId(qId);
        joinRoom(qId);
        await refreshQueue(qId);
      }

      if (authUser.role === "admin" || authUser.role === "superadmin") {
        await loadAnalytics();
      }
    } catch(e) { toast(e.message, "warn"); }
  }

  // Add customer (admin books on behalf of user)
  async function addCustomer() {
    if (!addForm.name.trim() || !activeQueueId) return;
    try {
      const res = await api.post("/token/book", {
        queueId: activeQueueId,
        priority: addForm.priority,
        customerName: addForm.name.trim(),
        notes: addForm.category,
      });
      setShowForm(false);
      setAddForm({ name:"", category:"General", priority:"normal" });
      toast(`${addForm.name} added to queue`);
      await refreshQueue(activeQueueId);
    } catch(e) { toast(e.message, "warn"); }
  }

  // Call next token (admin)
  async function callNext() {
    if (!activeQueueId) return;
    const activeCounter = counters.find(c => c.status === "active") || counters[0];
    if (!activeCounter) { toast("No active counters. Create one first.", "warn"); return; }
    try {
      const res = await api.post("/admin/call-next", {
        queueId: activeQueueId,
        counterId: activeCounter._id,
      });
      toast(`Serving: ${res.data.servedToken?.customerName}`, "info");
      await refreshQueue(activeQueueId);
    } catch(e) { toast(e.message, "warn"); }
  }

  // Remove customer from queue
  async function removeToken(tokenId, name) {
    try {
      await api.del(`/token/${tokenId}/cancel`);
      toast(`${name} removed`, "warn");
      await refreshQueue(activeQueueId);
    } catch(e) { toast(e.message, "warn"); }
  }

  // User joins queue
  async function joinQueue() {
    if (!joinForm.name.trim() || !activeQueueId) return;
    try {
      const res = await api.post("/token/book", {
        queueId: activeQueueId,
        priority: joinForm.priority,
        customerName: joinForm.name.trim(),
      });
      setMyToken(res.data.token);
      setJoinForm({ name:"", priority:"normal" });
      toast(`Token ${res.data.token?.tokenNumber} booked!`);
      await refreshQueue(activeQueueId);
    } catch(e) { toast(e.message, "warn"); }
  }

  function logout() {
    setUser(null); setToken(null); api.setToken(null);
    setWaitingTokens([]); setServingToken(null);
    setMyToken(null); setAnalytics(null); setActiveQueueId(null);
  }

  // ── Derived ─────────────────────────────────
  const isAdmin     = user?.role === "admin" || user?.role === "superadmin";
  const cntCount    = counters.length || 1;
  const totalServed = analytics?.overview?.served || 0;
  const avgWait     = analytics?.overview?.avgWaitTime ? `${parseFloat(analytics.overview.avgWaitTime).toFixed(1)}m` : "—";

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  if (!user) return <AuthGate onAuth={handleAuth} />;

  return (
    <div style={{ fontFamily:"'DM Sans','Helvetica Neue',sans-serif", background:"#F8FAFC", minHeight:"100vh", color:"#0F172A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button,input,select{font-family:inherit}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .tab{background:none;border:none;padding:10px 20px;font-size:14px;font-weight:500;color:#94A3B8;border-bottom:2.5px solid transparent;cursor:pointer;transition:all .2s}
        .tab.on{color:#0F172A;border-bottom-color:#0F172A}
      `}</style>

      {/* Toast notification */}
      {notif && (
        <div style={{
          position:"fixed", top:20, right:20, padding:"13px 18px", borderRadius:12, fontSize:14,
          fontWeight:500, zIndex:1000, animation:"slideDown .3s ease", boxShadow:"0 4px 24px rgba(0,0,0,.12)",
          background: notif.type==="warn" ? "#FFFBEB" : notif.type==="info" ? "#EFF6FF" : "#F0FDF4",
          color: notif.type==="warn" ? "#92400E" : notif.type==="info" ? "#1E40AF" : "#166534",
          border: `1.5px solid ${notif.type==="warn" ? "#FCD34D" : notif.type==="info" ? "#93C5FD" : "#86EFAC"}`,
        }}>
          {notif.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background:"white", borderBottom:"1px solid #E2E8F0" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 0 0" }}>
            {/* Brand */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ background:"#0F172A", borderRadius:12, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🧠</div>
              <div>
                <div style={{ fontWeight:700, fontSize:17 }}>QueueFlow <span style={{ fontWeight:300, color:"#94A3B8" }}>AI</span></div>
                <div style={{ fontSize:11, color:"#94A3B8" }}>
                  {connected
                    ? <span style={{ color:"#10B981" }}>● Live · Socket.io</span>
                    : <span style={{ color:"#EF4444" }}>● Connecting…</span>
                  }
                  {" · "}{user.name} ({user.role})
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {isAdmin && (
                <>
                  <button onClick={() => setShowForm(v => !v)}
                    style={{ background:"#F1F5F9", color:"#0F172A", border:"none", borderRadius:10, padding:"10px 18px", fontSize:14, fontWeight:500, cursor:"pointer" }}>
                    {showForm ? "✕ Cancel" : "+ Add Customer"}
                  </button>
                  {waitingTokens.length > 0 && (
                    <button onClick={callNext}
                      style={{ background:"#0F172A", color:"white", border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                      {servingToken ? "→ Next" : "▶ Start"}
                    </button>
                  )}
                </>
              )}
              <button onClick={logout}
                style={{ background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                Sign Out
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex" }}>
            {[
              ...(isAdmin ? [{ id:"admin", label:`Admin (${waitingTokens.length})` }] : []),
              { id:"user", label:"User View" },
              ...(isAdmin ? [{ id:"charts", label:"Analytics" }, { id:"ml", label:"AI Model" }] : []),
            ].map(t => (
              <button key={t.id}
                className={`tab${tab===t.id?" on":""}`}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === "charts" || t.id === "ml") loadAnalytics();
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px" }}>

        {/* Add Customer Form */}
        {showForm && isAdmin && (
          <div style={{ background:"white", border:"1.5px solid #0F172A", borderRadius:14, padding:"20px", marginBottom:20, animation:"slideDown .2s ease" }}>
            <div style={{ fontWeight:600, marginBottom:14 }}>Add New Customer → POST /api/token/book</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:12, alignItems:"end" }}>
              {[
                { lbl:"FULL NAME", el:<input autoFocus style={{ border:"1.5px solid #E2E8F0", borderRadius:10, padding:"10px 14px", fontSize:14, width:"100%", outline:"none" }} placeholder="e.g. Jane Smith" value={addForm.name} onChange={e => setAddForm(f => ({...f, name:e.target.value}))} onKeyDown={e => e.key==="Enter" && addCustomer()}/> },
                { lbl:"CATEGORY", el:<select style={{ border:"1.5px solid #E2E8F0", borderRadius:10, padding:"10px 14px", fontSize:14, width:"100%", outline:"none", background:"white" }} value={addForm.category} onChange={e => setAddForm(f => ({...f, category:e.target.value}))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select> },
                { lbl:"PRIORITY",  el:<select style={{ border:"1.5px solid #E2E8F0", borderRadius:10, padding:"10px 14px", fontSize:14, width:"100%", outline:"none", background:"white" }} value={addForm.priority} onChange={e => setAddForm(f => ({...f, priority:e.target.value}))}><option value="normal">Normal</option><option value="vip">VIP</option><option value="emergency">Emergency</option></select> },
              ].map(({ lbl, el }) => (
                <div key={lbl}><div style={{ fontSize:11, fontWeight:600, color:"#94A3B8", marginBottom:5 }}>{lbl}</div>{el}</div>
              ))}
              <button onClick={addCustomer} disabled={!addForm.name.trim()}
                style={{ background: addForm.name.trim() ? "#0F172A" : "#E2E8F0", color: addForm.name.trim() ? "white" : "#94A3B8", border:"none", borderRadius:10, padding:"11px 22px", fontSize:14, fontWeight:600, cursor: addForm.name.trim() ? "pointer" : "not-allowed" }}>
                Add →
              </button>
            </div>
          </div>
        )}

        {/* ── ADMIN TAB ── */}
        {tab === "admin" && isAdmin && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20 }}>
            <div>
              {/* Stats row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
                {[
                  { lbl:"In Queue",        val:waitingTokens.length, clr:"#3B82F6" },
                  { lbl:"Served Today",    val:totalServed,           clr:"#10B981" },
                  { lbl:"Avg Wait",        val:avgWait,               clr:"#8B5CF6" },
                  { lbl:"Active Counters", val:cntCount,              clr:"#F59E0B" },
                ].map(s => (
                  <div key={s.lbl} style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:s.clr, fontFamily:"'DM Mono',monospace" }}>{s.val}</div>
                    <div style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* Live board */}
              <LiveQueueStatus queue={waitingTokens} serving={servingToken} activeCounters={cntCount} connected={connected}/>

              {/* Detailed rows with remove */}
              {waitingTokens.length > 0 && (
                <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                  {waitingTokens.map((c, i) => (
                    <div key={c._id} style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, animation:"fadeIn .3s" }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#94A3B8", width:22 }}>#{i+1}</span>
                      <div style={{ width:36, height:36, borderRadius:10, background:(CAT_COLORS[c.category]||"#3B82F6")+"20", color:CAT_COLORS[c.category]||"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700 }}>
                        {initials(c.customerName)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:500, fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                          {c.customerName}
                          {c.priority==="vip"       && <span style={{ fontSize:10, fontWeight:700, background:"#FEF2F2", color:"#DC2626", borderRadius:6, padding:"2px 7px" }}>★ VIP</span>}
                          {c.priority==="emergency" && <span style={{ fontSize:10, fontWeight:700, background:"#FEF2F2", color:"#DC2626", borderRadius:6, padding:"2px 7px" }}>🚨 EMERGENCY</span>}
                        </div>
                        <div style={{ fontSize:12, color:"#94A3B8" }}>
                          {c.category} · {ago(c.createdAt)} · <span style={{ fontFamily:"'DM Mono',monospace" }}>{c.tokenNumber}</span>
                        </div>
                      </div>
                      <WaitTimePredictor customer={c} position={i} activeCounters={cntCount} total={waitingTokens.length} compact/>
                      <button onClick={() => removeToken(c._id, c.customerName)}
                        style={{ background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:500, cursor:"pointer" }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Now serving card */}
              {servingToken ? (
                <div style={{ background:"linear-gradient(135deg,#0F172A,#1E293B)", borderRadius:16, padding:"22px" }}>
                  <div style={{ fontSize:11, color:"#64748B", letterSpacing:1.5, marginBottom:14, fontWeight:600 }}>NOW SERVING</div>
                  <div style={{ width:48, height:48, borderRadius:14, background:"rgba(255,255,255,.1)", color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, marginBottom:12 }}>
                    {initials(servingToken.customerName)}
                  </div>
                  <div style={{ fontWeight:700, fontSize:20, color:"white", marginBottom:4 }}>{servingToken.customerName}</div>
                  <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, background:"rgba(255,255,255,.12)", color:"#CBD5E1", borderRadius:8, padding:"3px 10px" }}>{servingToken.category}</span>
                    {servingToken.priority==="vip" && <span style={{ fontSize:12, background:"#DC2626", color:"white", borderRadius:8, padding:"3px 10px" }}>★ VIP</span>}
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#64748B", marginBottom:20 }}>
                    Token: {servingToken.tokenNumber}<br/>
                    Called: {ago(servingToken.calledAt || servingToken.updatedAt)}
                  </div>
                  {waitingTokens.length > 0 && (
                    <button onClick={callNext}
                      style={{ background:"#10B981", color:"white", border:"none", borderRadius:10, padding:"12px", width:"100%", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                      ✓ Done → Call Next
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:16, padding:"22px", textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>◉</div>
                  <div style={{ fontWeight:600, color:"#64748B" }}>No active service</div>
                  <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>Press ▶ Start to begin</div>
                </div>
              )}

              {/* Counters list */}
              {counters.length > 0 && (
                <div style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:16, padding:"16px 18px" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#94A3B8", letterSpacing:1, marginBottom:12 }}>COUNTERS</div>
                  {counters.map((c, i) => (
                    <div key={c._id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom: i < counters.length-1 ? "1px solid #F8FAFC" : "none" }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background: c.status==="active" ? "#10B981" : "#94A3B8", flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{c.counterName}</span>
                      <span style={{ fontSize:11, color:"#94A3B8" }}>{c.averageServiceTime}m avg</span>
                      <span style={{ fontSize:11, fontWeight:600, background: c.status==="active" ? "#F0FDF4" : "#F1F5F9", color: c.status==="active" ? "#15803D" : "#64748B", borderRadius:6, padding:"2px 7px" }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── USER VIEW TAB ── */}
        {tab === "user" && (
          <div style={{ maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>
            {myToken ? (() => {
              const live = waitingTokens.find(t => t._id === myToken._id) || myToken;
              const pos  = waitingTokens.findIndex(t => t._id === myToken._id);
              return (
                <div>
                  <WaitTimePredictor
                    customer={{ ...myToken, ...live }}
                    position={pos >= 0 ? pos : (myToken.position || 1) - 1}
                    activeCounters={cntCount}
                    total={waitingTokens.length}
                  />
                  <div style={{ marginTop:12, background:"white", border:"1px solid #EBEBEB", borderRadius:14, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:2 }}>Your Token</div>
                      <div style={{ fontWeight:600 }}>{myToken.customerName}</div>
                      <div style={{ fontSize:13, color:"#6B7280" }}>
                        {myToken.category} · {myToken.priority==="vip" ? "★ VIP" : "Normal"}
                      </div>
                    </div>
                    <button onClick={() => { removeToken(myToken._id, myToken.customerName); setMyToken(null); }}
                      style={{ background:"#FEF2F2", color:"#DC2626", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                      Leave Queue
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div style={{ background:"white", border:"1.5px dashed #D1D5DB", borderRadius:16, padding:"28px 24px" }}>
                <div style={{ textAlign:"center", marginBottom:20 }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🎫</div>
                  <div style={{ fontWeight:600, fontSize:18 }}>Join the Queue</div>
                  <div style={{ fontSize:13, color:"#9CA3AF", marginTop:4 }}>AI predicts your wait time instantly</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input style={{ border:"1.5px solid #E5E7EB", borderRadius:10, padding:"11px 14px", fontSize:14, outline:"none" }}
                    placeholder="Your full name"
                    value={joinForm.name}
                    onChange={e => setJoinForm(f => ({...f, name:e.target.value}))}
                    onKeyDown={e => e.key==="Enter" && joinQueue()}
                  />
                  <select style={{ border:"1.5px solid #E5E7EB", borderRadius:10, padding:"11px 14px", fontSize:14, outline:"none", background:"white" }}
                    value={joinForm.priority} onChange={e => setJoinForm(f => ({...f, priority:e.target.value}))}>
                    <option value="normal">Normal</option>
                    <option value="vip">VIP</option>
                  </select>
                  <button onClick={joinQueue} disabled={!joinForm.name.trim()}
                    style={{ background: joinForm.name.trim() ? "#0F172A" : "#E5E7EB", color: joinForm.name.trim() ? "white" : "#9CA3AF", border:"none", borderRadius:10, padding:"13px", fontSize:14, fontWeight:600, cursor: joinForm.name.trim() ? "pointer" : "not-allowed" }}>
                    Get My Token → POST /api/token/book
                  </button>
                </div>
              </div>
            )}

            <LiveQueueStatus queue={waitingTokens} serving={servingToken} activeCounters={cntCount} connected={connected}/>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === "charts" && <PredictionChart analytics={analytics}/>}

        {/* ── AI MODEL TAB ── */}
        {tab === "ml" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

            {/* Weights panel */}
            <div style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:16, padding:"24px" }}>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>🧠 Backend ML Weights</div>
              <div style={{ fontSize:13, color:"#94A3B8", marginBottom:20 }}>
                Fetched from GET /api/admin/analytics · Updated via EMA on each served token
              </div>
              {CATEGORIES.map(cat => {
                const w = aiWeights[cat] || ai.weights[cat] || 5;
                const pct = Math.min(100, (w / 15) * 100);
                return (
                  <div key={cat} style={{ marginBottom:18 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:CAT_COLORS[cat] }}/>
                        <span style={{ fontSize:14, fontWeight:500 }}>{cat}</span>
                      </div>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color:CAT_COLORS[cat] }}>
                        {typeof w === "number" ? w.toFixed(2) : w} min
                      </span>
                    </div>
                    <div style={{ height:8, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:CAT_COLORS[cat], borderRadius:99, transition:"width .5s ease" }}/>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop:20, background:"#F8FAFC", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:12, color:"#64748B", fontWeight:500, marginBottom:8 }}>BACKEND FORMULA</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#0F172A", lineHeight:1.8 }}>
                  predicted_wait =<br/>
                  &nbsp;(people_ahead × avg_time<br/>
                  &nbsp;&nbsp;× peak_factor × priority_factor)<br/>
                  &nbsp;÷ active_counters
                </div>
              </div>
            </div>

            {/* Integration status */}
            <div style={{ background:"white", border:"1px solid #E2E8F0", borderRadius:16, padding:"24px" }}>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>📡 Integration Status</div>
              <div style={{ fontSize:13, color:"#94A3B8", marginBottom:20 }}>Live connection health checks</div>

              {[
                { lbl:"REST API",    ok:!!token,        note:`${API_BASE}` },
                { lbl:"Socket.io",   ok:connected,      note: connected ? `Connected to ${SOCKET_URL}` : "Reconnecting…" },
                { lbl:"Queue Room",  ok:!!activeQueueId, note: activeQueueId ? `Room: queue:${activeQueueId?.slice(-8)}` : "No queue" },
                { lbl:"JWT Auth",    ok:!!user,         note:`${user?.name} · ${user?.role}` },
                { lbl:"ML Weights",  ok:!!analytics,    note: analytics ? "Synced from backend" : "Not loaded yet" },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom: i < 4 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background: item.ok ? "#10B981" : "#EF4444", flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500, fontSize:14 }}>{item.lbl}</div>
                    <div style={{ fontSize:11, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{item.note}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, background: item.ok ? "#F0FDF4" : "#FEF2F2", color: item.ok ? "#15803D" : "#DC2626", borderRadius:6, padding:"3px 8px" }}>
                    {item.ok ? "✓ OK" : "✗ Down"}
                  </span>
                </div>
              ))}

              <div style={{ marginTop:20, background:"#EFF6FF", borderRadius:12, padding:"14px 16px", border:"1px solid #BFDBFE" }}>
                <div style={{ fontSize:12, color:"#1D4ED8", fontWeight:600, marginBottom:8 }}>INTEGRATION WIRING</div>
                <div style={{ fontSize:12, color:"#1E40AF", lineHeight:1.8, fontFamily:"'DM Mono',monospace" }}>
                  Login    → POST /api/auth/login<br/>
                  Queues   → GET  /api/queue/list<br/>
                  Book     → POST /api/token/book<br/>
                  CallNext → POST /api/admin/call-next<br/>
                  Socket   → queueUpdated · tokenCalled<br/>
                  AI Sync  → GET  /api/admin/analytics
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
