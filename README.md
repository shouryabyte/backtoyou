# BackToYou

Production-ready College Lost & Found system with:

- Explainable candidate matching (Python TF-IDF + cosine + rule scoring)
- Private verification (K-out-of-N ownership questions)
- Human-in-the-loop admin approval (never auto-return)

## Repo layout

- `frontend/`: React + TypeScript + Tailwind + React Query + Zustand + Framer Motion
- `backend/`: Node.js + Express + MongoDB (Mongoose) + JWT/RBAC + verification + fraud controls
- `ml-service/`: Python (FastAPI) microservice for TF-IDF/cosine/rule scoring

## Docs

- `PRD.md` — complete Product Requirements Document (interview-friendly)
- `TECHNICAL_README.md` — deep technical README + interview explanation guide

## Explainable match scores

BackToYou exposes an explainable breakdown for every candidate match:

- `final_score = 0.6 * text_similarity + 0.4 * rule_score`
- `rule_score = avg(categoryScore, colorScore, locationScore, dateScore)`

API:

- Admin: `GET /api/admin/matches/:matchId/explanation` (full breakdown)
- Lost-item owner: `GET /api/matches/:matchId` (confidence + short explanation; no raw scores)

Example response:

```json
{
  "lostItemId": "65e....",
  "foundItemId": "65e....",
  "scores": {
    "textSimilarity": 0.72,
    "categoryScore": 1.0,
    "colorScore": 0.8,
    "locationScore": 0.6,
    "dateScore": 0.7,
    "ruleScore": 0.78,
    "finalScore": 0.82
  },
  "confidence": "Medium",
  "confidenceLevel": "AMBIGUOUS"
}
```

## Requirements

- Node.js 20.x LTS (enforced via `.npmrc`)
- MongoDB (local `mongod` or MongoDB Atlas)
- Python 3.10+ (optional, for the ML service)

## Local setup

### 1) Start MongoDB

Pick one:
- **Local:** start `mongod` on `127.0.0.1:27017`
- **Atlas:** use a MongoDB Atlas connection string in `backend/.env`

### 2) Install JS dependencies

`npm i`

### 3) Configure env files

- Copy `backend/.env.example` -> `backend/.env` and set `JWT_SECRET`
- Copy `frontend/.env.example` -> `frontend/.env`

### 4) Run dev servers

`npm run dev`

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- ML service (optional): `http://localhost:8090` (`GET /health`, `POST /score`)

### Optional: run the Python ML service locally

From `ml-service/`:

- `python -m venv .venv`
- Activate venv
- `pip install -r requirements.txt`
- `uvicorn app.main:app --host 0.0.0.0 --port 8090`

If you don’t want the Python service, set `ML_MODE=local` in `backend/.env` (backend uses the local scorer).

## Admin user (local)

`npm -C backend run seed:admin`

Defaults come from `backend/.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_LOGIN_SECRET` (required for admin login)

You can reset the seeded admin password by setting `RESET_ADMIN_PASSWORD=1` and re-running the seed script.

## Smoke test (end-to-end)

Prereqs:

- Backend running on `http://localhost:8080`
- MongoDB connected (local or Atlas)

Run:

`npm -C backend run smoke`

## Notes

- Images use Cloudinary if `CLOUDINARY_URL` is set; otherwise stored in `backend/uploads/`.
- Emails are logged to the console unless SMTP env vars are configured.

## Production deploy (Vercel + Render + Python ML service)

### Frontend (Vercel)

- Deploy `frontend/`
- Set env `VITE_API_BASE_URL` to your Render backend URL, e.g. `https://backtoyou-backend.onrender.com`

### Backend (Render)

- Deploy `backend/` as a Node web service
- Ensure env includes:
  - `MONGODB_URI`, `MONGODB_DB`
  - `JWT_SECRET`
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_LOGIN_SECRET`
  - `APP_ORIGIN` (your Vercel domain)
  - `ML_MODE=service`
  - `ML_SERVICE_URL` (your Render ML service URL)
  - `ML_SERVICE_TOKEN` (must match the ML service token if set)

### ML service (Render, Python — no Docker)

- Deploy `ml-service/` as a Python web service
- Set Python version to **3.12.x** (Render’s latest Python may be too new and can force source builds for `pydantic-core`)
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Optional (recommended): set env `ML_SERVICE_TOKEN` to a strong random string.
  - When set, the ML service requires header `x-ml-token` for `POST /score`.
  - Set the same value as `ML_SERVICE_TOKEN` in the backend env.

## Windows “EPERM/EBUSY/esbuild.exe locked” recovery

1) Close VS Code + all terminals  
2) In an Admin PowerShell at repo root:

`taskkill /f /im node.exe`

`npm run clean`

`npm cache clean --force`

Then reinstall:

`npm i`
