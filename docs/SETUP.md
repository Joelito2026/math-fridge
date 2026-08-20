# Math Fridge Setup and Deployment Guide

This guide keeps each long-running process in a separate terminal. Commands under a terminal heading assume that terminal remains in the displayed directory.

## 1. Prerequisites

- Git
- Docker Desktop with Docker Compose
- Python 3.12 or newer
- Node.js 22.13 or newer and npm
- A Supabase project
- A Gemini API key
- For native development: Xcode/iOS Simulator or Android Studio/Android Emulator
- Expo Go for basic development, or an Expo development build for the full native notification path

## 2. Clone the repository

```bash
git clone <your-repository-url>
cd math-fridge
```

In the examples below, `math-fridge/` means this repository root—not its parent directory.

## 3. Configure external services

### Supabase

Collect these values from the Supabase dashboard:

| Value | Used by | Environment variable |
| --- | --- | --- |
| Project URL | Frontend and backend | `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` |
| Publishable/anonymous key | Frontend and backend token verification | `EXPO_PUBLIC_SUPABASE_KEY`, `SUPABASE_ANON_KEY` |
| Service-role key | Backend account deletion and private image storage | `SUPABASE_SERVICE_ROLE_KEY` |

Never place the service-role key in the frontend environment file or any variable beginning with `EXPO_PUBLIC_`.

The backend creates the private `recipe-images` storage bucket on first upload when the service-role key is configured.

For Google sign-in:

1. Enable Google under **Supabase Authentication → Providers**.
2. Store the Google client ID and secret in Supabase, not in either local `.env` file.
3. Add the applicable callback URLs under **Authentication → URL Configuration → Redirect URLs**:
   - `http://localhost:8081/auth/callback`
   - `frontend://**`
   - The deployed web URL ending in `/auth/callback`
   - Matching local/deployed `/auth/reset-password` URLs
4. Set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after the provider is configured.

Apple sign-in can remain disabled until an Apple Developer configuration is available.

### Gemini

Create a Gemini API key and use it as `GEMINI_API_KEY` in `backend/.env`. The backend requires it during startup because extraction also performs AI-assisted category and dietary classification.

## 4. Terminal layout

```text
Terminal 1: math-fridge/           Docker/PostgreSQL
Terminal 2: math-fridge/backend/   FastAPI
Terminal 3: math-fridge/frontend/  Expo
Terminal 4: math-fridge/frontend/  Tests (optional)
```

### Terminal 1 — PostgreSQL

Working directory:

```bash
cd /path/to/math-fridge
```

Start PostgreSQL:

```bash
docker compose up -d db
docker compose ps
```

The local defaults are:

```text
Host: localhost
Port: 5432
Database: math_fridge
User: math_admin
Password: local_dev_password
```

The named Docker volume preserves data between restarts.

### Terminal 2 — FastAPI backend

Working directory:

```bash
cd /path/to/math-fridge/backend
```

Create and activate an isolated environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

Fill in `backend/.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
DATABASE_URL=postgresql+psycopg://math_admin:local_dev_password@localhost:5432/math_fridge
```

Start the API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify it from another terminal or browser:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"healthy","database":"connected"}
```

### Terminal 3 — Expo frontend

Working directory:

```bash
cd /path/to/math-fridge/frontend
```

Install dependencies and create the environment file:

```bash
npm install
cp .env.example .env
```

Fill in `frontend/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-supabase-publishable-key
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false
EXPO_PUBLIC_APPLE_AUTH_ENABLED=false
```

`EXPO_PUBLIC_API_BASE_URL` is optional for local simulators:

- Web and iOS simulator default to `http://127.0.0.1:8000/api`.
- Android Emulator defaults to `http://10.0.2.2:8000/api`.
- A physical phone needs the computer's LAN address, for example:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8000/api
```

The phone and computer must be on the same network, the backend must use `--host 0.0.0.0`, and the computer firewall must permit port 8000.

Start Expo:

```bash
npx expo start
```

Useful alternatives:

```bash
npx expo start --clear   # clear Metro cache
npm run web              # web only
npm run ios              # local iOS development build
npm run android          # local Android development build
```

### Terminal 4 — automated tests

Working directory:

```bash
cd /path/to/math-fridge/frontend
```

```bash
npm test -- --verbose
npm run test:watch
npm run test:coverage
```

The HTML coverage report is written to `frontend/coverage/lcov-report/index.html` and is ignored by Git.

Backend scalar tests can be run from `backend/` with its virtual environment active:

```bash
python -m unittest test_scalar.py -v
```

## 5. Stop and restart

Stop Expo or Uvicorn with `Ctrl+C` in their terminals. Stop PostgreSQL from the repository root:

```bash
docker compose stop
```

Restart the existing database later:

```bash
docker compose up -d db
```

To remove the database container while retaining its named data volume:

```bash
docker compose down
```

Do not add `--volumes` unless permanent deletion of local database data is intended.

## 6. Troubleshooting

### Android cannot reach `127.0.0.1:8000`

Android's loopback address points to Android itself. Use the built-in emulator default (`10.0.2.2`) or set `EXPO_PUBLIC_API_BASE_URL` to the computer's LAN address for a physical device.

### Android Expo Go reports an `expo-notifications` limitation

Remote notification functionality is unavailable in Android Expo Go. Math Fridge guards that path so the app and in-app timer still run; use a development build to test the complete background notification behavior.

### `Bucket not found` or image storage is unavailable

Confirm `SUPABASE_SERVICE_ROLE_KEY` is present only in `backend/.env`. The backend attempts to create the private `recipe-images` bucket on first upload.

### OAuth succeeds but the callback fails

Confirm the callback URL is listed in Supabase and restart Expo after changing any `EXPO_PUBLIC_*` value. For web, use the exact host/port shown by Expo.

### The API fails during import or startup

Confirm Terminal 2 is inside `backend/`, its `.venv` is active, `pip install -r requirements.txt` completed, PostgreSQL is healthy, and every required backend variable is present.

### UI still shows old Android behavior

Restart with a cleared Metro cache:

```bash
npx expo start --clear
```

## 7. Production deployment checklist

Production deployment is not yet claimed as complete. Before release:

- Host PostgreSQL and the FastAPI service with managed secrets.
- Replace permissive CORS with the exact production web/mobile origins.
- Remove development SSL bypasses and enforce normal certificate validation.
- Replace startup schema alterations with versioned migrations.
- Configure production OAuth callback URLs.
- Build signed Android/iOS binaries and verify native notifications on physical devices.
- Run `npm test`, backend tests, and the manual E2E checklist.
- Add CI/CD only after the actual workflow is implemented and passing.
