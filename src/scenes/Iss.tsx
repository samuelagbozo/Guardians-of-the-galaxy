import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Stars, Html, PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { Mover } from './Base'
import { Atmosphere, Env, useTex } from '../Scene'
import { sfx } from '../audio'

const LABELS: [string, string, string][] = [
  ['Zarya', 'Zarya (FGB)', 'The first ISS module, launched in 1998. It provided early power and propulsion.'],
  ['Zvezda', 'Zvezda Service Module', 'Launched in 2000. Provides crew living quarters and life support.'],
  ['Z1_Truss', 'Z1 Truss', 'A structural mount that helped build the station’s long backbone.'],
  ['DEXTRE', 'Dextre robot', 'A Canadian two-armed robot that does maintenance work outside so astronauts do not have to.'],
  ['panel_01_p', 'Solar array', 'Turns sunlight into electricity. Batteries cover the ~35 minutes of shadow in each ~92 minute orbit.'],
]
export type DockInfo = { range: number; speed: number; limit: number; fuel: number; status: 'approach' | 'docked' | 'crash' | 'dry' }

const inside = (p: THREE.Vector3, bs: THREE.Box3[]) => bs.some(b => b.containsPoint(p))
export function pushBoxes(p: THREE.Vector3, bs: THREE.Box3[]) {
  for (let pass = 0; pass < 2; pass++) for (const b of bs) {
    if (!b.containsPoint(p)) continue
    const d = [p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z]
    const i = d.indexOf(Math.min(...d))
    if (i === 0) p.x = b.min.x; else if (i === 1) p.x = b.max.x; else if (i === 2) p.y = b.min.y; else if (i === 3) p.y = b.max.y; else if (i === 4) p.z = b.min.z; else p.z = b.max.z
  }
}
const PUFFS: [V, V][] = [[[0, 0, -1.6], [0, 0, -1]], [[0, 0, 1.6], [0, 0, 1]], [[-1.2, 0, 0], [-1, 0, 0]], [[1.2, 0, 0], [1, 0, 0]], [[0, 1.2, 0], [0, 1, 0]], [[0, -1.2, 0], [0, -1, 0]]]
type V = [number, number, number]

function Dock({ port, boxes, onDock }: { port: THREE.Vector3; boxes: THREE.Box3[]; onDock: (d: DockInfo) => void }) {
  const { scene } = useGLTF('/models/dragon.glb')
  const dragon = useMemo(() => scene.clone(true), [scene])
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const vel = useRef(new THREE.Vector3()), fuel = useRef(100), status = useRef<DockInfo['status']>('approach'), acc = useRef(0)
  const lag = useRef(new THREE.Vector3()), roll = useRef(0), q = useRef(new THREE.Quaternion())
  const holder = useRef<THREE.Group>(null), puffs = useRef<(THREE.Mesh | null)[]>([])
  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    camera.position.copy(port).add(new THREE.Vector3(45, 22, 110)); camera.lookAt(port); q.current.copy(camera.quaternion)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); sfx.layer('hiss', 0) }
  }, [])
  useFrame((_, dt) => {
    const k = keys.current, a = 0.5
    const f = new THREE.Vector3(); camera.getWorldDirection(f)
    const r = new THREE.Vector3().crossVectors(f, camera.up).normalize(), up = camera.up
    let lf = 0, lr = 0, lu = 0, brake = false
    if (status.current === 'approach') {
      if (k.KeyW) lf += 1; if (k.KeyS) lf -= 1; if (k.KeyD) lr += 1; if (k.KeyA) lr -= 1; if (k.Space) lu += 1; if (k.KeyC) lu -= 1
      const thrust = new THREE.Vector3().addScaledVector(f, lf).addScaledVector(r, lr).addScaledVector(up, lu)
      const on = thrust.lengthSq() > 0 && fuel.current > 0
      if (on) { vel.current.addScaledVector(thrust.normalize(), a * dt); fuel.current = Math.max(0, fuel.current - 0.35 * dt) }
      brake = !!k.KeyX && fuel.current > 0
      if (brake) { vel.current.multiplyScalar(Math.exp(-1.3 * dt)); fuel.current = Math.max(0, fuel.current - 0.2 * dt) }
      camera.position.addScaledVector(vel.current, dt)
      sfx.layer('hiss', on || brake ? 0.8 : 0, 0.15)
    } else sfx.layer('hiss', 0)
    // Dragon: lags behind the camera, tilts into strafes and shows RCS puffs
    lag.current.lerp(new THREE.Vector3(-lr * 0.9, -lu * 0.6, -lf * 0.5), 1 - Math.exp(-3 * dt))
    roll.current += ((-lr * 0.35) - roll.current) * (1 - Math.exp(-3 * dt))
    q.current.slerp(camera.quaternion, 1 - Math.exp(-4 * dt))
    if (holder.current) {
      if (status.current === 'docked') holder.current.position.lerp(port, 1 - Math.exp(-2 * dt))
      else holder.current.position.copy(camera.position).addScaledVector(f, 7 + lag.current.z).addScaledVector(r, lag.current.x).addScaledVector(up, -1.6 + lag.current.y)
      holder.current.quaternion.copy(q.current).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll.current))
    }
    const on = [lf < 0 || brake, lf > 0 || brake, lr > 0, lr < 0, lu < 0, lu > 0]
    puffs.current.forEach((m, i) => { if (m) m.visible = on[i] && fuel.current > 0 && Math.random() > 0.2 })
    const to = port.clone().sub(camera.position), range = to.length(), speed = vel.current.dot(to.normalize()), limit = Math.max(0.3, range / 60)
    if (status.current === 'approach') {
      if (range < 5) status.current = Math.abs(speed) < 0.5 ? 'docked' : 'crash'
      else if (inside(camera.position, boxes)) status.current = 'crash'
      else if (fuel.current <= 0 && vel.current.length() > 0.6) status.current = 'dry'
      if (status.current === 'docked') sfx.thunk(); else if (status.current !== 'approach') sfx.beep(180, 0.5, 0.4)
    }
    acc.current += dt
    if (acc.current > 0.1) { acc.current = 0; onDock({ range, speed, limit, fuel: fuel.current, status: status.current }) }
  })
  return (
    <>
      <group ref={holder} scale={1.2}>
        <primitive object={dragon} />
        {PUFFS.map(([p, d], i) => <mesh key={i} ref={el => { puffs.current[i] = el }} visible={false} position={p} rotation={[d[1] ? -d[1] * Math.PI / 2 : d[2] ? (d[2] > 0 ? Math.PI / 2 : -Math.PI / 2) : 0, 0, d[0] ? -d[0] * Math.PI / 2 : 0]}><coneGeometry args={[0.12, 0.7, 8]} /><meshBasicMaterial color="#e0f2fe" toneMapped={false} transparent opacity={0.8} /></mesh>)}
      </group>
      <group position={port}>
        <mesh><torusGeometry args={[5, 0.25, 12, 48]} /><meshBasicMaterial color="#22d3ee" toneMapped={false} /></mesh>
        <Html center distanceFactor={90} zIndexRange={[0, 0]}><div className="whitespace-nowrap rounded border border-cyan-400/60 bg-slate-950/70 px-2 py-1 font-mono text-[11px] text-cyan-200">DOCKING PORT</div></Html>
      </group>
      <PointerLockControls selector="canvas" />
    </>
  )
}

export default function Iss({ mode, onDock }: { mode: 'tour' | 'dock'; onDock: (d: DockInfo) => void }) {
  const { scene } = useGLTF('/models/iss.glb')
  const T = useTex({ earth: '/textures/earth.jpg' })
  const info = useMemo(() => {
    scene.updateMatrixWorld(true)
    const centre = (k: string) => { let hit: THREE.Object3D | undefined; scene.traverse(o => { if (!hit && o.name.includes(k)) hit = o }); return hit ? new THREE.Box3().setFromObject(hit).getCenter(new THREE.Vector3()) : undefined }
    const marks = LABELS.flatMap(([k, t, f]) => { const p = centre(k); return p ? [{ t, f, p }] : [] })
    const port = centre('PMA') ?? centre('Zarya') ?? new THREE.Vector3(0, 0, 0)
    const boxes: THREE.Box3[] = []
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { const b = new THREE.Box3().setFromObject(o); if (b.getSize(new THREE.Vector3()).length() > 0.8) boxes.push(b.expandByScalar(1.2)) } })
    return { marks, port, boxes }
  }, [scene])
  return (
    <>
      <color attach="background" args={['#000104']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[60, 40, 30]} intensity={3.2} />
      <Env />
      <Stars radius={2500} depth={200} count={9000} factor={9} fade />
      <group position={[0, -960, -200]}>
        <mesh><sphereGeometry args={[900, 128, 128]} /><meshStandardMaterial map={T.earth} roughness={0.9} /></mesh>
        <Atmosphere r={900} />
      </group>
      <primitive object={scene} />
      {mode === 'tour' ? (
        <>
          {info.marks.map(m => (
            <Html key={m.t} position={m.p} center distanceFactor={70} zIndexRange={[0, 0]}>
              <div className="w-52 select-none rounded border border-cyan-400/40 bg-slate-950/70 p-2 font-mono text-[11px] text-slate-200 backdrop-blur">
                <div className="font-bold text-cyan-300">{m.t}</div>{m.f}
              </div>
            </Html>
          ))}
          <Mover mode="fly" active start={[0, 14, 85]} speed={8} solid={p => pushBoxes(p, info.boxes)} />
        </>
      ) : <Dock port={info.port} boxes={info.boxes.filter(b => b.distanceToPoint(info.port) > 4)} onDock={onDock} />}
    </>
  )
}
useGLTF.preload('/models/iss.glb'); useGLTF.preload('/models/dragon.glb')
