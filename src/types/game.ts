export interface EntityBase {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  tooltip: string;
  learnMoreCardId?: string;
}

export interface NumericAttributes {
  massKg?: number;
  powerGenW?: number;
  powerUseW?: number;
  dataGeneratedMbps?: number;
  dataDownlinkMbps?: number;
  costM?: number;
  sciencePoints?: number;
  [attribute: string]: number | undefined;
}

export interface Objective extends EntityBase {
  budgetM: number;
  missionDurationDays: number;
  targetSciencePoints?: number;
}

export interface Orbit extends EntityBase {
  deltaVNeedMps: number;
}

export interface Instrument extends EntityBase {
  attributes: NumericAttributes;
}

export interface PowerSystem extends EntityBase {
  attributes: NumericAttributes;
}

export interface Antenna extends EntityBase {
  attributes: NumericAttributes;
}

export interface LaunchVehicle extends EntityBase {
  costM: number;
  payloadCapacityKgByOrbitId: Record<string, number>;
}

export interface SpacecraftBus extends EntityBase {
  attributes: NumericAttributes;
  propulsionIspSec: number;
}

export interface GameConfig {
  defaultSeed: number;
  marginWarningThreshold: number;
  gravityMps2: number;
  fuelModel: {
    name: string;
    description: string;
  };
}

export interface GameData {
  objectives: Objective[];
  orbits: Orbit[];
  instruments: Instrument[];
  powerSystems: PowerSystem[];
  antennas: Antenna[];
  launchVehicles: LaunchVehicle[];
  buses: SpacecraftBus[];
  config: GameConfig;
}

export interface MissionSelections {
  objectiveId: string;
  orbitId: string;
  busId: string;
  powerId: string;
  antennaId: string;
  launchVehicleId: string;
  instrumentIds: string[];
}

export interface ResourceTotals {
  dryMassKg: number;
  fuelMassKg: number;
  totalMassKg: number;
  powerGenW: number;
  powerUseW: number;
  dataGeneratedMb: number;
  dataDownlinkMb: number;
  costM: number;
  sciencePoints: number;
}

export interface CheckResult {
  id: string;
  kind: 'blocker' | 'warning';
  passed: boolean;
  label: string;
  cause: string;
  required: number;
  available: number;
  shortfall: number;
  unit: string;
  margin: number;
}

export interface MissionEvaluation {
  totals: ResourceTotals;
  checks: CheckResult[];
  blockers: CheckResult[];
  warnings: CheckResult[];
  canLaunch: boolean;
  smallestMargin: number;
  worstMarginCheckId: string | null;
  worstMarginCause: string | null;
}

export interface EventOdds {
  green: number;
  yellow: number;
  red: number;
}

export interface EventRoll {
  eventId: string;
  roll: number;
  threshold: number;
  triggered: boolean;
}

export interface RiskOutcome {
  id: string;
  label: string;
  summary: string;
}

export interface ScoreBreakdown {
  sciencePoints: number;
  outcomePoints: number;
  totalPoints: number;
}

export interface MissionReport {
  evaluation: MissionEvaluation;
  odds: EventOdds;
  rolls: EventRoll[];
  outcome: RiskOutcome;
  score: ScoreBreakdown;
}

export type MissionResult = MissionReport;
