# AI Interview Prep Buddy — Pro
Practice 5 role-based interview questions with instant feedback, save **session history**, and **export PDF reports**.

## New in Pro
- ✨ Glassmorphism UI + subtle animations
- 🗂️ Local session history (stored in browser)
- 📄 PDF export endpoint (`/api/export`)

## Quick Start

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env
# (optional) add OPENAI_API_KEY for richer feedback
npm start
# http://localhost:3000
```

### 2) Frontend
Open `frontend/index.html` directly in Chrome (allow mic).
Or serve it:
```bash
cd frontend
python -m http.server 5500
# open http://localhost:5500
```

## API
- `GET /api/questions?role=software&difficulty=medium`
- `POST /api/feedback` → `{clarity, confidence, keywords, tip}`
- `POST /api/export` → returns PDF from provided `session` JSON

## Notes
- Without OpenAI, heuristic scoring still works offline.
- History is saved only to your browser (localStorage).
