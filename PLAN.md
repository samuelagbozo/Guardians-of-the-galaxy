# Guardians of the Galaxy — Backend and Full-Stack Project Plan

## 1. Purpose and current state

This document defines the implementation plan for the Space Mission Design Game,
including the Vite frontend, TypeScript backend, shared API contracts, persistence,
testing, and deployment.

The repository currently contains project guidance and design resources, but no
application source, `package.json`, backend, frontend, test runner, or build
configuration.

The intended architecture is:

- **Frontend:** Vite-based browser application.
- **Backend:** TypeScript API application.
- **Shared contracts:** TypeScript request/response schemas and types shared by the
  frontend and backend.
- **Optional persistence:** Database-backed mission saving, reporting, and accounts
  when those capabilities are approved.

The existing `AGENTS.md` describes a browser-only JavaScript application and forbids
backend infrastructure. Before implementation begins, it must be updated so its
architecture and stack rules match this plan. The current human direction takes
precedence for this planning document: the frontend remains Vite-based and the
backend uses TypeScript.

## 2. Product and stage model

The game loop has four stages:

1. **Define** — choose the mission objective and orbit.
2. **Design / Builder** — choose instruments, power, antenna, spacecraft bus, and
   launch vehicle.
3. **Review Gate** — display totals, margins, blockers, and warnings.
4. **Launch / Report** — run the launch sequence and display the terminal report.

The report is part of the Launch stage, not a fifth stage. The complete loop should
remain playable in under 10 minutes.

## 3. Proposed repository layout

```text
/
├── apps/
│   ├── web/                         # Vite frontend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── engine/
│   │   │   ├── ui/
│   │   │   ├── data/
│   │   │   └── styles/
│   │   └── index.html
│   └── api/                         # TypeScript backend API
│       └── src/
│           ├── main.ts
│           ├── app.ts
│           ├── config/
│           ├── plugins/
│           ├── routes/
│           ├── services/
│           ├── repositories/
│           ├── validation/
│           ├── errors/
│           └── types/
├── packages/
│   ├── contracts/                   # Shared API schemas and types
│   ├── domain/                      # Shared game/domain types
│   └── config/                      # Shared TypeScript/tooling config
├── tests/
│   ├── api/
│   ├── integration/
│   └── contract/
├── resources/
├── package.json                     # Workspace scripts
├── tsconfig.base.json
├── PLAN.md
└── README.md
```

The exact package-manager and workspace implementation must be selected before
scaffolding. Do not introduce multiple lockfiles.

## 4. Technology strategy

### Frontend

- Vite.
- TypeScript for application code once the stack decision is approved.
- Browser-native APIs.
- No UI framework unless the project rules are explicitly amended.
- Shared API contracts imported from `packages/contracts`.

### Backend

- Node.js runtime.
- TypeScript.
- A lightweight TypeScript HTTP framework, preferably Fastify.
- Schema-based request and response validation.
- Structured logging and request IDs.
- OpenAPI documentation generated from route schemas.

### Persistence

Use PostgreSQL only if saved missions, accounts, leaderboards, shared reports, or
content administration require durable server-side state. If persistence is approved,
use migrations and a repository abstraction so business logic is not coupled directly
to database calls.

### Testing and tooling

- Vitest for unit and integration tests.
- TypeScript compiler checks.
- ESLint and a formatter after tooling decisions are approved.
- Docker Compose only if local database/API reproducibility is needed.

## 5. System responsibilities

### Frontend owns

- Rendering the four game stages.
- User interaction and navigation.
- Local UI state.
- Displaying calculations returned by the domain/engine layer.
- Loading, retrying, and presenting API errors.
- Responsive and accessible presentation.

### Backend owns

- API boundary validation.
- Authentication and authorization, if accounts are introduced.
- Mission persistence.
- Server-side validation of submitted designs.
- Review and launch processing if outcomes must be authoritative.
- Report persistence.
- Catalog delivery if catalog content is managed remotely.
- Rate limiting, observability, and operational health checks.

### Shared code owns

- Stable API request and response schemas.
- Domain identifiers and enums.
- Error response shapes.
- Versioned contract definitions.
- Types required by both frontend and backend.

The frontend must not duplicate backend formulas. The backend must not render UI.
Business logic should be testable without HTTP or DOM dependencies.

## 6. Backend module design

```text
apps/api/src/
├── main.ts                         # Process startup and graceful shutdown
├── app.ts                          # Framework/application composition
├── config/
│   ├── env.ts                      # Validated environment configuration
│   └── constants.ts
├── plugins/
│   ├── cors.ts
│   ├── logging.ts
│   ├── request-id.ts
│   ├── authentication.ts
│   └── error-handler.ts
├── routes/
│   ├── health.routes.ts
│   ├── catalog.routes.ts
│   ├── missions.routes.ts
│   ├── review.routes.ts
│   ├── launch.routes.ts
│   └── auth.routes.ts
├── services/
│   ├── catalog.service.ts
│   ├── mission.service.ts
│   ├── review.service.ts
│   ├── launch.service.ts
│   └── report.service.ts
├── repositories/
│   ├── mission.repository.ts
│   ├── report.repository.ts
│   └── user.repository.ts
├── validation/
├── errors/
└── types/
```

Use this request flow:

```text
Route handler
  → request validation
  → authentication/authorization
  → application service
  → domain calculation
  → repository
  → contract-shaped response
```

Route handlers should remain thin. Services should contain use-case logic, and
repositories should contain persistence details.

## 7. API plan

All endpoints should be versioned under `/api/v1`.

### Health and readiness

```text
GET /health
GET /ready
```

`/health` confirms that the process is running. `/ready` confirms that required
dependencies, such as the database, are available.

### Catalog

```text
GET /api/v1/objectives
GET /api/v1/orbits
GET /api/v1/instruments
GET /api/v1/power-systems
GET /api/v1/antennas
GET /api/v1/launch-vehicles
GET /api/v1/spacecraft-buses
```

Catalog records must preserve stable IDs and use explicit units. Invalid numeric
values, duplicate IDs, and malformed records must fail validation.

### Missions

```text
POST   /api/v1/missions
GET    /api/v1/missions/:missionId
PATCH  /api/v1/missions/:missionId
DELETE /api/v1/missions/:missionId
```

Mission creation should accept the objective/orbit and initial design selections.
Updates should be constrained by the mission state machine and ownership rules.

### Review and launch

```text
POST /api/v1/missions/:missionId/review
POST /api/v1/missions/:missionId/launch
GET  /api/v1/missions/:missionId/report
```

Review responses should include:

- Calculated totals.
- Resource margins.
- Hard blockers.
- Non-blocking warnings.
- Exact shortfalls or excesses.
- Calculation/catalog version identifiers.

Launch responses should include:

- Seed.
- Every recorded roll.
- Risk odds.
- Outcome.
- Score breakdown.
- Skill-versus-luck verdict.
- Cause chain used for the result.

### Optional authentication

Only add these endpoints if accounts are approved:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/me
```

Anonymous missions should be preferred for the initial playable version unless
accounts are necessary for the product goals.

## 8. Shared contract design

Create `packages/contracts` as the single source of truth for API shapes. It should
define:

- Mission creation and update payloads.
- Design selection objects.
- Catalog entity schemas.
- Review results.
- Gate blockers and warnings.
- Launch outcomes.
- Report cards.
- Pagination and filtering.
- API error responses.
- Contract/API version metadata.

Use a stable error envelope:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
};
```

Validation must happen at the backend boundary even when the frontend validates
the same input. Frontend validation improves usability; backend validation protects
correctness and integrity.

## 9. Data and persistence model

If persistence is approved, begin with:

- `users`
- `missions`
- `mission_designs`
- `mission_reviews`
- `mission_launches`
- `catalog_versions`

Store enough information to reproduce a result:

- Player selections.
- Objective and orbit identifiers.
- Catalog version.
- Calculation version.
- Seed.
- Risk rolls.
- Final outcome.
- Score breakdown.
- Created and updated timestamps.

Do not store only derived totals. Derived values may need to be recalculated after
the game rules change, while the original inputs and versions preserve historical
reports.

## 10. Domain and game-engine boundaries

The game engine should remain a pure library:

- Accept explicit state, catalog data, and random-number input.
- Return calculations or new state.
- Never access `window`, `document`, timers, storage, network APIs, or HTTP objects.
- Never import UI modules.
- Never branch on specific content IDs.
- Reject `NaN`, `Infinity`, invalid IDs, and malformed numeric input.
- Use one injected seeded RNG for reproducible outcomes.

The API may invoke the engine, but it should not duplicate engine formulas.
The frontend may invoke a local engine for responsive previews, but the server must
recalculate any authoritative review or launch result.

## 11. Implementation phases

### Phase 0 — Architecture and rules approval

- Confirm that an API is required for the first release.
- Decide whether missions are anonymous or account-based.
- Decide whether launch outcomes are server-authoritative.
- Select the backend HTTP framework.
- Select the database strategy.
- Select one package manager.
- Update `AGENTS.md` to permit the approved TypeScript backend architecture.
- Resolve the existing conflict between browser-only/static rules and API requirements.

**Exit criteria:** approved architecture decisions are recorded and repository rules
match the implementation plan.

### Phase 1 — Repository scaffolding

- Create the Vite frontend application.
- Create the TypeScript API application.
- Create shared contracts and domain packages.
- Add the root workspace configuration.
- Add shared TypeScript configuration.
- Add environment-variable validation.
- Add linting, formatting, and testing configuration.
- Add development scripts for frontend, backend, and shared checks.

**Exit criteria:** the frontend and backend compile independently, and shared types
can be imported by both applications.

### Phase 2 — Frontend domain foundation

- Implement the Define, Design, Review, and Launch/Report screens.
- Implement the pure engine and state transitions.
- Add local catalog data.
- Add responsive resource bars and gate display.
- Add keyboard-accessible controls.
- Add the initial report card.

**Exit criteria:** the entire game loop works locally without requiring the API.

### Phase 3 — API foundation

- Implement `/health` and `/ready`.
- Add structured logging.
- Add request IDs.
- Add centralized error handling.
- Add CORS configuration for local Vite development.
- Add request and response validation.
- Add OpenAPI documentation.
- Add graceful shutdown.

**Exit criteria:** the API starts, reports health/readiness correctly, rejects invalid
requests consistently, and exposes documented error responses.

### Phase 4 — Catalog APIs

- Add catalog routes and services.
- Validate catalog records and stable IDs.
- Add catalog versioning.
- Add frontend API loading.
- Add loading, retry, empty, and error states.
- Preserve a local fallback only if explicitly approved.

**Exit criteria:** the frontend can render all catalog choices from the API without
duplicating catalog definitions.

### Phase 5 — Mission persistence

- Add mission creation and update routes.
- Persist objective, orbit, and design selections.
- Add ownership checks when accounts exist.
- Add mission state transition validation.
- Add review calculation endpoint.
- Add migrations and repository integration if a database is selected.

**Exit criteria:** a mission can be created, updated, retrieved, reviewed, and
reloaded without losing its selections.

### Phase 6 — Launch and reports

- Add deterministic launch processing.
- Persist seeds and rolls.
- Persist the final report.
- Return blockers, warnings, odds, causes, score, and verdict.
- Ensure client and server use the same contract.
- Prevent duplicate or invalid launch transitions.

**Exit criteria:** a completed launch produces a reproducible report and cannot be
silently altered by a client.

### Phase 7 — Security and production readiness

- Validate every external input.
- Add rate limiting.
- Add secure HTTP headers.
- Configure allowed origins.
- Add authentication only if approved.
- Protect mission ownership and private reports.
- Add database migrations, backups, and connection limits if applicable.
- Add graceful shutdown and failure logging.
- Ensure secrets are supplied only through environment configuration.

**Exit criteria:** common invalid, unauthorized, and abusive requests are rejected
with explicit, contract-shaped errors.

### Phase 8 — Verification and release

- Run linting.
- Run unit and integration tests.
- Run the production build.
- Run a preview/server smoke test.
- Verify desktop and approximately 375px mobile layouts.
- Verify no console errors or horizontal overflow.
- Verify the full game loop remains under 10 minutes.
- Verify API documentation and deployment configuration.

**Exit criteria:** frontend, backend, contracts, and deployment artifacts pass the
approved release checks.

## 12. Testing strategy

### Unit tests

Cover:

- Mass, power, data, and cost calculations.
- Exact threshold boundaries.
- Failure cases and numeric validation.
- Gate blockers versus warnings.
- State-machine transitions.
- Seeded RNG behavior.
- Score and verdict calculations.
- Contract schema validation.

### API integration tests

Cover:

- Health and readiness.
- Catalog retrieval.
- Mission creation, update, and retrieval.
- Invalid IDs and malformed payloads.
- Review blockers and warnings.
- Launch transitions.
- Reproducible reports.
- Unauthorized access.
- Error envelope and request ID behavior.

### Frontend verification

Cover:

- All four stages.
- Live resource updates.
- Keyboard navigation.
- Responsive layout.
- Loading and API failure states.
- Report rendering.
- No formula duplication in UI code.

## 13. Operational requirements

- Use environment configuration with startup validation.
- Never commit credentials or secrets.
- Use structured logs with request IDs.
- Define timeouts for external/database operations.
- Return explicit errors rather than silent fallbacks.
- Add health/readiness checks suitable for deployment.
- Version API contracts and catalog/calculation rules.
- Define a migration and rollback process before production persistence.

## 14. Approval decisions required before implementation

The following decisions should be made before scaffolding:

1. Is a backend required for the first release, or should the first milestone remain
   frontend-only?
2. Should missions be anonymous, account-based, or support both?
3. Should launch outcomes be calculated and persisted by the server?
4. Which TypeScript HTTP framework should be used?
5. Is PostgreSQL required?
6. Which package manager and workspace strategy should be used?
7. Where will the frontend and API be deployed?
8. Should catalog content be static, API-served, or administrator-managed?
9. Should the frontend use TypeScript as well, or only the backend?

## 15. Recommended first release scope

To reduce risk, the first implementation should:

- Build the frontend game loop and pure engine first.
- Add a thin TypeScript API with health, catalog, mission, review, and report
  endpoints.
- Avoid accounts unless required.
- Use server-side recalculation for review and launch if a backend is introduced.
- Add persistence only after the local game loop and API contracts are stable.
- Keep the API versioned from its first endpoint.

This sequencing validates gameplay before infrastructure becomes a dependency while
still establishing the contracts and backend boundaries needed for future persistence,
accounts, leaderboards, and content management.

## 16. Verification commands after scaffolding

Once scripts exist, run:

```sh
npm run lint
npm test
npm run build
npm run preview
```

If a script is not configured, report it as a verification gap rather than replacing
it with an unapproved one-off command.
