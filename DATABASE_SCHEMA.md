# Database Schema - Multi-Tenant SaaS Booking Engine

## Overview
MongoDB schema for multi-tenant appointment and queue management platform.
Every collection includes `tenantId` for tenant isolation.

## Collections

### 1. tenants
Stores business/organization information.

```javascript
{
  _id: ObjectId,
  tenantId: String,          // Unique tenant identifier
  name: String,              // Business name
  slug: String,             // URL-friendly identifier
  email: String,            // Business email
  phone: String,
  website: String,
  
  // Branding
  logo: String,
  primaryColor: String,
  secondaryColor: String,
  
  // Subscription
  plan: String,             // free, pro, enterprise
  limits: {
    maxBranches: Number,
    maxEmployees: Number,
    maxBookingsPerDay: Number
  },
  
  // Settings
  timezone: String,
  currency: String,
  language: String,
  
  // AI Settings
  aiSettings: {
    personalizationWeight: Number,    // 0.3 - 0.5
    enableNoshowPrediction: Boolean,
    enableDemandForecasting: Boolean,
    enableCapacityOptimization: Boolean
  },
  
  status: String,            // active, suspended, cancelled
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.tenants.createIndex({ tenantId: 1 }, { unique: true })
db.tenants.createIndex({ slug: 1 }, { unique: true })
db.tenants.createIndex({ email: 1 })
db.tenants.createIndex({ status: 1 })
```

### 2. branches
Stores branch/location information for each tenant.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED - tenant isolation
  branchId: String,         // Unique branch identifier
  
  name: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zipCode: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  
  // Capacity
  maxDailyBookings: Number,
  maxConcurrentBookings: Number,
  
  // Operating Hours
  operatingHours: {
    monday: { open: String, close: String, isClosed: Boolean },
    tuesday: { open: String, close: String, isClosed: Boolean },
    wednesday: { open: String, close: String, isClosed: Boolean },
    thursday: { open: String, close: String, isClosed: Boolean },
    friday: { open: String, close: String, isClosed: Boolean },
    saturday: { open: String, close: String, isClosed: Boolean },
    sunday: { open: String, close: String, isClosed: Boolean }
  },
  
  status: String,            // active, inactive
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.branches.createIndex({ tenantId: 1, branchId: 1 }, { unique: true })
db.branches.createIndex({ tenantId: 1, status: 1 })
db.branches.createIndex({ coordinates: "2dsphere" })
```

### 3. employees
Stores employee/staff information.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  branchId: String,         // REQUIRED
  employeeId: String,       // Unique employee identifier
  
  name: String,
  email: String,
  phone: String,
  
  // Role & Specialization
  role: String,             // admin, staff, specialist
  specializations: [String], // Service types they can provide
  
  // Schedule
  schedule: {
    monday: { start: String, end: String, isWorking: Boolean },
    tuesday: { start: String, end: String, isWorking: Boolean },
    wednesday: { start: String, end: String, isWorking: Boolean },
    thursday: { start: String, end: String, isWorking: Boolean },
    friday: { start: String, end: String, isWorking: Boolean },
    saturday: { start: String, end: String, isWorking: Boolean },
    sunday: { start: String, end: String, isWorking: Boolean }
  },
  
  // Performance Metrics (for AI)
  performance: {
    totalAppointments: Number,
    averageDuration: Number,      // minutes
    onTimePercentage: Number,
    customerRating: Number,
    noshowRate: Number
  },
  
  status: String,            // active, inactive, on_leave
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.employees.createIndex({ tenantId: 1, employeeId: 1 }, { unique: true })
db.employees.createIndex({ tenantId: 1, branchId: 1 })
db.employees.createIndex({ tenantId: 1, status: 1 })
```

### 4. services
Defines services offered by tenants.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  serviceId: String,       // Unique service identifier
  
  name: String,
  description: String,
  category: String,        // haircut, consultation, checkup, etc.
  
  // Duration & Pricing
  baseDuration: Number,     // minutes
  basePrice: Number,
  
  // Requirements
  requiredEmployeeSpecialization: String,
  requiresPreparation: Boolean,
  
  // AI Training Data
  averageDuration: Number,  // Learned from history
  durationVariance: Number,
  peakHours: [Number],      // Hours when this service is most popular
  
  status: String,            // active, inactive
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.services.createIndex({ tenantId: 1, serviceId: 1 }, { unique: true })
db.services.createIndex({ tenantId: 1, category: 1 })
db.services.createIndex({ tenantId: 1, status: 1 })
```

### 5. customers
Stores customer information (PII - handle with care).

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  customerId: String,       // Unique customer identifier (hashed)
  
  // PII (Encrypted)
  name: String,
  email: String,
  phone: String,
  
  // Customer Type
  customerType: String,     // new, returning, vip
  
  // History (for AI - anonymized)
  history: {
    totalBookings: Number,
    totalNoShows: Number,
    totalCancellations: Number,
    averageLeadTime: Number,    // Hours between booking and appointment
    preferredServices: [String],
    preferredTimeSlots: [String],
    loyaltyScore: Number
  },
  
  status: String,            // active, blocked
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.customers.createIndex({ tenantId: 1, customerId: 1 }, { unique: true })
db.customers.createIndex({ tenantId: 1, email: 1 })
db.customers.createIndex({ tenantId: 1, phone: 1 })
```

### 6. bookings
Core booking/appointment records.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  bookingId: String,       // Unique booking identifier
  
  // References
  customerId: String,      // Hashed customer ID
  branchId: String,
  serviceId: String,
  employeeId: String,      // Assigned employee
  
  // Appointment Details
  scheduledDate: Date,
  scheduledTime: String,   // HH:MM
  duration: Number,        // minutes
  
  // Status
  status: String,          // scheduled, confirmed, completed, cancelled, no_show, in_progress
  
  // AI Predictions
  predictions: {
    noshowProbability: Number,
    durationPrediction: Number,
    waitTimePrediction: Number
  },
  
  // Actual Data (for training)
  actualData: {
    checkInTime: Date,
    startTime: Date,
    endTime: Date,
    actualDuration: Number,
    waitTime: Number
  },
  
  // Metadata
  source: String,          // web, mobile, api, assistant
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.bookings.createIndex({ tenantId: 1, bookingId: 1 }, { unique: true })
db.bookings.createIndex({ tenantId: 1, customerId: 1 })
db.bookings.createIndex({ tenantId: 1, scheduledDate: 1, status: 1 })
db.bookings.createIndex({ tenantId: 1, branchId: 1, scheduledDate: 1 })
db.bookings.createIndex({ tenantId: 1, employeeId: 1, scheduledDate: 1 })
db.bookings.createIndex({ tenantId: 1, status: 1, scheduledDate: 1 })
```

### 7. queues
Queue management for walk-in customers.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  branchId: String,         // REQUIRED
  queueId: String,         // Unique queue identifier
  
  name: String,
  serviceType: String,
  
  // Queue Status
  status: String,          // active, closed, paused
  isActive: Boolean,
  
  // Capacity
  maxCapacity: Number,
  currentLength: Number,
  
  // AI Analytics
  analytics: {
    totalServed: Number,
    averageWaitTime: Number,
    peakHour: Number,
    avgServiceTime: Number
  },
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.queues.createIndex({ tenantId: 1, queueId: 1 }, { unique: true })
db.queues.createIndex({ tenantId: 1, branchId: 1 })
db.queues.createIndex({ tenantId: 1, status: 1 })
```

### 8. tokens
Individual queue tokens.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  queueId: String,          // REQUIRED
  tokenId: String,         // Unique token identifier
  
  tokenNumber: String,     // e.g., "A-042"
  customerId: String,      // Hashed
  
  // Position & Priority
  position: Number,
  priority: String,        // normal, vip, emergency
  
  // Status
  status: String,          // waiting, serving, completed, cancelled, no_show
  
  // AI Predictions
  estimatedWaitTime: Number,
  
  // Service Details
  serviceType: String,
  category: String,
  
  // Assignment
  assignedCounter: String,
  assignedEmployee: String,
  
  // Timestamps
  calledAt: Date,
  startedAt: Date,
  completedAt: Date,
  
  // Actual Data (for training)
  actualWaitTime: Number,
  actualServiceTime: Number,
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.tokens.createIndex({ tenantId: 1, tokenId: 1 }, { unique: true })
db.tokens.createIndex({ tenantId: 1, queueId: 1, status: 1 })
db.tokens.createIndex({ tenantId: 1, queueId: 1, position: 1 })
db.tokens.createIndex({ tenantId: 1, customerId: 1 })
```

### 9. service_counters
Service counters/stations for queue management.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  branchId: String,         // REQUIRED
  counterId: String,       // Unique counter identifier
  
  counterNumber: Number,
  counterName: String,
  
  // Assigned Employee
  assignedEmployee: String,
  
  // Status
  status: String,          // active, inactive, break
  
  // Performance (for AI)
  totalServed: Number,
  averageServiceTime: Number,
  currentToken: String,
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.service_counters.createIndex({ tenantId: 1, counterId: 1 }, { unique: true })
db.service_counters.createIndex({ tenantId: 1, branchId: 1 })
db.service_counters.createIndex({ tenantId: 1, status: 1 })
```

### 10. ai_training_data
Anonymized training data for ML models (NO PII).

```javascript
{
  _id: ObjectId,
  tenantId: String,         // For tracking, NOT for training
  dataId: String,
  
  // Features (NO PII)
  features: {
    dayOfWeek: Number,      // 0-6
    hour: Number,           // 0-23
    month: Number,         // 1-12
    isWeekend: Boolean,
    isHoliday: Boolean,
    
    serviceCategory: String,
    serviceBaseDuration: Number,
    
    branchSize: Number,    // Number of employees
    staffCount: Number,
    
    bookingLeadTime: Number, // Hours between booking and appointment
    customerType: String,   // new, returning, vip
    
    // Queue-specific
    queuePosition: Number,
    priority: String,
    activeCounters: Number
  },
  
  // Labels
  labels: {
    actualDuration: Number,
    actualWaitTime: Number,
    noshow: Boolean,
    cancelled: Boolean,
    completed: Boolean
  },
  
  // Model Type
  modelType: String,       // duration, wait, noshow, demand
  
  createdAt: Date
}

// Indexes
db.ai_training_data.createIndex({ tenantId: 1 })
db.ai_training_data.createIndex({ modelType: 1 })
db.ai_training_data.createIndex({ createdAt: 1 })
```

### 11. ai_models
Model versioning and metadata.

```javascript
{
  _id: ObjectId,
  modelId: String,
  modelType: String,       // slot_recommendation, duration_prediction, etc.
  version: String,         // Semantic versioning (1.0.0)
  
  // Model Info
  algorithm: String,       // xgboost, lightgbm, catboost
  filePath: String,
  
  // Performance
  accuracy: Number,
  precision: Number,
  recall: Number,
  f1Score: Number,
  
  // Training Info
  trainedAt: Date,
  trainingDataSize: Number,
  trainingDataPeriod: {
    start: Date,
    end: Date
  },
  
  // Status
  status: String,          // active, deprecated, rollback
  
  createdAt: Date
}

// Indexes
db.ai_models.createIndex({ modelType: 1, version: 1 }, { unique: true })
db.ai_models.createIndex({ modelType: 1, status: 1 })
```

### 12. tenant_profiles
Tenant personalization profiles.

```javascript
{
  _id: ObjectId,
  tenantId: String,         // REQUIRED
  profileVersion: String,
  
  // Personalization Weight
  personalizationWeight: Number,  // 0.3 - 0.5
  
  // Employee Speed
  employeeSpeed: {
    [employeeId]: {
      averageDuration: Number,
      speedFactor: Number,   // < 1 = faster, > 1 = slower
      confidence: Number
    }
  },
  
  // Average Durations
  averageDurations: {
    [serviceId]: Number
  },
  
  // Local Patterns
  localBusyHours: [Number],  // Hours 0-23
  noshowPercentage: Number,
  cancellationPercentage: Number,
  
  // Branch Trends
  branchTrends: {
    [branchId]: {
      peakHours: [Number],
      averageLoad: Number
    }
  },
  
  // Data Points
  dataPoints: Number,       // Number of bookings used
  
  lastUpdated: Date,
  createdAt: Date
}

// Indexes
db.tenant_profiles.createIndex({ tenantId: 1 }, { unique: true })
```

## Tenant Isolation Rules

### Query Level
Every database query MUST include `tenantId` filter:

```javascript
// WRONG
db.bookings.find({ status: 'scheduled' })

// RIGHT
db.bookings.find({ tenantId: 'tenant_123', status: 'scheduled' })
```

### Application Level
- JWT tokens include `tenantId`
- Middleware validates tenant access
- AI service receives `tenantId` in every request

### AI Training Level
- Global model: Anonymized data from all tenants
- Training data collection strips all PII
- No tenant identifiers in training features
- Tenant profiles stored separately

## Data Retention Policy

| Collection | Retention Period |
|-----------|------------------|
| bookings | 7 years |
| tokens | 2 years |
| ai_training_data | 5 years |
| ai_models | Keep last 10 versions |
| tenant_profiles | Permanent |
| customers | Until deleted (GDPR) |

## Backup Strategy

- Daily full backups
- Hourly incremental backups
- Point-in-time recovery (7 days)
- Geo-redundant storage
