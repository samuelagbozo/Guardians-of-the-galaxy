# AGENT_RULES.md

Operational contract for autonomous AI agents working on the Space Mission Design Game.
Read `AGENTS.md` first for repository orientation, then this file before changing code,
data, or configuration.

## 1. Authority and precedence

1. An explicit, current human instruction.
2. This file (`AGENT_RULES.md`).
3. `AGENTS.md`.
4. The PDFs in `resources/` and `README.md`.
5. Agent assumptions.

If a human request conflicts with a hard rule here (for example, asks for React or a
backend), do not silently comply. Surface the conflict and ask the human to amend this
file first. Where rules overlap, the stricter rule wins.

## 2. Project and stage model

- Browser-only, single-player game. All game logic runs client-side and the built output
  must work as static files.
- Canonical four stages, per the role-breakdown PDF:
  1. **Define** — objective and orbit selection.
  2. **Design / Builder** — instrument, power, antenna, bus, and launch-vehicle choices.
  3. **Review Gate** — totals, margins, hard blockers, and warnings.
  4. **Launch / Report** — run animation plus the terminal report card.
- The report is the terminal view of stage 4, not a fifth stage. Do not omit or merge the
  Design and Review stages; the gate check is a distinct screen/state.
- The whole loop must be completable in under 10 minutes.

## 3. Stack lock (hard)

Allowed:

- Vite for dev server and production build.
- Vanilla JavaScript ES modules (`import` / `export`), modern browser APIs.
- Plain HTML and CSS.
- JSON data files.
- Vite-native test tooling only after it is approved and added to `package.json`.

Forbidden unless a human explicitly amends this file:

- React, Vue, Svelte, Angular, Next.js, Nuxt, or any UI framework/runtime.
- Node.js/Express or any application server, serverless function, database, or ORM.
- TypeScript, JSX, or a build-time transpiler beyond what Vite provides.
- Runtime dependencies for state management, DOM manipulation, charts, or CSS.
- Live network calls, API keys, secrets, or remote data at runtime.
- Mixing package managers or committing multiple lockfiles. If no lockfile exists, ask
  before choosing one.

Prefer the smallest dependency set. A task that appears to require forbidden technology
is a stop condition, not permission to substitute another stack.

## 4. Agent lanes and file ownership

Agents act in one of six lanes derived from the PDF roles. Declare the lane and the files
you intend to touch before editing. Do not edit outside your lane without approval.

| Lane (PDF role) | Owns | Must not change |
| --- | --- | --- |
| **Engine Architect** (role 1) | `src/engine/calc.js`, `gates.js`, `state.js`, schema definitions, shared math utilities | DOM, CSS, screen markup, content copy |
| **UI Builder** (role 2) | `src/ui/screens/define.js`, `design.js`, `review.js`, shared UI components, live resource bars | Formulas, engine internals, risk thresholds |
| **UI Run/Report** (role 3) | `src/ui/screens/launch.js`, report card, launch/orbit animation, Risk Face | Risk odds, scoring rules, engine math |
| **Risk & Systems** (role 4) | `src/engine/risk.js`, `score.js`, seeded RNG, outcome logic | Gate classification, mass/power/cost formulas, DOM |
| **Content & Data** (role 5) | `src/data/*.json`, tooltips, learning cards, player-facing copy | Engine logic, UI behavior, schema shape |
| **QA & Polish** (role 6) | Tests, cross-browser fixes, accessibility, performance, report/gate audits | Weakening tests, hiding failures by editing data, unapproved math changes |

Rules that apply across lanes:

- Do not duplicate engine formulas in UI code. The UI displays values returned by the
  engine; it does not recompute mass, power, cost, data, margins, or odds.
- Cross-lane work requires explicit human assignment, and every approval gate still
  applies.
- A content addition that requires an engine change is a schema/engine gap. Stop and ask;
  do not special-case the new content in engine code.

## 5. Required layout and engine isolation

When scaffolding begins, use this target layout (deviations require approval):

```text
src/
  main.js                 # app bootstrap, state wiring, screen mounting
  engine/                 # pure logic; no DOM, no imports from ui/
    calc.js               # mass, power, data, cost
    gates.js              # hard blockers vs warnings
    risk.js               # seeded RNG, event odds, outcome
    score.js              # scoring and verdicts
    state.js              # stage state machine
  ui/
    screens/              # define, design, review, launch/report
    components/           # bars, risk face, report card
  data/                   # one JSON file per entity type
  styles/
tests/
  engine/
```

Engine contract:

- The engine is a pure library: functions accept explicit inputs (state, data, RNG) and
  return results or new state. No `window`, `document`, DOM events, `fetch`, timers,
  storage, or UI imports.
- Dependency direction is `ui → engine` and `ui → data`. The engine must never import
  from `ui/`.
- No content branching in engine code. Forbidden: `if (instrumentId === "camera-x")`.
  Differences come from data fields.
- All randomness flows through one injected, seeded RNG. No `Math.random()` in engine
  code. Record the seed and every roll in the report/debug output so outcomes are
  reproducible.
- Guard against `NaN` and `Infinity`; never pass them to the UI. Validate numeric input at
  the engine boundary.
- Keep gate checks honest: hard blockers (launch fit, budget) must block; warnings (power,
  data, margins) must not silently become blockers or disappear.

## 6. Data handling

- One JSON file per entity type: `objectives`, `orbits`, `instruments`,
  `power-systems`, `antennas`, `launch-vehicles`, `spacecraft-buses`.
- Every row has a stable `id` (kebab-case) and human-readable `name`. Never reuse or
  rename an existing `id`; add a new row instead.
- Put units in field names: `massKg`, `powerW`, `costUsd`, `dataRateMbps`, `volumeM3`.
  Use SI-style base units consistently.
- All numbers must be finite; use `0` or `null` deliberately, never `NaN` or numeric
  strings.
- Player-facing copy belongs in data/UI copy files, not in engine conditionals.
- Mark placeholder or unverified NASA figures explicitly (for example
  `"isPlaceholder": true` and a `source` note). Do not present invented values as verified
  data.
- Adding content must be a data-only change: add the row(s), ensure the UI renders the new
  option dynamically, and confirm the engine diff is empty. If either fails, stop and ask.
- Changing a schema — required fields, units, IDs, enums, or meaning of a field — is
  approval-gated.
- Keep JSON valid: double quotes, no comments, no trailing commas, two-space indentation.

## 7. Code style

- ES modules only; no globals, no `var`, prefer `const`, and use named exports.
- File names: kebab-case. Functions/variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Keep engine functions small and pure. Separate calculation from rendering and from
  event wiring.
- Add JSDoc to every exported engine function and to each data shape. Document units.
- DOM: use `querySelector`/`addEventListener` and create nodes programmatically. Never
  interpolate data or user input into `innerHTML`; use `textContent`.
- CSS: plain CSS with custom properties, mobile-first, no framework, avoid `!important`.
  Status may not rely on color alone; Risk Face needs a text label.
- Every player-facing failure message names the cause and the exact numeric shortfall or
  excess. No generic "invalid design" errors.
- No `console.log` in committed code. No dead code or commented-out blocks.
- Do not reformat files unrelated to the change.

## 8. Autonomy boundaries

### Stop and ask before

- Changing engine math, formula order, gate classification, scoring, balance constants,
  or the placeholder risk odds (**5% green / 15% yellow / 30% red**).
- Changing a JSON schema, existing IDs, units, required fields, or entity semantics.
- Changing Vite config, `package.json`, the entry HTML, deployment/build settings, the
  package manager, or adding any dependency.
- Changing the stage state machine, navigation, or screen order.
- Deleting or renaming files, especially `resources/` PDFs or `README.md`.
- Adding tests that require a new runner or configuration.
- Any change that requires a backend, network access, secret, or database.
- Resolving genuine ambiguity or a conflict between the PDFs and an instruction. Cite
  the source and present options.
- Committing, pushing, rebasing, or opening a pull request, unless explicitly asked.

### Safe to do without asking

- Add rows to existing data files when the schema already supports them.
- Add or improve copy, tooltips, and learning cards without changing game behavior.
- Add tests and documentation.
- Fix a defect without changing documented behavior, formulas, schema, or config.
- Styling or markup changes that preserve all behavior and gate outcomes.

### Never

- Introduce a forbidden framework, backend, database, ORM, or runtime dependency.
- Weaken, skip, or delete a test to make a change pass.
- Hide a blocker or warning, or change a threshold to make a design pass.
- Bypass the seeded RNG or fabricate roll results.
- Edit the PDFs in `resources/` or change `README.md`'s UTF-16 encoding without
  instruction.
- Commit secrets, credentials, or generated build output.

## 9. Verification and Definition of Done

**Current state:** there is no `package.json` or test runner. Until scaffolding exists, do
not claim that commands, tests, or builds passed. Verify by static review and report the
missing tooling.

Once Vite is scaffolded, the expected scripts are `dev`, `build`, and `preview`; add
`test` and `lint` when approved. Use the package manager indicated by the lockfile. Run
in this order:

```sh
npm run lint     # if configured
npm test         # if configured
npm run build
npm run preview  # browser smoke test
```

If a script does not exist, report it as a verification gap rather than substituting an
unapproved one-off command.

Every change must satisfy:

- **Build:** production build passes with no errors.
- **Engine:** unit tests cover changed formulas, gate boundaries, and risk odds; include
  an exact-threshold case and a failure case. Risk tests use a fixed seed.
- **Data:** the new row appears in the UI without any engine edit; totals update; an
  invalid row fails validation with a clear message.
- **UI:** browser check at desktop width and ~375px mobile; no console errors, no
  horizontal overflow, controls keyboard-reachable, live bars update immediately.
- **Gate/report:** failure messages name both the cause and the exact number; the report
  shows cause chain, odds, rolls, score breakdown, and the skill-vs-luck verdict.
- **Loop:** the full Define → Design → Review → Launch → Report flow still completes in
  under 10 minutes.
- **Imports:** no DOM access in `engine/`, no UI imports from `engine/`, no forbidden
  dependencies.

## 10. Change workflow and report

1. Read `AGENTS.md`, this file, and the relevant PDF section.
2. Declare lane, intended files, and whether any approval gate applies.
3. Stop and ask if a stop condition is hit; otherwise make the smallest change that
   satisfies the task.
4. Verify using the checks above.
5. Report: **Changed**, **Verified** (commands and results), **Risks / gaps**, and
   **Approval requested** (if any). Include screenshots for visual changes.

When unsure, ask one focused question rather than guessing. A blocked task is acceptable;
an unapproved architecture or data change is not.
