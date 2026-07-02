import { ThemeToggle } from "@/components/theme-toggle";

export function IntroSplash() {
  return (
    <section
      aria-label="ClaY. by tharun"
      className="clay-intro-splash relative grid min-h-screen overflow-hidden bg-[#fffdf8] text-[#050505] dark:bg-[#000000] dark:text-[#f7efe0]"
    >
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="clay-intro-glow clay-intro-glow-one" />
        <div className="clay-intro-glow clay-intro-glow-two" />
        <div className="clay-intro-glow clay-intro-glow-three" />
        <div className="clay-intro-band" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(255_255_255_/_0),rgb(255_255_255_/_0.34)_72%,rgb(255_255_255_/_0.72))] dark:bg-[radial-gradient(circle_at_center,rgb(0_0_0_/_0),rgb(0_0_0_/_0.24)_64%,rgb(0_0_0_/_0.82))]" />
      </div>

      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8 lg:right-12 lg:top-10">
        <ThemeToggle variant="intro" />
      </div>

      <div className="relative z-10 grid min-h-screen place-items-center px-6 py-20">
        <div className="inline-flex items-start justify-center gap-3 sm:gap-5">
          <span className="font-brand text-[clamp(5.5rem,18vw,16rem)] leading-none tracking-normal">
            ClaY.
          </span>
          <span className="font-byline pt-[0.22em] text-[clamp(0.95rem,2.1vw,2rem)] leading-none text-[#5f5b55] dark:text-[#d8cebf]">
            by tharun
          </span>
        </div>
      </div>
    </section>
  );
}
