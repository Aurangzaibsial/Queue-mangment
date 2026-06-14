# 🧠 Smart Queue Management System — Backend

A production-ready MERN backend with AI-powered wait time prediction and real-time Socket.io updates.

---

## 🗂️ Project Structure

```
smart-queue-backend/
├── config/
│   └── db.js                    # MongoDB connection with retry logic
├── controllers/
│   ├── authController.js        # Register, login, profile
│   ├── queueController.js       # Queue CRUD
│   ├── tokenController.js       # Token booking & management
│   └── adminController.js       # Admin controls, analytics
├── models/
│   ├── User.js                  # User model (bcrypt, roles)
│   ├── Queue.js                 # Queue model
│   ├── Token.js                 # Token/ticket model
│   └── ServiceCounter.js        # Counter model (ML-enabled)
├── routes/
│   ├── authRoutes.js
│   ├── queueRoutes.js
│   ├── tokenRoutes.js
│   └── adminRoutes.js
├── middleware/
│   ├── auth.js                  # JWT protect + authorize()
│   ├── validate.js              # express-validator handler
│   └── errorHandler.js          # Global error + 404 handler
├── services/
│   └── aiPredictionService.js   # AI prediction engine + ML learning
├── sockets/
│   └── queueSocket.js           # Socket.io event handlers
├── utils/
│   ├── logger.js                # Winston logger
│   └── apiResponse.js           # Standardized response helpers
├── server.js                    # Entry point
├── .env.example
└── package.json
```

---

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Fill in MONGO_URI and JWT_SECRET

# 3. Start development server
npm run dev

# 4. Start production server
npm start
```

---

## 🔑 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | — |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `JWT_EXPIRE` | JWT expiry duration | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

---

## 📡 API Reference

### Auth Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | User | Get own profile |
| PUT | `/api/auth/me` | User | Update profile |
| PUT | `/api/auth/change-password` | User | Change password |

### Queue Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/queue/list` | — | List all active queues |
| GET | `/api/queue/:id` | — | Get queue + live tokens |
| POST | `/api/queue/create` | Admin | Create new queue |
| PUT | `/api/queue/:id` | Admin | Update queue settings |
| DELETE | `/api/queue/:id` | Admin | Soft-delete queue |

### Token Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/token/book` | User | Join a queue (get token) |
| GET | `/api/token/:id` | User | Get token + AI prediction |
| GET | `/api/token/user/:userId` | User | Get user's token history |
| DELETE | `/api/token/:id/cancel` | User | Cancel a waiting token |

### Admin Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/call-next` | Admin | Call next token to counter |
| POST | `/api/admin/counters` | Admin | Create a service counter |
| POST | `/api/admin/update-counter` | Admin | Update counter status |
| GET | `/api/admin/analytics` | Admin | Full analytics dashboard |
| POST | `/api/admin/optimize` | Admin | AI counter optimization |
| GET | `/api/admin/users` | SuperAdmin | List all users |

---

## ⚡ WebSocket Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `joinQueue` | `{ queueId }` | Subscribe to queue updates |
| `leaveQueue` | `{ queueId }` | Unsubscribe from queue |
| `pingStatus` | `{ queueId?, tokenId? }` | Request status refresh |
| `adminAction` | `{ action, queueId }` | Admin triggers action |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `queueUpdated` | `{ queueId, queueLength }` | Queue state changed |
| `tokenCalled` | `{ token, counter }` | A token was called |
| `newTokenAdded` | `{ token, queueLength }` | New customer joined |
| `waitTimeUpdated` | `{ tokens[] }` | AI predictions refreshed |
| `yourTurn` | `{ token, counter, message }` | Personal: your turn! |
| `counterUpdated` | `{ counter }` | Counter status changed |
| `queueSnapshot` | `{ waitingTokens, activeCounters }` | Initial state on join |

---

## 🧠 AI Prediction Model

```
predicted_wait = (peopleAhead × avgServiceTime × peakFactor × priorityFactor)
                 ÷ activeCounters
```

**Peak Hour Factors:**
- 11am–2pm: `1.3×`
- 9–10am: `1.1×`
- 3–5pm: `1.15×`
- Other hours: `1.0×`

**Priority Factors:**
- Normal: `1.0`
- VIP: `0.4` (serves earlier in queue)
- Emergency: `0.1`

**ML Learning:**
Uses Exponential Moving Average (α=0.1) on actual service times:
```
new_avg = old_avg + 0.1 × (actual_time − old_avg)
```
Updates every time a token is marked served.

---

## 🔒 Security Features

- Passwords hashed with **bcrypt** (salt rounds: 12)
- **JWT** with configurable expiry
- **Helmet** HTTP security headers
- **Rate limiting**: 100 req/15min globally, 10 req/15min on auth routes
- **Input validation** on all endpoints via express-validator
- Role-based access: `user` → `admin` → `superadmin`
- Password never returned in API responses (`select: false`)
