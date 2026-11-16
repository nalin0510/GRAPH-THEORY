import React from 'react';
import { BookOpen, Cpu, HardDrive, Layers, MapPin, ShieldCheck } from 'lucide-react';
import { clearAllGameScores } from '../utils/storage';

interface AboutViewProps {
  onStartDemo: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onStartDemo }) => {
  const [cleared, setCleared] = React.useState(false);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-800/90 pb-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-amber-300">About RouteVerse</p>
          <h1 className="text-2xl font-display font-bold text-stone-100 tracking-tight text-balance">
            Navigate smarter. Connect better. Master the graph.
          </h1>
          <p className="text-sm text-stone-300 leading-relaxed">
            RouteVerse is an interactive graph theory command centre demonstrating how weighted
            graphs model both point-to-point urban navigation and minimum-cost infrastructure
            planning.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartDemo}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 text-stone-950 text-xs font-semibold cursor-pointer shrink-0 shadow-[0_4px_16px_-4px_rgba(245,158,11,0.45)]"
        >
          Start Guided Demo
        </button>
      </div>

      {/* Visual Architecture Flow Schematic */}
      <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg">
        <svg viewBox="0 0 840 120" className="w-full h-28 block" aria-hidden="true">
          <defs>
            <linearGradient id="arch-link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
          </defs>
          <line x1="210" y1="60" x2="310" y2="60" stroke="url(#arch-link)" strokeWidth="2.5" strokeDasharray="6 4" className="animate-route-flow" />
          <line x1="530" y1="60" x2="630" y2="60" stroke="url(#arch-link)" strokeWidth="2.5" strokeDasharray="6 4" className="animate-route-flow" />

          {/* Box 1 */}
          <rect x="16" y="18" width="194" height="84" rx="10" fill="#0D0B09" stroke="rgba(251,191,36,0.45)" strokeWidth="1.2" />
          <text x="113" y="46" textAnchor="middle" fill="#FDE68A" fontSize="12" fontWeight="700">City Topology Model</text>
          <text x="113" y="66" textAnchor="middle" fill="#A8A29E" fontSize="10.5" fontFamily="var(--font-mono)">24 Nodes · 43 Roads</text>
          <text x="113" y="84" textAnchor="middle" fill="#78716C" fontSize="10">Distance · Time · Cost</text>

          {/* Box 2 */}
          <rect x="310" y="18" width="220" height="84" rx="10" fill="#0D0B09" stroke="rgba(52,211,153,0.45)" strokeWidth="1.2" />
          <text x="420" y="46" textAnchor="middle" fill="#6EE7B7" fontSize="12" fontWeight="700">Pure Graph Engines</text>
          <text x="420" y="66" textAnchor="middle" fill="#A8A29E" fontSize="10.5" fontFamily="var(--font-mono)">Dijkstra · Prim · Kruskal</text>
          <text x="420" y="84" textAnchor="middle" fill="#78716C" fontSize="10">Min-Heap &amp; Union-Find DSU</text>

          {/* Box 3 */}
          <rect x="630" y="18" width="194" height="84" rx="10" fill="#0D0B09" stroke="rgba(192,132,252,0.45)" strokeWidth="1.2" />
          <text x="727" y="46" textAnchor="middle" fill="#E9D5FF" fontSize="12" fontWeight="700">Interactive Visualizers</text>
          <text x="727" y="66" textAnchor="middle" fill="#A8A29E" fontSize="10.5" fontFamily="var(--font-mono)">3D Home · 2D Atlas · Games</text>
          <text x="727" y="84" textAnchor="middle" fill="#78716C" fontSize="10">Live Google Maps Adapter</text>
        </svg>
      </div>

      {/* Three Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <BookOpen className="w-4 h-4" />
            <span>Graph Modeling</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Demo City models 24 junctions and 43 roads. Every edge carries distinct properties:
            physical distance (<code className="text-stone-100">km</code>), free-flow travel time (
            <code className="text-stone-100">min</code>), simulated traffic multiplier (
            <code className="text-stone-100">1.0×–3.5×</code>), construction cost (
            <code className="text-stone-100">$M</code>), and closure status.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Pure Algorithm Engines</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Dijkstra’s, Prim’s, and Kruskal’s are implemented from scratch in pure TypeScript using
            a binary min-heap priority queue and a Disjoint-Set Union with path compression and
            union by rank. Every run records deterministic event snapshots for step-by-step playback.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>Decoupled Map Adapter</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Algorithm engines are separated from the React UI and mapping services via an explicit
            adapter layer. Demo City runs 100% locally with zero API keys, while Live Map
            optionally connects to Google Maps Routes & Places (New).
          </p>
        </div>
      </div>

      {/* Privacy, Local Storage & Geolocation Honesty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>Device-Local Storage</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            RouteVerse requires no backend server or user login. Your playback preferences, saved
            Demo City traffic scenarios, and personal best game scores are stored strictly in your
            browser’s <code className="text-stone-100">localStorage</code> on this device.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearAllGameScores();
                setCleared(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs text-stone-200 cursor-pointer"
            >
              Reset Local Game Scores
            </button>
            {cleared && (
              <span className="text-xs text-emerald-400">Local high scores cleared.</span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Live Map & Geolocation Transparency</span>
          </div>
          <ul className="text-xs text-stone-300 space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Browser GPS is requested only after you click “Use my location” or “Live GPS” on
                HTTPS or localhost.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Live Map routes come directly from Google Maps Routes API and are never mislabeled
                as our local Dijkstra demo.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
