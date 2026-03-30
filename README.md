# BackToYou — Explainable Lost & Found (MERN + Human Approval)

**Impact (1‑liner):** BackToYou helps campus communities recover lost items **faster and safer** by using **explainable matching** to suggest candidates, **private verification** to block false claims, and a **single admin** to approve every return (no auto-returns).

---

## Why this project exists (problem statement)

Traditional lost-and-found on campus is fragmented (posters, WhatsApp groups, desk logs) and fails in predictable ways:

- **Low recall:** people don’t see the right post at the right time.
- **Low trust:** “prove it’s yours” is subjective and easy to game.
- **Safety risk:** direct contact too early enables social engineering/harassment.
- **No audit trail:** it’s hard to explain *why* a decision was made later.

BackToYou solves these by separating **candidate generation** from **ownership proof** and forcing a **human-in-the-loop** decision.

---

## Solution overview (what it does)

BackToYou is a MERN platform where:

1. Users report **lost** and **found** items (structured fields + optional images).
2. The system generates **candidate matches** using classical, explainable ML:
   - TF‑IDF text similarity + cosine similarity
   - rule-based scoring (category/color/location/date)
3. The **lost-item owner** submits a claim and answers **private verification** questions (K‑out‑of‑N).
4. A **single admin** reviews:
   - full score breakdown (explainable)
   - verification result
   - user risk indicators
5. Only after admin approval:
   - items are marked `RETURNED`
   - a private **chat room** is created for the two users to coordinate pickup

**Non‑negotiables**
- No deep learning / CNNs
- No auto-return decisions
- Chat is disabled until approval

---

## Key features

- **Auth + RBAC:** JWT auth; server-side role enforcement; single-admin constraint.
- **Lost/Found reporting:** structured forms + optional images (Cloudinary or local).
- **Explainable matching:** stores numeric breakdown per match and returns safe views by role.
- **Ownership verification:** K‑out‑of‑N evaluation using private fields only.
- **Fraud controls:** rate limiting, suspicion scoring, blocking flags, audit logs.
- **Admin review:** approve/reject workflow with full explainability.
- **Secure chat:** created only after approval; only match participants can message; admin can view for moderation.
- **Production UX:** modern dark UI, toasts, skeleton loaders, empty states, responsive pages.

---

## Tech stack (what + why)

### Frontend (Vercel)
- **React + Vite:** fast builds and a clean SPA architecture.
- **Tailwind CSS:** consistent design system with rapid iteration.
- **Zustand:** minimal global state (auth/token) without Redux overhead.
- **TanStack Query:** API caching + polling (used for chat + dashboards).
- **Framer Motion:** subtle motion for “real product” feel.

### Backend (Render)
- **Node.js + Express:** pragmatic REST API with strong ecosystem support.
- **MongoDB Atlas + Mongoose:** flexible schemas for evolving item fields; indexes for fast query patterns.
- **JWT:** stateless auth; short-lived trust boundary.
- **Zod:** input validation at API edges.

### Matching (Explainable classical ML)
- **Python FastAPI service (optional):** TF‑IDF + cosine + rule scoring.
- **Node local fallback:** same formula using `natural` TF‑IDF so the system keeps working if ML service is down.

### Storage + email (optional)
- **Cloudinary** (preferred) or local uploads.
- **Nodemailer + SMTP** (emails log to console if SMTP not set).

---

## Architecture (high level)

```mermaid
flowchart LR
  U[Browser (User/Admin)] --> FE[React SPA]
  FE -->|REST JSON| API[Express API]
  API --> DB[(MongoDB Atlas)]
  API -->|POST /score (optional)| MLS[Python FastAPI ML Service]
  API --> STORE[Cloudinary or local uploads]
  API --> MAIL[SMTP via Nodemailer (optional)]
```

---

## Matching formula (explainable by design)

BackToYou stores and explains each component:

- `ruleScore = avg(categoryScore, colorScore, locationScore, dateScore)`
- `finalScore = 0.6 * textSimilarity + 0.4 * ruleScore`

**Important:** even a `HIGH_CONFIDENCE` match is **not** an auto-return; it only changes how the UI labels confidence.

---

## API surface (key endpoints)

Auth:
- `POST /api/auth/register` (USER)
- `POST /api/auth/login` (USER)
- `POST /api/auth/admin/login` (ADMIN + secret key)
- `GET /api/auth/me`

Items:
- `POST /api/items`
- `GET /api/items?mine=1`

Matches:
- `GET /api/matches?mine=1`
- `GET /api/matches/:id` (role-based response)
- `GET /api/admin/matches/:id/explanation` (admin only)

Claims + Admin decision:
- `POST /api/claims`
- `GET /api/admin/claims`
- `POST /api/admin/claims/:id/decision`

Chat (post-approval only):
- `GET /api/chat/mine`
- `GET /api/chat/:chatRoomId`
- `POST /api/chat/:chatRoomId/message`

---

## Local development

### Requirements
- Node.js 20.x (enforced via `.npmrc`)
- MongoDB (local `mongod` or Atlas)
- Python 3.12.x (optional, for `ml-service/`)

### Install + run
1. Install JS deps: `npm i`
2. Copy env files:
   - `backend/.env.example` → `backend/.env`
   - `frontend/.env.example` → `frontend/.env`
3. Start dev servers: `npm run dev`

### Seed the single admin (local or against Atlas)
`npm -C backend run seed:admin`

### Smoke test (end-to-end)
`npm -C backend run smoke`

---

## Deployment (recommended)

### Frontend (Vercel)
- Root directory: `frontend`
- Env:
  - `VITE_API_URL=https://<your-backend>.onrender.com`

### Backend (Render)
- Root directory: `backend`
- Env highlights:
  - `APP_ORIGIN=https://<your-vercel-domain>` (comma-separated allowed; no trailing slash)
  - `MONGODB_URI=...` / `MONGODB_DB=backtoyou`
  - `JWT_SECRET=...`
  - `ADMIN_EMAIL=...` / `ADMIN_PASSWORD=...` / `ADMIN_LOGIN_SECRET=...`
  - `ML_MODE=service` or `ML_MODE=local`

### ML service (Render, optional)
- Root directory: `ml-service`
- Python: **3.12.x**
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Optional security:
  - set `ML_SERVICE_TOKEN` on the ML service
  - set the same `ML_SERVICE_TOKEN` on the backend (sent as header `x-ml-token`)

---

## Resume bullet points (ATS-friendly)

- Built a production-style MERN lost-and-found platform with **explainable classical ML matching** (TF‑IDF + cosine + rule scoring) and **human-in-the-loop approvals** to prevent incorrect returns.
- Designed and enforced **server-side RBAC** with a **single-admin constraint**, plus role-based match explainability to prevent reverse-engineering and fraud.
- Implemented **private ownership verification (K‑out‑of‑N)** and fraud controls (rate limiting, suspicion scoring, blocking) to harden against false claims.
- Shipped a polished React UI using Tailwind + React Query + Zustand with robust loading/empty/error states and secure post-approval chat.
- Deployed a multi-service architecture on Vercel/Render with MongoDB Atlas and an optional Python ML scorer secured via shared-secret headers.

---

## Future improvements

- WebSocket chat (reduce polling) + typing indicators
- Async matching pipeline (queue + worker) for high item volumes
- Better location modeling (building proximity, geocoding)
- Stronger abuse detection (device fingerprinting, anomaly detection)
- Admin tooling for duplicate merging and dispute resolution

---

## Deep docs (interview package)

- `PRD.md` — product requirements + personas + KPIs
- `TECHNICAL_README.md` — architecture + business rules + API map
- `SYSTEM_DESIGN.md` — request lifecycles, data model, scaling, reliability, security
- `TECH_STACK_DEEP_DIVE.md` — what/why/alternatives/trade-offs per technology
- `INTERVIEW_GUIDE.md` — pitches, deep Q&A, edge cases, interview positioning
