import type { View } from "./types";

export function RuntimeHud({
  view,
  fade,
  muted,
  voiceCaption,
  loading,
  loadProgress,
  timeline,
  caption,
  onToggleMute,
}: {
  view: View;
  fade: boolean;
  muted: boolean;
  voiceCaption: string | null;
  loading: boolean;
  loadProgress: number;
  timeline: number;
  caption: string;
  onToggleMute: () => void;
}) {
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-700 ${fade ? "opacity-100" : "opacity-0"}`}
      />
      <button
        onClick={onToggleMute}
        className="absolute right-4 top-14 z-40 px-3 py-1 font-mono text-[11px] panel"
      >
        {muted ? "SOUND OFF" : "SOUND ON"} · M
      </button>
      {voiceCaption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-40 flex justify-center px-4 md:pl-[27rem]">
          <div
            className="max-w-xl px-4 py-2 text-center text-sm text-slate-100 panel"
            role="status"
            aria-live="polite"
          >
            {voiceCaption}
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950 font-mono text-cyan-300">
          LOADING ASSETS {Math.round(loadProgress)}%
        </div>
      )}
      {view === "dive" && (
        <div className="absolute bottom-16 w-full text-center font-mono tracking-[0.4em] text-cyan-200">
          APPROACHING EARTH…
        </div>
      )}
      {view === "pad" && (
        <div className="absolute inset-x-0 top-10 text-center font-mono">
          <div className="text-6xl font-bold tracking-widest text-orange-300">
            {timeline < 6
              ? `T-${Math.ceil(6 - timeline)}`
              : `T+${Math.floor(timeline - 6)}`}
          </div>
          <div className="mt-2 tracking-[0.4em] text-slate-300">
            {timeline < 6 ? "COUNTDOWN" : "LIFTOFF"}
          </div>
        </div>
      )}
      {(view === "pad" ||
        view === "orbit" ||
        view === "cruise" ||
        view === "arrive") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-sm tracking-[0.3em] text-cyan-200 md:pl-[27rem]">
          {caption}
        </div>
      )}
    </>
  );
}
