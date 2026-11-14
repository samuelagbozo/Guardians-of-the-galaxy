import type {
  CheckResult,
  GameData,
  MissionEvaluation,
  MissionSelections,
  ResourceTotals,
} from '../types/game';

function makeCheck(
  id: string,
  kind: CheckResult['kind'],
  label: string,
  required: number,
  available: number,
  unit: string,
): CheckResult {
  const passed = required <= available;
  const shortfall = Math.max(0, required - available);
  const margin = available > 0 ? (available - required) / available : passed ? 0 : -1;
  const cause = passed
    ? `${label}: ${required} ${unit} required; ${available} ${unit} available.`
    : `${label}: ${required} ${unit} required, ${available} ${unit} available; shortfall ${shortfall} ${unit}.`;

  return { id, kind, passed, label, cause, required, available, shortfall, unit, margin };
}

function lookup<T extends { id: string }>(rows: T[], id: string): T | undefined {
  return rows.find((row) => row.id === id);
}

export function evaluateMission(
  selections: MissionSelections,
  data: GameData,
): MissionEvaluation {
  // Step 0 placeholder values keep consumer screens and hooks usable before Step 1.
  const totals: ResourceTotals = {
    dryMassKg: 480,
    fuelMassKg: 120,
    totalMassKg: 600,
    powerGenW: 750,
    powerUseW: 500,
    dataGeneratedMb: 18000,
    dataDownlinkMb: 21000,
    costM: 180,
    sciencePoints: 80,
  };

  const objective = lookup(data.objectives, selections.objectiveId);
  const orbit = lookup(data.orbits, selections.orbitId);
  const vehicle = lookup(data.launchVehicles, selections.launchVehicleId);
  const capacity = vehicle?.payloadCapacityKgByOrbitId[orbit?.id ?? ''] ?? 0;
  const checks = [
    makeCheck('launch-fit', 'blocker', 'Launch mass fit', totals.totalMassKg, capacity, 'kg'),
    makeCheck('budget', 'blocker', 'Mission budget', totals.costM, objective?.budgetM ?? 0, 'M credits'),
    makeCheck('power-balance', 'warning', 'Power balance', totals.powerUseW, totals.powerGenW, 'W'),
    makeCheck(
      'data-balance',
      'warning',
      'Data return capacity',
      totals.dataGeneratedMb,
      totals.dataDownlinkMb,
      'MB',
    ),
  ];
  const blockers = checks.filter((check) => check.kind === 'blocker' && !check.passed);
  const warnings = checks.filter((check) => check.kind === 'warning' && !check.passed);
  const worstCheck = checks.reduce<CheckResult | null>(
    (worst, check) => (worst === null || check.margin < worst.margin ? check : worst),
    null,
  );

  return {
    totals,
    checks,
    blockers,
    warnings,
    canLaunch: blockers.length === 0,
    smallestMargin: worstCheck?.margin ?? 0,
    worstMarginCheckId: worstCheck?.id ?? null,
    worstMarginCause: worstCheck?.cause ?? null,
  };
}
