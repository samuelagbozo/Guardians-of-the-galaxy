import type { DockInfo } from "../scenes/Iss";

export function IssHud({
  visible,
  mode,
  dock,
  onChangeMode,
  onReturnToBase,
  onRetryDock,
}: {
  visible: boolean;
  mode: "tour" | "dock";
  dock: DockInfo | null;
  onChangeMode: (mode: "tour" | "dock") => void;
  onReturnToBase: () => void;
  onRetryDock: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="absolute left-4 top-4 w-72 p-3 font-mono text-[11px] text-slate-300 panel">
      <div className="mb-2 tracking-[0.25em] text-cyan-300">
        ISS · {mode === "tour" ? "ZERO-G TOUR" : "DRAGON DOCKING"}
      </div>
      <div className="mb-2 flex gap-1">
        {(["tour", "dock"] as const).map((nextMode) => (
          <button
            key={nextMode}
            onClick={() => onChangeMode(nextMode)}
            className={`flex-1 border py-1 ${mode === nextMode ? "border-cyan-400 bg-cyan-400/20 text-cyan-100" : "border-slate-600"}`}
          >
            {nextMode === "tour" ? "FREE TOUR" : "DOCK DRAGON"}
          </button>
        ))}
      </div>
      {mode === "tour" ? (
        <div>
          Click to look · WASD fly · Space up · C down · Shift fast · Esc
          release
        </div>
      ) : (
        <div>
          <div>Click to look · WASD/Space/C thrust · X brake · Esc release</div>
          <div className="mt-2 text-slate-400">
            Real docking is slow: thrusters add speed that never fades. Arrive
            under the limit with propellant to spare.
          </div>
          {dock && (
            <div className="mt-2 space-y-0.5 text-xs">
              <div>
                RANGE <b className="text-white">{dock.range.toFixed(1)} m</b>
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
                    onClick={onRetryDock}
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
        onClick={onReturnToBase}
        className="mt-3 block w-full border border-cyan-400 py-1 text-cyan-200 hover:bg-cyan-400/20"
      >
        RETURN TO BASE
      </button>
    </div>
  );
}
