import type { LaunchResult, Sel } from "../../engine";
import missions from "../../data/real_missions.json";
import { SectionHeading } from "../MissionUi";
import { ORBITS } from "../../data";

const OBJECTIVE_KEYWORDS: Record<string, RegExp> = {
  "earth-climate": /earth|climate|ice|ocean|atmospher|land/i,
  "exo-telescope": /telescope|x-ray|star|galax|exoplanet|astronom|cosmic/i,
  "solar-weather": /sun|solar|radiation|space weather|magnet/i,
  "lunar-survey": /moon|lunar|ice|crater/i,
  "mars-science": /mars|ice|water|planet/i,
};

export function ReportPanel({
  selection,
  result,
  onDockAtIss,
  onNewMission,
}: {
  selection: Sel;
  result: LaunchResult;
  onDockAtIss: () => void;
  onNewMission: () => void;
}) {
  const orbit = ORBITS.find((item) => item.id === selection.orbitId)!;
  const keyword = OBJECTIVE_KEYWORDS[selection.objectiveId];
  const relatedMissions = missions.rows
    .filter((mission) => keyword.test(`${mission.name} ${mission.summary}`))
    .slice(0, 3);
  const outcomeStyle =
    result.outcome === "success"
      ? "bg-emerald-900/60 text-emerald-300"
      : result.outcome === "partial-success"
        ? "bg-amber-900/50 text-amber-300"
        : "bg-red-900/50 text-red-300";
  const outcomeLabel =
    result.outcome === "success"
      ? "FULL SUCCESS"
      : result.outcome === "partial-success"
        ? "PARTIAL SUCCESS"
        : "MISSION FAILURE";

  return (
    <div>
      <div
        className={`rounded p-3 text-center font-mono text-lg font-bold ${outcomeStyle}`}
      >
        {outcomeLabel}
      </div>
      <div className="mt-2 text-center font-mono text-[11px] text-slate-400">
        Destination: {orbit.name}
      </div>
      <SectionHeading>Verdict</SectionHeading>
      <div className="rounded bg-slate-800/70 p-2 text-sm">
        <b>{result.verdict.title}.</b> {result.verdict.text}
      </div>
      <SectionHeading>Score: {result.score.total}</SectionHeading>
      {result.score.cats.map((category) => (
        <div
          key={category.label}
          className="flex justify-between border-b border-slate-700 py-1 text-xs"
        >
          <span>
            {category.label}
            <span className="block text-slate-500">{category.note}</span>
          </span>
          <b>{category.points}</b>
        </div>
      ))}
      <SectionHeading>Cause chain</SectionHeading>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-300">
        {result.causeChain.map((cause, index) => (
          <li key={index}>{cause}</li>
        ))}
      </ol>
      <SectionHeading>Real missions like yours</SectionHeading>
      {relatedMissions.map((mission) => (
        <div key={mission.id} className="mb-2 text-xs text-slate-300">
          <b className="text-cyan-300">{mission.name}</b> (
          {mission.organization}): {mission.summary}
        </div>
      ))}
      <div className="mt-2 text-[10px] text-slate-500">
        Seed {result.seed}. Same seed and design gives the same result.
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onDockAtIss}
          className="flex-1 border border-emerald-400 py-2 font-mono text-xs text-emerald-200 hover:bg-emerald-400/20"
        >
          DOCK AT THE ISS
        </button>
        <button
          onClick={onNewMission}
          className="flex-1 border border-cyan-400 py-2 font-mono text-xs text-cyan-200 hover:bg-cyan-400/20"
        >
          NEW MISSION
        </button>
      </div>
    </div>
  );
}
