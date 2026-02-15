# Backend and Database Integration - Implementation Tasks

## Phase 1: Database Setup

### 1.1 Install Dependencies
- [ ] Install `better-sqlite3` for SQLite driver
- [ ] Install `drizzle-orm` for ORM
- [ ] Install `drizzle-kit` for migrations (dev dependency)
- [ ] Install `bcryptjs` for password hashing
- [ ] Install `jose` for JWT handling
- [ ] Install `zod` validation schemas (already installed, verify)

### 1.2 Database Configuration
- [ ] Create `lib/db/index.ts` with database connection
- [ ] Create `lib/db/schema.ts` with Drizzle schema (users, assessments, refresh_tokens)
- [ ] Create `drizzle.config.ts` for Drizzle Kit configuration
- [ ] Create initial migration files
- [ ] Add database initialization script
- [ ] Create `.env.local` with DATABASE_URL and JWT_SECRET

### 1.3 Database Utilities
- [ ] Create database seeding script for development
- [ ] Create backup script for production
- [ ] Add database reset script for testing
- [ ] Document database setup in README

## Phase 2: Service Layer

### 2.1 Authentication Service
- [ ] Create `lib/services/auth.service.ts`
  - [ ] Implement `register()` method
  - [ ] Implement `login()` method
  - [ ] Implement `logout()` method
  - [ ] Implement `refreshToken()` method
  - [ ] Implement `verifyAccessToken()` method

### 2.2 User Service
- [ ] Create `lib/services/user.service.ts`
  - [ ] Implement `findById()` method
  - [ ] Implement `findByEmail()` method
  - [ ] Implement `update()` method
  - [ ] Implement `delete()` method
  - [ ] Implement `exportData()` method

### 2.3 Assessment Service
- [ ] Create `lib/services/assessment.service.ts`
  - [ ] Implement `create()` method
  - [ ] Implement `findById()` method
  - [ ] Implement `findByUser()` method with pagination
  - [ ] Implement `delete()` method
  - [ ] Implement data transformation helpers (DB <-> API format)

### 2.4 PDF Service
- [ ] Create `lib/services/pdf.service.ts`
  - [ ] Move PDF generation logic from frontend
  - [ ] Implement `generatePDF()` method
  - [ ] Add support for multiple assessments
  - [ ] Handle patient metadata

## Phase 3: Utilities & Middleware

### 3.1 JWT Utilities
- [ ] Create `lib/utils/jwt.ts`
  - [ ] Implement `generateAccessToken()` function
  - [ ] Implement `generateRefreshToken()` function
  - [ ] Implement `verifyToken()` function
  - [ ] Add token expiry configuration

### 3.2 Password Utilities
- [ ] Create `lib/utils/password.ts`
  - [ ] Implement `hashPassword()` function
  - [ ] Implement `verifyPassword()` function
  - [ ] Add password strength validation

### 3.3 Validation Schemas
- [ ] Create `lib/utils/validation.ts`
  - [ ] Define `registerSchema` (email, password)
  - [ ] Define `loginSchema` (email, password)
  - [ ] Define `assessmentSchema` (full assessment data)
  - [ ] Define `updateUserSchema` (email, password updates)
  - [ ] Define `paginationSchema` (limit, offset)

### 3.4 Authentication Middleware
- [ ] Create `lib/middleware/auth.middleware.ts`
  - [ ] Implement `requireAuth()` middleware
  - [ ] Extract user from JWT token
  - [ ] Handle token expiry
  - [ ] Return 401 for invalid tokens

### 3.5 Error Handling
- [ ] Create `lib/middleware/error.middleware.ts`
  - [ ] Define custom error classes (AuthError, ValidationError, NotFoundError)
  - [ ] Implement `handleAPIError()` function
  - [ ] Format error responses consistently
  - [ ] Add error logging

## Phase 4: API Routes - Authentication

### 4.1 Register Endpoint
- [ ] Create `app/api/auth/register/route.ts`
  - [ ] Validate request body with Zod
  - [ ] Check if email already exists
  - [ ] Hash password
  - [ ] Create user in database
  - [ ] Generate tokens
  - [ ] Set httpOnly cookies
  - [ ] Return user data
  - [ ] Handle errors (409 for duplicate email)

### 4.2 Login Endpoint
- [ ] Create `app/api/auth/login/route.ts`
  - [ ] Validate request body
  - [ ] Find user by email
  - [ ] Verify password
  - [ ] Generate tokens
  - [ ] Set httpOnly cookies
  - [ ] Return user data
  - [ ] Handle errors (401 for invalid credentials)

### 4.3 Logout Endpoint
- [ ] Create `app/api/auth/logout/route.ts`
  - [ ] Verify authentication
  - [ ] Delete refresh token from database
  - [ ] Clear cookies
  - [ ] Return success message

### 4.4 Refresh Token Endpoint
- [ ] Create `app/api/auth/refresh/route.ts`
  - [ ] Extract refresh token from cookie
  - [ ] Verify token in database
  - [ ] Check expiry
  - [ ] Generate new access token
  - [ ] Set new cookie
  - [ ] Handle errors (401 for invalid token)

### 4.5 Current User Endpoint
- [ ] Create `app/api/auth/me/route.ts`
  - [ ] Verify authentication
  - [ ] Return current user data
  - [ ] Handle errors

## Phase 5: API Routes - Assessments

### 5.1 List Assessments Endpoint
- [ ] Create `app/api/assessments/route.ts` (GET)
  - [ ] Verify authentication
  - [ ] Parse query parameters (limit, offset, dates)
  - [ ] Validate pagination params
  - [ ] Query assessments for user
  - [ ] Transform DB format to API format
  - [ ] Return paginated results
  - [ ] Include total count and hasMore flag

### 5.2 Create Assessment Endpoint
- [ ] Create `app/api/assessments/route.ts` (POST)
  - [ ] Verify authentication
  - [ ] Validate request body
  - [ ] Transform API format to DB format
  - [ ] Insert assessment into database
  - [ ] Return created assessment
  - [ ] Handle validation errors

### 5.3 Get Single Assessment Endpoint
- [ ] Create `app/api/assessments/[id]/route.ts` (GET)
  - [ ] Verify authentication
  - [ ] Extract assessment ID from params
  - [ ] Query assessment by ID
  - [ ] Verify user owns assessment
  - [ ] Transform to API format
  - [ ] Return assessment
  - [ ] Handle 404 and 403 errors

### 5.4 Delete Assessment Endpoint
- [ ] Create `app/api/assessments/[id]/route.ts` (DELETE)
  - [ ] Verify authentication
  - [ ] Extract assessment ID
  - [ ] Verify user owns assessment
  - [ ] Delete from database
  - [ ] Return 204 No Content
  - [ ] Handle 404 and 403 errors

## Phase 6: API Routes - User Management

### 6.1 Get Current User
- [ ] Create `app/api/user/me/route.ts` (GET)
  - [ ] Verify authentication
  - [ ] Query user by ID
  - [ ] Return user data (no password)
  - [ ] Handle errors

### 6.2 Update User
- [ ] Create `app/api/user/me/route.ts` (PATCH)
  - [ ] Verify authentication
  - [ ] Validate request body
  - [ ] Handle email update
  - [ ] Handle password update (verify current password)
  - [ ] Update database
  - [ ] Return updated user
  - [ ] Handle validation errors

### 6.3 Delete Account
- [ ] Create `app/api/user/me/route.ts` (DELETE)
  - [ ] Verify authentication
  - [ ] Validate password confirmation
  - [ ] Delete user (cascade deletes assessments)
  - [ ] Clear cookies
  - [ ] Return 204 No Content
  - [ ] Handle errors

### 6.4 Export User Data
- [ ] Create `app/api/user/export/route.ts` (GET)
  - [ ] Verify authentication
  - [ ] Query all user data
  - [ ] Query all assessments
  - [ ] Format as JSON export
  - [ ] Return downloadable file
  - [ ] Handle errors

## Phase 7: PDF Generation API

### 7.1 PDF Generation Endpoint
- [ ] Create `app/api/pdf/generate/route.ts` (POST)
  - [ ] Verify authentication
  - [ ] Validate request body (assessment IDs, metadata)
  - [ ] Query assessments by IDs
  - [ ] Verify user owns all assessments
  - [ ] Generate PDF using jsPDF
  - [ ] Return PDF as binary response
  - [ ] Set proper content-type headers
  - [ ] Handle errors (404, 403)

## Phase 8: Data Migration

### 8.1 Migration Endpoint
- [ ] Create `app/api/migrate/localStorage/route.ts` (POST)
  - [ ] Verify authentication
  - [ ] Validate request body (array of assessments)
  - [ ] Transform localStorage format to DB format
  - [ ] Batch insert assessments
  - [ ] Handle partial failures
  - [ ] Return migration summary (success/failure counts)
  - [ ] Handle errors

### 8.2 Migration UI Component
- [ ] Create `components/migration/migrate-data.tsx`
  - [ ] Check for localStorage data on mount
  - [ ] Display migration prompt if data exists
  - [ ] Show assessment count
  - [ ] Handle migration button click
  - [ ] Show loading state during migration
  - [ ] Display success/error messages
  - [ ] Clear localStorage on success
  - [ ] Refresh assessment list

## Phase 9: Frontend Integration

### 9.1 API Client
- [ ] Create `lib/api/client.ts`
  - [ ] Implement base request method with error handling
  - [ ] Add authentication methods (register, login, logout)
  - [ ] Add assessment methods (list, get, create, delete)
  - [ ] Add user methods (get, update, delete, export)
  - [ ] Add PDF generation method
  - [ ] Add migration method
  - [ ] Handle token refresh on 401 errors

### 9.2 Authentication Context
- [ ] Create `contexts/auth.context.tsx`
  - [ ] Define AuthContext interface
  - [ ] Implement AuthProvider component
  - [ ] Add user state management
  - [ ] Add loading state
  - [ ] Implement login method
  - [ ] Implement register method
  - [ ] Implement logout method
  - [ ] Check authentication on mount
  - [ ] Export useAuth hook

### 9.3 Authentication Pages
- [ ] Create `app/login/page.tsx`
  - [ ] Build login form (email, password)
  - [ ] Add form validation
  - [ ] Handle form submission
  - [ ] Display error messages
  - [ ] Redirect to dashboard on success
  - [ ] Add link to register page

- [ ] Create `app/register/page.tsx`
  - [ ] Build registration form (email, password, confirm password)
  - [ ] Add form validation
  - [ ] Handle form submission
  - [ ] Display error messages
  - [ ] Redirect to dashboard on success
  - [ ] Add link to login page

### 9.4 Protected Route Component
- [ ] Create `components/auth/protected-route.tsx`
  - [ ] Check authentication status
  - [ ] Show loading spinner while checking
  - [ ] Redirect to login if not authenticated
  - [ ] Render children if authenticated

### 9.5 Update Assessment Flow
- [ ] Update `components/neuro-screen/assessment-flow.tsx`
  - [ ] Replace localStorage.getItem with API call
  - [ ] Replace localStorage.setItem with API call
  - [ ] Update loadHistory to fetch from API
  - [ ] Update saveHistory to POST to API
  - [ ] Add error handling for API failures
  - [ ] Add loading states
  - [ ] Keep localStorage as fallback during migration

### 9.6 Update Results Dashboard
- [ ] Update `components/neuro-screen/results-dashboard.tsx`
  - [ ] Fetch assessment data from API
  - [ ] Update historical comparison to use API data
  - [ ] Add loading states
  - [ ] Handle API errors

### 9.7 Update Assessment History
- [ ] Update `components/neuro-screen/assessment-history.tsx`
  - [ ] Fetch history from API with pagination
  - [ ] Implement infinite scroll or pagination UI
  - [ ] Update delete functionality to use API
  - [ ] Add loading states
  - [ ] Handle API errors

### 9.8 Update PDF Generation
- [ ] Update `components/neuro-screen/send-to-doctor.tsx`
  - [ ] Call backend PDF generation endpoint
  - [ ] Remove frontend PDF generation code
  - [ ] Handle PDF download
  - [ ] Add loading state
  - [ ] Handle errors

### 9.9 Account Settings Page
- [ ] Create `app/settings/page.tsx`
  - [ ] Display current user info
  - [ ] Add email update form
  - [ ] Add password change form
  - [ ] Add export data button
  - [ ] Add delete account button (with confirmation)
  - [ ] Handle form submissions
  - [ ] Display success/error messages

## Phase 10: Testing

### 10.1 Unit Tests
- [ ] Test password hashing and verification
- [ ] Test JWT generation and verification
- [ ] Test validation schemas
- [ ] Test service layer methods
- [ ] Test data transformations

### 10.2 Integration Tests
- [ ] Test authentication endpoints
  - [ ] Register with valid data
  - [ ] Register with duplicate email
  - [ ] Login with valid credentials
  - [ ] Login with invalid credentials
  - [ ] Refresh token flow
  - [ ] Logout

- [ ] Test assessment endpoints
  - [ ] Create assessment
  - [ ] List assessments with pagination
  - [ ] Get single assessment
  - [ ] Delete assessment
  - [ ] Access control (can't access other user's data)

- [ ] Test user endpoints
  - [ ] Get current user
  - [ ] Update email
  - [ ] Update password
  - [ ] Delete account
  - [ ] Export data

- [ ] Test PDF generation
  - [ ] Generate PDF for single assessment
  - [ ] Generate PDF for multiple assessments
  - [ ] Include patient metadata

- [ ] Test migration endpoint
  - [ ] Migrate valid localStorage data
  - [ ] Handle invalid data
  - [ ] Partial migration failures

### 10.3 E2E Tests
- [ ] Complete user registration flow
- [ ] Login and access dashboard
- [ ] Create new assessment
- [ ] View assessment history
- [ ] Generate PDF report
- [ ] Migrate localStorage data
- [ ] Update account settings
- [ ] Delete account

## Phase 11: Documentation

### 11.1 API Documentation
- [ ] Document all endpoints with examples
- [ ] Add request/response schemas
- [ ] Document error codes
- [ ] Add authentication flow diagram
- [ ] Create Postman/Insomnia collection

### 11.2 Setup Documentation
- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Add database migration instructions
- [ ] Document backup procedures
- [ ] Add troubleshooting guide

### 11.3 Developer Documentation
- [ ] Document service layer architecture
- [ ] Add code examples for common tasks
- [ ] Document testing approach
- [ ] Add contribution guidelines

## Phase 12: Deployment

### 12.1 Production Configuration
- [ ] Set up production environment variables
- [ ] Configure database location
- [ ] Set up HTTPS
- [ ] Configure CORS
- [ ] Add security headers
- [ ] Set up rate limiting

### 12.2 Database Management
- [ ] Set up automated backups
- [ ] Configure backup retention
- [ ] Test backup restoration
- [ ] Document backup procedures

### 12.3 Monitoring
- [ ] Set up error logging
- [ ] Add performance monitoring
- [ ] Configure alerts for errors
- [ ] Set up uptime monitoring

### 12.4 Deployment
- [ ] Deploy to production environment
- [ ] Run database migrations
- [ ] Verify all endpoints working
- [ ] Test authentication flow
- [ ] Test data migration
- [ ] Monitor for errors

## Phase 13: Post-Launch

### 13.1 User Communication
- [ ] Notify users about new authentication requirement
- [ ] Provide migration instructions
- [ ] Offer support for migration issues

### 13.2 Monitoring & Optimization
- [ ] Monitor API performance
- [ ] Optimize slow queries
- [ ] Review error logs
- [ ] Gather user feedback

### 13.3 Future Enhancements
- [ ] Plan OAuth integration
- [ ] Plan two-factor authentication
- [ ] Plan real-time sync features
- [ ] Plan mobile app support

---

## Task Dependencies

**Critical Path:**
1. Phase 1 (Database Setup) → Phase 2 (Services) → Phase 3 (Utilities) → Phase 4-7 (API Routes) → Phase 9 (Frontend Integration)

**Parallel Work:**
- Phase 8 (Migration) can be done after Phase 4-5
- Phase 10 (Testing) can start after each phase completes
- Phase 11 (Documentation) can be done throughout

**Estimated Timeline:**
- Phase 1-3: 2-3 days
- Phase 4-7: 3-4 days
- Phase 8-9: 3-4 days
- Phase 10: 2-3 days
- Phase 11-12: 1-2 days
- **Total: 11-16 days** (for one developer)
