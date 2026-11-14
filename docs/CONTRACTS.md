# Space Mission Game Contracts

This document is the shared boundary between the engine/store owner and the screen,
visual, risk, content, and QA roles. Units are part of numeric field names: mass in
kilograms, power in watts, data rates in megabits per second, data volume in megabytes,
delta-v in meters per second, and cost in millions of credits.

## Data and types

`src/types/game.ts` defines the app-wide interfaces. All catalog rows share an `id`,
display copy, tooltip, and optional learning-card id. Component numeric values live in
`attributes`; the evaluator can sum these named attributes without branching on item
names. For example, an instrument row can add its own `massKg` and `sciencePoints`
values without requiring a new engine case.

`Objective` supplies a `budgetM` and `missionDurationDays`; `Orbit` supplies
`deltaVNeedMps`; each `LaunchVehicle` maps orbit ids to payload capacity; each
`SpacecraftBus` supplies `propulsionIspSec`. `GameConfig` carries the default seed,
margin threshold, gravity constant, check registry, and fuel-model description. Its
`checks` rows compare named metrics and define blocker/warning severity; adding another
comparison between supported metrics is data-only.

`MissionSelections` is the selected objective/orbit, one id for each spacecraft
component, and a list of instrument ids. `GameDataInput` is the raw set of tables accepted
by the validator. Example:

```ts
const selections: MissionSelections = {
  objectiveId: 'map-crops',
  orbitId: 'leo',
  busId: 'cubesat-bus',
  powerId: 'compact-solar',
  antennaId: 'x-band-patch',
  launchVehicleId: 'small-launcher',
  instrumentIds: ['multispectral-camera'],
};
```

`ResourceTotals` is the engine's resource summary. `CheckResult` is one measurable
pass/fail check; its `cause` must state the relevant quantities and unit when it fails,
and `margin` is `(available - required) / available`. `MissionEvaluation` groups totals,
all checks, blockers, warnings, launch permission, and the worst margin for Role 3/4.

`RiskOutcome`, `EventRoll`, `EventOdds`, `ScoreBreakdown`, and `MissionReport` are
integration shapes. Role 4 owns the final risk rules; Role 3 can render a report without
depending on their implementation. `MissionResult` aliases `MissionReport` for consumers
using that name.

## Loading catalog data

`src/data/*.json` contains the bundled tables. `loadGameData()` in `src/data/schema.ts`
validates every row with Zod and throws errors naming the JSON file, row id, and field.
To validate modified or test data, pass table values as an object:

```ts
const data = loadGameData({
  objectives: editedObjectives,
  orbits,
  instruments,
  powerSystems,
  antennas,
  launchVehicles,
  buses,
  config,
});
```

## Engine

`evaluateMission(selections, data)` is a pure function with no UI imports.

- Dry mass is the sum of bus, instrument, power-system, and antenna `massKg` attributes.
- Fuel is estimated by `dryMassKg * (exp(deltaVNeedMps / (propulsionIspSec * gravityMps2)) - 1)`.
  This simplified rocket-equation estimate is marked `TODO(balance)` for tuning.
- Total mass is dry mass plus fuel; cost sums selected component attributes plus
  launch-vehicle cost, while science points sum selected instrument attributes.
- Power generation comes from the selected power system and use sums selected component
  consumption, in watts. Generated data sums instrument rates; downlink uses the antenna
  rate. Each data volume in MB is its Mbps rate times mission seconds divided by 8.
- Registry checks calculate `margin = (available - required) / available`. A passing
  check below the configured margin threshold gets a separate warning; launch-fit,
  budget, and missing selections remain hard blockers.

```ts
const evaluation = evaluateMission(selections, gameData);
if (!evaluation.canLaunch) console.log(evaluation.blockers);
```

## Store actions and screens

`useGameStore` exposes `screen` (`define`, `design`, `review`, `launch`, or `report`),
selections, evaluation, report, and a deterministic seed. Selection actions immediately
refresh the evaluation. `goNext()` only leaves Define after an objective and orbit are
selected; Review can advance to Launch only when `evaluation.canLaunch` is true. `launch()`
calls the configured risk hooks and moves to Report; it throws if called from the wrong
screen or with blockers. `resetGame(seed?)` clears the mission and may set a reproducible
seed.

```ts
const { setObjective, setOrbit, goNext } = useGameStore.getState();
setObjective('map-crops');
setOrbit('leo');
goNext(); // Define -> Design
```

For Role 4 integration, create a store with replacement hooks rather than editing
screen code:

```ts
const useIntegratedStore = createGameStore({ riskHooks: role4RiskHooks });
```

## Risk hooks

`RiskHooks` keeps odds, random event rolls, outcome resolution, and scoring replaceable.
The Step 0 implementation is intentionally a placeholder (5% green, 15% yellow, 30%
red); its seeded RNG makes repeat runs reproducible.

```ts
const odds = defaultRiskHooks.computeEventOdds(evaluation);
const rolls = defaultRiskHooks.rollEvents(odds, createSeededRng(42));
const outcome = defaultRiskHooks.resolveOutcome(evaluation, rolls);
const score = defaultRiskHooks.scoreMission(evaluation, outcome);
```

## Changelog

- **Step 0 — initial contract:** Added shared game types, bundled placeholder JSON,
  validation/loader, engine and risk-hook stubs, Zustand store, and integration examples.
- **Step 1 — BREAKING CHANGE:** `GameConfig` now requires a `checks: CheckDefinition[]`
  registry. Teammates replacing `gameConfig.json` or constructing `GameConfig` in fixtures
  must include the five required baseline checks; add-on checks may compare supported
  metrics without an engine change.
- **Step 2:** Added focused Vitest coverage for engine formulas/check boundaries, extensible
  catalog rows, readable validation failures, and store navigation/launch behavior.
