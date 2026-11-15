// All game content is DATA. The engine never branches on specific ids, so new rows can be added freely.
// Units: massKg, powerW, dataRateMbps, volumeM3, costUsd.
// Instruments: powerW = consumed, dataRateMbps = produced.
// Power systems: powerW = generated.  Antennas: dataRateMbps = downlink capacity, powerW = consumed.
// Buses: powerW = consumed, payKg/payM3 = payload capacity.  Launchers: capKg (to LEO), capM3, rel = reliability.
export type Part = {
  id: string; name: string; desc: string
  massKg: number; powerW: number; dataRateMbps: number; volumeM3: number; costUsd: number
  science?: number; objectives?: string[]; color?: string
  payKg?: number; payM3?: number; model?: string; capKg?: number; capM3?: number; rel?: number
}
const M = 1e6
const p = (id: string, name: string, desc: string, massKg: number, powerW: number, dataRateMbps: number,
  volumeM3: number, costM: number, extra: Partial<Part> = {}): Part =>
  ({ id, name, desc, massKg, powerW, dataRateMbps, volumeM3, costUsd: costM * M, ...extra })

export type Dest = 'earth' | 'moon' | 'mars'
export type Orbit = { id: string; name: string; altKm: number; factor: number; desc: string; dest: Dest }
export type Objective = { id: string; name: string; goal: string; budgetUsd: number; orbitIds: string[]; learn: string }

export const ORBITS: Orbit[] = [
  { id: 'leo', name: 'Low Earth Orbit', altKm: 400, factor: 1, desc: 'Like the ISS. Easy to reach, circles Earth every ~90 minutes.', dest: 'earth' },
  { id: 'sso', name: 'Sun-Synchronous Orbit', altKm: 700, factor: 0.8, desc: 'Passes over each spot at the same local time, so lighting is consistent. Great for imaging.', dest: 'earth' },
  { id: 'geo', name: 'Geostationary Orbit', altKm: 35786, factor: 0.22, desc: 'Matches Earth’s rotation, hovering over one spot. Very expensive in rocket mass to reach.', dest: 'earth' },
  { id: 'lunar-orbit', name: 'Low Lunar Orbit', altKm: 100, factor: 0.2, desc: 'Circles the Moon about 100 km up. Needs a trans-lunar injection burn, so less mass fits on the rocket.', dest: 'moon' },
  { id: 'mars-orbit', name: 'Low Mars Orbit', altKm: 400, factor: 0.1, desc: 'Circles Mars after a ~7 month cruise. Very little mass survives the trip, so every kilogram counts.', dest: 'mars' },
]

export const OBJECTIVES: Objective[] = [
  { id: 'earth-climate', name: 'Earth Climate Monitor', goal: 'Track clouds, ice and surface temperature to understand climate change.',
    budgetUsd: 300 * M, orbitIds: ['sso', 'leo'], learn: 'Climate satellites like Terra and Aqua use sun-synchronous orbits for consistent lighting.' },
  { id: 'exo-telescope', name: 'Space Telescope', goal: 'Observe distant stars and exoplanets without atmospheric blur.',
    budgetUsd: 450 * M, orbitIds: ['leo', 'geo'], learn: 'Hubble sits in LEO. Larger mirrors gather more light but weigh far more.' },
  { id: 'solar-weather', name: 'Solar Weather Watch', goal: 'Watch the Sun and warn Earth about solar storms.',
    budgetUsd: 350 * M, orbitIds: ['geo', 'sso'], learn: 'Solar storms can disrupt power grids and satellites. Early warning protects both.' },
  { id: 'lunar-survey', name: 'Lunar Ice Survey', goal: 'Map the Moon and search the polar craters for water ice.',
    budgetUsd: 400 * M, orbitIds: ['lunar-orbit'], learn: 'Water ice in permanently shadowed lunar craters could supply future crews with drinking water and rocket fuel.' },
  { id: 'mars-science', name: 'Mars Science Orbiter', goal: 'Photograph Mars and look beneath its surface for ice and ancient water.',
    budgetUsd: 750 * M, orbitIds: ['mars-orbit'], learn: 'Mars orbiters like MRO and MAVEN also relay data from rovers. The cruise takes about seven months, so launch windows matter.' },
]

export const INSTRUMENTS: Part[] = [
  p('multispectral-imager', 'Multispectral Imager', 'Photographs Earth in many colour bands to map land, water and vegetation.', 85, 120, 25, 0.35, 45, { science: 40, objectives: ['earth-climate'], color: '#22d3ee' }),
  p('thermal-ir', 'Thermal Infrared Sensor', 'Measures heat radiated by oceans, land and clouds.', 60, 90, 12, 0.25, 35, { science: 30, objectives: ['earth-climate'], color: '#fb923c' }),
  p('optical-telescope', 'Optical Telescope', 'A large mirror that collects faint visible light from distant stars.', 220, 160, 30, 0.9, 110, { science: 70, objectives: ['exo-telescope'], color: '#a78bfa' }),
  p('uv-spectrograph', 'UV Spectrograph', 'Splits ultraviolet light to reveal chemical makeup of stars and atmospheres.', 95, 70, 8, 0.4, 60, { science: 35, objectives: ['exo-telescope', 'solar-weather'], color: '#c084fc' }),
  p('coronagraph', 'Solar Coronagraph', 'Blocks the Sun’s disc to reveal its fiery outer atmosphere.', 110, 80, 15, 0.5, 70, { science: 50, objectives: ['solar-weather'], color: '#facc15' }),
  p('magnetometer', 'Magnetometer', 'Measures magnetic fields. Light and cheap.', 8, 10, 1, 0.05, 6, { science: 15, objectives: ['solar-weather', 'earth-climate', 'lunar-survey', 'mars-science'], color: '#4ade80' }),
  p('particle-detector', 'Particle Detector', 'Counts charged particles streaming from the Sun.', 25, 30, 4, 0.12, 20, { science: 25, objectives: ['solar-weather'], color: '#f87171' }),
]

INSTRUMENTS.push(
  p('lunar-mapper', 'Lunar Mapping Camera', 'High-resolution camera that maps craters and landing sites.', 70, 80, 20, 0.3, 50, { science: 45, objectives: ['lunar-survey'], color: '#e2e8f0' }),
  p('laser-altimeter', 'Laser Altimeter', 'Fires laser pulses to measure surface height and build 3D terrain maps.', 35, 40, 3, 0.15, 30, { science: 30, objectives: ['lunar-survey', 'mars-science'], color: '#f43f5e' }),
  p('neutron-spectrometer', 'Neutron Spectrometer', 'Detects hydrogen, which hints at buried water ice.', 20, 15, 1, 0.08, 18, { science: 35, objectives: ['lunar-survey', 'mars-science'], color: '#38bdf8' }),
  p('mars-hirise', 'High-Resolution Camera', 'Telescopic camera that sees boulders and gullies on Mars.', 140, 110, 40, 0.6, 90, { science: 60, objectives: ['mars-science'], color: '#f97316' }),
  p('subsurface-radar', 'Subsurface Radar', 'Radar that sees through the ground to find ice layers.', 95, 100, 10, 0.5, 75, { science: 55, objectives: ['mars-science'], color: '#a3e635' }),
)

export const POWER: Part[] = [
  p('small-array', 'Small Solar Array', 'Compact panels. Cheap and light, limited power.', 30, 300, 0, 0.2, 12),
  p('medium-array', 'Medium Solar Array', 'Balanced panels for mid-size payloads.', 60, 700, 0, 0.4, 25),
  p('large-array', 'Large Solar Array', 'Big deployable wings. Lots of power, lots of mass.', 120, 1400, 0, 0.9, 50),
]
export const ANTENNAS: Part[] = [
  p('s-band-patch', 'S-band Patch Antenna', 'Simple, low data rate radio link.', 4, 20, 5, 0.02, 3),
  p('x-band-dish', 'X-band Dish', 'Common science downlink.', 18, 60, 50, 0.15, 12),
  p('ka-band-dish', 'Ka-band High-Gain Dish', 'Very high data rate. Needs more power.', 35, 110, 150, 0.3, 28),
]
export const BUSES: Part[] = [
  p('smallsat-bus', 'SmallSat Bus', 'The satellite’s “chassis”: structure, computer, thermal control.', 120, 80, 0, 0.5, 30, { payKg: 250, payM3: 1.2 }),
  p('medium-bus', 'Orbital Module Bus (Soyuz heritage)', 'Roomy pressurized-module style chassis for heavier payloads.', 260, 150, 0, 1.2, 55, { payKg: 600, payM3: 3, model: '/models/soyuz.glb' }),
  p('large-bus', 'Capsule-class Bus (Dragon heritage)', 'Flagship-class platform built around a Crew Dragon style capsule.', 520, 250, 0, 2.5, 95, { payKg: 1300, payM3: 7, model: '/models/dragon.glb' }),
]
export const LAUNCHERS: Part[] = [
  p('light-launcher', 'Light Launcher', 'Small rocket. Cheap, but limited lift.', 0, 0, 0, 0, 15, { capKg: 600, capM3: 4, rel: 0.94 }),
  p('medium-launcher', 'Medium Launcher', 'Workhorse rocket.', 0, 0, 0, 0, 62, { capKg: 2200, capM3: 12, rel: 0.97 }),
  p('heavy-launcher', 'Heavy Launcher', 'Huge lift capacity at a huge price.', 0, 0, 0, 0, 120, { capKg: 6500, capM3: 30, rel: 0.985 }),
]
