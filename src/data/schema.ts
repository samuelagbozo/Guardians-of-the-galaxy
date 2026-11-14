import { z } from 'zod';
import antennasJson from './antennas.json';
import busesJson from './buses.json';
import gameConfigJson from './gameConfig.json';
import instrumentsJson from './instruments.json';
import launchVehiclesJson from './launchVehicles.json';
import objectivesJson from './objectives.json';
import orbitsJson from './orbits.json';
import powerSystemsJson from './powerSystems.json';
import type {
  Antenna,
  GameConfig,
  GameData,
  Instrument,
  LaunchVehicle,
  Objective,
  Orbit,
  PowerSystem,
  SpacecraftBus,
} from '../types/game';

const entityBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  shortDescription: z.string(),
  tooltip: z.string(),
  learnMoreCardId: z.string().optional(),
});

export const objectiveSchema = entityBaseSchema.extend({
  budgetM: z.number().positive(),
  missionDurationDays: z.number().positive(),
  targetSciencePoints: z.number().nonnegative().optional(),
});

export const orbitSchema = entityBaseSchema.extend({
  deltaVNeedMps: z.number().nonnegative(),
});

const numericAttributesSchema = z.record(z.string(), z.number().finite());

export const instrumentSchema = entityBaseSchema.extend({
  attributes: numericAttributesSchema,
});

export const powerSystemSchema = entityBaseSchema.extend({
  attributes: numericAttributesSchema,
});

export const antennaSchema = entityBaseSchema.extend({
  attributes: numericAttributesSchema,
});

export const launchVehicleSchema = entityBaseSchema.extend({
  costM: z.number().nonnegative(),
  payloadCapacityKgByOrbitId: z.record(z.string(), z.number().nonnegative()),
});

export const spacecraftBusSchema = entityBaseSchema.extend({
  attributes: numericAttributesSchema,
  propulsionIspSec: z.number().positive(),
});

const checkMetricSchema = z.enum([
  'requiredSelectionCount',
  'selectedSelectionCount',
  'totalMassKg',
  'launchCapacityKg',
  'costM',
  'budgetM',
  'powerUseW',
  'powerGenW',
  'dataGeneratedMb',
  'dataDownlinkMb',
]);

const checkDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['blocker', 'warning']),
  label: z.string().min(1),
  requiredMetric: checkMetricSchema,
  availableMetric: checkMetricSchema,
  unit: z.string().min(1),
  warnOnThinMargin: z.boolean().optional(),
});

export const gameConfigSchema = z.object({
  defaultSeed: z.number().int(),
  marginWarningThreshold: z.number().min(0).max(1),
  gravityMps2: z.number().positive(),
  checks: z.array(checkDefinitionSchema).superRefine((checks, context) => {
    const ids = new Set<string>();
    for (const [index, check] of checks.entries()) {
      if (ids.has(check.id)) {
        context.addIssue({
          code: 'custom',
          path: ['checks', index, 'id'],
          message: `Duplicate check id "${check.id}".`,
        });
      }
      ids.add(check.id);
    }

    const requiredKinds = new Map([
      ['selection-completeness', 'blocker'],
      ['launch-fit', 'blocker'],
      ['budget', 'blocker'],
      ['power-balance', 'warning'],
      ['data-balance', 'warning'],
    ]);
    for (const [id, kind] of requiredKinds) {
      const check = checks.find((candidate) => candidate.id === id);
      if (!check) {
        context.addIssue({
          code: 'custom',
          path: [],
          message: `Required baseline check "${id}" is missing.`,
        });
      } else if (check.kind !== kind) {
        context.addIssue({
          code: 'custom',
          path: ['checks', checks.indexOf(check), 'kind'],
          message: `Baseline check "${id}" must have kind "${kind}".`,
        });
      }
    }
  }),
  fuelModel: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
});

export interface GameDataInput {
  objectives: unknown;
  orbits: unknown;
  instruments: unknown;
  powerSystems: unknown;
  antennas: unknown;
  launchVehicles: unknown;
  buses: unknown;
  config: unknown;
}

const bundledData: GameDataInput = {
  objectives: objectivesJson,
  orbits: orbitsJson,
  instruments: instrumentsJson,
  powerSystems: powerSystemsJson,
  antennas: antennasJson,
  launchVehicles: launchVehiclesJson,
  buses: busesJson,
  config: gameConfigJson,
};

function parseRows<T>(file: string, schema: z.ZodType<T>, value: unknown): T[] {
  const result = z.array(schema).safeParse(value);
  if (result.success) return result.data;

  const rows: unknown[] = Array.isArray(value) ? value : [];
  const details = result.error.issues.map((issue) => {
    const [index, ...fieldPath] = issue.path;
    const row = typeof index === 'number' ? rows[index] : undefined;
    const rowId =
      row && typeof row === 'object' && 'id' in row
        ? String(row.id)
        : '<missing id>';
    const field = fieldPath.length ? fieldPath.join('.') : '<row>';
    return `${file}: row "${rowId}" field "${field}": ${issue.message}`;
  });

  throw new Error(details.join('\n'));
}

function parseConfig(value: unknown): GameConfig {
  const result = gameConfigSchema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => {
    const field = issue.path.length ? issue.path.join('.') : '<root>';
    return `gameConfig.json: field "${field}": ${issue.message}`;
  });
  throw new Error(details.join('\n'));
}

export function loadGameData(raw: GameDataInput = bundledData): GameData {
  return {
    objectives: parseRows<Objective>('objectives.json', objectiveSchema, raw.objectives),
    orbits: parseRows<Orbit>('orbits.json', orbitSchema, raw.orbits),
    instruments: parseRows<Instrument>('instruments.json', instrumentSchema, raw.instruments),
    powerSystems: parseRows<PowerSystem>('powerSystems.json', powerSystemSchema, raw.powerSystems),
    antennas: parseRows<Antenna>('antennas.json', antennaSchema, raw.antennas),
    launchVehicles: parseRows<LaunchVehicle>(
      'launchVehicles.json',
      launchVehicleSchema,
      raw.launchVehicles,
    ),
    buses: parseRows<SpacecraftBus>('buses.json', spacecraftBusSchema, raw.buses),
    config: parseConfig(raw.config),
  };
}

export const gameData = loadGameData();
