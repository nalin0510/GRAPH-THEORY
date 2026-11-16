import React from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';

export interface GuidedDemoStep {
  number: number;
  title: string;
  caption: string;
}

export const GUIDED_DEMO_STEPS: GuidedDemoStep[] = [
  {
    number: 1,
    title: 'Fastest Route in Demo City',
    caption:
      'Dijkstra’s algorithm finds the fastest path from Harbor Pier (J1) to BioPark Lab (J22) via the northern expressways, avoiding congested downtown streets.',
  },
  {
    number: 2,
    title: 'Congestion Spike on Ridge Expressway',
    caption:
      'Traffic on Ridge Expressway (E16) just spiked to Gridlock (3.5×). Notice the amber warning highlight along the northern corridor.',
  },
  {
    number: 3,
    title: 'Dynamic Reroute & Explanation',
    caption:
      'Recalculating Dijkstra’s shifts the recommended route south via Rail Central & South Metro Bridge (E30)—with a clear explanation of the time trade-off.',
  },
  {
    number: 4,
    title: 'Switch to Network Planning (Prim’s)',
    caption:
      'Switching objectives: Prim’s algorithm ignores travel time and builds a Minimum Spanning Tree minimizing total construction cost ($M) across all 24 junctions.',
  },
  {
    number: 5,
    title: 'Prim’s vs. Kruskal’s Equal-Cost Trees',
    caption:
      'Both algorithms achieve the exact same $138M minimum cost, yet choose different valid river bridges (E29 vs. E28) due to equal-cost ties.',
  },
  {
    number: 6,
    title: 'Playable Strategy Challenge',
    caption:
      'Finally, test your own intuition in Beat the Traffic (Level 1)—click connected roads to reach Civic Plaza (J9) and compare against Dijkstra’s optimal time!',
  },
];

interface GuidedDemoBarProps {
  activeStepIndex: number; // 0..5
  onPrev: () => void;
  onNext: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export const GuidedDemoBar: React.FC<GuidedDemoBarProps> = ({
  activeStepIndex,
  onPrev,
  onNext,
  onRestart,
  onExit,
}) => {
  const step = GUIDED_DEMO_STEPS[activeStepIndex];
  if (!step) return null;

  const isFirst = activeStepIndex === 0;
  const isLast = activeStepIndex === GUIDED_DEMO_STEPS.length - 1;

  return (
    <aside
      aria-label="Guided Competition Demonstration"
      className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[440px] z-40 rounded-xl bg-[#15120F]/95 backdrop-blur-md border border-amber-400/50 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-mono font-semibold text-amber-300">
          Guided Demo · Step {step.number} of {GUIDED_DEMO_STEPS.length}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRestart}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-100 hover:bg-stone-800/70 cursor-pointer"
            title="Restart Guided Demo"
            aria-label="Restart Guided Demo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="p-1.5 rounded-md text-stone-400 hover:text-rose-300 hover:bg-stone-800/70 cursor-pointer"
            title="Exit Guided Demo"
            aria-label="Exit Guided Demo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-stone-100">{step.title}</h3>
        <p className="text-xs text-stone-300 leading-relaxed">{step.caption}</p>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-6 gap-1">
        {GUIDED_DEMO_STEPS.map((s, idx) => (
          <div
            key={s.number}
            className={`h-1.5 rounded-full transition-colors ${
              idx <= activeStepIndex
                ? 'bg-gradient-to-r from-amber-400 to-orange-300'
                : 'bg-[#0D0B09]'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={onPrev}
          className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 disabled:opacity-40 border border-stone-800 text-xs text-stone-200 inline-flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-stone-950 text-xs font-semibold cursor-pointer"
          >
            Finish & Play Challenge
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 text-stone-950 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Next Step</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
};
