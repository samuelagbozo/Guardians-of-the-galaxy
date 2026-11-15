import { Suspense, useEffect, useMemo, useState, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { sfx } from "./audio";
import { useProgress, PerformanceMonitor } from "@react-three/drei";
import { speak } from "./voice";
import { World, destOf } from "./Scene";
import Solar, { MoonCruise } from "./scenes/Solar";
import Base, { HUBS } from "./scenes/Base";
import Iss, { DockInfo } from "./scenes/Iss";
import {
  OBJECTIVES,
  ORBITS,
  INSTRUMENTS,
  POWER,
  ANTENNAS,
  BUSES,
  LAUNCHERS,
  Part,
} from "./data";
import { Sel, evaluate, runLaunch, usd, LaunchResult, Level } from "./engine";
import cards from "./data/learning_cards.json";
import missions from "./data/real_missions.json";

type View =
  | "intro"
  | "dive"
  | "base"
  | "define"
  | "design"
  | "review"
  | "iss"
  | "launch"
  | "pad"
  | "orbit"
  | "cruise"
  | "arrive";
const CARD_AT: Record<View, number> = {
  intro: 0,
  dive: 0,
  base: 1,
  define: 2,
  design: 3,
  review: 4,
  iss: 5,
  launch: 6,
  pad: 6,
  orbit: 7,
  cruise: 8,
  arrive: 9,
};
const RX: Record<string, RegExp> = {
  "earth-climate": /earth|climate|ice|ocean|atmospher|land/i,
  "exo-telescope": /telescope|x-ray|star|galax|exoplanet|astronom|cosmic/i,
  "solar-weather": /sun|solar|radiation|space weather|magnet/i,
  "lunar-survey": /moon|lunar|ice|crater/i,
  "mars-science": /mars|ice|water|planet/i,
};
const LV: Record<Level, { t: string; c: string }> = {
  green: { t: "LOW RISK", c: "text-emerald-400" },
  yellow: { t: "ELEVATED RISK", c: "text-amber-400" },
  red: { t: "CRITICAL RISK", c: "text-red-400" },
};
const glass = "panel";

function stat(p: Part) {
  const a: string[] = [];
  if (p.massKg) a.push(`${p.massKg} kg`);
  if (p.powerW) a.push(`${p.powerW} W`);
  if (p.dataRateMbps) a.push(`${p.dataRateMbps} Mbps`);
  if (p.payKg) a.push(`payload ${p.payKg} kg`);
  if (p.capKg) a.push(`lifts ${p.capKg} kg to LEO`);
  a.push(usd(p.costUsd));
  return a.join(" · ");
}
function Card({
  active,
  onClick,
  title,
  sub,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-2 w-full rounded-sm border p-3 text-left transition ${active ? "border-sky-300/80 bg-sky-300/10" : "border-slate-600/40 bg-slate-900/40 hover:border-slate-400/60"}`}
    >
      <div className="font-semibold text-slate-100">{title}</div>
      {sub && (
        <div className="mt-0.5 font-mono text-[11px] text-cyan-300">{sub}</div>
      )}
      {children && (
        <div className="mt-1 text-xs text-slate-400">{children}</div>
      )}
    </button>
  );
}
const H = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
    {children}
  </h3>
);

export default function App() {
  const [view, setView] = useState<View>("intro");
  const [fade, setFade] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [sel, setSel] = useState<Sel>({
    objectiveId: "earth-climate",
    orbitId: "sso",
    instrumentIds: [],
    powerId: "small-array",
    antennaId: "s-band-patch",
    busId: "smallsat-bus",
    launchId: "light-launcher",
  });
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [tl, setTl] = useState(0);
  const [done, setDone] = useState(false);
  const [issMode, setIssMode] = useState<"tour" | "dock">("tour");
  const [dock, setDock] = useState<DockInfo | null>(null);
  const [dockKey, setDockKey] = useState(0);
  const [lastHub, setLastHub] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [q, setQ] = useState(1); // adaptive quality: 1 high, 0 reduced
  const [vo, setVo] = useState<string | null>(null);
  const load = useProgress();
  const ev = useMemo(() => evaluate(sel), [sel]);
  const obj = OBJECTIVES.find((o) => o.id === sel.objectiveId)!;
  const dest = destOf(sel.orbitId);
  const lost = result?.rolls[0].triggered ?? false;
  const set = (p: Partial<Sel>) => setSel((s) => ({ ...s, ...p }));
  const go = (v: View) => {
    document.exitPointerLock?.();
    setFade(true);
    setTimeout(() => {
      setView(v);
      setFade(false);
    }, 650);
  };
  const back = (id: string) => {
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    go("base");
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && view === "base" && near) {
        setLastHub(near);
        sfx.beep(660, 0.08);
        go(near as View);
      }
      if (e.code === "KeyM") setMuted((m) => !m);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, near]);

  const begin = () => {
    sfx.init();
    speak("open", setVo);
    setView("dive");
    setTimeout(() => go("base"), 6500);
  };
  const pickObjective = (id: string) => {
    const o = OBJECTIVES.find((x) => x.id === id)!;
    set({
      objectiveId: id,
      orbitId: o.orbitIds.includes(sel.orbitId) ? sel.orbitId : o.orbitIds[0],
      instrumentIds: sel.instrumentIds.filter((i) =>
        INSTRUMENTS.find((x) => x.id === i)?.objectives?.includes(id),
      ),
    });
  };
  const toggleIns = (id: string) =>
    set({
      instrumentIds: sel.instrumentIds.includes(id)
        ? sel.instrumentIds.filter((i) => i !== id)
        : [...sel.instrumentIds, id],
    });
  const startLaunch = () => {
    setResult(runLaunch(sel, ev, Date.now().toString(36)));
    setDone(false);
    setProgress(0);
    setTl(0);
    go("pad");
  };
  const reset = () => {
    setLastHub(null);
    setResult(null);
    setDone(false);
    setVisited([]);
    setIssMode("tour");
    go("base");
  };

  const card = cards.rows[CARD_AT[view] % cards.rows.length];
  const body = dest === "mars" ? "MARS" : "LUNAR";
  const caption =
    view === "pad"
      ? tl < 6
        ? "MAIN ENGINE START SEQUENCE"
        : "LIFTOFF"
      : view === "orbit"
        ? lost && progress > 0.2
          ? "ANOMALY · VEHICLE LOST"
          : progress < 0.14
            ? "ASCENT · SOLID BOOSTERS BURNING"
            : progress < 0.26
              ? "SOLID BOOSTER SEPARATION"
              : progress < 0.32
                ? "TANK SEPARATION · MAIN ENGINE CUTOFF"
                : progress < 0.42
                  ? "ORBIT INSERTION"
                  : progress < 0.74
                    ? "DEPLOYING SPACECRAFT"
                    : dest === "earth"
                      ? "INSTRUMENTS ACTIVE · DOWNLINK TO EARTH"
                      : `${body} TRANSFER BURN`
        : view === "cruise"
          ? `CRUISE TO ${dest === "mars" ? "MARS · ~7 MONTHS COMPRESSED" : "THE MOON · ~3 DAYS COMPRESSED"}`
          : view === "arrive"
            ? progress < 0.25
              ? "APPROACH"
              : progress < 0.45
                ? result?.outcome === "failure"
                  ? "INSERTION BURN FAILED"
                  : "ORBIT INSERTION BURN"
                : result?.outcome === "failure"
                  ? "SIGNAL LOST"
                  : "IN ORBIT · INSTRUMENTS ACTIVE · DOWNLINK TO EARTH"
            : "";
  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    // voiceover cues come from real state, never from decoration
    if (["define", "design", "review"].includes(view)) speak(view, setVo);
    const c = caption;
    if (c.startsWith("MAIN ENGINE")) speak("countdown", setVo);
    else if (c === "LIFTOFF") speak("liftoff", setVo);
    else if (c === "ORBIT INSERTION") speak("insertion", setVo);
    else if (c.startsWith("DEPLOYING")) speak("deploy", setVo);
    else if (c.startsWith("INSTRUMENTS ACTIVE") || c.startsWith("IN ORBIT"))
      speak("success", setVo);
    else if (c.startsWith("SIGNAL LOST") || c.startsWith("ANOMALY"))
      speak("failure", setVo);
  }, [view, caption]);
  useEffect(() => {
    // ambience per scene
    sfx.layer("wind", inBase && view !== "pad" ? 1 : 0, 1.5);
    sfx.layer(
      "space",
      [
        "intro",
        "dive",
        "define",
        "design",
        "review",
        "iss",
        "cruise",
        "arrive",
        "orbit",
      ].includes(view)
        ? 0.6
        : 0,
      1.5,
    );
    if (view !== "pad" && view !== "orbit") sfx.layer("rumble", 0, 0.8);
  }, [view]);
  useEffect(() => {
    // launch rumble follows the countdown
    if (view !== "pad") return;
    if (tl >= 4) sfx.layer("rumble", Math.min(1, (tl - 4) / 5), 0.5);
    if (tl < 6 && Math.ceil(6 - tl) !== Math.ceil(6 - (tl - 0.1)))
      sfx.beep(tl > 5 ? 1400 : 900, 0.1);
  }, [tl, view]);
  useEffect(() => {
    // one-shot sounds when the mission phase changes
    if (caption.startsWith("SOLID BOOSTER") || caption.startsWith("TANK"))
      sfx.thunk();
    if (caption === "ORBIT INSERTION") {
      sfx.layer("rumble", 0, 1);
      sfx.burst("hiss", 0.7, 1500);
    }
    if (caption.startsWith("DEPLOYING")) sfx.radio();
    if (caption.endsWith("TRANSFER BURN") || caption === "ORBIT INSERTION BURN")
      sfx.burst("burn", 1, 3500);
    if (caption.startsWith("SIGNAL LOST") || caption.startsWith("ANOMALY")) {
      sfx.layer("rumble", 0, 0.2);
      sfx.burst("hiss", 1, 1200);
      sfx.thunk();
    }
    if (
      caption.startsWith("INSTRUMENTS ACTIVE") ||
      caption.startsWith("IN ORBIT")
    ) {
      sfx.layer("rumble", 0, 1);
      sfx.radio();
    }
  }, [caption]);
  const real = missions.rows
    .filter((m) => RX[sel.objectiveId].test(m.name + " " + m.summary))
    .slice(0, 3);
  const bars = (
    <div className="mt-3 rounded border border-slate-700 bg-slate-900/60 p-3">
      {ev.margins.map((m) => {
        const r = m.available ? m.required / m.available : 0;
        return (
          <div key={m.key} className="mb-2 last:mb-0">
            <div className="flex justify-between font-mono text-[11px] text-slate-300">
              <span>{m.label}</span>
              <span>{m.text}</span>
            </div>
            <div className="h-1.5 rounded bg-slate-700">
              <div
                className={`h-1.5 rounded transition-all duration-300 ${r > 1 ? "bg-red-500" : r > 0.85 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.min(100, r * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  const inBase = view === "base" || view === "launch" || view === "pad";
  const panel =
    view === "define" ||
    view === "design" ||
    view === "review" ||
    view === "launch" ||
    view === "orbit" ||
    view === "cruise" ||
    view === "arrive";
  const hubTodo = [
    ["define", "Define the mission"],
    ["design", "Build the spacecraft"],
    ["review", "Pass flight review"],
    ["launch", "Launch"],
  ] as const;
  const ok = (id: string) =>
    id === "review"
      ? visited.includes("review") && ev.canLaunch
      : id === "launch"
        ? !!result
        : visited.includes(id);

  return (
    <div className="relative h-full w-full text-slate-100">
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.1, far: 5000, position: [0, 60, 150] }}
        dpr={q ? [1, 1.75] : [0.75, 1]}
      >
        <PerformanceMonitor
          onDecline={() => setQ(0)}
          onIncline={() => setQ(1)}
        />
        <Suspense fallback={null}>
          {view === "intro" || view === "dive" ? (
            <Solar mode={view === "dive" ? "dive" : "idle"} />
          ) : view === "cruise" ? (
            dest === "mars" ? (
              <Solar
                mode="cruise"
                sel={sel}
                onProgress={setProgress}
                onDone={() => go("arrive")}
              />
            ) : (
              <MoonCruise
                sel={sel}
                onProgress={setProgress}
                onDone={() => go("arrive")}
              />
            )
          ) : inBase ? (
            <Base
              key="base"
              spawn={lastHub}
              walking={view === "base"}
              launching={view === "pad"}
              near={near}
              onNear={setNear}
              onCount={setTl}
              onDone={() => go("orbit")}
            />
          ) : view === "iss" ? (
            <Iss key={issMode + dockKey} mode={issMode} onDock={setDock} />
          ) : (
            <World
              mode={
                view === "define" || view === "orbit" || view === "arrive"
                  ? "earth"
                  : "craft"
              }
              sel={sel}
              launch={
                view === "orbit" && result
                  ? {
                      fail: lost,
                      fault: result.outcome === "failure" && !lost,
                      deep: dest !== "earth",
                      seed: result.seed,
                      onProgress: setProgress,
                      onDone: () =>
                        lost || dest === "earth" ? setDone(true) : go("cruise"),
                    }
                  : null
              }
              arrive={
                view === "arrive" && result
                  ? {
                      fail: result.outcome === "failure",
                      onProgress: setProgress,
                      onDone: () => setDone(true),
                    }
                  : null
              }
            />
          )}
          <EffectComposer>
            <Bloom
              intensity={q ? 0.55 : 0.25}
              luminanceThreshold={0.9}
              mipmapBlur
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-700 ${fade ? "opacity-100" : "opacity-0"}`}
      />
      <button
        onClick={() => setMuted((m) => !m)}
        className={`absolute right-4 top-14 z-40 px-3 py-1 font-mono text-[11px] ${glass}`}
      >
        {muted ? "SOUND OFF" : "SOUND ON"} · M
      </button>
      {vo && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-40 flex justify-center px-4 md:pl-[27rem]">
          <div
            className={`max-w-xl px-4 py-2 text-center text-sm text-slate-100 ${glass}`}
            role="status"
            aria-live="polite"
          >
            {vo}
          </div>
        </div>
      )}
      {load.active && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950 font-mono text-cyan-300">
          LOADING ASSETS {Math.round(load.progress)}%
        </div>
      )}

      {view === "intro" && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/70 via-transparent to-black/40 text-center">
          <div>
            <div className="text-xs tracking-[0.4em] text-slate-400">
              NASA Space Apps Challenge
            </div>
            <h1 className="mt-4 text-4xl font-extralight tracking-[0.35em] md:text-7xl">
              ORBIT ARCHITECT
            </h1>
            <div className="rule mx-auto mt-5 w-24" />
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Design a robotic science mission. Choose the objective, build the
              spacecraft, pass flight review, then launch it.
            </p>
            <button
              onClick={begin}
              className="mt-8 rounded-sm border border-sky-300/70 bg-sky-300/10 px-10 py-3 tracking-[0.3em] text-sky-100 hover:bg-sky-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200"
            >
              BEGIN MISSION
            </button>
          </div>
        </div>
      )}
      {view === "dive" && (
        <div className="absolute bottom-16 w-full text-center font-mono tracking-[0.4em] text-cyan-200">
          APPROACHING EARTH…
        </div>
      )}

      {inBase && view !== "pad" && (
        <>
          <div
            className={`absolute left-4 top-4 w-64 p-3 font-mono text-xs ${glass}`}
          >
            <div className="mb-2 tracking-[0.25em] text-cyan-300">
              MISSION CHECKLIST
            </div>
            {hubTodo.map(([id, l]) => (
              <div
                key={id}
                className={ok(id) ? "text-emerald-400" : "text-slate-300"}
              >
                {ok(id) ? "[x]" : "[ ]"} {l}
              </div>
            ))}
          </div>
          {view === "base" && (
            <>
              <div
                className={`absolute bottom-4 left-4 p-3 font-mono text-[11px] text-slate-300 ${glass}`}
              >
                Click to look · WASD move · hold Shift to drive fast · E
                interact · Esc release mouse
              </div>
              {near && (
                <div className="absolute bottom-24 w-full text-center">
                  <span
                    className={`px-5 py-2 font-mono text-sm tracking-widest text-white ${glass}`}
                  >
                    PRESS <b className="text-cyan-300">E</b> ·{" "}
                    {HUBS.find((h) => h.id === near)!.label.toUpperCase()}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
      {view === "pad" && (
        <div className="absolute inset-x-0 top-10 text-center font-mono">
          <div className="text-6xl font-bold tracking-widest text-orange-300">
            {tl < 6 ? `T-${Math.ceil(6 - tl)}` : `T+${Math.floor(tl - 6)}`}
          </div>
          <div className="mt-2 tracking-[0.4em] text-slate-300">
            {tl < 6 ? "COUNTDOWN" : "LIFTOFF"}
          </div>
        </div>
      )}
      {view === "iss" && (
        <div
          className={`absolute left-4 top-4 w-72 p-3 font-mono text-[11px] text-slate-300 ${glass}`}
        >
          <div className="mb-2 tracking-[0.25em] text-cyan-300">
            ISS · {issMode === "tour" ? "ZERO-G TOUR" : "DRAGON DOCKING"}
          </div>
          <div className="mb-2 flex gap-1">
            {(["tour", "dock"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setIssMode(m);
                  setDock(null);
                  setDockKey((k) => k + 1);
                  document.exitPointerLock?.();
                }}
                className={`flex-1 border py-1 ${issMode === m ? "border-cyan-400 bg-cyan-400/20 text-cyan-100" : "border-slate-600"}`}
              >
                {m === "tour" ? "FREE TOUR" : "DOCK DRAGON"}
              </button>
            ))}
          </div>
          {issMode === "tour" ? (
            <div>
              Click to look · WASD fly · Space up · C down · Shift fast · Esc
              release
            </div>
          ) : (
            <div>
              <div>
                Click to look · WASD/Space/C thrust · X brake · Esc release
              </div>
              <div className="mt-2 text-slate-400">
                Real docking is slow: thrusters add speed that never fades.
                Arrive under the limit with propellant to spare.
              </div>
              {dock && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <div>
                    RANGE{" "}
                    <b className="text-white">{dock.range.toFixed(1)} m</b>
                  </div>
                  <div>
                    CLOSING{" "}
                    <b
                      className={
                        dock.speed > dock.limit
                          ? "text-red-400"
                          : "text-emerald-400"
                      }
                    >
                      {dock.speed.toFixed(2)} m/s
                    </b>{" "}
                    (limit {dock.limit.toFixed(2)})
                  </div>
                  <div>
                    PROPELLANT{" "}
                    <b
                      className={
                        dock.fuel < 20 ? "text-amber-400" : "text-white"
                      }
                    >
                      {dock.fuel.toFixed(0)}%
                    </b>
                  </div>
                  {dock.status !== "approach" && (
                    <div
                      className={`mt-2 rounded p-2 text-center font-bold ${dock.status === "docked" ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/60 text-red-300"}`}
                    >
                      {dock.status === "docked"
                        ? "SOFT CAPTURE · DOCKED"
                        : dock.status === "crash"
                          ? "HARD CONTACT · ABORT"
                          : "OUT OF PROPELLANT"}
                      <button
                        onClick={() => {
                          setDock(null);
                          setDockKey((k) => k + 1);
                        }}
                        className="mt-2 block w-full border border-white/40 py-1 font-normal"
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => back("iss")}
            className="mt-3 block w-full border border-cyan-400 py-1 text-cyan-200 hover:bg-cyan-400/20"
          >
            RETURN TO BASE
          </button>
        </div>
      )}
      {(view === "pad" ||
        view === "orbit" ||
        view === "cruise" ||
        view === "arrive") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-sm tracking-[0.3em] text-cyan-200 md:pl-[27rem]">
          {caption}
        </div>
      )}
      {panel && (
        <aside
          className={`absolute inset-x-0 bottom-0 max-h-[55vh] overflow-y-auto p-4 md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-[27rem] ${glass} md:border-y-0 md:border-l-0`}
        >
          <div className="mb-3 rounded border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs text-cyan-100">
            <div className="font-mono font-bold uppercase tracking-wider">
              {card.title}
            </div>
            <div className="mt-1">{card.body}</div>
            <div className="mt-1 text-[10px] text-cyan-400/70">
              {card.source}
            </div>
          </div>

          {view === "define" && (
            <>
              <H>Mission objective</H>
              {OBJECTIVES.map((o) => (
                <Card
                  key={o.id}
                  active={o.id === sel.objectiveId}
                  onClick={() => pickObjective(o.id)}
                  title={o.name}
                  sub={`Budget ${usd(o.budgetUsd)}`}
                >
                  {o.goal}
                </Card>
              ))}
              <H>Orbit</H>
              {ORBITS.filter((o) => obj.orbitIds.includes(o.id)).map((o) => (
                <Card
                  key={o.id}
                  active={o.id === sel.orbitId}
                  onClick={() => set({ orbitId: o.id })}
                  title={o.name}
                  sub={`${o.altKm.toLocaleString()} km`}
                >
                  {o.desc}
                </Card>
              ))}
            </>
          )}

          {view === "design" && (
            <>
              <H>Live resources</H>
              {bars}
              <H>Instruments</H>
              {INSTRUMENTS.filter((i) =>
                i.objectives?.includes(sel.objectiveId),
              ).map((i) => (
                <Card
                  key={i.id}
                  active={sel.instrumentIds.includes(i.id)}
                  onClick={() => toggleIns(i.id)}
                  title={i.name}
                  sub={stat(i)}
                >
                  {i.desc}
                </Card>
              ))}
              <H>Power system</H>
              {POWER.map((i) => (
                <Card
                  key={i.id}
                  active={sel.powerId === i.id}
                  onClick={() => set({ powerId: i.id })}
                  title={i.name}
                  sub={stat(i)}
                >
                  {i.desc}
                </Card>
              ))}
              <H>Antenna</H>
              {ANTENNAS.map((i) => (
                <Card
                  key={i.id}
                  active={sel.antennaId === i.id}
                  onClick={() => set({ antennaId: i.id })}
                  title={i.name}
                  sub={stat(i)}
                >
                  {i.desc}
                </Card>
              ))}
              <H>Spacecraft bus</H>
              {BUSES.map((i) => (
                <Card
                  key={i.id}
                  active={sel.busId === i.id}
                  onClick={() => set({ busId: i.id })}
                  title={i.name}
                  sub={stat(i)}
                >
                  {i.desc}
                </Card>
              ))}
              <H>Launch vehicle</H>
              {LAUNCHERS.map((i) => (
                <Card
                  key={i.id}
                  active={sel.launchId === i.id}
                  onClick={() => set({ launchId: i.id })}
                  title={i.name}
                  sub={stat(i)}
                >
                  {i.desc}
                </Card>
              ))}
            </>
          )}

          {view === "review" && (
            <>
              <div className="rounded border border-slate-700 bg-slate-900/60 p-3 font-mono">
                <div className={`text-lg font-bold ${LV[ev.level].c}`}>
                  {LV[ev.level].t}
                </div>
                <div className="text-xs text-slate-300">
                  Worst margin: {ev.worst.label}, {ev.worst.pct}%
                </div>
              </div>
              {bars}
              <H>Blockers</H>
              {ev.blockers.length ? (
                ev.blockers.map((b, i) => (
                  <div
                    key={i}
                    className="mb-2 rounded border border-red-500/60 bg-red-950/50 p-2 text-xs"
                  >
                    BLOCKER · {b}
                  </div>
                ))
              ) : (
                <div className="text-xs text-emerald-400">
                  No blockers. Cleared for launch.
                </div>
              )}
              <H>Warnings</H>
              {ev.warnings.length ? (
                ev.warnings.map((b, i) => (
                  <div
                    key={i}
                    className="mb-2 rounded border border-amber-500/60 bg-amber-950/40 p-2 text-xs"
                  >
                    WARNING · {b}
                  </div>
                ))
              ) : (
                <div className="text-xs text-emerald-400">No warnings.</div>
              )}
            </>
          )}

          {view === "launch" && (
            <>
              <div className="text-sm text-slate-300">
                Mission <b>{obj.name}</b> to{" "}
                <b>{ORBITS.find((o) => o.id === sel.orbitId)!.name}</b>. Status:{" "}
                <b className={LV[ev.level].c}>{LV[ev.level].t}</b>
              </div>
              {!ev.canLaunch && (
                <div className="mt-3 rounded border border-red-500/60 bg-red-950/50 p-2 text-xs">
                  Launch blocked by {ev.blockers.length} blocker(s). Visit
                  Flight Readiness Review for details.
                </div>
              )}
              <button
                disabled={!ev.canLaunch}
                onClick={startLaunch}
                className="mt-4 w-full border border-orange-400 bg-orange-500/20 py-3 font-mono tracking-[0.3em] text-orange-200 hover:bg-orange-500/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                START COUNTDOWN
              </button>
            </>
          )}

          {(view === "orbit" || view === "cruise" || view === "arrive") &&
            result &&
            !done && (
              <div className="font-mono text-sm">
                <div className="mb-2">
                  {view === "orbit"
                    ? "LAUNCH & ORBIT"
                    : view === "cruise"
                      ? "TRANSFER"
                      : "ARRIVAL"}{" "}
                  · {Math.round(progress * 100)}%
                </div>
                <div className="h-1.5 rounded bg-slate-700">
                  <div
                    className="h-1.5 rounded bg-orange-400"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          {(view === "orbit" || view === "arrive") && result && done && (
            <div>
              <div
                className={`rounded p-3 text-center font-mono text-lg font-bold ${result.outcome === "success" ? "bg-emerald-900/60 text-emerald-300" : result.outcome === "partial-success" ? "bg-amber-900/50 text-amber-300" : "bg-red-900/50 text-red-300"}`}
              >
                {result.outcome === "success"
                  ? "FULL SUCCESS"
                  : result.outcome === "partial-success"
                    ? "PARTIAL SUCCESS"
                    : "MISSION FAILURE"}
              </div>
              <div className="mt-2 text-center font-mono text-[11px] text-slate-400">
                Destination: {ORBITS.find((o) => o.id === sel.orbitId)!.name}
              </div>
              <H>Verdict</H>
              <div className="rounded bg-slate-800/70 p-2 text-sm">
                <b>{result.verdict.title}.</b> {result.verdict.text}
              </div>
              <H>Score: {result.score.total}</H>
              {result.score.cats.map((c) => (
                <div
                  key={c.label}
                  className="flex justify-between border-b border-slate-700 py-1 text-xs"
                >
                  <span>
                    {c.label}
                    <span className="block text-slate-500">{c.note}</span>
                  </span>
                  <b>{c.points}</b>
                </div>
              ))}
              <H>Cause chain</H>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-300">
                {result.causeChain.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
              <H>Real missions like yours</H>
              {real.map((m) => (
                <div key={m.id} className="mb-2 text-xs text-slate-300">
                  <b className="text-cyan-300">{m.name}</b> ({m.organization}):{" "}
                  {m.summary}
                </div>
              ))}
              <div className="mt-2 text-[10px] text-slate-500">
                Seed {result.seed}. Same seed and design gives the same result.
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setIssMode("dock");
                    go("iss");
                  }}
                  className="flex-1 border border-emerald-400 py-2 font-mono text-xs text-emerald-200 hover:bg-emerald-400/20"
                >
                  DOCK AT THE ISS
                </button>
                <button
                  onClick={reset}
                  className="flex-1 border border-cyan-400 py-2 font-mono text-xs text-cyan-200 hover:bg-cyan-400/20"
                >
                  NEW MISSION
                </button>
              </div>
            </div>
          )}

          {(view === "define" ||
            view === "design" ||
            view === "review" ||
            view === "launch") && (
            <button
              onClick={() => (view === "launch" ? go("base") : back(view))}
              className="mt-5 w-full border border-cyan-400 py-2 font-mono tracking-widest text-cyan-200 hover:bg-cyan-400/20"
            >
              {view === "launch"
                ? "RETURN TO BASE"
                : "CONFIRM & RETURN TO BASE"}
            </button>
          )}
          <p className="mt-4 text-[10px] text-slate-500">
            Drag to rotate · scroll to zoom. Values are simplified for learning,
            not exact NASA data.
          </p>
        </aside>
      )}
    </div>
  );
}
