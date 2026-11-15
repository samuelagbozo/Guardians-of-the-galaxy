export type View =
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

export const CARD_AT: Record<View, number> = {
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

export const RISK_LEVELS = {
  green: { title: "LOW RISK", color: "text-emerald-400" },
  yellow: { title: "ELEVATED RISK", color: "text-amber-400" },
  red: { title: "CRITICAL RISK", color: "text-red-400" },
} as const;

export const GLASS_PANEL = "panel";
