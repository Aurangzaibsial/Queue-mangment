let API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000/api";
let SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
let discoveryPromise = null;

const discoverBackend = async () => {
  if (discoveryPromise) return discoveryPromise;
  
  discoveryPromise = (async () => {
    // Only skip auto-discovery if a production/remote URL is set
    const hasExplicitProdBase = process.env.REACT_APP_API_BASE && 
      !process.env.REACT_APP_API_BASE.includes("localhost") && 
      !process.env.REACT_APP_API_BASE.includes("127.0.0.1") && 
      !process.env.REACT_APP_API_BASE.includes("[::1]");

    if (hasExplicitProdBase) return;

    const candidatePorts = [5000, 5001, 5002, 5003, 5004, 5005];
    for (const port of candidatePorts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const res = await fetch(`http://localhost:${port}/health`, { 
          method: "GET",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.message && data.message.includes("Smart Queue")) {
            API_BASE = `http://localhost:${port}/api`;
            SOCKET_URL = `http://localhost:${port}`;
            console.log(`[Backend Discovery] Found backend running on port ${port}`);
            return;
          }
        }
      } catch (e) {
        // Ignore and try next port
      }
    }
    console.warn(`[Backend Discovery] Backend not found on typical local ports. Defaulting to 5000.`);
  })();
  
  return discoveryPromise;
};

// Start discovery immediately in the background
discoverBackend();

const getSocketUrl = async () => {
  await discoverBackend();
  return SOCKET_URL;
};

const api = {
  _token: null,
  setToken(t) { this._token = t; },

  async req(method, path, body) {
    await discoverBackend();
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

export { api, API_BASE, SOCKET_URL, getSocketUrl };
