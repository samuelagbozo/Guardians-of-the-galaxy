import type { ReactNode } from "react";
import type { Part } from "../data";
import { usd } from "../engine";

export function MissionCard({
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

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
      {children}
    </h3>
  );
}

export function partStats(part: Part) {
  const stats: string[] = [];
  if (part.massKg) stats.push(`${part.massKg} kg`);
  if (part.powerW) stats.push(`${part.powerW} W`);
  if (part.dataRateMbps) stats.push(`${part.dataRateMbps} Mbps`);
  if (part.payKg) stats.push(`payload ${part.payKg} kg`);
  if (part.capKg) stats.push(`lifts ${part.capKg} kg to LEO`);
  stats.push(usd(part.costUsd));
  return stats.join(" · ");
}

export function ResourceMargins({
  margins,
}: {
  margins: ReturnType<typeof import("../engine").evaluate>["margins"];
}) {
  return (
    <div className="mt-3 rounded border border-slate-700 bg-slate-900/60 p-3">
      {margins.map((margin) => {
        const ratio = margin.available ? margin.required / margin.available : 0;
        return (
          <div key={margin.key} className="mb-2 last:mb-0">
            <div className="flex justify-between font-mono text-[11px] text-slate-300">
              <span>{margin.label}</span>
              <span>{margin.text}</span>
            </div>
            <div className="h-1.5 rounded bg-slate-700">
              <div
                className={`h-1.5 rounded transition-all duration-300 ${ratio > 1 ? "bg-red-500" : ratio > 0.85 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
