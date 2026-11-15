import type { Sel, LaunchResult, evaluate } from "../engine";
import type { View } from "./types";
import { DesignPanel } from "./mission/DesignPanel";
import { LaunchPanel } from "./mission/LaunchPanel";
import { ObjectivePanel } from "./mission/ObjectivePanel";
import { ReportPanel } from "./mission/ReportPanel";
import { ReviewPanel } from "./mission/ReviewPanel";

export function MissionPanel({
  view,
  card,
  selection,
  evaluation,
  progress,
  done,
  result,
  onUpdateSelection,
  onSelectObjective,
  onToggleInstrument,
  onStartLaunch,
  onReturn,
  onDockAtIss,
  onNewMission,
}: {
  view: View;
  card: { title: string; body: string; source: string };
  selection: Sel;
  evaluation: ReturnType<typeof evaluate>;
  progress: number;
  done: boolean;
  result: LaunchResult | null;
  onUpdateSelection: (patch: Partial<Sel>) => void;
  onSelectObjective: (id: string) => void;
  onToggleInstrument: (id: string) => void;
  onStartLaunch: () => void;
  onReturn: () => void;
  onDockAtIss: () => void;
  onNewMission: () => void;
}) {
  return (
    <aside className="absolute inset-x-0 bottom-0 max-h-[55vh] overflow-y-auto p-4 md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-[27rem] panel md:border-y-0 md:border-l-0">
      <div className="mb-3 rounded border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs text-cyan-100">
        <div className="font-mono font-bold uppercase tracking-wider">
          {card.title}
        </div>
        <div className="mt-1">{card.body}</div>
        <div className="mt-1 text-[10px] text-cyan-400/70">{card.source}</div>
      </div>

      {view === "define" && (
        <ObjectivePanel
          selection={selection}
          onSelectObjective={onSelectObjective}
          onSelectOrbit={(orbitId) => onUpdateSelection({ orbitId })}
        />
      )}
      {view === "design" && (
        <DesignPanel
          selection={selection}
          margins={evaluation.margins}
          onUpdateSelection={onUpdateSelection}
          onToggleInstrument={onToggleInstrument}
        />
      )}
      {view === "review" && <ReviewPanel evaluation={evaluation} />}
      {view === "launch" && (
        <LaunchPanel
          selection={selection}
          evaluation={evaluation}
          onStartLaunch={onStartLaunch}
        />
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
        <ReportPanel
          selection={selection}
          result={result}
          onDockAtIss={onDockAtIss}
          onNewMission={onNewMission}
        />
      )}
      {(view === "define" ||
        view === "design" ||
        view === "review" ||
        view === "launch") && (
        <button
          onClick={onReturn}
          className="mt-5 w-full border border-cyan-400 py-2 font-mono tracking-widest text-cyan-200 hover:bg-cyan-400/20"
        >
          {view === "launch" ? "RETURN TO BASE" : "CONFIRM & RETURN TO BASE"}
        </button>
      )}
      <p className="mt-4 text-[10px] text-slate-500">
        Drag to rotate · scroll to zoom. Values are simplified for learning,
        not exact NASA data.
      </p>
    </aside>
  );
}
