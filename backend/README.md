# Backend

MySQL-backed auth and user module.

## Roles
- standard_user
- volunteer
- law_enforcement

## User fields
- first_name
- last_name
- phone_number
- password_hash
- entry_time

## Setup
1. Copy `.env.example` to `.env` and fill values.
2. Run `sql/schema.sql` in MySQL.
3. Install dependencies: `npm install`.
4. Start server: `npm run dev`.

## Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/roles`
- `GET /api/health`
