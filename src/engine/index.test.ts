import { describe, expect, it } from 'vitest';
import { gameData } from '../data/schema';
import type { CheckDefinition, GameData, MissionSelections } from '../types/game';
import { estimateFuelMassKg, evaluateMission } from './index';

const selections: MissionSelections = {
  objectiveId: 'map-crops',
  orbitId: 'leo',
  busId: 'cubesat-bus',
  powerId: 'compact-solar',
  antennaId: 'high-gain-dish',
  launchVehicleId: 'small-launcher',
  instrumentIds: ['multispectral-camera'],
};

function dataWith(overrides: Partial<GameData>): GameData {
  return { ...gameData, ...overrides };
}

function updateObjectiveBudget(budgetM: number): GameData {
  return dataWith({
    objectives: gameData.objectives.map((objective) =>
      objective.id === selections.objectiveId ? { ...objective, budgetM } : objective,
    ),
  });
}

function updateLaunchCapacity(capacityKg: number): GameData {
  return dataWith({
    launchVehicles: gameData.launchVehicles.map((vehicle) =>
      vehicle.id === selections.launchVehicleId
        ? {
            ...vehicle,
            payloadCapacityKgByOrbitId: {
              ...vehicle.payloadCapacityKgByOrbitId,
              [selections.orbitId]: capacityKg,
            },
          }
        : vehicle,
    ),
  });
}

function updatePowerGeneration(powerGenW: number): GameData {
  return dataWith({
    powerSystems: gameData.powerSystems.map((power) =>
      power.id === selections.powerId
        ? { ...power, attributes: { ...power.attributes, powerGenW } }
        : power,
    ),
  });
}

function updateDownlinkRate(dataDownlinkMbps: number): GameData {
  return dataWith({
    antennas: gameData.antennas.map((antenna) =>
      antenna.id === selections.antennaId
        ? { ...antenna, attributes: { ...antenna.attributes, dataDownlinkMbps } }
        : antenna,
    ),
  });
}

describe('estimateFuelMassKg', () => {
  it('uses the rocket-equation fuel estimate', () => {
    const expected = 200 * (Math.exp(900 / (300 * 9.80665)) - 1);
    expect(estimateFuelMassKg(200, 900, 300, 9.80665)).toBeCloseTo(expected);
  });

  it('returns zero for zero mass or no delta-v requirement', () => {
    expect(estimateFuelMassKg(0, 900, 300, 9.80665)).toBe(0);
    expect(estimateFuelMassKg(200, 0, 300, 9.80665)).toBe(0);
  });
});

describe('evaluateMission', () => {
  it('aggregates dry mass, fuel, cost, power, data volume, and instrument science', () => {
    const evaluation = evaluateMission(selections, gameData);
    const missionSeconds = 365 * 24 * 60 * 60;

    expect(evaluation.totals.dryMassKg).toBe(176);
    expect(evaluation.totals.fuelMassKg).toBeCloseTo(
      estimateFuelMassKg(176, 120, 220, gameData.config.gravityMps2),
    );
    expect(evaluation.totals.totalMassKg).toBeCloseTo(
      evaluation.totals.dryMassKg + evaluation.totals.fuelMassKg,
    );
    expect(evaluation.totals.costM).toBe(126);
    expect(evaluation.totals.powerGenW).toBe(360);
    expect(evaluation.totals.powerUseW).toBe(95);
    expect(evaluation.totals.dataGeneratedMb).toBe(18 * missionSeconds / 8);
    expect(evaluation.totals.dataDownlinkMb).toBe(45 * missionSeconds / 8);
    expect(evaluation.totals.sciencePoints).toBe(32);
  });

  it('passes launch fit at exact capacity and blocks on a shortfall', () => {
    const totals = evaluateMission(selections, gameData).totals;
    const boundary = evaluateMission(
      selections,
      updateLaunchCapacity(totals.totalMassKg),
    );
    const failed = evaluateMission(
      selections,
      updateLaunchCapacity(totals.totalMassKg - 1),
    );

    expect(boundary.checks.find((check) => check.id === 'launch-fit')?.passed).toBe(true);
    expect(boundary.canLaunch).toBe(true);
    expect(failed.blockers.find((check) => check.id === 'launch-fit')?.shortfall).toBeCloseTo(1);
  });

  it('passes the budget boundary and blocks when mission cost exceeds budget', () => {
    const costM = evaluateMission(selections, gameData).totals.costM;
    const boundary = evaluateMission(selections, updateObjectiveBudget(costM));
    const failed = evaluateMission(selections, updateObjectiveBudget(costM - 1));

    expect(boundary.checks.find((check) => check.id === 'budget')?.passed).toBe(true);
    expect(boundary.canLaunch).toBe(true);
    expect(failed.blockers.find((check) => check.id === 'budget')?.shortfall).toBe(1);
  });

  it('warns when power is short and emits a thin-margin warning at the boundary', () => {
    const exactPower = evaluateMission(selections, updatePowerGeneration(95));
    const powerShortfall = evaluateMission(selections, updatePowerGeneration(94));

    expect(exactPower.checks.find((check) => check.id === 'power-balance')?.passed).toBe(true);
    expect(exactPower.warnings.some((check) => check.id === 'power-balance-margin')).toBe(true);
    expect(powerShortfall.warnings.find((check) => check.id === 'power-balance')?.shortfall).toBe(1);
  });

  it('warns when data generation exceeds downlink and at the thin-margin boundary', () => {
    const exactData = evaluateMission(selections, updateDownlinkRate(18));
    const dataShortfall = evaluateMission(selections, updateDownlinkRate(17));

    expect(exactData.checks.find((check) => check.id === 'data-balance')?.passed).toBe(true);
    expect(exactData.warnings.some((check) => check.id === 'data-balance-margin')).toBe(true);
    expect(dataShortfall.warnings.find((check) => check.id === 'data-balance')?.shortfall).toBe(
      365 * 24 * 60 * 60 / 8,
    );
  });

  it('uses the configured margin threshold as an exclusive warning boundary', () => {
    const base = evaluateMission(selections, gameData);
    const launchFitMargin = base.checks.find((check) => check.id === 'launch-fit')?.margin;
    if (launchFitMargin === undefined) throw new Error('Launch-fit check was not evaluated.');

    const atThreshold = dataWith({
      config: { ...gameData.config, marginWarningThreshold: launchFitMargin },
    });
    const belowThreshold = dataWith({
      config: { ...gameData.config, marginWarningThreshold: launchFitMargin + 0.001 },
    });

    expect(
      evaluateMission(selections, atThreshold).warnings.some(
        (check) => check.id === 'launch-fit-margin',
      ),
    ).toBe(false);
    expect(
      evaluateMission(selections, belowThreshold).warnings.some(
        (check) => check.id === 'launch-fit-margin',
      ),
    ).toBe(true);
  });

  it('requires all six primary selections and validates selected instrument ids', () => {
    const empty = evaluateMission(
      {
        objectiveId: '',
        orbitId: '',
        busId: '',
        powerId: '',
        antennaId: '',
        launchVehicleId: '',
        instrumentIds: [],
      },
      gameData,
    );
    const invalidInstrument = evaluateMission(
      { ...selections, instrumentIds: ['missing-instrument'] },
      gameData,
    );

    expect(empty.blockers.some((check) => check.id === 'selection-completeness')).toBe(true);
    expect(
      evaluateMission(selections, gameData).checks.find(
        (check) => check.id === 'selection-completeness',
      )?.passed,
    ).toBe(true);
    expect(invalidInstrument.blockers.some((check) => check.id === 'selection-completeness')).toBe(
      true,
    );
  });

  it('runs additional registry checks without evaluator changes', () => {
    const customCheck: CheckDefinition = {
      id: 'custom-cost-check',
      kind: 'warning',
      label: 'Custom cost check',
      requiredMetric: 'costM',
      availableMetric: 'budgetM',
      unit: 'M credits',
    };
    const customData = dataWith({
      config: {
        ...gameData.config,
        checks: [...gameData.config.checks, customCheck],
      },
    });

    expect(
      evaluateMission(selections, customData).checks.find(
        (check) => check.id === 'custom-cost-check',
      )?.passed,
    ).toBe(true);
  });

  it('includes numeric quantities and units in every failing check cause', () => {
    const failedData = dataWith({
      objectives: gameData.objectives.map((objective) =>
        objective.id === selections.objectiveId ? { ...objective, budgetM: 1 } : objective,
      ),
      launchVehicles: gameData.launchVehicles.map((vehicle) =>
        vehicle.id === selections.launchVehicleId
          ? {
              ...vehicle,
              payloadCapacityKgByOrbitId: { ...vehicle.payloadCapacityKgByOrbitId, leo: 1 },
            }
          : vehicle,
      ),
      powerSystems: gameData.powerSystems.map((power) =>
        power.id === selections.powerId
          ? { ...power, attributes: { ...power.attributes, powerGenW: 0 } }
          : power,
      ),
      antennas: gameData.antennas.map((antenna) =>
        antenna.id === selections.antennaId
          ? { ...antenna, attributes: { ...antenna.attributes, dataDownlinkMbps: 0 } }
          : antenna,
      ),
    });
    const evaluation = evaluateMission(selections, failedData);
    const failedChecks = [...evaluation.blockers, ...evaluation.warnings];

    expect(failedChecks.map((check) => check.id)).toEqual(
      expect.arrayContaining(['launch-fit', 'budget', 'power-balance', 'data-balance']),
    );
    for (const check of failedChecks) {
      expect(check.cause).toMatch(/\d/);
      expect(check.cause).toContain(check.unit);
    }
  });
});
