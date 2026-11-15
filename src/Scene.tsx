import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Lightformer, useTexture, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ORBITS, INSTRUMENTS, POWER, ANTENNAS, BUSES, Dest } from './data'
import type { Sel } from './engine'

export const INC = 1.2181 // orbital plane tilt (rad)
export const destOf = (id: string): Dest => ORBITS.find(o => o.id === id)?.dest ?? 'earth'
export const orbitR = (id: string) => {
  const o = ORBITS.find(x => x.id === id)
  if (!o || o.dest !== 'earth') return 3.3
  return o.altKm > 20000 ? 5.5 : o.altKm > 500 ? 3.1 : 2.6
}
export const orbitPos = (r: number, th: number) => new THREE.Vector3(r * Math.cos(th), r * Math.sin(th) * Math.cos(INC), r * Math.sin(th) * Math.sin(INC))
const ease = (x: number) => x * x * (3 - 2 * x)

export function useTex<T extends Record<string, string>>(m: T) {
  const t = useTexture(m) as Record<keyof T, THREE.Texture>
  Object.values(t).forEach(x => { x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8 })
  return t
}
export function Atmosphere({ r, color = '#4aa3ff' }: { r: number; color?: string }) {
  return (
    <mesh scale={1.07}>
      <sphereGeometry args={[r, 64, 64]} />
      <shaderMaterial transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
        uniforms={{ c: { value: new THREE.Color(color) } }}
        vertexShader={'varying vec3 n; void main(){ n=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'}
        fragmentShader={'uniform vec3 c; varying vec3 n; void main(){ float i=pow(max(0.0,0.72-dot(n,vec3(0.0,0.0,1.0))),3.0); gl_FragColor=vec4(c,1.0)*i*1.6; }'} />
    </mesh>
  )
}
export const Env = () => (
  <Environment resolution={128}>
    <Lightformer form="rect" intensity={3} position={[5, 5, 5]} scale={[10, 5, 1]} />
    <Lightformer form="rect" intensity={1.5} position={[-5, 3, -5]} scale={[10, 5, 1]} color="#6ea8ff" />
  </Environment>
)

function EarthBody({ r }: { r: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useTex({ map: '/textures/earth.jpg', n: '/textures/earth_normal.jpg' })
  t.n.colorSpace = THREE.NoColorSpace
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03 })
  return <group><mesh ref={ref}><sphereGeometry args={[r, 128, 128]} /><meshStandardMaterial map={t.map} normalMap={t.n} normalScale={new THREE.Vector2(0.6, 0.6)} roughness={0.85} /></mesh><Atmosphere r={r} /></group>
}
function MarsBody({ r }: { r: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useTex({ map: '/textures/mars.jpg', n: '/textures/mars_normal.jpg' })
  t.n.colorSpace = THREE.NoColorSpace
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03 })
  return <group><mesh ref={ref}><sphereGeometry args={[r, 128, 128]} /><meshStandardMaterial map={t.map} normalMap={t.n} roughness={1} /></mesh><Atmosphere r={r} color="#ff9a66" /></group>
}
function MoonBody({ r }: { r: number }) {
  const t = useTex({ map: '/textures/moon.jpg' })
  return <mesh><sphereGeometry args={[r, 96, 96]} /><meshStandardMaterial map={t.map} bumpMap={t.map} bumpScale={0.6} roughness={1} /></mesh>
}
export function Planet({ body, r = 2 }: { body: Dest; r?: number }) {
  return body === 'mars' ? <MarsBody r={r} /> : body === 'moon' ? <MoonBody r={r} /> : <EarthBody r={r} />
}

// Real 3D bus models (Soyuz module, Crew Dragon) normalised to a target size.
function BusModel({ url, size }: { url: string; size: number }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    const sz = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3())
    c.scale.setScalar(size / Math.max(sz.x, sz.y, sz.z))
    const g = new THREE.Group(); g.add(c)
    g.updateMatrixWorld(true)
    c.position.sub(new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()))
    // Spacecraft axis is z (instruments +z, thrusters -z). Turn models whose long axis is x so solar wings land on the sides.
    const o = new THREE.Group(); o.add(g)
    const q = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3())
    if (q.x > q.z && q.x >= q.y) o.rotation.y = -Math.PI / 2
    return o
  }, [scene, size])
  return <primitive object={obj} />
}

const SHAPE: Record<string, string> = { 'multispectral-imager': 'camera', 'thermal-ir': 'camera', 'optical-telescope': 'telescope', 'uv-spectrograph': 'spectro', coronagraph: 'telescope', magnetometer: 'boom', 'particle-detector': 'spectro', 'lunar-mapper': 'camera', 'laser-altimeter': 'laser', 'neutron-spectrometer': 'spectro', 'mars-hirise': 'telescope', 'subsurface-radar': 'radar' }
const metal = (c = '#9aa3ad') => <meshStandardMaterial color={c} metalness={0.8} roughness={0.35} />
const foil = <meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} />
const glass = (c: string) => <meshStandardMaterial color="#05070d" emissive={c} emissiveIntensity={0.5} metalness={1} roughness={0.1} />
function Instrument({ id, color, mass, ops }: { id: string; color: string; mass: number; ops: boolean }) {
  const shape = SHAPE[id] ?? 'camera', L = 0.3 + mass / 400
  const beam = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (beam.current) { beam.current.rotation.x = -Math.PI / 2 + Math.sin(clock.elapsedTime * 2 + mass) * 0.08; (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.1 * Math.sin(clock.elapsedTime * 6) } })
  return (
    <group>
      {shape === 'camera' && <><mesh position={[0, 0, 0.1]}><boxGeometry args={[0.24, 0.24, 0.3]} />{metal('#cfd4da')}</mesh><mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.16, 24]} />{metal('#2b2f36')}</mesh><mesh position={[0, 0, 0.41]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.085, 0.085, 0.01, 24]} />{glass(color)}</mesh></>}
      {shape === 'telescope' && <><mesh position={[0, 0, L / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.13, L, 32]} />{foil}</mesh><mesh position={[0, 0, L + 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.03, 32]} />{metal('#e5e7eb')}</mesh><mesh position={[0, 0, L - 0.02]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.01, 32]} />{glass(color)}</mesh></>}
      {shape === 'spectro' && <><mesh position={[0, 0, 0.1]}><boxGeometry args={[0.3, 0.22, 0.24]} />{metal('#cfd4da')}</mesh><mesh position={[0, 0, 0.225]}><boxGeometry args={[0.2, 0.03, 0.02]} />{glass(color)}</mesh><mesh position={[0, 0.13, 0.1]}><boxGeometry args={[0.26, 0.02, 0.2]} />{metal('#e5e7eb')}</mesh></>}
      {shape === 'boom' && <><mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 1.1, 8]} />{metal('#d1d5db')}</mesh><mesh position={[0, 0, 1.1]}><boxGeometry args={[0.07, 0.07, 0.07]} />{metal(color)}</mesh><mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.05, 0.08, 12]} />{metal()}</mesh></>}
      {shape === 'radar' && <><mesh position={[0, 0, 0.12]}><boxGeometry args={[0.04, 0.04, 0.24]} />{metal()}</mesh><mesh position={[0, 0, 0.26]}><boxGeometry args={[0.6, 0.38, 0.025]} />{metal('#374151')}</mesh>{[-0.2, 0, 0.2].map(x => <mesh key={x} position={[x, 0, 0.275]}><boxGeometry args={[0.012, 0.34, 0.005]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>)}</>}
      {shape === 'laser' && <><mesh position={[0, 0, 0.05]}><boxGeometry args={[0.34, 0.16, 0.1]} />{metal('#cfd4da')}</mesh>{[-0.08, 0.08].map(x => <mesh key={x} position={[x, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.055, 0.14, 16]} />{metal('#2b2f36')}</mesh>)}<mesh position={[-0.08, 0, 0.245]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />{glass(color)}</mesh></>}
      {ops && shape !== 'boom' && (shape === 'laser'
        ? <mesh position={[-0.08, 0, 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.006, 0.006, 4, 6]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        : <mesh ref={beam} position={[0, 0, 1.4]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[shape === 'radar' ? 0.9 : 0.5, 2.8, 20, 1, true]} /><meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>)}
    </group>
  )
}
function Waves() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => refs.current.forEach((m, i) => { if (!m) return; const u = (clock.elapsedTime * 0.5 + i / 5) % 1; m.scale.setScalar(0.3 + u * 3.5); (m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.8 }))
  return <>{[0, 1, 2, 3, 4].map(i => <mesh key={i} ref={el => { refs.current[i] = el }} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.012, 8, 48]} /><meshBasicMaterial color="#67e8f9" transparent toneMapped={false} depthWrite={false} /></mesh>)}</>
}
let cell: THREE.CanvasTexture | null = null
const cellTex = () => {
  if (cell) return cell
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!
  x.fillStyle = '#10265c'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#8fa8d8'; x.lineWidth = 3; x.strokeRect(2, 2, 124, 124)
  x.strokeStyle = '#2d4a8f'; x.lineWidth = 1; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke()
  cell = new THREE.CanvasTexture(c); cell.wrapS = cell.wrapT = THREE.RepeatWrapping; cell.colorSpace = THREE.SRGBColorSpace; cell.anisotropy = 8
  return cell
}

export function Craft({ sel, spin = true, ops = false }: { sel: Sel; spin?: boolean; ops?: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (spin && g.current) g.current.rotation.y += dt * 0.25 })
  const bus = BUSES.find(b => b.id === sel.busId), pw = POWER.find(b => b.id === sel.powerId), ant = ANTENNAS.find(b => b.id === sel.antennaId)
  const ins = sel.instrumentIds.map(id => INSTRUMENTS.find(i => i.id === id)).filter(Boolean) as typeof INSTRUMENTS
  const s = 0.6 + ((bus?.massKg ?? 120) / 520) * 0.6
  const wing = 0.8 + ((pw?.powerW ?? 300) / 1400) * 1.6
  const dish = 0.15 + ((ant?.dataRateMbps ?? 5) / 150) * 0.4
  const wingTex = useMemo(() => { const t = cellTex().clone(); t.repeat.set(Math.round(wing * 5), Math.round(s * 5)); t.needsUpdate = true; return t }, [wing, s])
  const rows = ins.length > 3 ? 2 : 1
  const half = bus?.model ? s * 0.6 : s / 2 // lateral half-width of the bus body
  return (
    <group ref={g}>
      {bus?.model ? (
        <Suspense fallback={null}><BusModel url={bus.model} size={s * 1.5} /></Suspense>
      ) : (
        <>
          <mesh><boxGeometry args={[s, s, s * 1.3]} />{foil}</mesh>
          <mesh position={[0, 0, -s * 0.66]}><boxGeometry args={[s * 0.9, s * 0.9, 0.05]} />{metal('#e5e7eb')}</mesh>
          {[-1, 1].map(d => <mesh key={d} position={[d * s * 0.52, 0, 0]}><boxGeometry args={[0.03, s * 0.8, s * 1.1]} />{metal('#9ca3af')}</mesh>)}
          {[-0.3, 0, 0.3].map(z => <mesh key={z} position={[0, -s * 0.52, z * s]}><boxGeometry args={[s * 0.8, 0.02, 0.1]} />{metal('#e5e7eb')}</mesh>)}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], i) => <mesh key={i} position={[x * s * 0.46, y * s * 0.46, -s * 0.72]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.035, 0.1, 10]} />{metal('#52525b')}</mesh>)}
          <mesh position={[s * 0.3, s * 0.52, s * 0.4]}><cylinderGeometry args={[0.04, 0.05, 0.12, 12]} />{metal('#374151')}</mesh>
        </>
      )}
      {[-1, 1].map(d => <Wing key={d + (pw?.id ?? '')} d={d} half={half} wing={wing} s={s} tex={wingTex} />)}
      <group position={[0, s / 2 + 0.12, 0]}>
        <mesh><cylinderGeometry args={[0.02, 0.02, 0.25]} />{metal('#cbd5e1')}</mesh>
        <group position={[0, 0.15, 0]} rotation={[-Math.PI / 2.4, 0, 0]}>
          <mesh><sphereGeometry args={[dish, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e8edf3" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, dish * 0.55, 0]}><cylinderGeometry args={[0.015, 0.025, dish * 0.9, 8]} />{metal('#cbd5e1')}</mesh>
          <mesh position={[0, dish * 1.05, 0]}><cylinderGeometry args={[0.04, 0.02, 0.07, 12]} />{metal('#fbbf24')}</mesh>
        </group>
        {ops && <Waves />}
      </group>
      {ins.map((i, k) => {
        const row = rows === 2 ? k % 2 : 0, col = rows === 2 ? Math.floor(k / 2) : k, cols = rows === 2 ? Math.ceil(ins.length / 2) : ins.length
        return <group key={i.id} position={[(col - (cols - 1) / 2) * 0.5, rows === 2 ? (row ? 0.22 : -0.22) : 0, bus?.model ? s * 0.85 : s * 0.65]}><Instrument id={i.id} color={i.color ?? '#fff'} mass={i.massKg} ops={ops} /></group>
      })}
    </group>
  )
}

// Solar wing that unfolds from its hinge on the bus whenever a new power system is chosen.
function Wing({ d, half, wing, s, tex }: { d: number; half: number; wing: number; s: number; tex: THREE.Texture }) {
  const r = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (r.current && r.current.scale.x < 1) r.current.scale.x = Math.min(1, r.current.scale.x + dt * 0.9 * (1.15 - r.current.scale.x)) })
  return (
    <group ref={r} position={[d * (half + 0.07), 0, 0]} scale={[0.02, 1, 1]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 0.28, 10]} />{metal('#cbd5e1')}</mesh>
      <group position={[d * (wing / 2 + 0.07), 0, 0]}>
        <mesh><boxGeometry args={[wing, 0.03, s * 0.9]} /><meshStandardMaterial map={tex} metalness={0.7} roughness={0.25} emissive="#0a1a4a" emissiveIntensity={0.4} /></mesh>
      </group>
    </group>
  )
}

function Orbiter({ sel }: { sel: Sel }) {
  const g = useRef<THREE.Group>(null)
  const R = orbitR(sel.orbitId)
  useFrame(({ clock }) => { g.current?.position.copy(orbitPos(R, clock.elapsedTime * 0.35)) })
  return <group ref={g} scale={0.16}><Craft sel={sel} /></group>
}

const Flame = ({ len = 1 }: { len?: number }) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -len * 0.5]}><coneGeometry args={[len * 0.22, len, 16, 1, true]} /><meshBasicMaterial color="#ff8a1f" toneMapped={false} transparent opacity={0.85} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -len * 0.35]}><coneGeometry args={[len * 0.1, len * 0.7, 12, 1, true]} /><meshBasicMaterial color="#fff3c4" toneMapped={false} /></mesh>
  </group>
)

function useCloseUp() {
  const { camera } = useThree(), controls = useThree(st => st.controls) as unknown as { enabled: boolean } | null
  return (g: THREE.Object3D, dt: number) => {
    if (controls) controls.enabled = false
    g.lookAt(0, 0, 0)
    const out = g.position.clone().normalize(), tan = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize()
    const want = g.position.clone().addScaledVector(out, 0.75).addScaledVector(tan, 0.5).add(new THREE.Vector3(0, 0.18, 0))
    camera.position.lerp(want, 1 - Math.exp(-2.5 * dt)); camera.lookAt(g.position)
  }
}
export type LaunchProps = { fail: boolean; fault: boolean; deep: boolean; seed: string; onProgress: (t: number) => void; onDone: () => void }
const DUR = 26
// Shuttle ascent: SRB + tank separation, orbit, payload deployment, optional departure burn.
function Launch({ sel, fail, fault, deep, onProgress, onDone }: LaunchProps & { sel: Sel }) {
  const { scene } = useGLTF('/models/shuttle.glb')
  const stack = useMemo(() => scene.clone(true), [scene])
  const parts = useMemo(() => {
    const f = (n: string) => stack.getObjectByName(n)
    return { srb: [f('Booster_1'), f('Booster_2')].filter(Boolean) as THREE.Object3D[], et: [f('Main_Tank'), f('Main_Tank_Hold')].filter(Boolean) as THREE.Object3D[] }
  }, [stack])
  const rocket = useRef<THREE.Group>(null), flame = useRef<THREE.Group>(null), craft = useRef<THREE.Group>(null), burn = useRef<THREE.Group>(null), boom = useRef<THREE.Mesh>(null)
  const time = useRef(0), done = useRef(false), last = useRef(-1), opsRef = useRef(false)
  const [ops, setOps] = useState(false)
  const closeUp = useCloseUp()
  const R = orbitR(sel.orbitId)
  const P = (x: number) => { const e = ease(Math.min(x / 0.32, 1)); return { r: 2.05 + (R - 2.05) * e, th: 0.5 + e * 2.2 + Math.max(0, x - 0.32) * 7 } }
  const at = (x: number) => { const p = P(x); return orbitPos(p.r, p.th) }
  useFrame((_, dt) => {
    time.current += dt
    const s = time.current / DUR, t = Math.min(s, 1)
    const exploded = fail && s >= 0.2
    const p = at(exploded ? 0.2 : s)
    if (rocket.current) { rocket.current.visible = !exploded; rocket.current.position.copy(p); rocket.current.lookAt(at(s + 0.004)) }
    if (flame.current) flame.current.visible = s < 0.34 && !exploded
    parts.srb.forEach((o, i) => { const k = Math.max(0, (s - 0.14) * 6); o.position.set((i ? 1 : -1) * k * 1.2, -k * 1.5, 0); o.visible = k < 1.4 })
    parts.et.forEach(o => { const k = Math.max(0, (s - 0.26) * 6); o.position.set(0, -k * 2, -k * 0.3); o.visible = k < 1.6 })
    if (craft.current) {
      const dth = Math.min(1, Math.max(0, (s - 0.42) / 0.15)) * 0.35
      const dep = deep ? Math.max(0, s - 0.72) : 0
      const q = P(Math.min(s, 1))
      craft.current.visible = s >= 0.42 && !fail
      craft.current.position.copy(orbitPos(q.r + dep * dep * 120, q.th + dth))
      if (fault && s > 0.6) craft.current.rotation.z += dt * 4
      if (!deep && !fail && !fault && s > 0.74) { if (!opsRef.current) { opsRef.current = true; setOps(true) } closeUp(craft.current, dt) }
      if (burn.current) burn.current.visible = deep && s > 0.72
    }
    if (boom.current) {
      boom.current.visible = exploded && s < 0.45
      boom.current.position.copy(p)
      const k = (s - 0.2) * 16
      boom.current.scale.setScalar(Math.max(0.01, k))
      ;(boom.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k / 3)
    }
    const pct = Math.floor(t * 100)
    if (pct !== last.current) { last.current = pct; onProgress(t) }
    if (((fail && s >= 0.5) || s >= 1) && !done.current) { done.current = true; onDone() }
  })
  return (
    <>
      <group ref={rocket}>
        <group scale={0.55}><primitive object={stack} /></group>
        <group ref={flame} position={[0, 0, -0.3]}><Flame len={0.5} /></group>
      </group>
      <group ref={craft} scale={0.16}>
        <Craft sel={sel} ops={ops} />
        <group ref={burn} position={[0, 0, -2]} visible={false}><Flame len={5} /></group>
      </group>
      <mesh ref={boom} visible={false}><sphereGeometry args={[0.1, 24, 24]} /><meshBasicMaterial color="#f97316" toneMapped={false} transparent opacity={1} /></mesh>
    </>
  )
}

// Approach and orbit insertion around the Moon or Mars. A failed mission misses its burn and flies past.
export type ArriveProps = { fail: boolean; onProgress: (t: number) => void; onDone: () => void }
function Arrive({ sel, fail, onProgress, onDone }: ArriveProps & { sel: Sel }) {
  const g = useRef<THREE.Group>(null), burn = useRef<THREE.Group>(null)
  const time = useRef(0), done = useRef(false), last = useRef(-1), opsRef = useRef(false)
  const [ops, setOps] = useState(false)
  const closeUp = useCloseUp()
  const R = orbitR(sel.orbitId)
  const F = useMemo(() => new THREE.Vector3(-30, 7, 16), []), C = useMemo(() => new THREE.Vector3(-7, 3, 9), []), O = useMemo(() => orbitPos(R, 0), [R])
  const pos = (s: number) => {
    if (s <= 0.4) { const u = ease(s / 0.4); return F.clone().multiplyScalar((1 - u) ** 2).addScaledVector(C, 2 * u * (1 - u)).addScaledVector(O, u * u) }
    if (fail) return O.clone().addScaledVector(O.clone().sub(C).normalize(), (s - 0.4) * 36)
    return orbitPos(R, (s - 0.4) * 9)
  }
  useFrame((_, dt) => {
    time.current += dt
    const s = time.current / 22
    if (g.current) {
      g.current.position.copy(pos(s)); g.current.lookAt(pos(s + 0.004)); g.current.visible = !(fail && s > 0.8)
      if (!fail && s > 0.45) { if (!opsRef.current) { opsRef.current = true; setOps(true) } closeUp(g.current, dt) }
    }
    if (burn.current) burn.current.visible = !fail && s > 0.25 && s < 0.45
    const pct = Math.floor(Math.min(s, 1) * 100)
    if (pct !== last.current) { last.current = pct; onProgress(Math.min(s, 1)) }
    if (s >= 1 && !done.current) { done.current = true; onDone() }
  })
  return (
    <group ref={g} scale={0.16}>
      <Craft sel={sel} spin={false} ops={ops} />
      <group ref={burn} position={[0, 0, -2]} visible={false}><Flame len={6} /></group>
    </group>
  )
}

function Rig({ mode }: { mode: 'earth' | 'craft' }) {
  const { camera } = useThree()
  useEffect(() => { if (mode === 'earth') camera.position.set(0, 4, 10); else camera.position.set(5, 2.5, 6.5) }, [mode, camera])
  return null
}

export function World({ mode, sel, launch, arrive }: { mode: 'earth' | 'craft'; sel: Sel; launch: LaunchProps | null; arrive: ArriveProps | null }) {
  const R = orbitR(sel.orbitId), body = destOf(sel.orbitId)
  return (
    <>
      <color attach="background" args={['#01030a']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 5, 6]} intensity={2.2} />
      <directionalLight position={[-8, 2, -6]} intensity={mode === 'craft' ? 1.1 : 0.3} color="#7fb4ff" />
      {mode === 'craft' && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}><ringGeometry args={[1.9, 1.95, 96]} /><meshBasicMaterial color="#9aa7b8" transparent opacity={0.45} /></mesh>}
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />
      <Env />
      <Rig mode={mode} />
      {mode === 'earth' ? (
        <>
          <Planet body={arrive ? body : launch ? 'earth' : body} />
          <mesh rotation={[INC, 0, 0]}><torusGeometry args={[arrive || !launch ? R : orbitR(sel.orbitId), 0.012, 8, 160]} /><meshBasicMaterial color="#38bdf8" toneMapped={false} transparent opacity={0.7} /></mesh>
          {launch ? <Launch key={launch.seed} sel={sel} {...launch} /> : arrive ? <Arrive sel={sel} {...arrive} /> : <Orbiter sel={sel} />}
        </>
      ) : (
        <>
          <mesh position={[-14, -7, -30]}><sphereGeometry args={[9, 64, 64]} /><meshStandardMaterial color="#1d4ed8" roughness={0.8} /></mesh>
          <Craft sel={sel} />
        </>
      )}
      <OrbitControls makeDefault enablePan={false} minDistance={mode === 'earth' ? 0.5 : 2.5} maxDistance={20} />
    </>
  )
}
useGLTF.preload('/models/shuttle.glb')
