# Architecture & design notes

## Responsibilities
- Frontend: presentation, answer selection, timer, review and history display. It never contains answer keys.
- Quiz API: authoritative question bank, exam assembly and grading.
- Results API: validates and persists result records; owns the results database schema.
- PostgreSQL: durable storage for results.
- Nginx gateway: single-origin development entry point and path routing.

## API contracts
`POST /exams`: `{ "limit": 20, "mode": "practice", "domain": null, "shuffle": true }`
returns an `exam_id`, timing information, and public question objects (without answer keys).

`POST /grade`: `{ "answers": [{ "question_id": "aws-001", "selected_index": 0 }] }`
returns correct/incorrect totals and explanations.

`POST /` on results API: exam ID, mode, total, correct, score percentage, and pass flag. The API checks score consistency before persistence.

## Security and production notes
- Do not put database credentials in source control; use a secrets manager in production.
- Add authentication/rate limiting if results need to be private per user.
- The current sample history is shared across local users and is appropriate for a classroom demo, not a multi-tenant production service.
- For high-stakes use, grading must be server-authoritative (it is), APIs should be HTTPS-only, and all endpoints should have monitoring and request limits.
- Replace local Compose Postgres with managed RDS for production.
