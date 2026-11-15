import { HUBS } from "../scenes/Base";
import type { View } from "./types";

const HUB_TASKS = [
  ["define", "Define the mission"],
  ["design", "Build the spacecraft"],
  ["review", "Pass flight review"],
  ["launch", "Launch"],
] as const;

export function BaseHud({
  view,
  near,
  visited,
  canLaunch,
  hasResult,
}: {
  view: View;
  near: string | null;
  visited: string[];
  canLaunch: boolean;
  hasResult: boolean;
}) {
  const isInBase = view === "base" || view === "launch" || view === "pad";
  if (!isInBase || view === "pad") return null;

  const isComplete = (id: string) =>
    id === "review"
      ? visited.includes("review") && canLaunch
      : id === "launch"
        ? hasResult
        : visited.includes(id);
  const nearbyHub = HUBS.find((hub) => hub.id === near);

  return (
    <>
      <div className="absolute left-4 top-4 w-64 p-3 font-mono text-xs panel">
        <div className="mb-2 tracking-[0.25em] text-cyan-300">
          MISSION CHECKLIST
        </div>
        {HUB_TASKS.map(([id, label]) => (
          <div
            key={id}
            className={isComplete(id) ? "text-emerald-400" : "text-slate-300"}
          >
            {isComplete(id) ? "[x]" : "[ ]"} {label}
          </div>
        ))}
      </div>
      {view === "base" && (
        <>
          <div className="absolute bottom-4 left-4 p-3 font-mono text-[11px] text-slate-300 panel">
            Click to look · WASD move · hold Shift to drive fast · E interact ·
            Esc release mouse
          </div>
          {nearbyHub && (
            <div className="absolute bottom-24 w-full text-center">
              <span className="px-5 py-2 font-mono text-sm tracking-widest text-white panel">
                PRESS <b className="text-cyan-300">E</b> ·{" "}
                {nearbyHub.label.toUpperCase()}
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}
