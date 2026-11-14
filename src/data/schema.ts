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

export const gameConfigSchema = z.object({
  defaultSeed: z.number().int(),
  marginWarningThreshold: z.number().min(0).max(1),
  gravityMps2: z.number().positive(),
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

  const rows = Array.isArray(value) ? value : [];
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
