import type {
  EventOdds,
  EventRoll,
  MissionEvaluation,
  RiskOutcome,
  ScoreBreakdown,
} from '../types/game';

export interface RiskHooks {
  computeEventOdds(evaluation: MissionEvaluation): EventOdds;
  rollEvents(odds: EventOdds, rng: () => number): EventRoll[];
  resolveOutcome(evaluation: MissionEvaluation, rolls: EventRoll[]): RiskOutcome;
  scoreMission(evaluation: MissionEvaluation, outcome: RiskOutcome): ScoreBreakdown;
}

export const defaultRiskHooks: RiskHooks = {
  computeEventOdds: () => ({ green: 0.05, yellow: 0.15, red: 0.3 }),

  rollEvents: (odds, rng) =>
    (['green', 'yellow', 'red'] as const).map((eventId) => {
      const roll = rng();
      const threshold = odds[eventId];
      return { eventId, roll, threshold, triggered: roll < threshold };
    }),

  resolveOutcome: (_evaluation, rolls) => {
    if (rolls.some((roll) => roll.eventId === 'red' && roll.triggered)) {
      return { id: 'red', label: 'Major setback', summary: 'A major mission event occurred.' };
    }
    if (rolls.some((roll) => roll.eventId === 'yellow' && roll.triggered)) {
      return { id: 'yellow', label: 'Minor setback', summary: 'A minor mission event occurred.' };
    }
    return { id: 'green', label: 'Nominal', summary: 'No major mission event occurred.' };
  },

  scoreMission: (evaluation, outcome) => {
    const sciencePoints = evaluation.totals.sciencePoints;
    const outcomePoints = outcome.id === 'red' ? 0 : outcome.id === 'yellow' ? 10 : 25;
    return {
      sciencePoints,
      outcomePoints,
      totalPoints: sciencePoints + outcomePoints,
    };
  },
};

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
