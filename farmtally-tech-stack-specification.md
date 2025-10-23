# FarmTally Technology Stack Specification

## Document Overview

This document provides a comprehensive technology stack specification for the FarmTally agricultural supply chain management platform. It defines the complete technology architecture, frameworks, tools, and infrastructure components required to build and deploy the system across all eight user roles and microservices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Technology Stack](#backend-technology-stack)
3. [Frontend Technology Stack](#frontend-technology-stack)
4. [Database Technology Stack](#database-technology-stack)
5. [Authentication & Security Stack](#authentication--security-stack)
6. [Communication & Real-Time Stack](#communication--real-time-stack)
7. [DevOps & Infrastructure Stack](#devops--infrastructure-stack)
8. [Development Tools & Workflow](#development-tools--workflow)
9. [Monitoring & Observability Stack](#monitoring--observability-stack)
10. [Third-Party Services & Integrations](#third-party-services--integrations)
11. [Performance & Scalability Considerations](#performance--scalability-considerations)
12. [Security & Compliance Stack](#security--compliance-stack)

---

## Architecture Overview

### System Architecture Pattern

**Microservices Architecture with Event-Driven Communication**

```
┌─────────────────────────────────────────────────────────────────┐
│                  Client/Application Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Web App       │  │   Mobile App    │  │  Admin Panel    │  │
│  │  (Next.js +     │  │  (React Native  │  │  (React +       │  │
│  │   React)        │  │   + Expo)       │  │   Dashboard)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   GraphQL API   │  │   REST Gateway  │  │  WebSocket      │  │
│  │   (Apollo)      │  │   (Express)     │  │  (Socket.io)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                 Business Logic Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │User Mgmt    │ │Auth Service │ │Supply Chain │ │Business     │ │
│  │Service      │ │             │ │Service      │ │Relationship │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │Transaction  │ │Communication│ │Analytics    │ │Audit &      │ │
│  │Service      │ │Service      │ │Service      │ │Compliance   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                 Integration Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │Event Bus    │ │Message      │ │File Storage │ │External     │ │
│  │(Redis       │ │Queue        │ │(AWS S3/     │ │APIs         │ │
│  │Streams)     │ │(Bull/Redis) │ │Cloudinary)  │ │(SendGrid)   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │PostgreSQL   │ │MongoDB      │ │Redis        │ │ClickHouse   │ │
│  │(ACID Data)  │ │(Flexible    │ │(Cache/      │ │(Analytics   │ │
│  │- Users      │ │Schema)      │ │Sessions/    │ │& Time       │ │
│  │- Transactions│ │- Field Ops  │ │Real-time)   │ │Series)      │ │
│  │- Relations  │ │- Tracking   │ │             │ │             │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │Container    │ │Load         │ │Monitoring   │ │Security     │ │
│  │Orchestration│ │Balancer     │ │& Logging    │ │& Auth       │ │
│  │(K8s/Docker) │ │(Nginx/ALB)  │ │(New Relic)  │ │(WAF/SSL)    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Principles

- **Polyglot Persistence**: Different databases for different use cases
- **API-First Design**: All services expose well-defined APIs
- **Event-Driven Architecture**: Loose coupling through events
- **Containerized Deployment**: Docker-based deployment strategy
- **Type Safety**: TypeScript throughout the stack
- **Real-Time Capabilities**: WebSocket and SSE for live updates
- **Scalable by Design**: Horizontal scaling capabilities

---

## Backend Technology Stack

### Core Runtime & Framework

#### Primary Runtime
**Node.js 20 LTS**
- **Rationale**: Excellent performance, large ecosystem, TypeScript support
- **Configuration**: 
  - ES2022 target
  - Native ESM modules
  - V8 engine optimizations

#### Web Frameworks

**Express.js 4.18+**
```javascript
// Primary framework for REST APIs
const express = require('express');
const app = express();

// Middleware stack
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
```

**Fastify 4.x** (High-Performance Services)
```javascript
// For analytics and real-time services
const fastify = require('fastify')({
  logger: true,
  trustProxy: true
});

// JSON Schema validation
fastify.addSchema({
  $id: 'user',
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' }
  }
});
```

### Programming Language

**TypeScript 5.2+**
```typescript
// Strict configuration
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### API Architecture

#### GraphQL Layer
**Apollo Server 4.x**
```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    ApolloServerPluginLandingPageLocalDefault({ embed: true })
  ]
});
```

**GraphQL Code Generator**
```yaml
# codegen.yml
generates:
  src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-resolvers
    config:
      useIndexSignature: true
      contextType: '../context#Context'
```

#### REST API Standards
**OpenAPI 3.0 Specification**
```yaml
openapi: 3.0.0
info:
  title: FarmTally API
  version: 1.0.0
paths:
  /api/v1/users:
    get:
      summary: Get users
      parameters:
        - name: role
          in: query
          schema:
            type: string
            enum: [farm_admin, field_manager, farmer]
```

### Microservices Communication

#### Service Mesh
**Consul Connect** or **Istio** (Production)
- Service discovery
- Load balancing
- Circuit breaker patterns
- Distributed tracing

#### Message Queuing
**Redis Streams**
```typescript
// Event publishing
await redis.xadd(
  'supply-chain-events',
  '*',
  'event', 'commodity_ready',
  'commodityId', commodityId,
  'farmId', farmId
);

// Event consumption
const events = await redis.xread(
  'STREAMS',
  'supply-chain-events',
  lastId
);
```

**Bull Queue** (Job Processing)
```typescript
import Queue from 'bull';

const emailQueue = new Queue('email processing', {
  redis: { port: 6379, host: '127.0.0.1' }
});

emailQueue.process('send-notification', async (job) => {
  const { userId, notificationType, data } = job.data;
  await sendNotification(userId, notificationType, data);
});
```

---

## Frontend Technology Stack

### Core Framework

#### React 18 with TypeScript
```typescript
// Modern React with Concurrent Features
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

#### Next.js 14 (Full-Stack Framework)
```typescript
// app/layout.tsx - App Router
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

// Server Components for data fetching
async function UserDashboard({ userId }: { userId: string }) {
  const user = await getUser(userId);
  return <DashboardContent user={user} />;
}
```

### UI Framework & Styling

#### Tailwind CSS 3.x
```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        farmtally: {
          green: '#22c55e',
          brown: '#a3a3a3',
        }
      }
    }
  }
} satisfies Config;
```

#### Shadcn/ui Component Library
```typescript
// components/ui/button.tsx
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### State Management

#### Zustand (Global State)
```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UserState {
  user: User | null;
  role: UserRole | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        role: null,
        setUser: (user) => set({ user, role: user.role }),
        clearUser: () => set({ user: null, role: null }),
      }),
      { name: 'user-storage' }
    )
  )
);
```

#### TanStack Query (Server State)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Data fetching
export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutations
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      queryClient.setQueryData(['user', data.id], data);
    },
  });
}
```

### Form Handling

#### React Hook Form with Zod Validation
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const registrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['farm_admin', 'field_manager', 'farmer']),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
  });

  const onSubmit = async (data: RegistrationForm) => {
    await registerUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

### Mobile Development (Future)

#### React Native with Expo
```typescript
// expo.json
{
  "expo": {
    "name": "FarmTally",
    "slug": "farmtally",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "orientation": "portrait"
  }
}

// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="FieldOperations" component={FieldOperationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Database Technology Stack

### Primary Databases

#### PostgreSQL 15+ (ACID Transactions)
```sql
-- Connection configuration
-- postgresql.conf
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Database per service pattern
CREATE DATABASE farmtally_users;
CREATE DATABASE farmtally_auth;
CREATE DATABASE farmtally_transactions;
CREATE DATABASE farmtally_relationships;
```

**Prisma ORM Configuration**
```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      UserRole
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum UserRole {
  APP_ADMIN
  FARM_ADMIN
  FIELD_MANAGER
  FARMER
  LORRY_AGENCY
  FIELD_EQUIPMENT_MANAGER
  INPUT_SUPPLIER
  DEALER
}
```

#### MongoDB 6+ (Flexible Schemas)
```typescript
// Mongoose schemas for flexible data
import mongoose from 'mongoose';

const fieldOperationSchema = new mongoose.Schema({
  fieldId: { type: String, required: true },
  operationType: {
    type: String,
    enum: ['planting', 'irrigation', 'fertilization', 'harvest'],
    required: true
  },
  operationDate: { type: Date, required: true },
  performedBy: { type: String, required: true },
  details: {
    equipment: [String],
    materials: [{
      name: String,
      quantity: Number,
      unit: String
    }],
    weather: {
      temperature: Number,
      humidity: Number,
      rainfall: Number
    },
    notes: String,
    photos: [String],
    gpsCoordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  results: {
    areaCompleted: Number,
    timeSpent: Number,
    costIncurred: Number,
    qualityRating: Number
  }
}, {
  timestamps: true,
  collection: 'field_operations'
});

export const FieldOperation = mongoose.model('FieldOperation', fieldOperationSchema);
```

#### Redis 7+ (Caching & Real-Time)
```typescript
import Redis from 'ioredis';

// Redis configuration
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Caching patterns
class CacheService {
  async set(key: string, value: any, ttl: number = 300) {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async invalidatePattern(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Session management
class SessionService {
  async createSession(userId: string, sessionData: any) {
    const sessionId = generateSessionId();
    await redis.setex(
      `session:${sessionId}`,
      3600, // 1 hour
      JSON.stringify({ userId, ...sessionData })
    );
    return sessionId;
  }

  async getSession(sessionId: string) {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

#### ClickHouse (Analytics - Optional)
```sql
-- Time-series analytics database
CREATE TABLE user_activity_events (
    event_id UUID,
    user_id String,
    event_type String,
    event_data String,
    timestamp DateTime64(3),
    date Date MATERIALIZED toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, timestamp);

-- Materialized views for real-time analytics
CREATE MATERIALIZED VIEW daily_user_activity
ENGINE = SummingMergeTree()
ORDER BY (date, user_id, event_type)
AS SELECT
    date,
    user_id,
    event_type,
    count() as event_count
FROM user_activity_events
GROUP BY date, user_id, event_type;
```

### Database Tools & Utilities

#### Migration Management
```typescript
// Prisma migrations
npx prisma migrate dev --name init
npx prisma generate
npx prisma db push

// Custom migration runner
class MigrationRunner {
  async runMigrations() {
    const migrations = await this.getPendingMigrations();
    
    for (const migration of migrations) {
      await this.runMigration(migration);
      await this.markMigrationComplete(migration);
    }
  }
}
```

#### Connection Pooling
```typescript
// PgBouncer configuration for PostgreSQL
// pgbouncer.ini
[databases]
farmtally_users = host=localhost port=5432 dbname=farmtally_users
farmtally_auth = host=localhost port=5432 dbname=farmtally_auth

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

---

## Authentication & Security Stack

### Authentication Services

#### Auth0 Integration
```typescript
import { Auth0Provider } from '@auth0/auth0-react';

// Auth0 configuration
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  authorizationParams: {
    redirect_uri: window.location.origin,
    scope: 'openid profile email'
  }
};

// Provider setup
function App() {
  return (
    <Auth0Provider {...auth0Config}>
      <Router>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </Router>
    </Auth0Provider>
  );
}
```

#### Magic Link Implementation
```typescript
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

class MagicLinkService {
  async generateMagicLink(email: string, purpose: 'login' | 'registration') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.storeMagicLink({
      token,
      email,
      purpose,
      expiresAt,
      used: false
    });

    const magicLink = `${process.env.FRONTEND_URL}/auth/magic?token=${token}`;
    await this.sendMagicLinkEmail(email, magicLink);

    return { token, expiresAt };
  }

  async verifyMagicLink(token: string) {
    const magicLink = await this.getMagicLink(token);
    
    if (!magicLink || magicLink.used || magicLink.expiresAt < new Date()) {
      throw new Error('Invalid or expired magic link');
    }

    await this.markMagicLinkUsed(token);
    
    const sessionToken = jwt.sign(
      { email: magicLink.email, purpose: magicLink.purpose },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    return { sessionToken, email: magicLink.email };
  }
}
```

#### OTP Implementation
```typescript
class OTPService {
  async generateOTP(identifier: string, method: 'email' | 'sms') {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.storeOTP({
      identifier,
      code,
      method,
      expiresAt,
      attempts: 0,
      verified: false
    });

    if (method === 'email') {
      await this.sendOTPEmail(identifier, code);
    } else {
      await this.sendOTPSMS(identifier, code);
    }

    return { expiresAt };
  }

  async verifyOTP(identifier: string, code: string) {
    const otp = await this.getOTP(identifier);
    
    if (!otp || otp.verified || otp.expiresAt < new Date()) {
      throw new Error('Invalid or expired OTP');
    }

    if (otp.attempts >= 3) {
      throw new Error('Too many attempts');
    }

    if (otp.code !== code) {
      await this.incrementOTPAttempts(identifier);
      throw new Error('Invalid OTP code');
    }

    await this.markOTPVerified(identifier);
    return true;
  }
}
```

### Security Middleware

#### JWT Authentication
```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = decoded as any;
    next();
  });
};
```

#### Role-Based Access Control
```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin';
type Resource = 'users' | 'farms' | 'fields' | 'transactions';

class RBACService {
  private rolePermissions: Record<string, Record<Resource, Permission[]>> = {
    'app_admin': {
      users: ['read', 'write', 'delete', 'admin'],
      farms: ['read', 'write', 'delete', 'admin'],
      fields: ['read', 'write', 'delete', 'admin'],
      transactions: ['read', 'write', 'delete', 'admin']
    },
    'farm_admin': {
      users: ['read'],
      farms: ['read', 'write'],
      fields: ['read', 'write'],
      transactions: ['read', 'write']
    },
    'field_manager': {
      users: ['read'],
      farms: ['read'],
      fields: ['read', 'write'],
      transactions: ['read']
    }
  };

  hasPermission(role: string, resource: Resource, permission: Permission): boolean {
    const rolePerms = this.rolePermissions[role];
    if (!rolePerms) return false;

    const resourcePerms = rolePerms[resource];
    if (!resourcePerms) return false;

    return resourcePerms.includes(permission);
  }

  checkPermission(role: string, resource: Resource, permission: Permission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!this.hasPermission(req.user.role, resource, permission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }
}
```

### Security Headers & Validation

#### Helmet.js Security Headers
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### Input Validation with Zod
```typescript
import { z } from 'zod';

// User registration validation
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['farm_admin', 'field_manager', 'farmer', 'lorry_agency', 'input_supplier', 'dealer']),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  profileData: z.record(z.any()).optional()
});

// Validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
};

// Usage
app.post('/api/users/register', 
  validateRequest(userRegistrationSchema),
  registerUser
);
```

---

## Communication & Real-Time Stack

### Real-Time Communication

#### Socket.io Implementation
```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

// Socket.io server setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Redis adapter for scaling
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Real-time events
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);

  // Join role-based rooms
  socket.join(`role:${socket.userRole}`);
  socket.join(`user:${socket.userId}`);

  // Field operation updates
  socket.on('field-operation-update', async (data) => {
    const { fieldId, operationData } = data;
    
    // Validate permissions
    if (await canUpdateField(socket.userId, fieldId)) {
      // Broadcast to relevant users
      socket.to(`field:${fieldId}`).emit('field-updated', {
        fieldId,
        operationData,
        updatedBy: socket.userId
      });
    }
  });

  // Supply chain tracking
  socket.on('tracking-update', (data) => {
    const { deliveryId, location, status } = data;
    
    // Broadcast to stakeholders
    socket.to(`delivery:${deliveryId}`).emit('delivery-tracking', {
      deliveryId,
      location,
      status,
      timestamp: new Date()
    });
  });
});
```

#### Server-Sent Events (SSE)
```typescript
import { Request, Response } from 'express';

class SSEService {
  private connections = new Map<string, Response>();

  setupSSE(req: Request, res: Response) {
    const userId = req.user!.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store connection
    this.connections.set(userId, res);

    // Send initial connection event
    this.sendEvent(res, 'connected', { userId, timestamp: new Date() });

    // Handle client disconnect
    req.on('close', () => {
      this.connections.delete(userId);
    });
  }

  sendEvent(res: Response, event: string, data: any) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  broadcastToUser(userId: string, event: string, data: any) {
    const connection = this.connections.get(userId);
    if (connection) {
      this.sendEvent(connection, event, data);
    }
  }

  broadcastToRole(role: string, event: string, data: any) {
    // Get all users with specific role and broadcast
    this.connections.forEach((connection, userId) => {
      // Check user role and send if matches
      if (this.getUserRole(userId) === role) {
        this.sendEvent(connection, event, data);
      }
    });
  }
}
```

### Notification Services

#### Email Service (SendGrid)
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

class EmailService {
  async sendMagicLink(email: string, magicLink: string) {
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL!,
      templateId: 'd-magic-link-template-id',
      dynamicTemplateData: {
        magic_link: magicLink,
        expires_in: '15 minutes'
      }
    };

    try {
      await sgMail.send(msg);
      console.log(`Magic link sent to ${email}`);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send magic link email');
    }
  }

  async sendNotification(email: string, type: string, data: any) {
    const templates = {
      'registration_approved': 'd-registration-approved-template',
      'delivery_scheduled': 'd-delivery-scheduled-template',
      'payment_received': 'd-payment-received-template'
    };

    const msg = {
      to: email,
      from: process.env.FROM_EMAIL!,
      templateId: templates[type],
      dynamicTemplateData: data
    };

    await sgMail.send(msg);
  }
}
```

#### SMS Service (Twilio)
```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

class SMSService {
  async sendOTP(phoneNumber: string, code: string) {
    try {
      const message = await client.messages.create({
        body: `Your FarmTally verification code is: ${code}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      console.log(`OTP sent to ${phoneNumber}: ${message.sid}`);
      return message.sid;
    } catch (error) {
      console.error('SMS sending failed:', error);
      throw new Error('Failed to send OTP SMS');
    }
  }

  async sendAlert(phoneNumber: string, alertMessage: string) {
    const message = await client.messages.create({
      body: `FarmTally Alert: ${alertMessage}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    return message.sid;
  }
}
```

#### Push Notifications (Firebase)
```typescript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

class PushNotificationService {
  async sendToUser(userId: string, notification: any) {
    const userTokens = await this.getUserDeviceTokens(userId);
    
    if (userTokens.length === 0) return;

    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      tokens: userTokens
    };

    try {
      const response = await admin.messaging().sendMulticast(message);
      console.log(`Push notification sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(response.responses, userTokens);
      }
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  async sendToRole(role: string, notification: any) {
    const roleUsers = await this.getUsersByRole(role);
    
    for (const userId of roleUsers) {
      await this.sendToUser(userId, notification);
    }
  }
}
```

---

## DevOps & Infrastructure Stack

### Containerization

#### Docker Configuration
```dockerfile
# Dockerfile for Node.js services
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN corepack enable pnpm && pnpm run build

# Production image, copy all the files and run the application
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "dist/index.js"]
```

#### Docker Compose for Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  # API Gateway
  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/farmtally_gateway
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./services/api-gateway:/app
      - /app/node_modules

  # User Management Service
  user-service:
    build:
      context: ./services/user-management
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/farmtally_users
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # Authentication Service
  auth-service:
    build:
      context: ./services/auth
      dockerfile: Dockerfile
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/farmtally_auth
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-jwt-secret
    depends_on:
      - postgres
      - redis

  # Supply Chain Service
  supply-chain-service:
    build:
      context: ./services/supply-chain
      dockerfile: Dockerfile
    ports:
      - "3003:3000"
    environment:
      - NODE_ENV=development
      - POSTGRES_URL=postgresql://postgres:password@postgres:5432/farmtally_supply_chain
      - MONGODB_URL=mongodb://mongo:27017/farmtally_supply_chain
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - mongo
      - redis

  # Frontend
  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "3100:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
      - NEXT_PUBLIC_WS_URL=ws://localhost:3000
    depends_on:
      - api-gateway

  # Databases
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=farmtally
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init-databases.sql

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

### Cloud Infrastructure

#### AWS Infrastructure (Terraform)
```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Configuration
resource "aws_vpc" "farmtally_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "farmtally-vpc"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "farmtally_cluster" {
  name = "farmtally-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "farmtally_postgres" {
  identifier     = "farmtally-postgres"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "farmtally"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.farmtally.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  
  tags = {
    Name = "farmtally-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "farmtally_redis" {
  name       = "farmtally-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "farmtally_redis" {
  cluster_id           = "farmtally-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.farmtally_redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

# Application Load Balancer
resource "aws_lb" "farmtally_alb" {
  name               = "farmtally-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "farmtally-alb"
  }
}
```

#### Kubernetes Deployment (Alternative)
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: farmtally

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: farmtally-config
  namespace: farmtally
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis-service"
  POSTGRES_HOST: "postgres-service"

---
# k8s/user-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: farmtally
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: farmtally/user-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: farmtally-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: farmtally-config
              key: REDIS_HOST
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/user-service-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: farmtally
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### CI/CD Pipeline

#### GitHub Actions
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: farmtally_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run linting
      run: pnpm run lint
    
    - name: Run type checking
      run: pnpm run type-check
    
    - name: Run tests
      run: pnpm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/farmtally_test
        REDIS_URL: redis://localhost:6379
    
    - name: Run E2E tests
      run: pnpm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/farmtally_test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Docker images
      run: |
        # Build all service images
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/user-service:${{ github.sha }} ./services/user-management
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/auth-service:${{ github.sha }} ./services/auth
        docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/supply-chain-service:${{ github.sha }} ./services/supply-chain
        
        # Push images
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/user-service:${{ github.sha }}
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/auth-service:${{ github.sha }}
        docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/supply-chain-service:${{ github.sha }}
    
    - name: Deploy to production
      run: |
        # Update Kubernetes deployments
        kubectl set image deployment/user-service user-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/user-service:${{ github.sha }} -n farmtally
        kubectl set image deployment/auth-service auth-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/auth-service:${{ github.sha }} -n farmtally
        kubectl set image deployment/supply-chain-service supply-chain-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/supply-chain-service:${{ github.sha }} -n farmtally
```

---

## Development Tools & Workflow

### Package Management

#### pnpm Configuration
```json
// package.json (root)
{
  "name": "farmtally",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "@farmtally/eslint-config": "workspace:*",
    "@farmtally/typescript-config": "workspace:*",
    "turbo": "^1.10.0"
  },
  "packageManager": "pnpm@8.6.0"
}

// pnpm-workspace.yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
```

#### Turborepo Configuration
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Code Quality Tools

#### ESLint Configuration
```javascript
// packages/eslint-config/index.js
module.exports = {
  extends: [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-const": "error",
    "prefer-const": "off",
    "no-var": "error"
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: {
        jest: true
      }
    }
  ]
};
```

#### Prettier Configuration
```javascript
// .prettierrc.js
module.exports = {
  semi: true,
  trailingComma: "es5",
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: "avoid",
  endOfLine: "lf"
};
```

#### Husky Git Hooks
```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
pnpm run type-check
```

### Testing Framework

#### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']
};
```

#### Test Examples
```typescript
// src/services/user.service.test.ts
import { UserService } from './user.service';
import { prismaMock } from '../test/prisma-mock';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(prismaMock);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'FARM_ADMIN' as const
      };

      const expectedUser = {
        id: 'user-123',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prismaMock.user.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: userData
      });
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        fullName: 'Test User',
        role: 'FARM_ADMIN' as const
      };

      prismaMock.user.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(userService.createUser(userData))
        .rejects.toThrow('Unique constraint violation');
    });
  });
});
```

#### E2E Testing with Playwright
```typescript
// tests/e2e/user-registration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should complete registration flow successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=name-input]', 'Test User');
    await page.selectOption('[data-testid=role-select]', 'farm_admin');

    // Submit form
    await page.click('[data-testid=submit-button]');

    // Verify success message
    await expect(page.locator('[data-testid=success-message]'))
      .toContainText('Registration request submitted successfully');

    // Verify redirect to pending approval page
    await expect(page).toHaveURL('/registration/pending');
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.click('[data-testid=submit-button]');

    // Verify validation errors
    await expect(page.locator('[data-testid=email-error]'))
      .toContainText('Email is required');
    await expect(page.locator('[data-testid=name-error]'))
      .toContainText('Name is required');
  });
});
```

This comprehensive tech stack document provides the foundation for building FarmTally with modern, scalable technologies that support your complex agricultural supply chain management requirements across all eight user roles.

---

## Monitoring & Observability Stack

### Application Performance Monitoring

#### New Relic Integration
```typescript
// newrelic.js
'use strict'

exports.config = {
  app_name: ['FarmTally API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: {
    enabled: true
  },
  logging: {
    level: 'info'
  },
  application_logging: {
    forwarding: {
      enabled: true
    }
  }
}

// Custom metrics
import newrelic from 'newrelic';

class MetricsService {
  recordCustomMetric(name: string, value: number) {
    newrelic.recordMetric(name, value);
  }

  recordUserRegistration(role: string) {
    newrelic.recordMetric(`Custom/UserRegistration/${role}`, 1);
  }

  recordSupplyChainEvent(eventType: string) {
    newrelic.recordMetric(`Custom/SupplyChain/${eventType}`, 1);
  }

  addCustomAttributes(attributes: Record<string, string | number>) {
    newrelic.addCustomAttributes(attributes);
  }
}
```

#### Sentry Error Tracking
```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});

// Custom error handling
class ErrorHandler {
  static captureException(error: Error, context?: any) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext('additional_info', context);
      }
      Sentry.captureException(error);
    });
  }

  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(message, level);
  }

  static setUser(user: { id: string; email: string; role: string }) {
    Sentry.setUser(user);
  }
}

// Express error middleware
export const sentryErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
};
```

### Logging Infrastructure

#### Winston Logger Configuration
```typescript
import winston from 'winston';
import 'winston-daily-rotate-file';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: process.env.SERVICE_NAME || 'farmtally-api' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for production
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    
    // Error file transport
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Structured logging helpers
export class Logger {
  static info(message: string, meta?: any) {
    logger.info(message, meta);
  }

  static error(message: string, error?: Error, meta?: any) {
    logger.error(message, { error: error?.stack, ...meta });
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, meta);
  }

  static debug(message: string, meta?: any) {
    logger.debug(message, meta);
  }

  // Business-specific logging
  static logUserAction(userId: string, action: string, details?: any) {
    logger.info('User action', {
      userId,
      action,
      details,
      category: 'user_activity'
    });
  }

  static logSupplyChainEvent(eventType: string, data: any) {
    logger.info('Supply chain event', {
      eventType,
      data,
      category: 'supply_chain'
    });
  }

  static logSecurityEvent(event: string, userId?: string, details?: any) {
    logger.warn('Security event', {
      event,
      userId,
      details,
      category: 'security'
    });
  }
}
```

### Health Checks & Monitoring

#### Health Check Endpoints
```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    external_apis: 'up' | 'down';
  };
  uptime: number;
}

class HealthCheckService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      external_apis: await this.checkExternalAPIs()
    };

    const allHealthy = Object.values(checks).every(status => status === 'up');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      checks,
      uptime: process.uptime()
    };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      Logger.error('Database health check failed', error);
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      await this.redis.ping();
      return 'up';
    } catch (error) {
      Logger.error('Redis health check failed', error);
      return 'down';
    }
  }

  private async checkExternalAPIs(): Promise<'up' | 'down'> {
    try {
      // Check critical external services
      const promises = [
        this.checkSendGrid(),
        this.checkTwilio(),
        // Add other external service checks
      ];

      const results = await Promise.allSettled(promises);
      const allSuccessful = results.every(result => result.status === 'fulfilled');
      
      return allSuccessful ? 'up' : 'down';
    } catch (error) {
      Logger.error('External API health check failed', error);
      return 'down';
    }
  }

  private async checkSendGrid(): Promise<void> {
    // Implement SendGrid health check
  }

  private async checkTwilio(): Promise<void> {
    // Implement Twilio health check
  }
}

// Health check endpoints
export const healthCheckRoutes = (healthCheckService: HealthCheckService) => {
  const router = express.Router();

  // Liveness probe
  router.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness probe
  router.get('/health/ready', async (req: Request, res: Response) => {
    try {
      const healthCheck = await healthCheckService.performHealthCheck();
      const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthCheck);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};
```

### Metrics Collection

#### Prometheus Metrics
```typescript
import promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
  labelNames: ['role']
});

const supplyChainEvents = new promClient.Counter({
  name: 'supply_chain_events_total',
  help: 'Total number of supply chain events',
  labelNames: ['event_type', 'status']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeUsers);
register.registerMetric(supplyChainEvents);

// Middleware for HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
};

// Metrics endpoint
export const metricsEndpoint = (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
};

// Business metrics helpers
export class BusinessMetrics {
  static recordUserRegistration(role: string) {
    // Custom metric for user registrations
    const userRegistrations = new promClient.Counter({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['role']
    });
    
    userRegistrations.labels(role).inc();
  }

  static updateActiveUsers(role: string, count: number) {
    activeUsers.labels(role).set(count);
  }

  static recordSupplyChainEvent(eventType: string, status: 'success' | 'failure') {
    supplyChainEvents.labels(eventType, status).inc();
  }
}
```

---

## Third-Party Services & Integrations

### Email Service Integration

#### SendGrid Configuration
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailTemplate {
  templateId: string;
  subject: string;
  dynamicTemplateData?: Record<string, any>;
}

class EmailService {
  private templates: Record<string, EmailTemplate> = {
    magic_link: {
      templateId: 'd-magic-link-template-id',
      subject: 'Your FarmTally Login Link'
    },
    registration_approved: {
      templateId: 'd-registration-approved-template-id',
      subject: 'Welcome to FarmTally - Registration Approved'
    },
    delivery_notification: {
      templateId: 'd-delivery-notification-template-id',
      subject: 'Delivery Update - FarmTally'
    },
    payment_confirmation: {
      templateId: 'd-payment-confirmation-template-id',
      subject: 'Payment Confirmation - FarmTally'
    }
  };

  async sendTemplatedEmail(
    to: string,
    templateKey: string,
    dynamicData?: Record<string, any>
  ) {
    const template = this.templates[templateKey];
    if (!template) {
      throw new Error(`Email template '${templateKey}' not found`);
    }

    const msg = {
      to,
      from: {
        email: process.env.FROM_EMAIL!,
        name: 'FarmTally'
      },
      templateId: template.templateId,
      dynamicTemplateData: {
        ...template.dynamicTemplateData,
        ...dynamicData
      }
    };

    try {
      const response = await sgMail.send(msg);
      Logger.info('Email sent successfully', {
        to,
        templateKey,
        messageId: response[0].headers['x-message-id']
      });
      return response[0].headers['x-message-id'];
    } catch (error) {
      Logger.error('Email sending failed', error, { to, templateKey });
      throw new Error('Failed to send email');
    }
  }

  async sendBulkEmails(emails: Array<{
    to: string;
    templateKey: string;
    dynamicData?: Record<string, any>;
  }>) {
    const messages = emails.map(email => {
      const template = this.templates[email.templateKey];
      return {
        to: email.to,
        from: {
          email: process.env.FROM_EMAIL!,
          name: 'FarmTally'
        },
        templateId: template.templateId,
        dynamicTemplateData: email.dynamicData
      };
    });

    try {
      const response = await sgMail.send(messages);
      Logger.info('Bulk emails sent successfully', {
        count: emails.length,
        messageIds: response.map(r => r.headers['x-message-id'])
      });
      return response;
    } catch (error) {
      Logger.error('Bulk email sending failed', error);
      throw new Error('Failed to send bulk emails');
    }
  }
}
```

### SMS Service Integration

#### Twilio Configuration
```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

class SMSService {
  private fromNumber = process.env.TWILIO_PHONE_NUMBER!;

  async sendSMS(to: string, message: string) {
    try {
      const result = await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      Logger.info('SMS sent successfully', {
        to,
        messageId: result.sid,
        status: result.status
      });

      return result.sid;
    } catch (error) {
      Logger.error('SMS sending failed', error, { to });
      throw new Error('Failed to send SMS');
    }
  }

  async sendOTP(phoneNumber: string, code: string) {
    const message = `Your FarmTally verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendAlert(phoneNumber: string, alertType: string, details: string) {
    const message = `FarmTally Alert [${alertType}]: ${details}`;
    return this.sendSMS(phoneNumber, message);
  }

  async getMessageStatus(messageSid: string) {
    try {
      const message = await client.messages(messageSid).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      Logger.error('Failed to fetch message status', error, { messageSid });
      throw new Error('Failed to fetch message status');
    }
  }
}
```

### File Storage Integration

#### AWS S3 Configuration
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

class FileStorageService {
  private bucketName = process.env.S3_BUCKET_NAME!;

  // Multer configuration for direct S3 upload
  getMulterS3Config() {
    return multer({
      storage: multerS3({
        s3: s3Client,
        bucket: this.bucketName,
        metadata: (req, file, cb) => {
          cb(null, {
            fieldName: file.fieldname,
            uploadedBy: req.user?.id || 'anonymous'
          });
        },
        key: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const key = `uploads/${req.user?.id}/${uniqueSuffix}-${file.originalname}`;
          cb(null, key);
        }
      }),
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow images and documents
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    });
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });

    try {
      const result = await s3Client.send(command);
      Logger.info('File uploaded to S3', { key, etag: result.ETag });
      return {
        key,
        url: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        etag: result.ETag
      };
    } catch (error) {
      Logger.error('S3 upload failed', error, { key });
      throw new Error('File upload failed');
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    try {
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      Logger.error('Failed to generate signed URL', error, { key });
      throw new Error('Failed to generate download URL');
    }
  }

  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    try {
      await s3Client.send(command);
      Logger.info('File deleted from S3', { key });
    } catch (error) {
      Logger.error('S3 delete failed', error, { key });
      throw new Error('File deletion failed');
    }
  }
}
```

### Payment Integration (Future)

#### Stripe Configuration
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

class PaymentService {
  async createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, string>) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      });

      Logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      Logger.error('Payment intent creation failed', error);
      throw new Error('Failed to create payment intent');
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        Logger.info('Payment confirmed', { paymentIntentId });
        return {
          status: 'succeeded',
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency
        };
      }

      return { status: paymentIntent.status };
    } catch (error) {
      Logger.error('Payment confirmation failed', error, { paymentIntentId });
      throw new Error('Failed to confirm payment');
    }
  }

  async handleWebhook(payload: string, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);

      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await this.handleSuccessfulPayment(paymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          await this.handleFailedPayment(failedPayment);
          break;
        
        default:
          Logger.info('Unhandled webhook event', { type: event.type });
      }

      return { received: true };
    } catch (error) {
      Logger.error('Webhook handling failed', error);
      throw new Error('Webhook handling failed');
    }
  }

  private async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
    // Update transaction status in database
    // Send confirmation notifications
    Logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
  }

  private async handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
    // Handle failed payment
    // Send failure notifications
    Logger.error('Payment failed', null, { paymentIntentId: paymentIntent.id });
  }
}
```

---

## Performance & Scalability Considerations

### Caching Strategy

#### Multi-Level Caching
```typescript
import Redis from 'ioredis';
import NodeCache from 'node-cache';

// L1 Cache: In-memory (Node Cache)
const memoryCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 1000
});

// L2 Cache: Redis
const redisCache = new Redis(process.env.REDIS_URL!);

class CacheService {
  // L1 Cache methods
  async getFromMemory<T>(key: string): Promise<T | null> {
    const value = memoryCache.get<T>(key);
    return value || null;
  }

  async setInMemory<T>(key: string, value: T, ttl?: number): Promise<void> {
    memoryCache.set(key, value, ttl);
  }

  // L2 Cache methods
  async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await redisCache.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      Logger.error('Redis get failed', error, { key });
      return null;
    }
  }

  async setInRedis<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      await redisCache.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      Logger.error('Redis set failed', error, { key });
    }
  }

  // Multi-level cache strategy
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    let value = await this.getFromMemory<T>(key);
    if (value) {
      return value;
    }

    // Try L2 cache
    value = await this.getFromRedis<T>(key);
    if (value) {
      // Populate L1 cache
      await this.setInMemory(key, value);
      return value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // Set in both caches
    await Promise.all([
      this.setInMemory(key, value, Math.min(ttl, 300)), // Max 5 minutes in memory
      this.setInRedis(key, value, ttl)
    ]);
  }

  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    memoryCache.flushAll();

    // Clear Redis cache
    try {
      const keys = await redisCache.keys(pattern);
      if (keys.length > 0) {
        await redisCache.del(...keys);
      }
    } catch (error) {
      Logger.error('Cache invalidation failed', error, { pattern });
    }
  }

  // Cache-aside pattern
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    let value = await this.get<T>(key);
    
    if (value === null) {
      value = await fetchFunction();
      await this.set(key, value, ttl);
    }
    
    return value;
  }
}

// Usage examples
const cacheService = new CacheService();

// Cache user data
async function getUser(userId: string) {
  return cacheService.getOrSet(
    `user:${userId}`,
    () => userService.findById(userId),
    1800 // 30 minutes
  );
}

// Cache dashboard data
async function getDashboardData(userId: string, role: string) {
  return cacheService.getOrSet(
    `dashboard:${role}:${userId}`,
    () => dashboardService.generateDashboard(userId, role),
    300 // 5 minutes
  );
}
```

### Database Optimization

#### Connection Pooling
```typescript
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

// PostgreSQL connection pool
const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of connections
  min: 5,  // Minimum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Prisma with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}?connection_limit=20&pool_timeout=20`
    }
  }
});

// Query optimization helpers
class DatabaseOptimizer {
  // Batch operations
  async batchInsert<T>(tableName: string, records: T[], batchSize: number = 1000) {
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    const results = [];
    for (const batch of batches) {
      const result = await prisma[tableName].createMany({
        data: batch,
        skipDuplicates: true
      });
      results.push(result);
    }

    return results;
  }

  // Pagination with cursor
  async paginateWithCursor<T>(
    model: any,
    cursor?: string,
    take: number = 20,
    where?: any
  ) {
    const items = await model.findMany({
      take: take + 1, // Take one extra to check if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      where,
      orderBy: { id: 'asc' }
    });

    const hasNextPage = items.length > take;
    const edges = hasNextPage ? items.slice(0, -1) : items;
    const nextCursor = hasNextPage ? edges[edges.length - 1].id : null;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        nextCursor
      }
    };
  }

  // Optimized search with full-text search
  async searchUsers(query: string, filters?: any) {
    return prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          },
          filters
        ]
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      },
      take: 50
    });
  }
}
```

### Load Balancing & Scaling

#### Horizontal Scaling Configuration
```typescript
// Load balancer configuration (nginx.conf)
/*
upstream farmtally_api {
    least_conn;
    server api-1:3000 weight=3;
    server api-2:3000 weight=3;
    server api-3:3000 weight=2;
    keepalive 32;
}

server {
    listen 80;
    server_name api.farmtally.com;

    location / {
        proxy_pass http://farmtally_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
}

# Rate limiting configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
*/

// Application-level rate limiting
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const limiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisCache.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Different limits for different endpoints
const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisCache.call(...args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // Stricter limit for auth endpoints
  skipSuccessfulRequests: true,
});

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);
```

### Performance Monitoring

#### Custom Performance Metrics
```typescript
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure function execution time
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }

  // Record custom metrics
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 measurements
    if (values.length > 1000) {
      values.shift();
    }

    // Send to monitoring service
    BusinessMetrics.recordCustomMetric(name, value);
  }

  // Get performance statistics
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // Performance middleware
  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = performance.now();
      
      res.on('finish', () => {
        const duration = performance.now() - start;
        const route = req.route?.path || req.path;
        this.recordMetric(`http_${req.method.toLowerCase()}_${route}`, duration);
      });
      
      next();
    };
  }
}

// Usage
const monitor = PerformanceMonitor.getInstance();

// Measure database operations
async function getUserWithMetrics(userId: string) {
  return monitor.measureAsync('db_get_user', async () => {
    return await userService.findById(userId);
  });
}

// Measure API endpoints
app.use(monitor.createMiddleware());
```

---

## Security & Compliance Stack

### Data Protection & Privacy

#### GDPR Compliance Implementation
```typescript
interface DataSubject {
  id: string;
  email: string;
  consentGiven: boolean;
  consentDate?: Date;
  dataProcessingPurposes: string[];
}

class GDPRComplianceService {
  // Right to be informed
  async recordConsent(userId: string, purposes: string[]) {
    await prisma.dataConsent.create({
      data: {
        userId,
        purposes,
        consentGiven: true,
        consentDate: new Date(),
        ipAddress: this.getCurrentIP(),
        userAgent: this.getCurrentUserAgent()
      }
    });

    Logger.info('GDPR consent recorded', { userId, purposes });
  }

  // Right of access
  async exportUserData(userId: string): Promise<any> {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        sessions: true,
        notifications: true,
        // Include all related data
      }
    });

    // Anonymize sensitive data for export
    const exportData = {
      personalData: {
        email: userData?.email,
        fullName: userData?.fullName,
        role: userData?.role,
        createdAt: userData?.createdAt
      },
      activityData: {
        loginHistory: userData?.sessions?.map(s => ({
          loginDate: s.createdAt,
          ipAddress: this.anonymizeIP(s.ipAddress)
        })),
        notifications: userData?.notifications?.length
      }
    };

    Logger.info('User data exported', { userId });
    return exportData;
  }

  // Right to erasure (Right to be forgotten)
  async deleteUserData(userId: string, reason: string) {
    // Soft delete approach - anonymize instead of hard delete
    await prisma.$transaction(async (tx) => {
      // Anonymize user data
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${Date.now()}@anonymized.local`,
          fullName: 'Deleted User',
          deletedAt: new Date(),
          deletionReason: reason
        }
      });

      // Delete or anonymize related data
      await tx.userSession.deleteMany({
        where: { userId }
      });

      await tx.notification.updateMany({
        where: { recipientId: userId },
        data: {
          recipientId: 'anonymized'
        }
      });
    });

    Logger.info('User data deleted/anonymized', { userId, reason });
  }

  // Data portability
  async generateDataPortabilityExport(userId: string) {
    const userData = await this.exportUserData(userId);
    
    // Convert to standard format (JSON, CSV, etc.)
    const exportPackage = {
      exportDate: new Date().toISOString(),
      dataSubject: userId,
      format: 'JSON',
      data: userData
    };

    // Store export file temporarily
    const exportId = await this.storeExportFile(exportPackage);
    
    // Send download link to user
    await this.sendExportNotification(userId, exportId);

    return exportId;
  }

  private anonymizeIP(ip: string): string {
    // Anonymize last octet of IP address
    return ip.replace(/\.\d+$/, '.xxx');
  }

  private getCurrentIP(): string {
    // Get current request IP
    return 'implementation-specific';
  }

  private getCurrentUserAgent(): string {
    // Get current request user agent
    return 'implementation-specific';
  }

  private async storeExportFile(data: any): Promise<string> {
    // Store export file securely
    return 'export-id';
  }

  private async sendExportNotification(userId: string, exportId: string) {
    // Send notification with download link
  }
}
```

#### Data Encryption
```typescript
import crypto from 'crypto';
import bcrypt from 'bcrypt';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private secretKey = process.env.ENCRYPTION_KEY!;

  // Encrypt sensitive data
  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    cipher.setAAD(Buffer.from('farmtally', 'utf8'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  // Decrypt sensitive data
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    decipher.setAAD(Buffer.from('farmtally', 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Hash passwords
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify passwords
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate secure tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive identifiers (for anonymization)
  hashIdentifier(identifier: string): string {
    return crypto.createHash('sha256').update(identifier).digest('hex');
  }
}

// Database field encryption
class EncryptedField {
  constructor(private encryptionService: EncryptionService) {}

  // Prisma middleware for automatic encryption/decryption
  createPrismaMiddleware() {
    return async (params: any, next: any) => {
      // Encrypt before write operations
      if (['create', 'update', 'upsert'].includes(params.action)) {
        if (params.args.data) {
          params.args.data = this.encryptSensitiveFields(params.args.data);
        }
      }

      const result = await next(params);

      // Decrypt after read operations
      if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
        if (Array.isArray(result)) {
          return result.map(item => this.decryptSensitiveFields(item));
        } else if (result) {
          return this.decryptSensitiveFields(result);
        }
      }

      return result;
    };
  }

  private encryptSensitiveFields(data: any): any {
    const sensitiveFields = ['ssn', 'taxId', 'bankAccount'];
    const encrypted = { ...data };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encryptionService.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  private decryptSensitiveFields(data: any): any {
    const sensitiveFields = ['ssn', 'taxId', 'bankAccount'];
    const decrypted = { ...data };

    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'object') {
        try {
          decrypted[field] = this.encryptionService.decrypt(decrypted[field]);
        } catch (error) {
          Logger.error('Decryption failed', error, { field });
          decrypted[field] = '[ENCRYPTED]';
        }
      }
    }

    return decrypted;
  }
}
```

### Security Audit & Compliance

#### Security Audit Logging
```typescript
interface SecurityEvent {
  eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'permission_denied' | 'data_access' | 'data_modification';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  resource?: string;
  action?: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
}

class SecurityAuditService {
  async logSecurityEvent(event: SecurityEvent) {
    // Store in audit database
    await prisma.securityAuditLog.create({
      data: {
        eventType: event.eventType,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resource: event.resource,
        action: event.action,
        success: event.success,
        details: event.details,
        timestamp: event.timestamp
      }
    });

    // Send to SIEM system if critical
    if (this.isCriticalEvent(event)) {
      await this.sendToSIEM(event);
    }

    // Trigger alerts for suspicious activity
    await this.checkForSuspiciousActivity(event);
  }

  private isCriticalEvent(event: SecurityEvent): boolean {
    const criticalEvents = ['permission_denied', 'login_failure'];
    return criticalEvents.includes(event.eventType) || !event.success;
  }

  private async sendToSIEM(event: SecurityEvent) {
    // Send to Security Information and Event Management system
    Logger.warn('Critical security event', event);
  }

  private async checkForSuspiciousActivity(event: SecurityEvent) {
    if (event.eventType === 'login_failure') {
      const recentFailures = await this.getRecentLoginFailures(event.ipAddress);
      
      if (recentFailures >= 5) {
        await this.triggerSecurityAlert('Multiple login failures', {
          ipAddress: event.ipAddress,
          failureCount: recentFailures
        });
      }
    }
  }

  private async getRecentLoginFailures(ipAddress: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await prisma.securityAuditLog.count({
      where: {
        eventType: 'login_failure',
        ipAddress,
        timestamp: {
          gte: oneHourAgo
        }
      }
    });

    return count;
  }

  private async triggerSecurityAlert(alertType: string, details: any) {
    Logger.warn('Security alert triggered', { alertType, details });
    
    // Send alert to security team
    // Implement rate limiting to prevent alert spam
  }

  // Compliance reporting
  async generateComplianceReport(startDate: Date, endDate: Date) {
    const auditLogs = await prisma.securityAuditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    const report = {
      reportPeriod: { startDate, endDate },
      totalEvents: auditLogs.length,
      eventsByType: this.groupEventsByType(auditLogs),
      securityIncidents: auditLogs.filter(log => !log.success),
      topUsers: this.getTopUsersByActivity(auditLogs),
      topIPs: this.getTopIPsByActivity(auditLogs)
    };

    return report;
  }

  private groupEventsByType(logs: any[]) {
    return logs.reduce((acc, log) => {
      acc[log.eventType] = (acc[log.eventType] || 0) + 1;
      return acc;
    }, {});
  }

  private getTopUsersByActivity(logs: any[]) {
    const userActivity = logs.reduce((acc, log) => {
      if (log.userId) {
        acc[log.userId] = (acc[log.userId] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(userActivity)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10);
  }

  private getTopIPsByActivity(logs: any[]) {
    const ipActivity = logs.reduce((acc, log) => {
      acc[log.ipAddress] = (acc[log.ipAddress] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(ipActivity)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10);
  }
}

// Security middleware
export const securityAuditMiddleware = (auditService: SecurityAuditService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the request after response
      auditService.logSecurityEvent({
        eventType: req.method === 'GET' ? 'data_access' : 'data_modification',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        resource: req.path,
        action: req.method,
        success: res.statusCode < 400,
        timestamp: new Date()
      });

      return originalSend.call(this, data);
    };

    next();
  };
};
```

This comprehensive tech stack specification provides FarmTally with a robust, scalable, and secure foundation that supports all the complex requirements of your agricultural supply chain management platform across all eight user roles.
