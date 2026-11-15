import type { evaluate } from "../../engine";
import { ResourceMargins, SectionHeading } from "../MissionUi";
import { RISK_LEVELS } from "../types";

export function ReviewPanel({
  evaluation,
}: {
  evaluation: ReturnType<typeof evaluate>;
}) {
  const risk = RISK_LEVELS[evaluation.level];

  return (
    <>
      <div className="rounded border border-slate-700 bg-slate-900/60 p-3 font-mono">
        <div className={`text-lg font-bold ${risk.color}`}>{risk.title}</div>
        <div className="text-xs text-slate-300">
          Worst margin: {evaluation.worst.label}, {evaluation.worst.pct}%
        </div>
      </div>
      <ResourceMargins margins={evaluation.margins} />
      <SectionHeading>Blockers</SectionHeading>
      {evaluation.blockers.length ? (
        evaluation.blockers.map((blocker, index) => (
          <div
            key={index}
            className="mb-2 rounded border border-red-500/60 bg-red-950/50 p-2 text-xs"
          >
            BLOCKER · {blocker}
          </div>
        ))
      ) : (
        <div className="text-xs text-emerald-400">
          No blockers. Cleared for launch.
        </div>
      )}
      <SectionHeading>Warnings</SectionHeading>
      {evaluation.warnings.length ? (
        evaluation.warnings.map((warning, index) => (
          <div
            key={index}
            className="mb-2 rounded border border-amber-500/60 bg-amber-950/40 p-2 text-xs"
          >
            WARNING · {warning}
          </div>
        ))
      ) : (
        <div className="text-xs text-emerald-400">No warnings.</div>
      )}
    </>
  );
}
