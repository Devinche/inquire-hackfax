# Backend and Database Integration - Requirements

## 1. Overview

Replace the current localStorage-based data persistence with a proper backend API and SQLite database to enable multi-device access, data integrity, user authentication, and scalability.

## 2. User Stories

### 2.1 Data Persistence
**As a** user  
**I want** my assessment data stored in a database  
**So that** I can access my history from any device and my data is secure

**Acceptance Criteria:**
- Assessment results are saved to SQLite database instead of localStorage
- Data persists across browser sessions and devices
- Database handles concurrent access safely
- Data integrity is maintained with proper constraints

### 2.2 User Authentication
**As a** user  
**I want** to create an account and log in  
**So that** my assessment data is private and only accessible to me

**Acceptance Criteria:**
- Users can register with email/password
- Users can log in with credentials
- Passwords are securely hashed (bcrypt/argon2)
- Session management with JWT or secure cookies
- Users can only access their own assessment data

### 2.3 Assessment History API
**As a** user  
**I want** to retrieve my assessment history via API  
**So that** the frontend can display my past results

**Acceptance Criteria:**
- GET endpoint returns all assessments for authenticated user
- GET endpoint can retrieve a single assessment by ID
- Results are returned in JSON format matching current data structure
- Pagination support for large histories
- Filtering by date range

### 2.4 Assessment Creation API
**As a** user  
**I want** to save new assessments via API  
**So that** my test results are stored securely

**Acceptance Criteria:**
- POST endpoint accepts assessment data
- Validates assessment data structure
- Associates assessment with authenticated user
- Returns created assessment with ID and timestamp
- Handles validation errors gracefully

### 2.5 PDF Generation
**As a** user  
**I want** to generate PDFs from stored assessments  
**So that** I can share reports with healthcare providers

**Acceptance Criteria:**
- PDF generation moved to backend
- Endpoint accepts assessment IDs and patient metadata
- Returns PDF as downloadable file
- Supports multiple assessments in single PDF
- Maintains current PDF formatting and clinical content

### 2.6 Data Migration
**As an** existing user  
**I want** my localStorage data migrated to the database  
**So that** I don't lose my assessment history

**Acceptance Criteria:**
- Frontend detects existing localStorage data
- Offers one-time migration on first login
- Migrates all assessments to user account
- Clears localStorage after successful migration
- Handles migration errors gracefully

### 2.7 Multi-Device Sync
**As a** user  
**I want** my data synchronized across devices  
**So that** I can access my assessments from phone, tablet, or computer

**Acceptance Criteria:**
- Same account works on multiple devices
- Assessment history is consistent across devices
- Real-time or near-real-time sync
- Offline support with sync on reconnection (optional enhancement)

### 2.8 Data Export
**As a** user  
**I want** to export all my data  
**So that** I can keep a personal backup or switch services

**Acceptance Criteria:**
- Endpoint to export all user data as JSON
- Includes all assessments and metadata
- GDPR-compliant data portability
- Downloadable as file

### 2.9 Account Management
**As a** user  
**I want** to manage my account settings  
**So that** I can update my information or delete my account

**Acceptance Criteria:**
- Update email/password endpoints
- Delete account endpoint (with confirmation)
- Account deletion removes all associated data
- Password reset functionality

## 3. Technical Requirements

### 3.1 Database Schema
- Users table (id, email, password_hash, created_at, updated_at)
- Assessments table (id, user_id, timestamp, results_json, created_at)
- Proper foreign key constraints
- Indexes on user_id and timestamp for query performance

### 3.2 API Framework
- Next.js API Routes (app/api directory) or separate backend
- RESTful API design
- JSON request/response format
- Proper HTTP status codes

### 3.3 Security
- Password hashing with bcrypt or argon2
- JWT tokens or secure session cookies
- HTTPS in production
- SQL injection prevention (parameterized queries)
- Rate limiting on authentication endpoints
- CORS configuration

### 3.4 Data Validation
- Zod schemas for API request validation
- Type-safe database queries
- Error handling and meaningful error messages

### 3.5 Testing
- Unit tests for database operations
- Integration tests for API endpoints
- Test authentication flows
- Test data migration logic

## 4. Non-Functional Requirements

### 4.1 Performance
- API response time < 200ms for typical queries
- Database queries optimized with indexes
- Pagination for large datasets

### 4.2 Scalability
- SQLite suitable for single-server deployment
- Migration path to PostgreSQL/MySQL for multi-server (future)
- Connection pooling if needed

### 4.3 Reliability
- Database backups (automated)
- Transaction support for data integrity
- Graceful error handling

### 4.4 Maintainability
- Clear separation of concerns (routes, services, models)
- TypeScript throughout
- Comprehensive error logging

## 5. Out of Scope (Future Enhancements)

- OAuth/social login (Google, Apple)
- Two-factor authentication
- Real-time collaboration features
- Mobile native apps
- Advanced analytics dashboard
- Healthcare provider portal
- HIPAA compliance features
- Multi-tenancy for clinics

## 6. Dependencies

### New Dependencies Required
- `better-sqlite3` - SQLite database driver
- `bcryptjs` or `argon2` - Password hashing
- `jsonwebtoken` - JWT token generation
- `zod` - Already installed, use for validation
- `drizzle-orm` or `prisma` - ORM (optional but recommended)
- `jose` - JWT handling (alternative to jsonwebtoken)

## 7. Migration Strategy

### Phase 1: Backend Setup
1. Set up SQLite database with schema
2. Create database access layer
3. Implement authentication system

### Phase 2: API Development
4. Build assessment CRUD endpoints
5. Implement user management endpoints
6. Move PDF generation to backend

### Phase 3: Frontend Integration
7. Add login/register UI
8. Replace localStorage calls with API calls
9. Implement data migration utility

### Phase 4: Testing & Deployment
10. Comprehensive testing
11. Database backup strategy
12. Production deployment

## 8. Success Metrics

- 100% of localStorage functionality replaced with API
- Zero data loss during migration
- Authentication working on all endpoints
- API response times meet performance requirements
- All existing features continue to work
- Users can access data from multiple devices

## 9. Risks & Mitigations

### Risk: Data Loss During Migration
**Mitigation:** Thorough testing, keep localStorage as backup until confirmed successful migration

### Risk: Authentication Complexity
**Mitigation:** Use established patterns, consider NextAuth.js for simplified auth

### Risk: SQLite Limitations at Scale
**Mitigation:** Design with migration path to PostgreSQL, document scaling strategy

### Risk: Breaking Existing Functionality
**Mitigation:** Maintain backward compatibility during transition, feature flags for gradual rollout

## 10. Open Questions

1. Should we use an ORM (Drizzle/Prisma) or raw SQL?
2. NextAuth.js vs custom authentication?
3. JWT tokens vs session cookies?
4. Should we support anonymous assessments (no login required)?
5. Database location (file path) in production?
6. Backup frequency and retention policy?
7. Should we implement soft deletes for assessments?
8. Rate limiting strategy for API endpoints?
