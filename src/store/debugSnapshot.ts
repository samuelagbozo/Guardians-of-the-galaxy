import { useGameStore } from './gameStore';

export function getDebugSnapshotJson(): string {
  const { screen, selections, evaluation } = useGameStore.getState();
  return JSON.stringify(
    {
      screen,
      selections,
      evaluation,
      checks: evaluation.checks,
    },
    null,
    2,
  );
}
