import { OBJECTIVES, ORBITS } from "../../data";
import type { Sel, evaluate } from "../../engine";
import { RISK_LEVELS } from "../types";

export function LaunchPanel({
  selection,
  evaluation,
  onStartLaunch,
}: {
  selection: Sel;
  evaluation: ReturnType<typeof evaluate>;
  onStartLaunch: () => void;
}) {
  const objective = OBJECTIVES.find(
    (item) => item.id === selection.objectiveId,
  )!;
  const orbit = ORBITS.find((item) => item.id === selection.orbitId)!;
  const risk = RISK_LEVELS[evaluation.level];

  return (
    <>
      <div className="text-sm text-slate-300">
        Mission <b>{objective.name}</b> to <b>{orbit.name}</b>. Status:{" "}
        <b className={risk.color}>{risk.title}</b>
      </div>
      {!evaluation.canLaunch && (
        <div className="mt-3 rounded border border-red-500/60 bg-red-950/50 p-2 text-xs">
          Launch blocked by {evaluation.blockers.length} blocker(s). Visit
          Flight Readiness Review for details.
        </div>
      )}
      <button
        disabled={!evaluation.canLaunch}
        onClick={onStartLaunch}
        className="mt-4 w-full border border-orange-400 bg-orange-500/20 py-3 font-mono tracking-[0.3em] text-orange-200 hover:bg-orange-500/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        START COUNTDOWN
      </button>
    </>
  );
}
