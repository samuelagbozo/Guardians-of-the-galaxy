# Guardians of the Galaxy — Frontend/Backend Data Model

## 1. Purpose

This document defines the canonical data exchanged between the Vite frontend and
the TypeScript backend. Both applications must use these shapes through the shared
contracts package. The frontend must not invent alternate field names or send
calculated values as authoritative data.

All API routes are versioned under:

```text
/api/v1
```

## 2. Data conventions

- JSON uses `camelCase`.
- IDs are stable, opaque strings in `kebab-case`.
- Dates are ISO 8601 UTC strings.
- Mass uses kilograms: `massKg`.
- Power uses watts: `powerW`.
- Cost uses USD: `costUsd`.
- Data rate uses megabits per second: `dataRateMbps`.
- Volume uses cubic metres: `volumeM3`.
- Percentages are decimal values between `0` and `1`.
- Counts are non-negative integers.
- Numeric values must be finite; `NaN` and `Infinity` are invalid.
- Unknown fields should be rejected on write requests.
- Backend-generated fields must not be trusted when supplied by the frontend.

## 3. Shared identifiers

```ts
type EntityId = string;

type ObjectiveId = EntityId;
type OrbitId = EntityId;
type InstrumentId = EntityId;
type PowerSystemId = EntityId;
type AntennaId = EntityId;
type LaunchVehicleId = EntityId;
type SpacecraftBusId = EntityId;
type MissionId = EntityId;
type UserId = EntityId;
```

The backend validates that every submitted ID exists in the active catalog version
and that the selected entities are compatible with the mission.

## 4. Mission lifecycle

```ts
type MissionStatus =
  | "draft"
  | "ready-for-review"
  | "reviewed"
  | "launching"
  | "launched"
  | "failed";
```

Allowed transitions:

```text
draft → ready-for-review
ready-for-review → draft
ready-for-review → reviewed
reviewed → draft
reviewed → launching
launching → launched
launching → failed
```

The frontend may request a transition, but the backend is authoritative and must
reject invalid transitions.

## 5. Catalog data models

Catalog records are read by the frontend and submitted back by ID. The frontend
must not submit an entire catalog object when selecting a component.

### Base catalog entity

```ts
type CatalogEntity = {
  id: string;
  name: string;
  description?: string;
  isPlaceholder?: boolean;
  source?: string;
  catalogVersion: string;
};
```

### Objective

```ts
type Objective = CatalogEntity & {
  type: "objective";
  scienceGoal: string;
  requiredDataMbps: number;
  requiredPowerW: number;
  budgetUsd: number;
  targetOrbitIds: OrbitId[];
};
```

### Orbit

```ts
type Orbit = CatalogEntity & {
  type: "orbit";
  altitudeKm: number;
  inclinationDeg: number;
  requiredLaunchVehicleClass?: string;
};
```

### Instrument

```ts
type Instrument = CatalogEntity & {
  type: "instrument";
  massKg: number;
  powerW: number;
  dataRateMbps: number;
  volumeM3: number;
  costUsd: number;
  compatibleObjectiveIds?: ObjectiveId[];
};
```

### Power system

```ts
type PowerSystem = CatalogEntity & {
  type: "power-system";
  massKg: number;
  powerW: number;
  volumeM3: number;
  costUsd: number;
};
```

### Antenna

```ts
type Antenna = CatalogEntity & {
  type: "antenna";
  massKg: number;
  powerW: number;
  dataRateMbps: number;
  volumeM3: number;
  costUsd: number;
};
```

### Spacecraft bus

```ts
type SpacecraftBus = CatalogEntity & {
  type: "spacecraft-bus";
  massKg: number;
  powerW: number;
  volumeM3: number;
  costUsd: number;
  payloadMassCapacityKg: number;
  payloadVolumeCapacityM3: number;
};
```

### Launch vehicle

```ts
type LaunchVehicle = CatalogEntity & {
  type: "launch-vehicle";
  massCapacityKg: number;
  volumeCapacityM3: number;
  costUsd: number;
  supportedOrbitIds: OrbitId[];
  vehicleClass: string;
};
```

## 6. Frontend-to-backend request models

### Create mission request

```ts
type CreateMissionRequest = {
  objectiveId: ObjectiveId;
  orbitId: OrbitId;
  catalogVersion?: string;
};
```

The backend creates the mission ID, timestamps, status, owner, and active catalog
version. The frontend must not send those fields.

### Design selections

```ts
type MissionDesignSelections = {
  instrumentIds: InstrumentId[];
  powerSystemId: PowerSystemId;
  antennaId: AntennaId;
  spacecraftBusId: SpacecraftBusId;
  launchVehicleId: LaunchVehicleId;
};
```

Rules:

- `instrumentIds` must contain at least one instrument unless the objective permits
  an empty payload.
- IDs must be unique.
- Required single-selection fields must contain exactly one ID.
- The backend validates compatibility and capacity.

### Update mission request

```ts
type UpdateMissionRequest = {
  objectiveId?: ObjectiveId;
  orbitId?: OrbitId;
  design?: MissionDesignSelections;
  expectedVersion: number;
};
```

`expectedVersion` prevents accidental overwrites when multiple browser tabs or
requests update the same mission.

The frontend must not submit calculated mass, power, cost, data, margins, odds,
score, outcome, timestamps, ownership, or status as update values.

### Review request

```ts
type ReviewMissionRequest = {
  expectedVersion: number;
};
```

The backend recalculates all totals from the mission selections and active catalog.

### Launch request

```ts
type LaunchMissionRequest = {
  expectedVersion: number;
  confirmation: true;
};
```

The literal confirmation value prevents accidental launch requests from incomplete
UI actions. The backend creates or records the seed; the frontend cannot choose or
override the authoritative launch seed.

## 7. Backend response models

### Mission summary

```ts
type MissionSummary = {
  missionId: MissionId;
  status: MissionStatus;
  objectiveId: ObjectiveId;
  orbitId: OrbitId;
  design?: MissionDesignSelections;
  catalogVersion: string;
  calculationVersion: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
```

### Mission response

```ts
type MissionResponse = {
  mission: MissionSummary;
};
```

### Catalog list response

```ts
type CatalogListResponse<T> = {
  items: T[];
  catalogVersion: string;
};
```

The backend should return catalog versions consistently across all catalog
endpoints. A frontend must not combine records from different catalog versions.

## 8. Calculation and review models

The backend returns calculated values. The frontend renders them and does not
recalculate them for authoritative decisions.

### Totals

```ts
type MissionTotals = {
  massKg: number;
  powerW: number;
  dataRateMbps: number;
  volumeM3: number;
  costUsd: number;
};
```

### Resource margin

```ts
type ResourceMargin = {
  resource: "mass" | "power" | "data" | "volume" | "cost";
  required: number;
  available: number;
  margin: number;
  unit: "kg" | "W" | "Mbps" | "m3" | "USD";
  isPassing: boolean;
};
```

`margin` is calculated as available capacity minus required amount. Positive values
indicate remaining capacity; negative values indicate a shortfall.

### Gate issue

```ts
type GateIssue = {
  code: string;
  severity: "blocker" | "warning";
  resource?: "mass" | "power" | "data" | "volume" | "cost" | "compatibility";
  message: string;
  required?: number;
  available?: number;
  difference?: number;
  unit?: "kg" | "W" | "Mbps" | "m3" | "USD";
};
```

Every player-facing issue must identify the cause and exact numerical shortfall or
excess when applicable.

### Review response

```ts
type ReviewResult = {
  missionId: MissionId;
  status: "reviewed" | "ready-for-review";
  totals: MissionTotals;
  margins: ResourceMargin[];
  blockers: GateIssue[];
  warnings: GateIssue[];
  canLaunch: boolean;
  catalogVersion: string;
  calculationVersion: string;
  version: number;
  reviewedAt: string;
};

type ReviewResponse = {
  review: ReviewResult;
};
```

Hard blockers must make `canLaunch` false. Warnings must remain visible and must not
silently become blockers.

## 9. Launch and report models

### Risk roll

```ts
type RiskRoll = {
  event: string;
  probability: number;
  roll: number;
  triggered: boolean;
};
```

`probability` and `roll` are decimal values between `0` and `1`.

### Score breakdown

```ts
type ScoreBreakdown = {
  total: number;
  categories: Array<{
    code: string;
    label: string;
    points: number;
    explanation: string;
  }>;
};
```

### Launch result

```ts
type LaunchResult = {
  missionId: MissionId;
  outcome: "success" | "partial-success" | "failure";
  seed: string;
  rolls: RiskRoll[];
  score: ScoreBreakdown;
  verdict: "skill" | "luck" | "skill-and-luck" | "unfavorable";
  causeChain: string[];
  launchedAt: string;
};

type LaunchResponse = {
  launch: LaunchResult;
};
```

The seed and rolls are server-generated and persisted. A report must be reproducible
from the stored mission selections, catalog version, calculation version, seed, and
rolls.

### Report response

```ts
type MissionReport = {
  mission: MissionSummary;
  review: ReviewResult;
  launch: LaunchResult;
};

type ReportResponse = {
  report: MissionReport;
};
```

## 10. Standard API envelopes

Successful single-resource responses should use a named property:

```json
{
  "mission": {}
}
```

Successful collection responses should use:

```json
{
  "items": [],
  "catalogVersion": "2026-01"
}
```

### Error response

```ts
type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
};
```

Recommended error codes:

```text
INVALID_REQUEST
INVALID_CATALOG_ENTITY
INCOMPATIBLE_SELECTION
MISSION_NOT_FOUND
MISSION_VERSION_CONFLICT
INVALID_MISSION_STATE
REVIEW_BLOCKED
LAUNCH_NOT_ALLOWED
UNAUTHORIZED
FORBIDDEN
RATE_LIMITED
INTERNAL_ERROR
```

Examples:

```json
{
  "error": {
    "code": "MISSION_VERSION_CONFLICT",
    "message": "Mission version 4 is required; received version 3.",
    "details": {
      "expectedVersion": 4,
      "receivedVersion": 3
    },
    "requestId": "req_01J..."
  }
}
```

```json
{
  "error": {
    "code": "INCOMPATIBLE_SELECTION",
    "message": "Launch vehicle 'small-launcher' cannot reach orbit 'polar-leo'.",
    "details": {
      "launchVehicleId": "small-launcher",
      "orbitId": "polar-leo"
    },
    "requestId": "req_01J..."
  }
}
```

## 11. HTTP status conventions

```text
200 OK                    Successful read, update, review, or report
201 Created               Successful mission creation
204 No Content            Successful deletion where no body is required
400 Bad Request           Malformed JSON or invalid request shape
401 Unauthorized          Missing or invalid authentication
403 Forbidden             Authenticated but not allowed
404 Not Found             Resource does not exist
409 Conflict              Version or lifecycle conflict
422 Unprocessable Entity  Valid shape but invalid domain selection
429 Too Many Requests     Rate limit exceeded
500 Internal Server Error Unexpected server failure
```

## 12. Frontend request flow

### Create

```text
Frontend selects objective/orbit
  → POST /api/v1/missions
  → backend validates IDs
  → backend returns MissionResponse
```

### Save design

```text
Frontend sends IDs and expectedVersion
  → PATCH /api/v1/missions/:missionId
  → backend validates IDs and compatibility
  → backend recalculates version
  → backend returns MissionResponse
```

### Review

```text
Frontend sends expectedVersion
  → POST /api/v1/missions/:missionId/review
  → backend recalculates totals and gates
  → backend returns ReviewResponse
```

### Launch

```text
Frontend sends confirmation and expectedVersion
  → POST /api/v1/missions/:missionId/launch
  → backend verifies review and blockers
  → backend generates seed and rolls
  → backend persists result
  → backend returns LaunchResponse
```

## 13. Validation requirements

The shared contracts package should validate:

- Required fields.
- Disallowed unknown fields.
- String lengths.
- ID formats.
- Array uniqueness.
- Array size limits.
- Finite numeric values.
- Non-negative numeric values.
- Decimal ranges for probabilities and percentages.
- Enum values.
- ISO date formats on responses.

The backend must additionally validate:

- Catalog existence.
- Catalog version compatibility.
- Objective/orbit compatibility.
- Component compatibility.
- Mass, volume, budget, power, and data constraints.
- Mission ownership.
- Mission lifecycle transitions.
- Expected version.
- Review completion before launch.

## 14. Versioning and compatibility

Every persisted mission should record:

```ts
type CalculationMetadata = {
  catalogVersion: string;
  calculationVersion: string;
};
```

Breaking API changes require a new API version. Changes to calculation formulas or
catalog semantics require a new `calculationVersion`, even if the HTTP schema is
unchanged.

The backend should reject a stale catalog version when a client submits selections
that cannot be interpreted consistently. The frontend should reload catalog data
when the backend reports a version mismatch.

## 15. Contract verification checklist

Before frontend/backend integration is considered complete:

- Frontend payloads compile against shared contracts.
- Backend routes validate against the same schemas.
- Every submitted component is represented by an ID, not an arbitrary client object.
- Backend-derived totals are never accepted from the frontend.
- Exact-threshold and failure cases are tested.
- Error responses have stable codes and request IDs.
- Mission version conflicts are tested.
- Catalog version mismatches are tested.
- Review and launch state transitions are tested.
- Launch seeds and rolls are persisted and reproducible.
- The report contains the complete review and launch cause chain.
