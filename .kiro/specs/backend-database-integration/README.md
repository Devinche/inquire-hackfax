# Backend and Database Integration Spec

## Overview

This spec outlines the plan to replace the current localStorage-based data persistence in the Inquire cognitive assessment application with a proper backend API and SQLite database.

## Current State

The application currently stores all assessment data in browser localStorage:
- Assessment results are stored as JSON in `localStorage.getItem('inquire-history')`
- No user authentication
- No multi-device access
- Data is browser-specific and can be lost
- No data backup or recovery

## Proposed Solution

Implement a full-stack solution with:
- **SQLite database** for persistent storage
- **Next.js API routes** for backend endpoints
- **JWT-based authentication** for user accounts
- **Drizzle ORM** for type-safe database queries
- **Data migration** from localStorage to database

## Key Benefits

1. **Multi-device access**: Users can access their data from any device
2. **Data security**: User authentication and authorization
3. **Data persistence**: Reliable storage with backups
4. **Scalability**: Foundation for future features (sharing, analytics, etc.)
5. **Professional deployment**: Production-ready architecture

## Architecture Highlights

### Database Schema
- **users**: User accounts with email/password
- **assessments**: All assessment data (speech, hand, eye)
- **refresh_tokens**: For JWT refresh token rotation

### API Endpoints
- **Authentication**: `/api/auth/*` (register, login, logout, refresh)
- **Assessments**: `/api/assessments/*` (CRUD operations)
- **User Management**: `/api/user/*` (profile, export, delete)
- **PDF Generation**: `/api/pdf/generate` (server-side PDF creation)
- **Migration**: `/api/migrate/localStorage` (one-time data migration)

### Frontend Changes
- Add login/register pages
- Authentication context and protected routes
- Replace localStorage calls with API calls
- Migration prompt for existing users
- Account settings page

## Technology Stack

- **Database**: SQLite with better-sqlite3
- **ORM**: Drizzle ORM (TypeScript-first)
- **Authentication**: Custom JWT with jose library
- **Password Hashing**: bcryptjs
- **Validation**: Zod schemas
- **API**: Next.js App Router API routes

## Implementation Phases

1. **Database Setup** (2-3 days)
   - Install dependencies
   - Create schema and migrations
   - Set up database connection

2. **Service Layer** (2-3 days)
   - Authentication service
   - User service
   - Assessment service
   - PDF service

3. **API Routes** (3-4 days)
   - Authentication endpoints
   - Assessment CRUD endpoints
   - User management endpoints
   - PDF generation endpoint

4. **Frontend Integration** (3-4 days)
   - API client
   - Authentication UI
   - Update existing components
   - Data migration UI

5. **Testing & Deployment** (3-4 days)
   - Unit and integration tests
   - E2E tests
   - Documentation
   - Production deployment

**Total Estimated Time**: 11-16 days for one developer

## Migration Strategy

For existing users with localStorage data:

1. User creates account or logs in
2. Frontend detects localStorage data
3. Prompts user to migrate
4. Sends data to migration endpoint
5. Backend validates and stores data
6. Frontend clears localStorage on success

## Security Considerations

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens in httpOnly cookies
- Access tokens: 15 minutes expiry
- Refresh tokens: 7 days expiry
- SQL injection prevention via parameterized queries
- Rate limiting on authentication endpoints
- HTTPS in production

## Files in This Spec

- **requirements.md**: Detailed user stories and acceptance criteria
- **design.md**: Technical architecture and implementation details
- **tasks.md**: Step-by-step implementation checklist
- **README.md**: This overview document

## Next Steps

1. Review and approve this spec
2. Set up development environment
3. Begin Phase 1: Database Setup
4. Follow tasks.md for implementation

## Questions & Decisions Needed

1. **ORM Choice**: Drizzle ORM recommended (lightweight, TypeScript-first)
2. **Authentication**: Custom JWT recommended (full control, no external deps)
3. **Anonymous Assessments**: Should we support assessments without login? (Recommend: No, require authentication)
4. **Database Location**: Development: `./data/inquire.dev.db`, Production: TBD
5. **Backup Strategy**: Daily automated backups, 30-day retention
6. **Rate Limiting**: Implement on auth endpoints to prevent brute force

## Success Criteria

- [ ] All localStorage functionality replaced with API
- [ ] Users can register and log in
- [ ] Assessments stored in database
- [ ] Multi-device access working
- [ ] Data migration successful for existing users
- [ ] PDF generation working from backend
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Production deployment successful

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Keep localStorage as backup, thorough testing |
| Authentication complexity | Medium | Use established patterns, consider NextAuth.js |
| SQLite limitations at scale | Low | Design with PostgreSQL migration path |
| Breaking existing features | High | Comprehensive testing, gradual rollout |

## Future Enhancements

After initial implementation:
- OAuth/social login (Google, Apple)
- Two-factor authentication
- Real-time sync with WebSockets
- Offline support with service workers
- Healthcare provider portal
- Advanced analytics dashboard
- HIPAA compliance features

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**Spec Version**: 1.0  
**Created**: 2026-02-15  
**Status**: Ready for Review
