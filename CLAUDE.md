# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun run dev` - Start development server with hot reload on port 3000 (or PORT env var)
- `bun install` - Install dependencies

### Testing
- `bun test` - Run all tests
- `bun test src/index.test.ts` - Run specific test file

### Running Individual Files
- `bun run src/index.ts` - Run the main server file directly

## Architecture Overview

This is a Bun-based REST API backend for Slunch-V2, a Korean school meal and timetable service. The application uses the Elysia web framework and provides multiple API endpoints for school-related data.

### Core Stack
- **Runtime**: Bun (TypeScript runtime with built-in testing)
- **Framework**: Elysia (high-performance web framework)
- **Database**: LMDB (embedded key-value store via `src/libraries/db.ts`)
- **Push Notifications**: Firebase Admin SDK
- **API Documentation**: Swagger UI at `/swagger` endpoint

### Project Structure
- `src/index.ts` - Main entry point, sets up Elysia server with middleware and routes
- `src/routes/` - API route handlers:
  - `comcigan.ts` - School timetable API integration
  - `neis.ts` - NEIS (Korean education system) API integration
  - `fcm.ts` - Firebase Cloud Messaging subscription management
  - `notifications.ts` - Admin notifications system
- `src/libraries/` - Shared utilities:
  - `cache.ts` - Caching layer for API responses
  - `db.ts` - LMDB database connection
  - `fcm.ts` - FCM notification sending utilities

### Key Middleware Configuration
- **Rate Limiting**: 100 requests per minute per IP
- **Logging**: Custom format with timestamps, method, path, status, duration, and IP
- **Static Files**: Served from `public/` directory
- **Error Handling**: 404s redirect to a random YouTube video (intentional easter egg)

## Environment Variables

Required environment variables (see `.env.d.ts`):
- `PORT` (optional) - Server port, defaults to 3000
- `NEIS_API_KEY` - API key for NEIS education system
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `ADMIN_KEY` - Admin authentication token for protected endpoints

## Testing Setup

Tests use Bun's built-in test runner and require:
1. Create `.env` file with `ADMIN_KEY=test`
2. Firebase service account key file (`serviceAccountKey.json`)
3. Test data files in `tests/` directory (referenced in tests)

The test suite covers the main API endpoints and uses an in-memory approach by directly calling `app.handle()` rather than making HTTP requests.

## TypeScript Configuration

The project uses strict TypeScript settings with:
- Target: ES2021
- Module: ES2022
- Strict mode enabled
- Bun types included