import { useEffect, useMemo, useState } from "react";
import { useProgress } from "@react-three/drei";
import { sfx } from "./audio";
import { speak } from "./voice";
import { destOf } from "./Scene";
import type { DockInfo } from "./scenes/Iss";
import { OBJECTIVES, INSTRUMENTS } from "./data";
import { evaluate, runLaunch, type LaunchResult, type Sel } from "./engine";
import cards from "./data/learning_cards.json";
import { BaseHud } from "./components/BaseHud";
import { IntroOverlay } from "./components/IntroOverlay";
import { IssHud } from "./components/IssHud";
import { MissionPanel } from "./components/MissionPanel";
import { RuntimeHud } from "./components/RuntimeHud";
import { SceneCanvas } from "./components/SceneCanvas";
import { CARD_AT, type View } from "./components/types";

export default function App() {
  const [view, setView] = useState<View>("intro");
  const [fade, setFade] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [selection, setSelection] = useState<Sel>({
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
  const [timeline, setTimeline] = useState(0);
  const [done, setDone] = useState(false);
  const [issMode, setIssMode] = useState<"tour" | "dock">("tour");
  const [dock, setDock] = useState<DockInfo | null>(null);
  const [dockKey, setDockKey] = useState(0);
  const [lastHub, setLastHub] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState(1);
  const [voiceCaption, setVoiceCaption] = useState<string | null>(null);
  const load = useProgress();
  const evaluation = useMemo(() => evaluate(selection), [selection]);
  const destination = destOf(selection.orbitId);
  const lost = result?.rolls[0].triggered ?? false;
  const updateSelection = (patch: Partial<Sel>) =>
    setSelection((current) => ({ ...current, ...patch }));
  const go = (nextView: View) => {
    document.exitPointerLock?.();
    setFade(true);
    setTimeout(() => {
      setView(nextView);
      setFade(false);
    }, 650);
  };
  const returnToBase = (id: string) => {
    setVisited((current) =>
      current.includes(id) ? current : [...current, id],
    );
    go("base");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyE" && view === "base" && near) {
        setLastHub(near);
        sfx.beep(660, 0.08);
        go(near as View);
      }
      if (event.code === "KeyM") setMuted((current) => !current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, near]);

  const begin = () => {
    sfx.init();
    speak("open", setVoiceCaption);
    setView("dive");
    setTimeout(() => go("base"), 6500);
  };
  const selectObjective = (id: string) => {
    const nextObjective = OBJECTIVES.find((item) => item.id === id)!;
    updateSelection({
      objectiveId: id,
      orbitId: nextObjective.orbitIds.includes(selection.orbitId)
        ? selection.orbitId
        : nextObjective.orbitIds[0],
      instrumentIds: selection.instrumentIds.filter((instrumentId) =>
        INSTRUMENTS.find((item) => item.id === instrumentId)?.objectives?.includes(
          id,
        ),
      ),
    });
  };
  const toggleInstrument = (id: string) =>
    updateSelection({
      instrumentIds: selection.instrumentIds.includes(id)
        ? selection.instrumentIds.filter((instrumentId) => instrumentId !== id)
        : [...selection.instrumentIds, id],
    });
  const startLaunch = () => {
    setResult(runLaunch(selection, evaluation, Date.now().toString(36)));
    setDone(false);
    setProgress(0);
    setTimeline(0);
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
  const changeIssMode = (mode: "tour" | "dock") => {
    setIssMode(mode);
    setDock(null);
    setDockKey((key) => key + 1);
    document.exitPointerLock?.();
  };
  const retryDocking = () => {
    setDock(null);
    setDockKey((key) => key + 1);
  };
  const handleSceneDone = () => {
    if (view === "pad") {
      go("orbit");
    } else if (view === "cruise") {
      go("arrive");
    } else if (view === "orbit") {
      if (lost || destination === "earth") setDone(true);
      else go("cruise");
    } else if (view === "arrive") {
      setDone(true);
    }
  };
  const card = cards.rows[CARD_AT[view] % cards.rows.length];
  const body = destination === "mars" ? "MARS" : "LUNAR";
  const caption =
    view === "pad"
      ? timeline < 6
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
                    : destination === "earth"
                      ? "INSTRUMENTS ACTIVE · DOWNLINK TO EARTH"
                      : `${body} TRANSFER BURN`
        : view === "cruise"
          ? `CRUISE TO ${destination === "mars" ? "MARS · ~7 MONTHS COMPRESSED" : "THE MOON · ~3 DAYS COMPRESSED"}`
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
  const inBase = view === "base" || view === "launch" || view === "pad";
  const showMissionPanel =
    view === "define" ||
    view === "design" ||
    view === "review" ||
    view === "launch" ||
    view === "orbit" ||
    view === "cruise" ||
    view === "arrive";

  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    if (["define", "design", "review"].includes(view)) speak(view, setVoiceCaption);
    if (caption.startsWith("MAIN ENGINE")) speak("countdown", setVoiceCaption);
    else if (caption === "LIFTOFF") speak("liftoff", setVoiceCaption);
    else if (caption === "ORBIT INSERTION") speak("insertion", setVoiceCaption);
    else if (caption.startsWith("DEPLOYING")) speak("deploy", setVoiceCaption);
    else if (
      caption.startsWith("INSTRUMENTS ACTIVE") ||
      caption.startsWith("IN ORBIT")
    )
      speak("success", setVoiceCaption);
    else if (caption.startsWith("SIGNAL LOST") || caption.startsWith("ANOMALY"))
      speak("failure", setVoiceCaption);
  }, [view, caption]);
  useEffect(() => {
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
    if (view !== "pad") return;
    if (timeline >= 4) sfx.layer("rumble", Math.min(1, (timeline - 4) / 5), 0.5);
    if (
      timeline < 6 &&
      Math.ceil(6 - timeline) !== Math.ceil(6 - (timeline - 0.1))
    )
      sfx.beep(timeline > 5 ? 1400 : 900, 0.1);
  }, [timeline, view]);
  useEffect(() => {
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

  return (
    <div className="relative h-full w-full text-slate-100">
      <SceneCanvas
        view={view}
        quality={quality}
        onQualityChange={setQuality}
        destination={destination}
        selection={selection}
        lastHub={lastHub}
        near={near}
        onNear={setNear}
        onTimeline={setTimeline}
        onProgress={setProgress}
        onDone={handleSceneDone}
        launchResult={result}
        issMode={issMode}
        dockKey={dockKey}
        onDock={setDock}
      />
      <RuntimeHud
        view={view}
        fade={fade}
        muted={muted}
        voiceCaption={voiceCaption}
        loading={load.active}
        loadProgress={load.progress}
        timeline={timeline}
        caption={caption}
        onToggleMute={() => setMuted((current) => !current)}
      />
      {view === "intro" && <IntroOverlay onBegin={begin} />}
      <BaseHud
        view={view}
        near={near}
        visited={visited}
        canLaunch={evaluation.canLaunch}
        hasResult={!!result}
      />
      <IssHud
        visible={view === "iss"}
        mode={issMode}
        dock={dock}
        onChangeMode={changeIssMode}
        onReturnToBase={() => returnToBase("iss")}
        onRetryDock={retryDocking}
      />
      {showMissionPanel && (
        <MissionPanel
          view={view}
          card={card}
          selection={selection}
          evaluation={evaluation}
          progress={progress}
          done={done}
          result={result}
          onUpdateSelection={updateSelection}
          onSelectObjective={selectObjective}
          onToggleInstrument={toggleInstrument}
          onStartLaunch={startLaunch}
          onReturn={() =>
            view === "launch" ? go("base") : returnToBase(view)
          }
          onDockAtIss={() => {
            setIssMode("dock");
            go("iss");
          }}
          onNewMission={reset}
        />
      )}
    </div>
  );
}
