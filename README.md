# Space Mission Design Game

A single-player, browser-based spacecraft design game. Choose a mission objective and
orbit, assemble a spacecraft, review its resource margins and blockers, then launch and
receive a mission report.

The target play loop is under ten minutes. Catalog values are illustrative placeholders;
game balance and flight realism will be refined as the data tables and risk model evolve.

## Mission flow

1. **Define** — Select an objective and orbit.
2. **Design** — Choose a spacecraft bus, power system, antenna, launch vehicle, and
   instruments.
3. **Review** — Inspect mass, budget, power, data return, margins, blockers, and warnings.
4. **Launch & Report** — Roll mission events and view the outcome and score.

## Architecture

- [`src/types/game.ts`](src/types/game.ts) — shared catalog, selection, evaluation, and
  report contracts.
- [`src/data/`](src/data/) — bundled JSON catalogs and game configuration.
- [`src/data/schema.ts`](src/data/schema.ts) — Zod validation and `loadGameData()`.
- [`src/engine/index.ts`](src/engine/index.ts) — pure, deterministic mission evaluation.
- [`src/engine/hooks.ts`](src/engine/hooks.ts) — seeded RNG and replaceable risk hooks.
- [`src/store/gameStore.ts`](src/store/gameStore.ts) — Zustand screen flow, selections,
  derived evaluation, and launch/report actions.
- [`src/store/debugSnapshot.ts`](src/store/debugSnapshot.ts) — JSON snapshot helper for a
  development debug view.
- [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — integration guide and contract changelog.

The engine aggregates numeric component attributes rather than branching on item names.
Catalog rows can be added in JSON and validated by the loader without changing engine
logic. Checks are configured in `src/data/gameConfig.json`; launch-fit, budget, and
incomplete selections are blockers, while power, data, and thin margins are warnings.

### Calculation model

- Dry mass is the sum of bus, instrument, power-system, and antenna masses.
- Fuel uses the ideal rocket equation with orbit delta-v, bus specific impulse, and the
  configured gravity constant. This is a simplified estimate marked `TODO(balance)`.
- Total mass is dry mass plus fuel. Mission cost sums component and launch-vehicle costs.
- Power is compared in watts. Generated and downlinked data volumes use rate in Mbps times
  mission duration in seconds divided by eight.
- Science points sum the selected instruments' data values.

See [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for formulas, types, store actions, and hook
examples.

## Development status

This repository currently contains the contracts, placeholder data, engine, store, hooks,
and Vitest test sources. It does **not** yet include the React/Vite app scaffold or a
`package.json`, so there are no runnable install, development-server, build, or test
commands yet. Add those with the app scaffold before running the Vitest suites.

The debug snapshot helper is ready for Role 2 to connect to a development-only `/debug`
route in the screen/router layer.
