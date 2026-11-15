#Orbit Architect
Orbit Architect is an interactive space-mission design and flight game. Players define a science objective, choose an orbit, assemble a spacecraft, pass a flight-readiness review, launch it, and inspect the outcome. The project is designed as a learning experience: the engineering values are simplified, but the relationships between mass, power, data, volume, cost, reliability, and mission risk are explicit and inspectable.
The application is a client-side Vite project. There is no backend, database, authentication layer, or network API. Mission definitions and game content are bundled with the frontend, while 3D scenes, launch outcomes, sound effects, and docking interactions run in the browser.
What the player does
The main experience is a stateful mission loop:
Intro and solar-system dive - the player starts the experience and transitions into the mission base.
Base exploration - the player walks around the 3D operations base and visits interactive hubs.
Mission definition - the player chooses a science objective and a compatible orbit.
Spacecraft design - the player selects instruments, power, communications, a spacecraft bus, and a launcher.
Flight-readiness review - the engine calculates resource margins, blockers, warnings, and risk level.
Launch - a timed shuttle-style launch animation visualizes separation, insertion, and deployment.
Mission execution - the craft either operates in Earth orbit, cruises to the Moon or Mars, or arrives at the selected destination.
Mission report - the player receives an outcome, score, verdict, deterministic cause chain, and related real-mission examples.
ISS tour or docking - after a completed mission, the player can tour the ISS or attempt manual docking with a spacecraft.
Technology stack
React 18 for the application shell and UI state.
TypeScript for type-safe content, selection state, engine results, and scene props.
Vite 5 for local development and production bundling.
React Three Fiber for rendering Three.js scenes as React components.
Three.js for meshes, materials, cameras, animation, GLTF models, textures, and spatial calculations.
`@react-three/drei` for controls, loaders, environment lighting, stars, HTML labels, and pointer-lock movement.
`@react-three/postprocessing` and `postprocessing` for bloom and tone mapping.
Tailwind CSS 4 for utility classes used by the interface.
Web Audio API for procedural sound effects. Voiceover is optional audio-file content.
Repository layout
```text
.
├── index.html                 Browser entry document
├── package.json               Scripts and runtime/development dependencies
├── start-game.sh              macOS/Linux convenience launcher
├── START_GAME.bat             Windows convenience launcher
├── public/
│   ├── audio/vo/              Optional recorded voiceover files
│   ├── models/                GLB spacecraft, launch-pad, and ISS assets
│   └── textures/              Planet and normal-map textures
└── src/
    ├── main.tsx               React bootstrap and global CSS import
    ├── App.tsx                Top-level state machine, UI, and orchestration
    ├── Scene.tsx              Shared Three.js primitives and mission-world scenes
    ├── engine.ts              Pure mission evaluation and seeded launch simulation
    ├── data.ts                Typed objectives, orbits, and spacecraft component data
    ├── audio.ts               Procedural Web Audio sound system
    ├── voice.ts               Optional voiceover playback and caption timing
    ├── index.css              Global layout, theme variables, and reduced-motion rules
    ├── data/
    │   ├── learning_cards.json
    │   └── real_missions.json
    └── scenes/
        ├── Base.tsx           Walkable base, hubs, movement, and launch pad
        ├── Solar.tsx          Solar-system overview and transfer trajectories
        └── Iss.tsx            ISS tour and manual docking simulation
```
`node_modules/` is generated dependency output and is not part of the application source. The `public/` directory is served at the web root, so a file such as `public/textures/earth.jpg` is referenced in code as `/textures/earth.jpg`.
Architecture and interconnection
1. Browser bootstrap
`index.html` supplies the `root` element and loads `/src/main.tsx`. `main.tsx` creates the React root, wraps `App` in `React.StrictMode`, and imports `index.css`.
2. `App` is the application coordinator
`App.tsx` owns the player-facing workflow. Its `View` union is the navigation state for the whole game:
```text
intro → dive → base
              ├── define → design → review → launch → pad
              │                                      └── orbit
              ├── iss
              └── base

orbit → cruise → arrive       (Moon/Mars missions)
orbit → report                (Earth-orbit missions, represented by completed orbit state)
```
The component:
stores the current `View`;
stores the `Sel` mission configuration;
derives the current review with `evaluate(sel)`;
starts a launch with `runLaunch(sel, review, seed)`;
chooses which Three.js scene to render;
connects scene callbacks to UI progress and completion state;
controls fade transitions, pointer-lock release, visited hubs, mute state, and adaptive quality;
selects learning cards and real-mission examples for the current phase.
The UI and 3D scenes communicate through props and callbacks rather than a global state library. For example, `Base` reports the nearby hub, `App` changes the view after the player presses `E`, and `World`/`Solar` report animation progress through `onProgress` and completion through `onDone`.
3. Data is the mission domain model
`data.ts` is the authoritative source for the playable engineering choices. It defines:
`OBJECTIVES`: science goals, budgets, compatible orbit IDs, and learning text;
`ORBITS`: altitude, destination, mission factor, and descriptions;
`INSTRUMENTS`: science value and resource requirements;
`POWER`: generated power and hardware cost;
`ANTENNAS`: downlink capacity and power/mass requirements;
`BUSES`: spacecraft capacity, model references, and resource requirements;
`LAUNCHERS`: lift capacity, fairing volume, price, and reliability.
Each component uses the shared `Part` shape. The engine therefore aggregates components generically instead of branching on individual component IDs. To add a new instrument or hardware option, add a correctly shaped row and, when needed, add its objective ID. The UI lists the rows from these arrays automatically.
4. The engine is pure business logic
`engine.ts` deliberately has no DOM, React, Three.js, or browser APIs. It imports the typed domain data and exposes:
`evaluate(sel)`: resolves selected IDs, sums resource requirements, calculates orbit-adjusted launch capacity, and returns a `Review`;
`runLaunch(sel, review, seed)`: runs seeded risk events and returns a `LaunchResult`;
`usd(x)`: formats costs for the UI.
The review calculates margins for:
mass versus launch capacity;
spacecraft volume versus fairing capacity;
power demand versus generated power;
instrument data production versus antenna downlink capacity;
total cost versus objective budget.
Hard constraints become blockers, so `canLaunch` is false. Power/data shortfalls and thin margins become warnings. The worst of the mass, power, and data ratios determines the green/yellow/red risk level.
Launch outcomes are reproducible for the same selection, review, and seed. The seed currently comes from `Date.now().toString(36)` when the player starts a launch. The result includes the individual rolls, outcome, score categories, verdict, and cause chain so the UI can explain why a mission succeeded or failed.
5. Three.js scene layer
`Scene.tsx` contains reusable rendering and spacecraft functions:
texture loading and color-space setup;
Earth, Moon, and Mars bodies with atmospheres;
lighting/environment helpers;
GLTF spacecraft loading and normalization;
procedural spacecraft construction from the selected `Sel`;
Earth orbit visualization;
launch and arrival animation components;
the exported `World` scene used by `App`.
The scene components consume `Sel`, but they do not decide whether a design is valid. That decision remains in `engine.ts`. This keeps visual presentation separate from mission rules.
The specialized scenes are:
`Base.tsx`: walkable operations base, hub proximity detection, pointer-lock movement, and the launch-pad countdown animation;
`Solar.tsx`: planet layout, orbital motion, Hohmann-like transfer visualization, and Moon cruise animation;
`Iss.tsx`: ISS model tour labels plus a physics-lite manual docking mode with thrust, fuel, collision boxes, and docking status.
6. Audio and voiceover
`audio.ts` creates a single Web Audio context after the user starts the experience. It synthesizes wind, space ambience, launch rumble, hiss, burn, beeps, radio bursts, and impact-like sounds. `App` changes layers as the current `View`, launch timeline, and caption change.
`voice.ts` maps event IDs to captions and durations. It attempts to load `/audio/vo/<id>.mp3`; if the file is absent, the caption still appears for the configured duration. Voice playback ducks procedural sound and prevents overlapping lines.
7. Learning and mission reference data
`learning_cards.json` supplies short engineering lessons shown by phase.
`real_missions.json` supplies paraphrased mission examples. `App` filters them with objective-specific regular expressions and displays a small set in the final report.
The JSON files are imported at build time. They are content inputs, not runtime API responses. Keep their schema stable when adding rows, and verify that IDs used for matching correspond to the current `data.ts` model.
Runtime data flow
```text
User input
   │
   ▼
App state: View + Sel
   │
   ├── evaluate(Sel)
   │       └── Review: margins, blockers, warnings, risk, canLaunch
   │
   ├── UI panels
   │       └── objective/design/review/launch controls
   │
   └── 3D scene props
           ├── Base → nearby hub / launch timeline
           ├── World → launch, orbit, arrival progress
           ├── Solar → cruise progress
           └── Iss → docking telemetry

When launch starts:
Sel + Review + seed
   │
   ▼
runLaunch(...)
   │
   └── LaunchResult → animation flags + final report + score
```
The important boundary is that the engine result is computed before the visual launch begins. The launch scene reads flags derived from the result (`fail`, `fault`, and deep-transfer behavior), while the report reads the complete `LaunchResult`.
Getting started
Requirements
Node.js with npm. Use a current LTS release.
A modern browser with WebGL support.
Audio playback may require a user gesture; the start button initializes the audio context.
Convenience launchers
Windows:
```text
Double-click START_GAME.bat
```
macOS/Linux:
```sh
./start-game.sh
```
Both scripts check for Node.js, install dependencies on first run with `npm install --legacy-peer-deps`, and start Vite.
Manual setup
```sh
npm install --legacy-peer-deps
npm run dev
```
Open the URL printed by Vite, normally `http://localhost:5173`.
Development commands
```sh
npm run dev       # Start the Vite development server
npm run build     # Type-check-independent production bundle
npm run typecheck # Run TypeScript without emitting files
npm run preview   # Serve the production bundle locally
```
There is currently no automated test script in `package.json`. For changes to mission rules, run `npm run typecheck` and `npm run build`; for scene changes, also exercise the affected view manually in a WebGL-capable browser.
Controls
Base and general navigation
Click the scene to capture the mouse.
`W`, `A`, `S`, `D` move through the base.
`Shift` moves faster.
`E` interacts with a nearby hub.
`Esc` releases pointer lock.
`M` toggles mute.
ISS docking
In docking mode, use:
`W` / `S`: forward and reverse thrust;
`A` / `D`: lateral thrust;
`Space` / `C`: vertical thrust;
`X`: braking.
The docking controller reports range, relative speed, speed limit, fuel, and status (`approach`, `docked`, `crash`, or `dry`).
Extending the project
Add a mission component
Add a row to the appropriate array in `data.ts`.
Use a unique `id`.
Set all shared resource fields in the `Part` shape.
Add `objectives` for instruments so they appear for the intended objectives.
Add a `model` URL only when the component should use a GLB spacecraft model.
Run `npm run typecheck` and verify the design and review screens.
No engine changes should be required for ordinary data additions.
Add an objective or orbit
Add the row to `OBJECTIVES` or `ORBITS`, then ensure:
every referenced orbit ID exists;
the destination is one of `earth`, `moon`, or `mars`;
the objective has a realistic budget for the simplified component catalog;
the objective has matching learning and real-mission content if the report should be populated.
`App` derives the available orbit and instrument choices from these relationships.
Add a new view or scene
Extend the `View` union and `CARD_AT` in `App.tsx`.
Add the view transition and rendering branch.
Keep simulation state in `App` if it affects the overall mission flow.
Put reusable Three.js behavior in `Scene.tsx` or a specialized file under `src/scenes/`.
Expose progress and completion through callbacks rather than directly mutating UI state from a scene.
Add audio/voice cues only when they correspond to real state transitions.
Add assets
Place GLB files in `public/models/`, textures in `public/textures/`, and optional voice files in `public/audio/vo/`. Reference them with root-relative URLs such as `/models/new-craft.glb`. Preload frequently used GLTF assets with `useGLTF.preload(...)` when load latency affects a transition.
Design and maintenance guidelines
Keep mission rules in `engine.ts`, not in JSX or scene animation code.
Prefer adding data rows over adding ID-specific conditionals.
Preserve the `Sel`, `Review`, and `LaunchResult` contracts when changing the mission flow.
Keep browser-only behavior such as audio, pointer lock, camera movement, and timers in React/scene modules, not in the pure engine.
When changing resource units, update the comments and every consumer together. Current units are kilograms, watts, Mbps, cubic metres, and US dollars.
Use `prefers-reduced-motion` behavior already defined in `index.css` as the baseline for UI motion changes.
Keep educational copy clearly labeled as simplified learning content; the application is not an authoritative mission-planning tool.
Known implementation notes
Launch risk is intentionally game-like and seeded rather than a physical trajectory or reliability model.
Orbit and transfer visuals are illustrative. They are not intended to provide precise orbital mechanics.
Audio and voiceover are optional enhancements; missing voice files should not block gameplay.
The project uses `React.StrictMode`, so development builds may initialize and clean up effects more than once. Scene and audio effects should remain safe to initialize and dispose.
Asset paths are case-sensitive when deployed to Linux-hosted environments.
Troubleshooting
The game does not start
Confirm Node.js is installed and run:
```sh
npm install --legacy-peer-deps
npm run dev
```
If the browser does not open automatically, navigate to the URL printed in the terminal.
A model or texture is missing
Check that the file exists under `public/` and that the code uses the exact root-relative path and casing. Browser developer tools will usually show a 404 for the missing asset.
No sound is heard
Start the game through the intro interaction first. Browsers commonly block Web Audio until a user gesture. Also check the in-game mute state with `M`.
The game is slow
The app renders high-resolution planets, GLTF models, postprocessing, and many stars. Test with the adaptive quality behavior in the UI, close other WebGL tabs, and profile scene changes before reducing asset quality globally.
