# 🧠 Smart Queue Management System
### Full-Stack MERN App · AI Predictions · Real-Time Socket.io

---

## 📁 Project Structure

```
smart-queue-system/
├── smart-queue-backend/      ← Node.js + Express + MongoDB + Socket.io
│   ├── config/db.js
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/aiPredictionService.js
│   ├── sockets/queueSocket.js
│   ├── utils/
│   ├── server.js
│   ├── .env                  ← ✅ Already configured
│   └── package.json
│
└── smart-queue-frontend/     ← React 18 + Recharts + Socket.io Client
    ├── public/index.html
    ├── src/
    │   ├── App.js            ← Main integrated component
    │   └── index.js
    ├── .env                  ← ✅ Already configured
    └── package.json
```

---

## 🚀 Quick Start (3 Steps)

### Step 1 — Install dependencies

Open **two terminals** in VS Code (`Ctrl + `` ` `` → click + to open second)

**Terminal 1 (Backend):**
```bash
cd smart-queue-backend
npm install
```

**Terminal 2 (Frontend):**
```bash
cd smart-queue-frontend
npm install
```

---

### Step 2 — Start MongoDB

**Option A: Local MongoDB**
```bash
# Make sure MongoDB is installed, then run:
mongod
```

**Option B: MongoDB Atlas (Cloud — Free)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster → Get connection string
3. Open `smart-queue-backend/.env`
4. Replace `MONGO_URI=mongodb://localhost:27017/smart_queue_db`
   with your Atlas URI

---

### Step 3 — Run both servers

**Terminal 1 (Backend):**
```bash
cd smart-queue-backend
npm run dev
# ✅ Server running on http://localhost:5000
```

**Terminal 2 (Frontend):**
```bash
cd smart-queue-frontend
npm start
# ✅ App opens at http://localhost:3000
```

---

## 🔑 First Login

1. Open http://localhost:3000
2. Click **Register**
3. Create an account with role **Admin**
4. The app auto-creates a demo queue + counter
5. Green **● Live · Socket.io** = everything working!

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/queue/list` | List all queues |
| POST | `/api/queue/create` | Create queue (admin) |
| POST | `/api/token/book` | Join a queue |
| GET | `/api/token/:id` | Get token + AI prediction |
| POST | `/api/admin/call-next` | Call next customer |
| GET | `/api/admin/analytics` | Dashboard analytics |

---

## ⚡ Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `queueUpdated` | Server → Client | Queue state changed |
| `tokenCalled` | Server → Client | Customer called to counter |
| `newTokenAdded` | Server → Client | New customer joined |
| `waitTimeUpdated` | Server → Client | AI predictions refreshed |
| `yourTurn` | Server → Client | Personal notification |

---

## ❗ Troubleshooting

**CORS error:**
→ Check `smart-queue-backend/.env` has `CORS_ORIGINS=http://localhost:3000`

**MongoDB connection failed:**
→ Run `mongod` in a separate terminal, or use Atlas cloud URI

**Port already in use:**
```bash
# Kill process on port 5000
npx kill-port 5000
```

**npm install fails:**
```bash
npm install --legacy-peer-deps
```
