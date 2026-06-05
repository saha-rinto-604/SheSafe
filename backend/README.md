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
1. Fill the existing `.env` file with your local backend values.
2. Run `sql/schema.sql` in MySQL.
3. Install dependencies: `npm install`.
4. Start server: `npm run dev`.

## Environment
- `GEMINI_API_KEY` is used only by the backend AI routes.
- `GOOGLE_MAPS_API_KEY` is used by backend AI Area Safety Brief and Route Safety Check for geocoding and directions.
- The React Native map UI uses its own frontend `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `app/resqher-mobile/.env`.
- Do not put backend AI or backend Maps keys in frontend source, app config, or committed files.

## Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/roles`
- `GET /api/health`
