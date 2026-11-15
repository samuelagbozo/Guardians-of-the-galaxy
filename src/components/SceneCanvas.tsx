import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { PerformanceMonitor } from "@react-three/drei";
import { ToneMappingMode } from "postprocessing";
import { World } from "../Scene";
import Solar, { MoonCruise } from "../scenes/Solar";
import Base from "../scenes/Base";
import Iss, { type DockInfo } from "../scenes/Iss";
import type { Sel, LaunchResult } from "../engine";
import type { View } from "./types";

export function SceneCanvas({
  view,
  quality,
  onQualityChange,
  destination,
  selection,
  lastHub,
  near,
  onNear,
  onTimeline,
  onProgress,
  onDone,
  launchResult,
  issMode,
  dockKey,
  onDock,
}: {
  view: View;
  quality: number;
  onQualityChange: (quality: number) => void;
  destination: string;
  selection: Sel;
  lastHub: string | null;
  near: string | null;
  onNear: (hub: string | null) => void;
  onTimeline: (time: number) => void;
  onProgress: (progress: number) => void;
  onDone: () => void;
  launchResult: LaunchResult | null;
  issMode: "tour" | "dock";
  dockKey: number;
  onDock: (dock: DockInfo) => void;
}) {
  const inBase = view === "base" || view === "launch" || view === "pad";
  const lost = launchResult?.rolls[0].triggered ?? false;

  return (
    <Canvas
      shadows
      camera={{ fov: 55, near: 0.1, far: 5000, position: [0, 60, 150] }}
      dpr={quality ? [1, 1.75] : [0.75, 1]}
    >
      <PerformanceMonitor
        onDecline={() => onQualityChange(0)}
        onIncline={() => onQualityChange(1)}
      />
      <Suspense fallback={null}>
        {view === "intro" || view === "dive" ? (
          <Solar mode={view === "dive" ? "dive" : "idle"} />
        ) : view === "cruise" ? (
          destination === "mars" ? (
            <Solar
              mode="cruise"
              sel={selection}
              onProgress={onProgress}
              onDone={onDone}
            />
          ) : (
            <MoonCruise
              sel={selection}
              onProgress={onProgress}
              onDone={onDone}
            />
          )
        ) : inBase ? (
          <Base
            key="base"
            spawn={lastHub}
            walking={view === "base"}
            launching={view === "pad"}
            near={near}
            onNear={onNear}
            onCount={onTimeline}
            onDone={onDone}
          />
        ) : view === "iss" ? (
          <Iss key={issMode + dockKey} mode={issMode} onDock={onDock} />
        ) : (
          <World
            mode={
              view === "define" || view === "orbit" || view === "arrive"
                ? "earth"
                : "craft"
            }
            sel={selection}
            launch={
              view === "orbit" && launchResult
                ? {
                    fail: lost,
                    fault: launchResult.outcome === "failure" && !lost,
                    deep: destination !== "earth",
                    seed: launchResult.seed,
                    onProgress,
                    onDone,
                  }
                : null
            }
            arrive={
              view === "arrive" && launchResult
                ? {
                    fail: launchResult.outcome === "failure",
                    onProgress,
                    onDone,
                  }
                : null
            }
          />
        )}
        <EffectComposer>
          <Bloom
            intensity={quality ? 0.55 : 0.25}
            luminanceThreshold={0.9}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
