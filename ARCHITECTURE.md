# AI SaaS Booking Engine - Architecture

## Overview
Enterprise-grade multi-tenant AI-powered appointment and queue management platform.

## Microservices Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway / Load Balancer              │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐      ┌────────▼────────┐      ┌─────────▼────────┐
│   Node.js API  │      │  Python AI      │      │   React Frontend │
│   Service      │      │  Service        │      │   (Multi-tenant) │
│                │      │  (FastAPI)      │      │                  │
│ - Auth         │      │ - ML Models     │      │ - Owner Dashboard│
│ - Booking      │◄────►│ - Predictions   │◄────►│ - Customer Portal│
│ - Queue Mgmt   │      │ - Training      │      │ - Admin Panel    │
│ - Tenant Mgmt  │      │ - Analytics     │      │                  │
└───────┬────────┘      └────────┬────────┘      └──────────────────┘
        │                        │
        │                        │
┌───────▼────────┐      ┌───────▼────────┐
│   MongoDB      │      │   Redis        │
│   (NoSQL)      │      │   Cache        │
│                │      │                │
│ - Tenants      │      │ - Model Cache  │
│ - Bookings     │      │ - Predictions  │
│ - Customers    │      │ - Sessions     │
│ - Employees    │      │ - Rate Limit   │
│ - Services     │      │                │
└────────────────┘      └────────────────┘
        │
        │
┌───────▼────────┐
│   Message Queue│
│   (Redis/Celery)│
│                │
│ - Training Jobs│
│ - Retraining   │
│ - Analytics    │
└────────────────┘
```

## Technology Stack

### Frontend
- React.js 18+
- TypeScript
- TailwindCSS
- shadcn/ui
- Recharts (analytics)
- Socket.io-client (real-time)

### Backend Services

#### Node.js API Service
- Node.js 18+
- Express.js
- MongoDB (Mongoose)
- Socket.io
- JWT Auth
- Rate Limiting

#### Python AI Service
- Python 3.11+
- FastAPI
- Scikit-learn
- XGBoost
- LightGBM
- CatBoost
- Prophet
- Pandas
- NumPy
- Joblib (model serialization)
- Celery (background tasks)

### Infrastructure
- Redis (cache + message queue)
- Docker & Docker Compose
- Nginx (reverse proxy)
- Prometheus + Grafana (monitoring)
- ELK Stack (logging)

## Data Flow

### Booking Flow
1. Customer requests slot via React frontend
2. Frontend calls Node.js API `/api/bookings/slots`
3. Node.js calls Python AI Service `/predict-slot`
4. AI Service returns top 5 recommended slots
5. Customer selects slot
6. Booking saved to MongoDB (tenant-isolated)
7. AI Service updates demand forecast
8. Real-time update via Socket.io

### Training Pipeline (Nightly)
1. Celery worker triggers at 2 AM
2. Collect anonymized booking data from MongoDB
3. Remove PII (names, emails, phones)
4. Extract features (day, hour, service, etc.)
5. Train global model (XGBoost/LightGBM)
6. Validate model accuracy
7. If improved: version and deploy
8. Update tenant personalization profiles
9. Cache new model in Redis

## Multi-Tenant Isolation

### Database Level
- Every query includes `tenantId` filter
- Indexes on `tenantId` for all collections
- Separate collections per tenant type

### Application Level
- JWT includes `tenantId`
- Middleware validates tenant access
- AI model training anonymizes data

### AI Model Level
- Global model: anonymized data from all tenants
- Tenant profile: per-tenant personalization
- Prediction = 70% global + 30% personalization
- Personalization weight increases with data volume

## AI Model Architecture

### Global Booking Intelligence Model
- **Purpose**: Learn universal booking patterns
- **Data**: Anonymized bookings from all tenants
- **Features**: Day, hour, month, service type, duration, holiday, weekend, branch size, staff count
- **Algorithms**: XGBoost (primary), LightGBM (backup), CatBoost (categorical-heavy)
- **Training**: Nightly retraining
- **Versioning**: Semantic versioning (v1.0, v1.1, v2.0)
- **Rollback**: Keep last 3 versions

### Tenant Personalization Profile
- **Purpose**: Learn tenant-specific patterns
- **Data**: Per-tenant booking history
- **Features**: Employee speed, avg duration, arrival behavior, local busy hours, no-show rate
- **Algorithm**: Online learning (partial_fit)
- **Update**: Daily incremental update
- **Weight**: Starts at 30%, increases to 50% with 1000+ bookings

## AI Modules

### 1. Smart Slot Recommendation
- Input: date, service, preferred time, employee
- Output: Top 5 ranked slots
- Ranking factors: wait time, completion probability, cancellation probability, availability, demand

### 2. Availability Prediction
- Input: slot, tenant, service
- Output: Available/Likely Full + confidence score
- Model: Binary classification

### 3. Waiting Time Prediction
- Input: queue position, service, time, employees
- Output: Estimated wait time, completion time, queue length
- Model: Regression

### 4. Appointment Duration Prediction
- Input: service, employee, customer type, history
- Output: Expected duration (minutes)
- Model: Regression

### 5. No-show Prediction
- Input: customer history, booking lead time, service, time
- Output: No-show probability
- Model: Binary classification
- Action: Auto-reminder if > 30% probability

### 6. Demand Forecasting
- Input: Historical bookings, calendar, holidays
- Output: Tomorrow/week/month forecasts, peak hours, staff needed
- Model: Prophet (time series) + XGBoost (feature-based)

### 7. Dynamic Capacity Optimization
- Input: Current bookings, forecasts, staff availability
- Output: Open/close slots, staff adjustments, break recommendations
- Model: Optimization algorithm

## API Endpoints

### Node.js API Service
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/tenants/:id
POST   /api/tenants
PUT    /api/tenants/:id

GET    /api/tenants/:id/branches
POST   /api/tenants/:id/branches
PUT    /api/branches/:id

GET    /api/tenants/:id/services
POST   /api/tenants/:id/services
PUT    /api/services/:id

GET    /api/tenants/:id/employees
POST   /api/tenants/:id/employees
PUT    /api/employees/:id

GET    /api/bookings/slots          # Calls AI service
POST   /api/bookings
GET    /api/bookings/:id
PUT    /api/bookings/:id
DELETE /api/bookings/:id

GET    /api/queues/:id/status
POST   /api/queues/:id/join
POST   /api/queues/:id/call
```

### Python AI Service
```
POST   /ai/predict-slot
POST   /ai/predict-duration
POST   /ai/predict-wait
POST   /ai/predict-demand
POST   /ai/predict-noshow
POST   /ai/predict-availability
POST   /ai/recommend-slots
POST   /ai/optimize-capacity
GET    /ai/tenant-profile/:tenantId
GET    /ai/analytics/:tenantId
POST   /ai/retrain-model
GET    /ai/model-version
POST   /ai/rollback-model/:version
```

## Security & Privacy

### PII Removal
- Strip: names, emails, phones, addresses
- Hash: customer IDs (one-way)
- Keep: booking patterns, timestamps, service types

### Encryption
- At rest: MongoDB encryption
- In transit: TLS 1.3
- API keys: Environment variables

### GDPR Compliance
- Right to deletion
- Data export
- Consent management
- Data minimization

## Scalability

### Targets
- 100,000+ businesses
- 10 million+ bookings
- < 300ms inference time
- 99.9% uptime

### Scaling Strategy
- Horizontal scaling: API and AI services
- Read replicas: MongoDB
- Redis Cluster: Cache and queue
- CDN: Static assets
- Auto-scaling: Kubernetes

## Deployment

### Docker Compose (Development)
```
- frontend (React)
- api-service (Node.js)
- ai-service (Python/FastAPI)
- mongodb
- redis
- nginx
```

### Kubernetes (Production)
- Separate namespaces per service
- HPA (Horizontal Pod Autoscaler)
- ConfigMaps and Secrets
- Persistent volumes for MongoDB

## Monitoring

### Metrics
- API response times
- Model accuracy
- Prediction latency
- Error rates
- Resource usage

### Logging
- Structured JSON logs
- Centralized logging (ELK)
- Log levels: DEBUG, INFO, WARN, ERROR
- Request tracing

### Alerts
- Model accuracy drops below threshold
- API error rate spikes
- High latency
- Service down
