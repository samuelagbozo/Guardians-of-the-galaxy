import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useTex, Atmosphere, Craft, Planet } from '../Scene'
import type { Sel } from '../engine'

// name, distance, radius, orbit period (s)
const P: [string, number, number, number][] = [
  ['mercury', 18, 0.7, 9], ['venus', 25, 1.3, 14], ['earth', 33, 1.5, 20], ['mars', 41, 1.0, 28],
  ['jupiter', 58, 5, 45], ['saturn', 77, 4.2, 60], ['uranus', 92, 2.6, 80], ['neptune', 105, 2.5, 100],
]
const A0 = 0.35, TA = 37, TE = 4 / 37
const hoh = (s: number) => { const nu = Math.PI * s, r = (TA * (1 - TE * TE)) / (1 + TE * Math.cos(nu)), a = A0 + nu; return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r) }

type Mode = 'idle' | 'dive' | 'cruise'
export default function Solar({ mode, sel, onProgress, onDone }: { mode: Mode; sel?: Sel; onProgress?: (t: number) => void; onDone?: () => void }) {
  const T = useTex({ sun: '/textures/sun.jpg', mercury: '/textures/mercury.jpg', venus: '/textures/venus.jpg', earth: '/textures/earth.jpg',
    mars: '/textures/mars.jpg', jupiter: '/textures/jupiter.jpg', saturn: '/textures/saturn.jpg', uranus: '/textures/uranus.jpg',
    neptune: '/textures/neptune.jpg', moon: '/textures/moon.jpg' })
  const refs = useRef<Record<string, THREE.Group | null>>({})
  const craft = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3()), t0 = useRef(0), done = useRef(false), last = useRef(-1)
  const trail = useMemo(() => Array.from({ length: 60 }, (_, i) => hoh(i / 59)), [])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    P.forEach(([n, d, , per], i) => {
      let a = i * 1.1 + t * (6.283 / per) * 0.6
      if (mode === 'cruise' && n === 'earth') a = A0
      if (mode === 'cruise' && n === 'mars') a = A0 + Math.PI
      refs.current[n]?.position.set(Math.cos(a) * d, 0, Math.sin(a) * d)
      refs.current[n]?.children[0]?.rotateY(dt * 0.3)
    })
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3()
    let rate = 2
    if (mode === 'cruise') {
      t0.current += dt
      const s = Math.min(t0.current / 18, 1), c = hoh(s), dir = hoh(Math.min(s + 0.01, 1)).sub(c).normalize()
      if (craft.current) { craft.current.position.copy(c); craft.current.lookAt(c.clone().add(dir)) }
      const dist = 3 + 38 * Math.sin(Math.PI * s) ** 2
      tgt.copy(c)
      pos.copy(c).addScaledVector(dir, -dist).add(new THREE.Vector3(0, 1.2 + dist * 0.45, 0))
      rate = 3
      const pct = Math.floor(s * 100)
      if (pct !== last.current) { last.current = pct; onProgress?.(s) }
      if (s >= 1 && !done.current) { done.current = true; onDone?.() }
    } else if (mode === 'dive' && refs.current.earth) {
      const e = refs.current.earth.position
      tgt.copy(e)
      pos.copy(e).multiplyScalar(1 - 4.6 / Math.max(e.length(), 1)).add(new THREE.Vector3(0, 0.9, 0))
      rate = 1.4
    } else {
      pos.set(Math.sin(t * 0.04) * 150, 62, Math.cos(t * 0.04) * 150)
    }
    const k = 1 - Math.exp(-rate * dt)
    camera.position.lerp(pos, k); look.current.lerp(tgt, k); camera.lookAt(look.current)
  })
  return (
    <>
      <color attach="background" args={['#000207']} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]} intensity={380} decay={1.2} distance={0} />
      <Stars radius={600} depth={100} count={9000} factor={6} fade speed={0.4} />
      <mesh><sphereGeometry args={[9, 64, 64]} /><meshBasicMaterial map={T.sun} toneMapped={false} color="#ffd9a0" /></mesh>
      {P.map(([n, d, r]) => (
        <group key={n}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[d - 0.06, d + 0.06, 160]} /><meshBasicMaterial color="#475569" transparent opacity={0.45} side={THREE.DoubleSide} /></mesh>
          <group ref={el => { refs.current[n] = el }}>
            <mesh><sphereGeometry args={[r, 64, 64]} /><meshStandardMaterial map={(T as any)[n]} roughness={1} /></mesh>
            {n === 'earth' && <><Atmosphere r={r} /><mesh position={[2.8, 0, 0]}><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial map={T.moon} roughness={1} /></mesh></>}
            {n === 'saturn' && <mesh rotation={[-Math.PI / 2.2, 0, 0]}><ringGeometry args={[5.6, 9.2, 96]} /><meshBasicMaterial color="#cdb88e" transparent opacity={0.7} side={THREE.DoubleSide} /></mesh>}
          </group>
        </group>
      ))}
      {mode === 'cruise' && sel && (
        <>
          <Line points={trail} color="#38bdf8" lineWidth={1.5} transparent opacity={0.8} />
          <group ref={craft} scale={0.12}><Craft sel={sel} spin={false} /></group>
        </>
      )}
    </>
  )
}

// Earth to Moon transfer.
export function MoonCruise({ sel, onProgress, onDone }: { sel: Sel; onProgress: (t: number) => void; onDone: () => void }) {
  const craft = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3()), t0 = useRef(0), done = useRef(false), last = useRef(-1)
  const S = useMemo(() => new THREE.Vector3(3.3, 0, 0), []), C = useMemo(() => new THREE.Vector3(14, 11, 12), []), M = useMemo(() => new THREE.Vector3(30, 0, -6), [])
  const bez = (u: number) => S.clone().multiplyScalar((1 - u) ** 2).addScaledVector(C, 2 * u * (1 - u)).addScaledVector(M.clone().add(new THREE.Vector3(0, 0, 2.2)), u * u)
  const trail = useMemo(() => Array.from({ length: 50 }, (_, i) => bez(i / 49)), [])
  useFrame((_, dt) => {
    t0.current += dt
    const s = Math.min(t0.current / 14, 1), c = bez(s), dir = bez(Math.min(s + 0.01, 1)).sub(c).normalize()
    if (craft.current) { craft.current.position.copy(c); craft.current.lookAt(c.clone().add(dir)) }
    const dist = 2.5 + 22 * Math.sin(Math.PI * s) ** 2
    const k = 1 - Math.exp(-3 * dt)
    camera.position.lerp(c.clone().addScaledVector(dir, -dist).add(new THREE.Vector3(0, 1 + dist * 0.4, 0)), k)
    look.current.lerp(c, k); camera.lookAt(look.current)
    const pct = Math.floor(s * 100)
    if (pct !== last.current) { last.current = pct; onProgress(s) }
    if (s >= 1 && !done.current) { done.current = true; onDone() }
  })
  return (
    <>
      <color attach="background" args={['#01030a']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 10, 30]} intensity={2} />
      <Stars radius={300} depth={80} count={6000} factor={5} fade />
      <Planet body="earth" />
      <group position={M}><Planet body="moon" r={0.9} /></group>
      <Line points={trail} color="#38bdf8" lineWidth={1.5} transparent opacity={0.8} />
      <group ref={craft} scale={0.12}><Craft sel={sel} spin={false} /></group>
    </>
  )
}
