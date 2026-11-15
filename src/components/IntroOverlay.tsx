export function IntroOverlay({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/70 via-transparent to-black/40 text-center">
      <div>
        <div className="text-xs tracking-[0.4em] text-slate-400">
          NASA Space Apps Challenge
        </div>
        <h1 className="mt-4 text-4xl font-extralight tracking-[0.35em] md:text-7xl">
          ORBIT ARCHITECT
        </h1>
        <div className="rule mx-auto mt-5 w-24" />
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Design a robotic science mission. Choose the objective, build the
          spacecraft, pass flight review, then launch it.
        </p>
        <button
          onClick={onBegin}
          className="mt-8 rounded-sm border border-sky-300/70 bg-sky-300/10 px-10 py-3 tracking-[0.3em] text-sky-100 hover:bg-sky-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200"
        >
          BEGIN MISSION
        </button>
      </div>
    </div>
  );
}
