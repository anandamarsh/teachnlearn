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

## Exercise generator (JS)
The MCP tool `lesson_exercise_generator_put` expects a single JS file that defines a global
`generateExercise(noOfQuestions = 5)` function and returns an array of exercise items:
```js
function generateExercise(noOfQuestions = 5) {
  return [
    {
      type: "mcq",
      question_html: "<p>...</p>",
      options: ["A", "B", "C", "D"],
      answer: "B",
      steps: [
        { step: "Explain...", type: "mcq", options: ["..."], answer: "..." },
      ],
    },
  ];
}
```
The learner portal fetches this file from
`/catalog/teacher/{teacher_id}/lesson/{lesson_id}/exercise/generator` and runs it in a Web
Worker when the learner taps Start.

Exercises sections can also accept JS when saving via section endpoints:
- MCP `lesson_section_put` / `lesson_section_create`: set `content_type: "js"` and send JS in `code`.
- HTTP `/lesson/id/{lesson_id}/sections/{section_key}`: set `type: "js"` (or `contentType`) and send JS in `code`.

## Git hooks
Enable local hooks:
```
git config core.hooksPath .githooks
```
