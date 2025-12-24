# Teach n Learn Monorepo

Apps:
- `teacher-portal` - React + MUI SPA for teachers
- `learner-portal` - React + MUI SPA for learners
- `learning-server` - FastAPI backend for S3 operations

## Local setup

Teacher portal:
```
cd teacher-portal
cp .env.example .env
# Optional local override:
# echo "VITE_TEACHNLEARN_API=http://localhost:9000" > .env.local
npm install
npm run dev
```

Learner portal:
```
cd learner-portal
cp .env.example .env
# Optional local override:
# echo "VITE_TEACHNLEARN_API=http://localhost:9000" > .env.local
npm install
npm run dev
```

Learning server:
```
cd learning-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## Deployment notes
- Build SPAs with `npm run build` and copy `dist/` to `/var/www/teacher-portal` and `/var/www/learner-portal`.
- Run FastAPI on port 9000 (systemd or any process manager), e.g. `uvicorn main:app --host 0.0.0.0 --port 9000`.
- See `Caddyfile` for routing.

## Git hooks
Enable local hooks:
```
git config core.hooksPath .githooks
```
