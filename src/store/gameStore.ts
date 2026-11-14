import { create } from 'zustand';
import { gameData } from '../data/schema';
import { evaluateMission } from '../engine';
import { createSeededRng, defaultRiskHooks } from '../engine/hooks';
import type { RiskHooks } from '../engine/hooks';
import type {
  GameData,
  MissionEvaluation,
  MissionReport,
  MissionSelections,
} from '../types/game';

export type GameScreen = 'define' | 'design' | 'review' | 'launch' | 'report';
export type ComponentSlot = 'bus' | 'power' | 'antenna' | 'launchVehicle';
const componentSelectionKey: Record<ComponentSlot, 'busId' | 'powerId' | 'antennaId' | 'launchVehicleId'> = {
  bus: 'busId',
  power: 'powerId',
  antenna: 'antennaId',
  launchVehicle: 'launchVehicleId',
};

export interface GameState {
  screen: GameScreen;
  selections: MissionSelections;
  evaluation: MissionEvaluation;
  report: MissionReport | null;
  seed: number;
  setObjective(id: string): void;
  setOrbit(id: string): void;
  selectComponent(slot: ComponentSlot, id: string): void;
  toggleInstrument(id: string): void;
  goNext(): void;
  goBack(): void;
  canAdvance(): boolean;
  launch(): MissionReport;
  resetGame(seed?: number): void;
}

function emptySelections(): MissionSelections {
  return {
    objectiveId: '',
    orbitId: '',
    busId: '',
    powerId: '',
    antennaId: '',
    launchVehicleId: '',
    instrumentIds: [],
  };
}

function canAdvanceFrom(
  screen: GameScreen,
  selections: MissionSelections,
  evaluation: MissionEvaluation,
): boolean {
  if (screen === 'define') return Boolean(selections.objectiveId && selections.orbitId);
  if (screen === 'design') return true;
  if (screen === 'review') return evaluation.canLaunch;
  return false;
}

export function createGameStore(options: {
  data?: GameData;
  riskHooks?: RiskHooks;
  seed?: number;
} = {}) {
  const data = options.data ?? gameData;
  const riskHooks = options.riskHooks ?? defaultRiskHooks;
  const initialSeed = options.seed ?? data.config.defaultSeed;

  return create<GameState>((set, get) => {
    const initialSelections = emptySelections();
    return {
      screen: 'define',
      selections: initialSelections,
      evaluation: evaluateMission(initialSelections, data),
      report: null,
      seed: initialSeed,

      setObjective: (id) => {
        const selections = { ...get().selections, objectiveId: id };
        set({ selections, evaluation: evaluateMission(selections, data), report: null });
      },

      setOrbit: (id) => {
        const selections = { ...get().selections, orbitId: id };
        set({ selections, evaluation: evaluateMission(selections, data), report: null });
      },

      selectComponent: (slot, id) => {
        const key = componentSelectionKey[slot];
        const selections = { ...get().selections, [key]: id };
        set({ selections, evaluation: evaluateMission(selections, data), report: null });
      },

      toggleInstrument: (id) => {
        const current = get().selections.instrumentIds;
        const instrumentIds = current.includes(id)
          ? current.filter((instrumentId) => instrumentId !== id)
          : [...current, id];
        const selections = { ...get().selections, instrumentIds };
        set({ selections, evaluation: evaluateMission(selections, data), report: null });
      },

      canAdvance: () => {
        const state = get();
        return canAdvanceFrom(state.screen, state.selections, state.evaluation);
      },

      goNext: () => {
        const state = get();
        if (!canAdvanceFrom(state.screen, state.selections, state.evaluation)) return;
        const next: Partial<Record<GameScreen, GameScreen>> = {
          define: 'design',
          design: 'review',
          review: 'launch',
        };
        const screen = next[state.screen];
        if (screen) set({ screen });
      },

      goBack: () => {
        const previous: Partial<Record<GameScreen, GameScreen>> = {
          design: 'define',
          review: 'design',
          launch: 'review',
          report: 'launch',
        };
        const screen = previous[get().screen];
        if (screen) set({ screen });
      },

      launch: () => {
        const state = get();
        if (state.screen !== 'launch') {
          throw new Error('Cannot launch: the current screen is not launch.');
        }
        if (!state.evaluation.canLaunch) {
          throw new Error(
            `Cannot launch: ${state.evaluation.blockers.map((check) => check.cause).join(' ')}`,
          );
        }

        const odds = riskHooks.computeEventOdds(state.evaluation);
        const rolls = riskHooks.rollEvents(odds, createSeededRng(state.seed));
        const outcome = riskHooks.resolveOutcome(state.evaluation, rolls);
        const score = riskHooks.scoreMission(state.evaluation, outcome);
        const report: MissionReport = {
          evaluation: state.evaluation,
          odds,
          rolls,
          outcome,
          score,
        };
        set({ report, screen: 'report' });
        return report;
      },

      resetGame: (seed = data.config.defaultSeed) => {
        const selections = emptySelections();
        set({
          screen: 'define',
          selections,
          evaluation: evaluateMission(selections, data),
          report: null,
          seed,
        });
      },
    };
  });
}

export const useGameStore = createGameStore();
