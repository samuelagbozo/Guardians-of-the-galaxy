# Orbit Architect

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-React_Three_Fiber-000000?logo=threedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

**Orbit Architect** is an interactive space-mission design and flight game. Players define a science objective, choose an orbit, assemble a spacecraft, pass a flight-readiness review, launch it, and inspect the outcome. 

Designed as an interactive learning experience, the engineering values are simplified while keeping the relationships between **mass, power, data, volume, cost, reliability, and mission risk** explicit and inspectable.

The application is a 100% client-side Vite project—there is no backend, database, authentication layer, or network API. All mission definitions, 3D scenes, launch outcomes, procedural sound effects, and docking interactions run directly in the browser.

---

## 📑 Table of Contents

- [Gameplay Loop](#-gameplay-loop)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Controls](#-controls)
- [Repository Layout](#-repository-layout)
- [Architecture & Interconnection](#-architecture--interconnection)
- [Runtime Data Flow](#-runtime-data-flow)
- [Extending the Project](#-extending-the-project)
- [Design & Maintenance Guidelines](#-design--maintenance-guidelines)
- [Known Implementation Notes](#-known-implementation-notes)
- [Troubleshooting](#-troubleshooting)

---

## 🎮 Gameplay Loop

The main experience follows a stateful mission progression:

1. **Intro & Solar-System Dive:** Start the experience and transition seamlessly into the 3D operations base.
2. **Base Exploration:** Walk around the 3D operations base and visit interactive mission hubs.
3. **Mission Definition:** Choose a science objective and a compatible target orbit.
4. **Spacecraft Design:** Select scientific instruments, power systems, communications antennas, a spacecraft bus, and a launch vehicle.
5. **Flight-Readiness Review:** The simulation engine calculates resource margins, hard blockers, warnings, and overall risk level.
6. **Launch:** Watch a timed, shuttle-style launch animation visualizing stage separation, orbital insertion, and deployment.
7. **Mission Execution:** Operate in Earth orbit, cruise through interplanetary space to the Moon or Mars, or arrive at your destination.
8. **Mission Report:** Receive a final outcome, score breakdown, verdict, deterministic cause chain, and related real-world mission examples.
9. **ISS Tour & Docking:** After completing a mission, tour the International Space Station or attempt a manual 6-DOF docking maneuver.

---

## 🛠 Technology Stack

* **React 18:** Application shell, routing state machine, and UI overlays.
* **TypeScript:** Type-safe mission content, player selection state, engine results, and 3D scene props.
* **Vite 5:** Fast local development server and production bundling.
* **React Three Fiber & Three.js:** Declarative 3D rendering, meshes, materials, cameras, animations, GLTF models, textures, and spatial math.
* **@react-three/drei:** Camera controls, asset loaders, environment lighting, starfields, HTML labels, and pointer-lock movement.
* **@react-three/postprocessing & postprocessing:** Bloom and tone mapping effects.
* **Tailwind CSS 4:** Utility-first styling for the HUD and mission panels.
* **Web Audio API:** Procedural sound synthesis (with optional MP3 voiceover support).

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** with `npm` (current LTS release recommended).
* A modern web browser with **WebGL** support.
* *Note: Browsers require a user gesture to unlock audio; clicking the in-game start button initializes the Web Audio context.*

### Quick Launch (Convenience Scripts)
Both launcher scripts check for Node.js, automatically install dependencies on the first run (`npm install --legacy-peer-deps`), and start the Vite server:

* **Windows:** Double-click `START_GAME.bat`
* **macOS / Linux:**
  ```sh
  ./start-game.sh
  ```

### Manual Setup
```sh
npm install --legacy-peer-deps
npm run dev
```
Open the local URL printed in your terminal (typically `http://localhost:5173`).

### Development Commands
```sh
npm run dev        # Start the Vite development server
npm run build      # Create a type-check-independent production bundle
npm run typecheck  # Run TypeScript compiler checks without emitting files
npm run preview    # Serve the production bundle locally
```
> **Note:** There is currently no automated test runner in `package.json`. When modifying mission rules, run `npm run typecheck` and `npm run build`. When modifying 3D scenes, verify the affected views manually in a WebGL-capable browser.

---

## 🕹 Controls

### Base & General Navigation
| Key / Action | Function |
| :--- | :--- |
| **Click Scene** | Capture mouse (pointer lock) |
| `W` `A` `S` `D` | Move around the operations base |
| `Shift` | Sprint / move faster |
| `E` | Interact with a nearby mission hub |
| `Esc` | Release pointer lock |
| `M` | Toggle audio mute |

### ISS Manual Docking Mode
| Key | Function |
| :--- | :--- |
| `W` / `S` | Forward / Reverse thrust |
| `A` / `D` | Lateral (left / right) thrust |
| `Space` / `C` | Vertical (up / down) thrust |
| `X` | Kill velocity / Braking |

*The docking controller actively tracks range, relative speed, safe speed limits, remaining fuel, and status (`approach`, `docked`, `crash`, or `dry`).*

---

## 📂 Repository Layout

```text
.
├── index.html                  # Browser entry document
├── package.json                # Scripts and runtime/development dependencies
├── start-game.sh               # macOS/Linux convenience launcher
├── START_GAME.bat              # Windows convenience launcher
├── public/
│   ├── audio/vo/               # Optional recorded voiceover MP3 files
│   ├── models/                 # GLB spacecraft, launch-pad, and ISS assets
│   └── textures/               # Planet surface and normal-map textures
└── src/
    ├── main.tsx                # React bootstrap and global CSS import
    ├── App.tsx                 # Top-level state machine, UI, and orchestration
    ├── Scene.tsx               # Shared Three.js primitives and mission-world scenes
    ├── engine.ts               # Pure mission evaluation and seeded launch simulation
    ├── data.ts                 # Typed objectives, orbits, and spacecraft component data
    ├── audio.ts                # Procedural Web Audio sound system
    ├── voice.ts                # Optional voiceover playback and caption timing
    ├── index.css               # Global layout, theme variables, and reduced-motion rules
    ├── data/
    │   ├── learning_cards.json # Phase-based engineering lessons
    │   └── real_missions.json  # Paraphrased historical mission examples
    └── scenes/
        ├── Base.tsx            # Walkable base, hubs, movement, and launch pad
        ├── Solar.tsx           # Solar-system overview and transfer trajectories
        └── Iss.tsx             # ISS tour and manual docking simulation
```
*(Note: `public/` is served at the web root, so `public/textures/earth.jpg` is referenced in code as `/textures/earth.jpg`.)*

---

## 🏗 Architecture & Interconnection

### 1. Browser Bootstrap (`index.html`, `main.tsx`)
`index.html` supplies the `#root` element and loads `/src/main.tsx`, which mounts `<App />` inside `React.StrictMode` and imports global styles from `index.css`.

### 2. Application Coordinator (`App.tsx`)
`App.tsx` owns the player-facing workflow via its `View` navigation state union:

```text
intro → dive → base
              ├── define → design → review → launch → pad
              │                                      └── orbit
              ├── iss
              └── base

orbit → cruise → arrive        (Moon / Mars missions)
orbit → report                 (Earth-orbit missions via completed orbit state)
```

* Stores current `View` and `Sel` (player mission configuration).
* Derives live review metrics via `evaluate(sel)` and triggers launches via `runLaunch(sel, review, seed)`.
* Coordinates scene rendering, callbacks (`onProgress`, `onDone`), fade transitions, pointer-lock release, mute state, adaptive graphics quality, and educational cards.
* Communicates with 3D scenes strictly through props and callbacks rather than a global state store.

### 3. Mission Domain Model (`data.ts`)
`data.ts` is the single source of truth for playable engineering choices:
* `OBJECTIVES`: Science goals, budgets, compatible orbit IDs, and learning text.
* `ORBITS`: Altitude, destination (`earth`, `moon`, `mars`), mission factor, and descriptions.
* `INSTRUMENTS`, `POWER`, `ANTENNAS`, `BUSES`, `LAUNCHERS`: Hardware catalogs sharing the unified `Part` interface so the engine aggregates resources generically without ID-specific branching.

### 4. Pure Business Logic (`engine.ts`)
`engine.ts` has zero dependencies on React, Three.js, or browser APIs. It exposes:
* `evaluate(sel)`: Sums resource requirements, calculates orbit-adjusted lift capacity, and returns a `Review` covering **mass, fairing volume, power, downlink data, and budget**. Hard constraint violations become blockers (`canLaunch = false`), while thin margins or shortfalls trigger warnings and set the green/yellow/red risk level.
* `runLaunch(sel, review, seed)`: Executes seeded risk rolls (using `Date.now().toString(36)` at launch) to produce a deterministic `LaunchResult` containing individual roll outcomes, score categories, final verdict, and a human-readable cause chain.
* `usd(x)`: Currency formatter for UI budgets.

### 5. Three.js Scene Layer (`Scene.tsx` & `src/scenes/`)
* `Scene.tsx`: Manages texture loading, color spaces, Earth/Moon/Mars meshes and atmospheres, GLTF normalization, procedural spacecraft assembly from `Sel`, and the `World` scene. Visuals consume `Sel` and `LaunchResult` flags (`fail`, `fault`) without duplicating validation logic.
* `Base.tsx`: Walkable operations center, hub proximity triggers, pointer-lock controls, and launch-pad countdown sequence.
* `Solar.tsx`: Planetary layout, orbital motion, Hohmann-like transfer arcs, and interplanetary cruise animations.
* `Iss.tsx`: ISS guided tour labels and physics-lite 6-DOF manual docking mode.

### 6. Audio, Voiceover & Reference Content (`audio.ts`, `voice.ts`, `src/data/`)
* `audio.ts` synthesizes wind, space ambience, launch rumble, stage separation hiss, engine burns, telemetry beeps, and radio bursts via the Web Audio API.
* `voice.ts` plays `/audio/vo/<id>.mp3` when available, automatically ducking procedural audio and displaying timed captions even if audio files are omitted.
* `learning_cards.json` and `real_missions.json` provide build-time educational content matched to the active mission phase and objective.

---

## 🔄 Runtime Data Flow

```text
User Input
   │
   ▼
App State (View + Sel)
   │
   ├──► evaluate(Sel) ──► Review (margins, blockers, warnings, risk, canLaunch)
   │
   ├──► UI Panels ──────► Objective, design, review, and launch controls
   │
   └──► 3D Scene Props
           ├── Base  ──► Nearby hub detection / launch timeline
           ├── World ──► Launch, orbit, and arrival progress
           ├── Solar ──► Interplanetary cruise progress
           └── Iss   ──► Manual docking telemetry

On Launch Trigger:
Sel + Review + Seed ──► runLaunch(...) ──► LaunchResult ──► 3D Animation Flags + Final Report
```

---

## 🧩 Extending the Project

### Adding a Spacecraft Component
1. Add a new entry to the appropriate array (`INSTRUMENTS`, `POWER`, `ANTENNAS`, `BUSES`, or `LAUNCHERS`) in `src/data.ts` with a unique `id` and complete `Part` resource properties.
2. For instruments, include matching objective IDs in the `objectives` array.
3. Optionally include a `model` path pointing to a `.glb` file in `public/models/`.
4. Run `npm run typecheck` and inspect the Design and Review screens.

### Adding an Objective or Orbit
1. Add the row to `OBJECTIVES` or `ORBITS` in `src/data.ts`.
2. Ensure all referenced orbit IDs exist, `destination` is `'earth' | 'moon' | 'mars'`, and the budget is balanced against the component catalog.
3. Add corresponding entries in `src/data/learning_cards.json` and `src/data/real_missions.json`.

### Adding a New View or 3D Scene
1. Extend the `View` union and `CARD_AT` mapping in `src/App.tsx`.
2. Create reusable Three.js primitives in `src/Scene.tsx` or a dedicated module in `src/scenes/`.
3. Report progress and completion back to `App.tsx` via callbacks (`onProgress`, `onDone`) rather than mutating global state.

### Adding 3D Models, Textures, or Audio
* Place assets in `public/models/`, `public/textures/`, or `public/audio/vo/`.
* Reference them using root-relative paths (e.g., `/models/new-craft.glb`).
* Use `useGLTF.preload(...)` for heavy models to prevent frame hitches during view transitions.

---

## 📐 Design & Maintenance Guidelines

* **Separation of Concerns:** Keep all mission math and validation rules inside `engine.ts`. Keep browser APIs (Web Audio, pointer lock, timers) inside React/scene modules.
* **Data-Driven Design:** Prefer adding data rows in `data.ts` over writing ID-specific `if/else` conditionals.
* **Contract Stability:** Preserve the `Sel`, `Review`, and `LaunchResult` TypeScript interfaces when updating mission flow.
* **Consistent Units:** Resource units across the codebase are **kilograms (`kg`)**, **watts (`W`)**, **megabits per second (`Mbps`)**, **cubic meters ($\text{m}^3$)**, and **US dollars (`USD`)**. Update comments and consumers together if changing units.
* **Accessibility:** Respect the `prefers-reduced-motion` rules established in `src/index.css` when adding UI animations.
* **Educational Framing:** Keep copy clearly framed as a simplified educational model rather than an authoritative aerospace engineering tool.

---

## 📝 Known Implementation Notes

* Launch risk rolls and orbital trajectories are illustrative and game-like rather than high-fidelity astrodynamics simulations.
* Missing voiceover MP3 files fail gracefully and fall back to timed on-screen captions without interrupting gameplay.
* `React.StrictMode` is enabled in development, meaning effects initialize and clean up twice; ensure Three.js geometries, materials, and audio nodes dispose cleanly.
* Asset paths are **case-sensitive** when deployed to Linux-based web hosts.

---

## 🔧 Troubleshooting

* **The game does not start:** Verify Node.js is installed, run `npm install --legacy-peer-deps` followed by `npm run dev`, and manually open the localhost URL printed in your terminal.
* **A 3D model or texture is missing:** Check the browser DevTools Network tab for `404` errors and verify that the file exists under `public/` with exact matching casing.
* **No sound is heard:** Ensure you clicked the intro start button to unlock the browser's Web Audio context, and check that audio isn't muted (`M` key).
* **Low frame rate / performance issues:** High-resolution planetary textures, starfields, and postprocessing bloom can be GPU-intensive. Use the in-game adaptive quality toggle and close other WebGL browser tabs.
