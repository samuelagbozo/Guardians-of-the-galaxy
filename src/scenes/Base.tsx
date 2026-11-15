import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Sky, Html, PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { Env } from '../Scene'

// 1 unit = 1 metre. The shuttle stack is ~56 m tall; facilities sit hundreds of metres from the pad.
type V3 = [number, number, number]
type Col = { x: number; z: number; hw: number; hd: number; c?: boolean }
export const HUBS: { id: string; label: string; sub: string; pos: V3; color: string; col: Col }[] = [
  { id: 'define', label: 'Mission Control', sub: 'Define objective & orbit', pos: [-340, 0, 130], color: '#22d3ee', col: { x: -340, z: 130, hw: 34, hd: 17 } },
  { id: 'design', label: 'Assembly Hangar', sub: 'Build the spacecraft', pos: [360, 0, 80], color: '#a78bfa', col: { x: 360, z: 80, hw: 27, hd: 22 } },
  { id: 'review', label: 'Flight Readiness Review', sub: 'Check margins & blockers', pos: [-300, 0, -170], color: '#facc15', col: { x: -307, z: -170, hw: 31, hd: 14 } },
  { id: 'iss', label: 'ISS Training Simulator', sub: 'Fly the station & dock Dragon', pos: [310, 0, -210], color: '#4ade80', col: { x: 310, z: -210, hw: 24, hd: 24, c: true } },
  { id: 'launch', label: 'Launch Control', sub: 'Start the countdown', pos: [0, 0, 240], color: '#fb923c', col: { x: 0, z: 240, hw: 18, hd: 22 } },
]
const EXTRA: Col[] = [{ x: 0, z: 0, hw: 42, hd: 42, c: true }, { x: 344, z: -204, hw: 11, hd: 8 }] // launch pad + simulator annex
const LIMIT = 480
const PR = 1.6
// Push a point out of every solid structure and keep it inside the fenced area.
// Solid footprints of the launch pad's real structures, measured from the loaded model (see Pad).
export const PAD_COLS: Col[] = []
export function solidBase(p: THREE.Vector3) {
  const pad: Col[] = PAD_COLS.length ? PAD_COLS : [{ x: 0, z: 0, hw: 42, hd: 42, c: true }]
  for (const c of [...HUBS.map(h => h.col), ...EXTRA.filter(e => !e.c), ...pad]) {
    const dx = p.x - c.x, dz = p.z - c.z
    if (c.c) {
      const d = Math.hypot(dx, dz), m = c.hw + PR
      if (d < m) { const k = d > 0.001 ? m / d : 1; p.x = c.x + (d > 0.001 ? dx * k : m); p.z = c.z + (d > 0.001 ? dz * k : 0) }
    } else {
      const px = c.hw + PR - Math.abs(dx), pz = c.hd + PR - Math.abs(dz)
      if (px > 0 && pz > 0) { if (px < pz) p.x += (dx >= 0 ? 1 : -1) * px; else p.z += (dz >= 0 ? 1 : -1) * pz }
    }
  }
  p.x = THREE.MathUtils.clamp(p.x, -LIMIT, LIMIT); p.z = THREE.MathUtils.clamp(p.z, -LIMIT, LIMIT)
}
const edge = (p: THREE.Vector3, c: Col) => { const dx = Math.abs(p.x - c.x), dz = Math.abs(p.z - c.z); return c.c ? Math.max(Math.hypot(dx, dz) - c.hw, 0) : Math.hypot(Math.max(dx - c.hw, 0), Math.max(dz - c.hd, 0)) }
// A safe spot just outside a facility, on the side facing the launch site.
export function spawnFor(id: string) {
  const h = HUBS.find(x => x.id === id)!, dx = -h.pos[0], dz = 70 - h.pos[2], d = Math.hypot(dx, dz) || 1, e = Math.max(h.col.hw, h.col.hd) + 18
  return { x: h.pos[0] + (dx / d) * e, z: h.pos[2] + (dz / d) * e, hx: h.pos[0], hz: h.pos[2] }
}

let saved: { p: THREE.Vector3; q: THREE.Quaternion } | null = null
export function Mover({ mode, active, onNear, start, speed = 14, spawn, solid }: { mode: 'walk' | 'fly'; active: boolean; onNear?: (id: string | null) => void; start: V3; speed?: number; spawn?: string | null; solid?: (p: THREE.Vector3) => void }) {
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const near = useRef<string | null>(null)
  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    if (mode === 'walk' && spawn) { const sp = spawnFor(spawn); camera.position.set(sp.x, 1.7, sp.z); camera.lookAt(sp.hx, 8, sp.hz) }
    else if (mode === 'walk' && saved) { camera.position.copy(saved.p); camera.quaternion.copy(saved.q) }
    else { camera.position.set(...start); camera.lookAt(0, mode === 'walk' ? 30 : 0, 0) }
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05) // no tunnelling through walls on a frame hitch
    if (!active) return
    const k = keys.current, s = (k.ShiftLeft ? 3.2 : 1) * speed * dt
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir)
    if (mode === 'walk') dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()
    if (k.KeyW || k.ArrowUp) camera.position.addScaledVector(dir, s)
    if (k.KeyS || k.ArrowDown) camera.position.addScaledVector(dir, -s)
    if (k.KeyD || k.ArrowRight) camera.position.addScaledVector(right, s)
    if (k.KeyA || k.ArrowLeft) camera.position.addScaledVector(right, -s)
    if (mode === 'fly') { if (k.Space) camera.position.y += s; if (k.KeyC) camera.position.y -= s }
    if (mode === 'walk') camera.position.y = 1.7
    solid?.(camera.position)
    if (mode === 'walk') {
      saved = { p: camera.position.clone(), q: camera.quaternion.clone() }
      let n: string | null = null
      for (const h of HUBS) if (edge(camera.position, h.col) < 22) n = h.id
      if (n !== near.current) { near.current = n; onNear?.(n) }
    }
  })
  return active ? <PointerLockControls selector="canvas" /> : null
}

// ---------- pad + shuttle stack (animated) ----------
const STACK = /^(Spacecraft|Fuel_Tank|Left_Rocket_Thrust|Right_Rocket_Thrust)/
function Pad({ launching, onCount, onDone }: { launching: boolean; onCount: (t: number) => void; onDone: () => void }) {
  const { scene } = useGLTF('/models/pad.glb')
  const { camera } = useThree()
  const flame = useRef<THREE.Group>(null), smoke = useRef<THREE.Group>(null)
  const stack = useRef<{ o: THREE.Object3D; w: THREE.Vector3 }[]>([])
  const nozzle = useRef(new THREE.Vector3())
  const t0 = useRef(0), done = useRef(false), last = useRef(-1)
  useLayoutEffect(() => {
    scene.scale.setScalar(1); scene.position.set(0, 0, 0); scene.updateMatrixWorld(true)
    const find = () => { const f: THREE.Object3D[] = []; scene.traverse(o => { if (STACK.test(o.name) && !f.some(x => x.getObjectById(o.id))) f.push(o) }); return f }
    const bounds = (os: THREE.Object3D[]) => { const b = new THREE.Box3(); os.forEach(o => b.expandByObject(o)); return b }
    let found = find(), sb = bounds(found)
    const k = 56 / Math.max(sb.getSize(new THREE.Vector3()).y, 0.01) // real shuttle stack height
    scene.scale.setScalar(k); scene.updateMatrixWorld(true)
    sb = bounds(found); const c = sb.getCenter(new THREE.Vector3())
    scene.position.set(-c.x, 0, -c.z); scene.updateMatrixWorld(true)
    // find the real ground level by casting rays down around the structure
    const whole = new THREE.Box3().setFromObject(scene), r = Math.max(whole.max.x - whole.min.x, whole.max.z - whole.min.z) / 2 * 1.05
    const meshes: THREE.Object3D[] = []; scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o) })
    const ray = new THREE.Raycaster(), ys: number[] = []
    for (let i = 0; i < 16; i++) {
      ray.set(new THREE.Vector3(Math.cos(i * 0.3927) * r, 2000, Math.sin(i * 0.3927) * r), new THREE.Vector3(0, -1, 0))
      const h = ray.intersectObjects(meshes, false)[0]; if (h) ys.push(h.point.y)
    }
    ys.sort((a, b) => a - b)
    scene.position.y -= ys.length ? ys[Math.floor(ys.length / 2)] : whole.min.y
    scene.updateMatrixWorld(true)
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
    stack.current = found.map(o => ({ o, w: o.getWorldPosition(new THREE.Vector3()) }))
    // Walls and towers become solid; open ground, terrain slabs and decks stay walkable.
    PAD_COLS.length = 0
    scene.traverse(o => {
      if (!(o as THREE.Mesh).isMesh) return
      const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3())
      if (s.y < 3 || b.max.y < 2.2 || b.min.y < -3 || s.x > 60 || s.z > 60 || Math.max(s.x, s.z) < 1.5) return
      PAD_COLS.push({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hw: s.x / 2, hd: s.z / 2 })
    })
    sb = bounds(found)
    nozzle.current.set((sb.min.x + sb.max.x) / 2, sb.min.y, (sb.min.z + sb.max.z) / 2)
  }, [scene])
  useFrame((_, dt) => {
    if (!launching) return
    if (t0.current === 0) camera.position.set(70, 8, 250)
    t0.current += dt
    const tl = t0.current, dy = tl < 6 ? 0 : 1.6 * (tl - 6) ** 2
    const v = new THREE.Vector3()
    stack.current.forEach(({ o, w }) => { v.copy(w).y += dy; if (o.parent) o.position.copy(o.parent.worldToLocal(v.clone())) })
    if (flame.current) {
      flame.current.visible = tl > 5.5
      flame.current.position.copy(nozzle.current).y += dy
      flame.current.scale.set(1, (0.85 + Math.random() * 0.4) * (1 + dy * 0.004), 1)
      const gl = flame.current.children[2] as THREE.PointLight; if (gl) gl.intensity = 2600 + Math.random() * 900 // flickering ground glow
    }
    if (smoke.current) {
      smoke.current.visible = tl > 5.5
      smoke.current.position.set(nozzle.current.x, Math.max(nozzle.current.y, 0) + 2, nozzle.current.z)
      smoke.current.children.forEach((m, i) => {
        const g = (tl - 5.5) * (14 + i * 2), a = i * 1.05
        m.position.set(Math.cos(a) * g * 0.9, g * 0.12, Math.sin(a) * g * 0.9); m.scale.setScalar(5 + g * 0.55)
        ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - (tl - 5.5) * 0.02)
      })
    }
    // engine tremor builds at ignition and fades, then the camera rises and eases back as the stack climbs
    const sh = tl > 5.5 && tl < 12 ? Math.min(1, (tl - 5.5) / 1.5) * Math.max(0, 1 - (tl - 5.5) / 6.5) * 0.3 : 0
    camera.position.set(70 + (Math.random() - 0.5) * sh, 8 + dy * 0.12 + (Math.random() - 0.5) * sh, 250 + dy * 0.05)
    camera.lookAt(0, 30 + dy * 0.8, 0)
    const r = Math.floor(tl * 10) / 10
    if (r !== last.current) { last.current = r; onCount(r) }
    if (tl >= 20 && !done.current) { done.current = true; onDone() }
  })
  return (
    <>
      <primitive object={scene} />
      <group ref={flame} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -14, 0]}><coneGeometry args={[9, 34, 24, 1, true]} /><meshBasicMaterial color="#ff8a1f" toneMapped={false} transparent opacity={0.85} /></mesh>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -10, 0]}><coneGeometry args={[4, 24, 16, 1, true]} /><meshBasicMaterial color="#fff3c4" toneMapped={false} /></mesh>
        <pointLight color="#ff9a3c" intensity={3000} distance={600} decay={1} />
      </group>
      <group ref={smoke} visible={false}>
        {Array.from({ length: 7 }, (_, i) => <mesh key={i}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#e5e7eb" transparent opacity={0.5} depthWrite={false} /></mesh>)}
      </group>
    </>
  )
}

// ---------- solid facilities ----------
function facade(base: string, win: string, cols: number, rows: number, glass = false) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = base; x.fillRect(0, 0, 256, 256)
  const w = 256 / cols, h = 256 / rows
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    x.fillStyle = glass ? '#1b3a5c' : win; x.fillRect(i * w + w * 0.18, j * h + h * 0.22, w * 0.64, h * 0.56)
    if (glass) { x.fillStyle = 'rgba(160,210,255,0.25)'; x.fillRect(i * w + w * 0.18, j * h + h * 0.22, w * 0.64, h * 0.2) }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}
function Building({ w, h, d, base, win, glass, cols = 1, rows = 1, pos = [0, 0, 0] as V3 }: { w: number; h: number; d: number; base: string; win: string; glass?: boolean; cols?: number; rows?: number; pos?: V3 }) {
  const mats = useMemo(() => {
    const side = (len: number) => { const t = facade(base, win, 4, 3, glass); t.repeat.set(Math.max(1, Math.round(len / (cols * 8))), Math.max(1, Math.round(h / (rows * 5)))); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 }) }
    const plain = new THREE.MeshStandardMaterial({ color: base, roughness: 0.8 })
    return [side(d), side(d), plain, plain, side(w), side(w)]
  }, [w, h, d, base, win, glass])
  return <mesh position={[pos[0], pos[1] + h / 2, pos[2]]} material={mats}><boxGeometry args={[w, h, d]} /></mesh>
}
const Dish = ({ p }: { p: V3 }) => (
  <group position={p}>
    <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.4, 0.6, 2.4]} /><meshStandardMaterial color="#9ca3af" /></mesh>
    <mesh position={[0, 3.2, 0]} rotation={[-0.9, 0, 0]}><sphereGeometry args={[3.2, 24, 12, 0, Math.PI * 2, 0, 1.1]} /><meshStandardMaterial color="#f1f5f9" side={THREE.DoubleSide} roughness={0.4} /></mesh>
  </group>
)
const Mast = ({ p, h }: { p: V3; h: number }) => (
  <group position={p}>
    <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.25, 0.5, h]} /><meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.4} /></mesh>
    <mesh position={[0, h + 0.4, 0]}><sphereGeometry args={[0.6]} /><meshBasicMaterial color="#ff3030" toneMapped={false} /></mesh>
  </group>
)
function Facility({ id, color }: { id: string; color: string }) {
  return (
    <>
      {id === 'define' && <><Building w={64} h={14} d={30} base="#dfe5ec" win="#2a3f5a" cols={2} rows={1} /><Building w={30} h={24} d={18} base="#c9d1db" win="#2a3f5a" pos={[-12, 14, -4]} /><Dish p={[18, 14, 6]} /><Dish p={[26, 14, -4]} /><Mast p={[-26, 14, 8]} h={28} /></>}
      {id === 'design' && <><Building w={52} h={46} d={42} base="#f1f5f9" win="#cbd5e1" cols={3} rows={4} />
        <mesh position={[0, 16, 21.2]}><planeGeometry args={[22, 32]} /><meshStandardMaterial color="#1e293b" roughness={0.9} /></mesh>
        <mesh position={[0, 40, 21.2]}><boxGeometry args={[52.2, 5, 0.3]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
        <mesh position={[0, 50, 0]}><boxGeometry args={[40, 6, 30]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.5} /></mesh></>}
      {id === 'review' && <><Building w={44} h={24} d={26} base="#1f3550" win="#8ab4e8" glass cols={2} rows={2} /><Building w={20} h={10} d={20} base="#cbd5e1" win="#334155" pos={[-26, 0, 0]} /><Mast p={[16, 24, -6]} h={20} /></>}
      {id === 'iss' && <>
        <mesh position={[0, 8, 0]}><cylinderGeometry args={[22, 22, 16, 48]} /><meshStandardMaterial color="#e5e7eb" roughness={0.5} metalness={0.3} /></mesh>
        <mesh position={[0, 16, 0]}><sphereGeometry args={[22, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.4} /></mesh>
        <mesh position={[0, 6, 0]}><cylinderGeometry args={[22.2, 22.2, 2.4, 48]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
        <Building w={20} h={9} d={14} base="#cbd5e1" win="#334155" pos={[34, 0, 6]} /></>}
      {id === 'launch' && <>
        <mesh position={[0, 3, 0]}><boxGeometry args={[34, 8, 22]} /><meshStandardMaterial color="#6b7280" roughness={0.9} /></mesh>
        <Building w={26} h={7} d={16} base="#dfe5ec" win="#2a3f5a" pos={[0, 8, 0]} />
        <mesh position={[0, 1.5, -15]} rotation={[0.45, 0, 0]}><boxGeometry args={[34, 3, 12]} /><meshStandardMaterial color="#5a6b4a" roughness={1} /></mesh>
        <Mast p={[-14, 15, 4]} h={30} /><Mast p={[14, 15, 4]} h={24} /></>}
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[7, 8, 48]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </>
  )
}
function Hub({ h, near }: { h: (typeof HUBS)[number]; near: boolean }) {
  return (
    <group position={h.pos}>
      <Facility id={h.id} color={h.color} />
      <mesh position={[0, 90, 0]}><cylinderGeometry args={[1.2, 1.2, 180, 12, 1, true]} /><meshBasicMaterial color={h.color} toneMapped={false} transparent opacity={0.35} depthWrite={false} /></mesh>
      <Html position={[0, 60, 0]} center distanceFactor={260} zIndexRange={[0, 0]}>
        <div className={`select-none whitespace-nowrap rounded border px-3 py-1.5 text-center font-mono backdrop-blur ${near ? 'border-white bg-slate-900/90 text-white' : 'border-slate-500/50 bg-slate-950/60 text-slate-200'}`}>
          <div className="text-sm font-bold tracking-wider" style={{ color: h.color }}>{h.label.toUpperCase()}</div>
          <div className="text-[11px] text-slate-300">{h.sub}</div>
        </div>
      </Html>
    </group>
  )
}
function Road({ to, w = 14 }: { to: V3; w?: number }) {
  const len = Math.hypot(to[0], to[2] - 70), ang = Math.atan2(to[0], to[2] - 70)
  return <mesh position={[to[0] / 2, 0.12, 70 + (to[2] - 70) / 2]} rotation={[-Math.PI / 2, 0, -ang]}><planeGeometry args={[w, len]} /><meshStandardMaterial color="#2b2f36" roughness={1} /></mesh>
}

function Fence() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const posts = useMemo(() => { const a: V3[] = []; for (let i = -LIMIT; i <= LIMIT; i += 20) { a.push([i, 0, -LIMIT], [i, 0, LIMIT], [-LIMIT, 0, i], [LIMIT, 0, i]) } return a }, [])
  useLayoutEffect(() => { const m = new THREE.Matrix4(); posts.forEach((p, i) => { m.setPosition(p[0], 1.8, p[2]); ref.current!.setMatrixAt(i, m) }); ref.current!.instanceMatrix.needsUpdate = true }, [posts])
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, posts.length]}><boxGeometry args={[0.3, 3.6, 0.3]} /><meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.5} /></instancedMesh>
      {[1.2, 3].map(y => [[0, -LIMIT, 0], [0, LIMIT, 0], [-LIMIT, 0, Math.PI / 2], [LIMIT, 0, Math.PI / 2]].map(([x, z, r], i) => (
        <mesh key={y + '-' + i} position={r ? [x, y, 0] : [0, y, z]} rotation={[0, r, 0]}><boxGeometry args={[LIMIT * 2, 0.08, 0.08]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.4} /></mesh>
      )))}
      {[[0, -LIMIT, 0], [0, LIMIT, Math.PI], [-LIMIT, 0, Math.PI / 2], [LIMIT, 0, -Math.PI / 2]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 5, z]} rotation={[0, r, 0]}><planeGeometry args={[18, 5]} /><meshBasicMaterial color="#facc15" side={THREE.DoubleSide} /></mesh>
      ))}
    </>
  )
}
function Hills() {
  const g = useMemo(() => {
    const geo = new THREE.CylinderGeometry(2600, 2600, 1, 180, 1, true), pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); pos.setY(i, pos.getY(i) > 0 ? 80 + 32 * Math.sin(a * 5) + 22 * Math.sin(a * 11 + 1) + 12 * Math.sin(a * 23) : -30) }
    return geo
  }, [])
  return <mesh geometry={g}><meshBasicMaterial color="#7f93a8" side={THREE.BackSide} /></mesh>
}
export default function Base({ walking, launching, near, spawn, onNear, onCount, onDone }: { walking: boolean; launching: boolean; near: string | null; spawn: string | null; onNear: (id: string | null) => void; onCount: (t: number) => void; onDone: () => void }) {
  const sun: V3 = [-300, 260, -420]
  return (
    <>
      <color attach="background" args={['#b9cde0']} />
      <fog attach="fog" args={['#bfd0e0', 500, 3000]} />
      <Sky distance={4500} sunPosition={sun} turbidity={2.2} rayleigh={0.9} mieCoefficient={0.003} mieDirectionalG={0.6} />
      <ambientLight intensity={0.55} />
      <directionalLight position={sun} intensity={2.0} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140} shadow-camera-right={140} shadow-camera-top={140} shadow-camera-bottom={-140} shadow-camera-far={1400} />
      <Env />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow><planeGeometry args={[8000, 8000]} /><meshStandardMaterial color="#7d8b6a" roughness={1} /></mesh>
      <Hills />
      <Fence />
      <Pad launching={launching} onCount={onCount} onDone={onDone} />
      {HUBS.map(h => <Road key={'r' + h.id} to={h.pos} />)}
      {HUBS.map(h => <Hub key={h.id} h={h} near={near === h.id} />)}
      <Mover mode="walk" active={walking} onNear={onNear} start={[60, 1.7, 330]} spawn={spawn} solid={solidBase} />
    </>
  )
}
useGLTF.preload('/models/pad.glb')
