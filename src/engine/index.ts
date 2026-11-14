import type {
  CheckDefinition,
  CheckMetric,
  CheckResult,
  GameData,
  Instrument,
  MissionEvaluation,
  MissionSelections,
  NumericAttributes,
  ResourceTotals,
} from '../types/game';

type GameMetricValues = Record<CheckMetric, number>;

function sumNumericAttributes(
  ...attributeSets: (NumericAttributes | undefined)[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const attributes of attributeSets) {
    if (!attributes) continue;
    for (const [name, value] of Object.entries(attributes)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        totals[name] = (totals[name] ?? 0) + value;
      }
    }
  }
  return totals;
}

/**
 * TODO(balance): tune this simple ideal rocket-equation estimate with game feedback.
 * Fuel = dry mass * (exp(delta-v / (Isp * g0)) - 1).
 */
export function estimateFuelMassKg(
  dryMassKg: number,
  deltaVNeedMps: number,
  propulsionIspSec: number,
  gravityMps2: number,
): number {
  if (dryMassKg <= 0 || deltaVNeedMps <= 0 || propulsionIspSec <= 0 || gravityMps2 <= 0) {
    return 0;
  }
  return dryMassKg * Math.expm1(deltaVNeedMps / (propulsionIspSec * gravityMps2));
}

function makeCheck(
  definition: Pick<CheckDefinition, 'id' | 'kind' | 'label' | 'unit'>,
  required: number,
  available: number,
  unit = definition.unit,
): CheckResult {
  // Margin = (available - required) / available.
  const passed = required <= available;
  const shortfall = Math.max(0, required - available);
  const margin = available > 0 ? (available - required) / available : passed ? 0 : -1;
  const cause = passed
    ? `${definition.label}: ${required} ${unit} required; ${available} ${unit} available.`
    : `${definition.label}: ${required} ${unit} required, ${available} ${unit} available; shortfall ${shortfall} ${unit}.`;

  return {
    id: definition.id,
    kind: definition.kind,
    passed,
    label: definition.label,
    cause,
    required,
    available,
    shortfall,
    unit,
    margin,
  };
}

function makeThinMarginCheck(
  check: CheckResult,
  threshold: number,
): CheckResult {
  // Express the warning threshold and observed margin as percentage points.
  const thresholdPercentage = threshold * 100;
  const availablePercentage = Math.max(0, check.margin * 100);
  return makeCheck(
    {
      id: `${check.id}-margin`,
      kind: 'warning',
      label: `Thin ${check.label.toLowerCase()} margin`,
      unit: 'percentage points',
    },
    thresholdPercentage,
    availablePercentage,
    'percentage points',
  );
}

function findById<T extends { id: string }>(rows: T[], id: string): T | undefined {
  return rows.find((row) => row.id === id);
}

export function evaluateMission(
  selections: MissionSelections,
  data: GameData,
): MissionEvaluation {
  const objective = findById(data.objectives, selections.objectiveId);
  const orbit = findById(data.orbits, selections.orbitId);
  const bus = findById(data.buses, selections.busId);
  const powerSystem = findById(data.powerSystems, selections.powerId);
  const antenna = findById(data.antennas, selections.antennaId);
  const launchVehicle = findById(data.launchVehicles, selections.launchVehicleId);
  const instruments = selections.instrumentIds
    .map((id) => findById(data.instruments, id))
    .filter((instrument): instrument is Instrument => instrument !== undefined);
  const componentMetrics = sumNumericAttributes(
    bus?.attributes,
    powerSystem?.attributes,
    antenna?.attributes,
    ...instruments.map((instrument) => instrument.attributes),
  );
  const instrumentMetrics = sumNumericAttributes(
    ...instruments.map((instrument) => instrument.attributes),
  );
  const powerMetrics = sumNumericAttributes(powerSystem?.attributes);
  const antennaMetrics = sumNumericAttributes(antenna?.attributes);

  // Dry mass = bus + instrument + power-system + antenna mass attributes.
  const dryMassKg = componentMetrics.massKg ?? 0;
  // Total mass = dry mass + rocket-equation fuel estimate.
  const fuelMassKg = estimateFuelMassKg(
    dryMassKg,
    orbit?.deltaVNeedMps ?? 0,
    bus?.propulsionIspSec ?? 0,
    data.config.gravityMps2,
  );
  const totalMassKg = dryMassKg + fuelMassKg;
  const missionSeconds = (objective?.missionDurationDays ?? 0) * 24 * 60 * 60;
  // Generated data uses instrument rates; downlink uses the antenna rate, both in MB.
  // Data volume (MB) = rate (Mbps) * mission seconds / 8 bits per byte.
  const dataGeneratedMb = (instrumentMetrics.dataGeneratedMbps ?? 0) * missionSeconds / 8;
  const dataDownlinkMb = (antennaMetrics.dataDownlinkMbps ?? 0) * missionSeconds / 8;
  // Cost = selected component costs + launch cost; science = instrument science values.
  const costM = (componentMetrics.costM ?? 0) + (launchVehicle?.costM ?? 0);
  const requiredSelectionCount = 6 + selections.instrumentIds.length;
  const selectedSelectionCount =
    [objective, orbit, bus, powerSystem, antenna, launchVehicle].filter(Boolean).length +
    instruments.length;

  const totals: ResourceTotals = {
    dryMassKg,
    fuelMassKg,
    totalMassKg,
    powerGenW: powerMetrics.powerGenW ?? 0,
    powerUseW: componentMetrics.powerUseW ?? 0,
    dataGeneratedMb,
    dataDownlinkMb,
    costM,
    sciencePoints: instrumentMetrics.sciencePoints ?? 0,
  };

  const values: GameMetricValues = {
    requiredSelectionCount,
    selectedSelectionCount,
    totalMassKg,
    launchCapacityKg: launchVehicle?.payloadCapacityKgByOrbitId[orbit?.id ?? ''] ?? 0,
    costM,
    budgetM: objective?.budgetM ?? 0,
    powerUseW: totals.powerUseW,
    powerGenW: totals.powerGenW,
    dataGeneratedMb,
    dataDownlinkMb,
  };

  const checks = data.config.checks.map((definition) =>
    makeCheck(
      definition,
      values[definition.requiredMetric],
      values[definition.availableMetric],
    ),
  );
  const marginWarnings = data.config.checks
    .filter((definition) => definition.warnOnThinMargin)
    .map((definition) => checks.find((check) => check.id === definition.id))
    .filter(
      (check): check is CheckResult =>
        check !== undefined &&
        check.passed &&
        check.margin < data.config.marginWarningThreshold,
    )
    .map((check) => makeThinMarginCheck(check, data.config.marginWarningThreshold));
  const allChecks = [...checks, ...marginWarnings];
  const blockers = allChecks.filter((check) => check.kind === 'blocker' && !check.passed);
  const warnings = allChecks.filter((check) => check.kind === 'warning' && !check.passed);
  const worstCheck = allChecks.reduce<CheckResult | null>(
    (worst, check) => (worst === null || check.margin < worst.margin ? check : worst),
    null,
  );

  return {
    totals,
    checks: allChecks,
    blockers,
    warnings,
    canLaunch: blockers.length === 0,
    smallestMargin: worstCheck?.margin ?? 0,
    worstMarginCheckId: worstCheck?.id ?? null,
    worstMarginCause: worstCheck?.cause ?? null,
  };
}
