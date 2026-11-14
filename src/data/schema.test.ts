import { describe, expect, it } from 'vitest';
import { gameData, loadGameData } from './schema';
import { evaluateMission } from '../engine';
import type { MissionSelections } from '../types/game';

describe('loadGameData', () => {
  it('loads added rows across every catalog table and evaluates a mission using them', () => {
    const data = loadGameData({
      ...gameData,
      objectives: [
        ...gameData.objectives,
        {
          ...gameData.objectives[0],
          id: 'new-objective',
          budgetM: 1000,
          missionDurationDays: 10,
        },
      ],
      orbits: [
        ...gameData.orbits,
        { ...gameData.orbits[0], id: 'new-orbit', deltaVNeedMps: 100 },
      ],
      instruments: [
        ...gameData.instruments,
        {
          ...gameData.instruments[0],
          id: 'new-instrument',
          attributes: {
            massKg: 20,
            powerUseW: 15,
            dataGeneratedMbps: 5,
            costM: 10,
            sciencePoints: 7,
          },
        },
      ],
      powerSystems: [
        ...gameData.powerSystems,
        {
          ...gameData.powerSystems[0],
          id: 'new-power',
          attributes: { massKg: 30, powerGenW: 120, costM: 5 },
        },
      ],
      antennas: [
        ...gameData.antennas,
        {
          ...gameData.antennas[0],
          id: 'new-antenna',
          attributes: { massKg: 10, dataDownlinkMbps: 10, costM: 4 },
        },
      ],
      launchVehicles: [
        ...gameData.launchVehicles,
        {
          ...gameData.launchVehicles[0],
          id: 'new-launch-vehicle',
          costM: 20,
          payloadCapacityKgByOrbitId: { 'new-orbit': 1000 },
        },
      ],
      buses: [
        ...gameData.buses,
        {
          ...gameData.buses[0],
          id: 'new-bus',
          attributes: { massKg: 100, costM: 10 },
          propulsionIspSec: 300,
        },
      ],
    });
    const selections: MissionSelections = {
      objectiveId: 'new-objective',
      orbitId: 'new-orbit',
      busId: 'new-bus',
      powerId: 'new-power',
      antennaId: 'new-antenna',
      launchVehicleId: 'new-launch-vehicle',
      instrumentIds: ['new-instrument'],
    };
    const evaluation = evaluateMission(selections, data);

    expect(evaluation.totals.dryMassKg).toBe(160);
    expect(evaluation.totals.sciencePoints).toBe(7);
    expect(evaluation.totals.costM).toBe(49);
    expect(evaluation.totals.dataGeneratedMb).toBe(5 * 10 * 24 * 60 * 60 / 8);
    expect(evaluation.canLaunch).toBe(true);
  });

  it('rejects a bad row with its filename, id, and field in the error', () => {
    const invalidObjective = {
      ...gameData.objectives[0],
      id: 'bad-objective',
      budgetM: 'not-a-number',
    };

    expect(() =>
      loadGameData({
        ...gameData,
        objectives: [...gameData.objectives, invalidObjective],
      }),
    ).toThrow(/objectives\.json: row "bad-objective" field "budgetM"/);
  });

  it('rejects a config missing a baseline gate check with a readable field message', () => {
    const invalidConfig = {
      ...gameData.config,
      checks: gameData.config.checks.filter((check) => check.id !== 'launch-fit'),
    };

    expect(() =>
      loadGameData({
        ...gameData,
        config: invalidConfig,
      }),
    ).toThrow(/gameConfig\.json: field "<root>": Required baseline check "launch-fit" is missing/);
  });
});
