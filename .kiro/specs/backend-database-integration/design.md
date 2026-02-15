# Backend and Database Integration - Design Document

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Assessment   │  │ Auth Pages   │  │ History      │     │
│  │ Components   │  │ (Login/Reg)  │  │ Dashboard    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  API Client    │                       │
│                    │  (fetch/axios) │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTP/JSON
                             │
┌────────────────────────────▼──────────────────────────────┐
│              Backend API (Next.js API Routes)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Auth Routes  │  │ Assessment   │  │ User Routes  │   │
│  │ /api/auth/*  │  │ Routes       │  │ /api/user/*  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            │                               │
│                    ┌───────▼────────┐                     │
│                    │  Middleware    │                     │
│                    │  (Auth, CORS)  │                     │
│                    └───────┬────────┘                     │
│                            │                               │
│                    ┌───────▼────────┐                     │
│                    │  Service Layer │                     │
│                    │  (Business     │                     │
│                    │   Logic)       │                     │
│                    └───────┬────────┘                     │
│                            │                               │
│                    ┌───────▼────────┐                     │
│                    │  Database      │                     │
│                    │  Access Layer  │                     │
│                    └───────┬────────┘                     │
└────────────────────────────┼──────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  SQLite DB      │
                    │  (inquire.db)   │
                    └─────────────────┘
```

### 1.2 Technology Decisions

**Database:** SQLite with `better-sqlite3`
- Rationale: Simple deployment, no separate DB server, sufficient for single-server apps
- File-based, easy backups
- ACID compliant
- Migration path to PostgreSQL if needed

**ORM:** Drizzle ORM
- Rationale: TypeScript-first, lightweight, SQL-like syntax
- Better performance than Prisma for SQLite
- Type-safe queries
- Simple migrations

**Authentication:** Custom JWT-based auth
- Rationale: Full control, no external dependencies
- JWT tokens in httpOnly cookies
- Refresh token pattern
- Simple to implement with `jose` library

**API Framework:** Next.js API Routes (App Router)
- Rationale: Already using Next.js, no additional server needed
- Serverless-ready
- TypeScript support
- Easy deployment

## 2. Database Schema

### 2.1 Schema Design (Drizzle ORM)

```typescript
// lib/db/schema.ts

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
}))

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  
  // Speech data
  speechDuration: integer('speech_duration'),
  speechWords: text('speech_words', { mode: 'json' }).$type<string[]>(),
  speechLetter: text('speech_letter'),
  speechRepeatWords: text('speech_repeat_words', { mode: 'json' })
    .$type<Record<string, number>>(),
  speechWasSkipped: integer('speech_was_skipped', { mode: 'boolean' }),
  speechRestartCount: integer('speech_restart_count'),
  
  // Hand data
  handStability: integer('hand_stability'),
  handSamples: integer('hand_samples'),
  handPositions: text('hand_positions', { mode: 'json' })
    .$type<Array<{ x: number; y: number }>>(),
  handVarianceX: integer('hand_variance_x'),
  handVarianceY: integer('hand_variance_y'),
  handWasSkipped: integer('hand_was_skipped', { mode: 'boolean' }),
  handRestartCount: integer('hand_restart_count'),
  
  // Eye data
  eyeSmoothness: integer('eye_smoothness'),
  eyeSamples: integer('eye_samples'),
  eyeDeltas: text('eye_deltas', { mode: 'json' }).$type<number[]>(),
  eyeMeanDelta: integer('eye_mean_delta'),
  eyeMaxDelta: integer('eye_max_delta'),
  eyeGazeOnTarget: integer('eye_gaze_on_target'),
  eyeWasSkipped: integer('eye_was_skipped', { mode: 'boolean' }),
  eyeRestartCount: integer('eye_restart_count'),
  
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId),
  timestampIdx: index('timestamp_idx').on(table.timestamp),
  userTimestampIdx: index('user_timestamp_idx').on(table.userId, table.timestamp),
}))

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  tokenIdx: index('token_idx').on(table.token),
  userIdIdx: index('refresh_user_id_idx').on(table.userId),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Assessment = typeof assessments.$inferSelect
export type NewAssessment = typeof assessments.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
```

### 2.2 Schema Rationale

**Normalized vs Denormalized:**
- Assessments table is denormalized (all data in one table)
- Rationale: Assessment data is always retrieved as a complete unit
- Simplifies queries and improves read performance
- JSON columns for complex nested data (positions, deltas)

**Indexes:**
- `user_id` + `timestamp` composite index for efficient history queries
- Email index for fast login lookups
- Token index for refresh token validation

**Data Types:**
- Text for IDs (UUIDs as strings)
- Integer for timestamps (Unix milliseconds)
- Integer for booleans (SQLite doesn't have native boolean)
- JSON text for arrays and objects

## 3. API Design

### 3.1 Authentication Endpoints

**POST /api/auth/register**
```typescript
Request:
{
  email: string
  password: string (min 8 chars)
}

Response: 201 Created
{
  user: {
    id: string
    email: string
    createdAt: string
  }
  accessToken: string (in httpOnly cookie)
}

Errors:
- 400: Invalid email/password format
- 409: Email already exists
```

**POST /api/auth/login**
```typescript
Request:
{
  email: string
  password: string
}

Response: 200 OK
{
  user: {
    id: string
    email: string
  }
  accessToken: string (in httpOnly cookie)
}

Errors:
- 400: Missing credentials
- 401: Invalid credentials
```

**POST /api/auth/logout**
```typescript
Request: (authenticated)

Response: 200 OK
{
  message: "Logged out successfully"
}
```

**POST /api/auth/refresh**
```typescript
Request: (refresh token in cookie)

Response: 200 OK
{
  accessToken: string (new token in httpOnly cookie)
}

Errors:
- 401: Invalid or expired refresh token
```

### 3.2 Assessment Endpoints

**GET /api/assessments**
```typescript
Request: (authenticated)
Query params:
  - limit?: number (default 50, max 100)
  - offset?: number (default 0)
  - startDate?: ISO string
  - endDate?: ISO string

Response: 200 OK
{
  assessments: Assessment[]
  total: number
  hasMore: boolean
}
```

**GET /api/assessments/:id**
```typescript
Request: (authenticated)

Response: 200 OK
{
  assessment: Assessment
}

Errors:
- 404: Assessment not found
- 403: Not authorized to access this assessment
```

**POST /api/assessments**
```typescript
Request: (authenticated)
{
  timestamp: number
  results: {
    speech: SpeechData | null
    hand: HandData | null
    eye: EyeData | null
  }
}

Response: 201 Created
{
  assessment: Assessment
}

Errors:
- 400: Invalid assessment data
```

**DELETE /api/assessments/:id**
```typescript
Request: (authenticated)

Response: 204 No Content

Errors:
- 404: Assessment not found
- 403: Not authorized to delete this assessment
```

### 3.3 User Endpoints

**GET /api/user/me**
```typescript
Request: (authenticated)

Response: 200 OK
{
  user: {
    id: string
    email: string
    createdAt: string
  }
}
```

**PATCH /api/user/me**
```typescript
Request: (authenticated)
{
  email?: string
  currentPassword?: string
  newPassword?: string
}

Response: 200 OK
{
  user: {
    id: string
    email: string
  }
}

Errors:
- 400: Invalid data
- 401: Current password incorrect
```

**DELETE /api/user/me**
```typescript
Request: (authenticated)
{
  password: string (confirmation)
}

Response: 204 No Content

Errors:
- 401: Password incorrect
```

**GET /api/user/export**
```typescript
Request: (authenticated)

Response: 200 OK
{
  user: User
  assessments: Assessment[]
  exportedAt: string
}
```

### 3.4 PDF Generation Endpoint

**POST /api/pdf/generate**
```typescript
Request: (authenticated)
{
  assessmentIds: string[]
  patientName?: string
  patientDOB?: string
  doctorName?: string
  notes?: string
}

Response: 200 OK
Content-Type: application/pdf
(PDF file as binary)

Errors:
- 400: Invalid assessment IDs
- 403: Not authorized to access assessments
- 404: One or more assessments not found
```

### 3.5 Migration Endpoint

**POST /api/migrate/localStorage**
```typescript
Request: (authenticated)
{
  assessments: StoredAssessment[] (from localStorage)
}

Response: 200 OK
{
  migrated: number
  failed: number
  errors?: string[]
}

Errors:
- 400: Invalid data format
```

## 4. Service Layer Architecture

### 4.1 Directory Structure

```
lib/
├── db/
│   ├── index.ts           # Database connection
│   ├── schema.ts          # Drizzle schema
│   └── migrations/        # SQL migrations
├── services/
│   ├── auth.service.ts    # Authentication logic
│   ├── user.service.ts    # User management
│   ├── assessment.service.ts  # Assessment CRUD
│   └── pdf.service.ts     # PDF generation
├── middleware/
│   ├── auth.middleware.ts # JWT verification
│   └── error.middleware.ts # Error handling
├── utils/
│   ├── jwt.ts             # JWT utilities
│   ├── password.ts        # Password hashing
│   └── validation.ts      # Zod schemas
└── types/
    └── api.types.ts       # API type definitions
```

### 4.2 Service Layer Examples

**auth.service.ts**
```typescript
export class AuthService {
  async register(email: string, password: string): Promise<User>
  async login(email: string, password: string): Promise<{ user: User, tokens: Tokens }>
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }>
  async logout(userId: string, refreshToken: string): Promise<void>
  async verifyAccessToken(token: string): Promise<JWTPayload>
}
```

**assessment.service.ts**
```typescript
export class AssessmentService {
  async create(userId: string, data: AssessmentInput): Promise<Assessment>
  async findById(id: string, userId: string): Promise<Assessment | null>
  async findByUser(userId: string, options: QueryOptions): Promise<PaginatedResult<Assessment>>
  async delete(id: string, userId: string): Promise<void>
  async exportUserData(userId: string): Promise<ExportData>
}
```

## 5. Authentication Flow

### 5.1 JWT Token Strategy

**Access Token:**
- Short-lived (15 minutes)
- Stored in httpOnly cookie
- Contains: userId, email, iat, exp
- Used for API authentication

**Refresh Token:**
- Long-lived (7 days)
- Stored in httpOnly cookie
- Stored in database for revocation
- Used to get new access tokens

### 5.2 Authentication Middleware

```typescript
// lib/middleware/auth.middleware.ts

export async function requireAuth(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const payload = await verifyJWT(accessToken)
    return { userId: payload.userId, email: payload.email }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

### 5.3 Password Security

- Hash algorithm: bcryptjs with salt rounds = 12
- Password requirements: min 8 characters
- No password in responses
- Secure password reset flow (future)

## 6. Frontend Integration

### 6.1 API Client

```typescript
// lib/api/client.ts

class APIClient {
  private baseURL = '/api'
  
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      throw new APIError(response.status, await response.json())
    }
    
    return response.json()
  }
  
  // Auth methods
  async register(email: string, password: string) { }
  async login(email: string, password: string) { }
  async logout() { }
  
  // Assessment methods
  async getAssessments(options?: QueryOptions) { }
  async getAssessment(id: string) { }
  async createAssessment(data: AssessmentInput) { }
  async deleteAssessment(id: string) { }
  
  // User methods
  async getCurrentUser() { }
  async updateUser(data: UserUpdate) { }
  async deleteAccount(password: string) { }
  async exportData() { }
}

export const apiClient = new APIClient()
```

### 6.2 Authentication Context

```typescript
// contexts/auth.context.tsx

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Implementation
}

export function useAuth() {
  return useContext(AuthContext)
}
```

### 6.3 Protected Routes

```typescript
// components/auth/protected-route.tsx

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])
  
  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return null
  
  return <>{children}</>
}
```

## 7. Data Migration Strategy

### 7.1 Migration Flow

1. User logs in for first time
2. Frontend checks for localStorage data
3. If found, prompt user to migrate
4. Send all localStorage assessments to `/api/migrate/localStorage`
5. Backend validates and inserts assessments
6. On success, clear localStorage
7. Redirect to dashboard

### 7.2 Migration Component

```typescript
// components/migration/migrate-data.tsx

export function MigrateData() {
  const [hasLocalData, setHasLocalData] = useState(false)
  const [migrating, setMigrating] = useState(false)
  
  useEffect(() => {
    const data = localStorage.getItem('inquire-history')
    setHasLocalData(!!data)
  }, [])
  
  async function handleMigrate() {
    const data = JSON.parse(localStorage.getItem('inquire-history') || '[]')
    await apiClient.migrateLocalStorage(data)
    localStorage.removeItem('inquire-history')
    // Refresh assessment list
  }
  
  if (!hasLocalData) return null
  
  return (
    <Alert>
      <AlertTitle>Migrate Your Data</AlertTitle>
      <AlertDescription>
        We found {count} assessments in your browser. 
        Would you like to migrate them to your account?
      </AlertDescription>
      <Button onClick={handleMigrate} disabled={migrating}>
        Migrate Now
      </Button>
    </Alert>
  )
}
```

## 8. Error Handling

### 8.1 Error Response Format

```typescript
interface APIError {
  error: string
  message: string
  statusCode: number
  details?: unknown
}
```

### 8.2 Error Middleware

```typescript
// lib/middleware/error.middleware.ts

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({
      error: 'Validation Error',
      message: error.message,
      details: error.issues,
    }, { status: 400 })
  }
  
  if (error instanceof AuthError) {
    return NextResponse.json({
      error: 'Authentication Error',
      message: error.message,
    }, { status: 401 })
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error)
  
  return NextResponse.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  }, { status: 500 })
}
```

## 9. Testing Strategy

### 9.1 Unit Tests
- Service layer methods
- Password hashing/verification
- JWT generation/verification
- Data validation schemas

### 9.2 Integration Tests
- API endpoint responses
- Authentication flows
- Database operations
- Error handling

### 9.3 E2E Tests
- Complete user registration flow
- Login and access protected resources
- Create and retrieve assessments
- Data migration

## 10. Deployment Considerations

### 10.1 Database Location
- Development: `./data/inquire.dev.db`
- Production: `/var/data/inquire.db` or cloud storage

### 10.2 Environment Variables
```
DATABASE_URL=file:./data/inquire.db
JWT_SECRET=<random-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
NODE_ENV=production
```

### 10.3 Database Backups
- Automated daily backups
- Retention: 30 days
- Backup script using SQLite `.backup` command

### 10.4 Migration to PostgreSQL (Future)
- Drizzle ORM supports PostgreSQL
- Change connection string and driver
- Minimal code changes required
- Export SQLite data, import to PostgreSQL

## 11. Security Checklist

- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] JWT secrets stored in environment variables
- [ ] httpOnly cookies for tokens
- [ ] CORS configured properly
- [ ] SQL injection prevented (parameterized queries)
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints
- [ ] HTTPS in production
- [ ] Secure headers (helmet.js)
- [ ] CSRF protection for state-changing operations

## 12. Performance Optimizations

### 12.1 Database
- Indexes on frequently queried columns
- Connection pooling (if needed)
- Prepared statements for repeated queries

### 12.2 API
- Response caching where appropriate
- Pagination for large datasets
- Compression (gzip)

### 12.3 Frontend
- Optimistic updates for better UX
- Request deduplication
- Cache API responses (React Query/SWR)

## 13. Monitoring & Logging

### 13.1 Logging
- Request/response logging
- Error logging with stack traces
- Authentication events
- Database query performance

### 13.2 Metrics
- API response times
- Error rates
- Authentication success/failure rates
- Database query performance

## 14. Future Enhancements

1. **Real-time Sync**: WebSocket for live updates
2. **Offline Support**: Service worker + IndexedDB
3. **Multi-tenancy**: Clinic/organization accounts
4. **Advanced Analytics**: Trend analysis, ML insights
5. **OAuth Integration**: Google, Apple sign-in
6. **Two-Factor Authentication**: TOTP-based 2FA
7. **Audit Logs**: Track all data access
8. **Data Encryption**: Encrypt sensitive data at rest
