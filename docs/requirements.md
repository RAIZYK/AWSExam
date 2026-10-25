# Project requirements and acceptance checklist

## Functional
1. User can select Practice or Exam mode, question count, and domain.
2. Questions can be navigated in both directions; selected answers remain in state.
3. Questions can be flagged for review.
4. Exam mode has a 90-minute timer; timeout submits the attempt.
5. Grading returns score and answer explanations.
6. Results are saved and visible in history.

## Non-functional
- Responsive layout and keyboard navigation.
- Service boundaries and REST contracts.
- Containerized services, health checks and isolated Docker network.
- PostgreSQL persistence.
- Automated API tests and OpenAPI documentation.
- Environment-based configuration and deployment documentation.

## Acceptance
- `docker compose up --build -d` starts healthy services.
- Frontend loads at `http://localhost:8080`.
- API health endpoint returns `status: ok`.
- Exam can be completed and appears in result history.
- API documentation loads from the gateway.
