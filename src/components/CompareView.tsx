import React, { useMemo, useState } from 'react';
import { AlertCircle, Play, RefreshCw } from 'lucide-react';
import { runDijkstra } from '../algorithms/dijkstra';
import { runKruskal } from '../algorithms/kruskal';
import { runPrim } from '../algorithms/prim';
import { CityGraph } from '../types/graph';

interface CompareViewProps {
  graph: CityGraph;
  startId: string;
  endId: string;
}

export const CompareView: React.FC<CompareViewProps> = ({ graph, startId, endId }) => {
  const [benchNonce, setBenchNonce] = useState(0);
  const [scaleV, setScaleV] = useState(240);
  const [densityMode, setDensityMode] = useState<'sparse' | 'grid' | 'dense'>('grid');

  const metrics = useMemo(() => {
    // Run pure computations without event recording so timings reflect algorithm work, not animation.
    const dijkstraTime = runDijkstra(graph, startId, endId, 'time', { recordEvents: false });
    const dijkstraDist = runDijkstra(graph, startId, endId, 'distance', { recordEvents: false });
    const prim = runPrim(graph, startId, { recordEvents: false });
    const kruskal = runKruskal(graph, { recordEvents: false });
    return { dijkstraTime, dijkstraDist, prim, kruskal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, startId, endId, benchNonce]);

  const maxComputeMs = Math.max(
    0.05,
    metrics.dijkstraTime.computeTimeMs,
    metrics.dijkstraDist.computeTimeMs,
    metrics.prim.computeTimeMs,
    metrics.kruskal.computeTimeMs
  );

  const scalingSeries = useMemo(() => {
    const estimateEdges = (v: number) => {
      if (densityMode === 'sparse') return Math.round(v * 1.8);
      if (densityMode === 'grid') return Math.round(v * 2.5);
      return Math.round(0.25 * v * Math.max(1, v - 1));
    };
    const steps = 16;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const v = Math.max(10, Math.round(10 + ((scaleV - 10) * i) / steps));
      const e = estimateEdges(v);
      const logV = Math.max(1, Math.log2(v));
      const logE = Math.max(1, Math.log2(Math.max(2, e)));
      return {
        v,
        e,
        heapOps: Math.round((v + e) * logV),
        kruskalOps: Math.round(e * logE),
        naiveArrayOps: v * v,
      };
    });
    const maxOps = Math.max(
      100,
      ...points.flatMap((p) => [p.heapOps, p.kruskalOps, p.naiveArrayOps])
    );
    const current = points[points.length - 1];
    return { points, maxOps, current };
  }, [scaleV, densityMode]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-800/90 pb-4">
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-2xl font-display font-bold text-stone-100 tracking-tight">
            Algorithm Comparison & Live Metrics
          </h1>
          <p className="text-sm text-stone-300 leading-relaxed">
            Dijkstra’s, Prim’s, and Kruskal’s all operate on weighted graphs, yet they answer
            fundamentally different questions. In graph notation,{' '}
            <strong className="text-amber-300 font-mono">V</strong> represents the number of
            junctions (vertices — currently <strong className="font-mono">{graph.nodes.length}</strong> in Demo City), and{' '}
            <strong className="text-emerald-300 font-mono">E</strong> represents the number of roads
            (edges — currently <strong className="font-mono">{graph.edges.length}</strong>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBenchNonce((n) => n + 1)}
          className="px-4 py-2 rounded-lg bg-[#15120F] hover:bg-stone-800/80 border border-stone-800 text-xs font-semibold text-stone-100 inline-flex items-center gap-2 cursor-pointer shrink-0 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Re-run Live Benchmark</span>
        </button>
      </div>

      {/* Side-by-Side Visual Schematic Contrast */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Schematic 1: Dijkstra Shortest Path */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300">
              1. Shortest Path Goal (Dijkstra’s)
            </span>
            <span className="font-mono text-[11px] text-stone-400">Point-to-Point S → D</span>
          </div>
          <div className="rounded-lg bg-[#0D0B09] border border-stone-800/85 p-2">
            <svg viewBox="0 0 360 155" className="w-full h-36 block" aria-hidden="true">
              {/* Edges */}
              <line x1="45" y1="78" x2="145" y2="32" stroke="#EA580C" strokeWidth="3.5" strokeOpacity="0.88" />
              <line x1="145" y1="32" x2="255" y2="32" stroke="#EA580C" strokeWidth="3.5" strokeOpacity="0.88" />
              <line x1="255" y1="32" x2="315" y2="78" stroke="#44403C" strokeWidth="2.5" />
              <line x1="145" y1="32" x2="175" y2="118" stroke="#44403C" strokeWidth="2" />
              <line x1="255" y1="32" x2="175" y2="118" stroke="#44403C" strokeWidth="2" />
              {/* Optimal Route */}
              <line x1="45" y1="78" x2="175" y2="118" stroke="#FACC15" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="175" y1="118" x2="315" y2="78" stroke="#FACC15" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="45" y1="78" x2="175" y2="118" stroke="#FFFBEB" strokeWidth="2" className="animate-route-flow" />
              <line x1="175" y1="118" x2="315" y2="78" stroke="#FFFBEB" strokeWidth="2" className="animate-route-flow" />

              {/* Weight labels */}
              <text x="86" y="45" fill="#FDBA74" fontSize="10" fontFamily="var(--font-mono)">9m (slow)</text>
              <text x="182" y="22" fill="#FDBA74" fontSize="10" fontFamily="var(--font-mono)">6m</text>
              <text x="92" y="114" fill="#FEF08A" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">4m</text>
              <text x="242" y="114" fill="#FEF08A" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">4m</text>

              {/* Nodes */}
              <circle cx="145" cy="32" r="8" fill="#161310" stroke="#78716C" strokeWidth="2" />
              <circle cx="255" cy="32" r="8" fill="#161310" stroke="#78716C" strokeWidth="2" />
              <circle cx="175" cy="118" r="9.5" fill="#422006" stroke="#FACC15" strokeWidth="2.5" />
              <circle cx="45" cy="78" r="12" fill="#059669" stroke="#A7F3D0" strokeWidth="2.5" />
              <circle cx="315" cy="78" r="12" fill="#D97706" stroke="#FEF08A" strokeWidth="2.5" />
              <text x="45" y="78" textAnchor="middle" dominantBaseline="central" fill="#FFF" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">S</text>
              <text x="315" y="78" textAnchor="middle" dominantBaseline="central" fill="#FFF" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">D</text>
            </svg>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Minimizes cumulative weight along <strong className="text-amber-200">one route</strong>{' '}
            between Start and Destination. Unneeded junctions are ignored once Destination settles.
          </p>
        </div>

        {/* Schematic 2: Prim / Kruskal MST */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-300">
              2. Network Backbone Goal (Prim’s & Kruskal’s)
            </span>
            <span className="font-mono text-[11px] text-stone-400">All V Junctions, 0 Cycles</span>
          </div>
          <div className="rounded-lg bg-[#0D0B09] border border-stone-800/85 p-2">
            <svg viewBox="0 0 360 155" className="w-full h-36 block" aria-hidden="true">
              {/* Rejected cycle edges */}
              <line x1="45" y1="78" x2="175" y2="118" stroke="#FB7185" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.7" />
              <line x1="255" y1="32" x2="175" y2="118" stroke="#FB7185" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.7" />

              {/* Selected MST edges */}
              <line x1="45" y1="78" x2="145" y2="32" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="145" y1="32" x2="255" y2="32" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="255" y1="32" x2="315" y2="78" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="145" y1="32" x2="175" y2="118" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />

              <line x1="45" y1="78" x2="145" y2="32" stroke="#D1FAE5" strokeWidth="1.8" className="animate-mst-flow" />
              <line x1="145" y1="32" x2="255" y2="32" stroke="#D1FAE5" strokeWidth="1.8" className="animate-mst-flow" />
              <line x1="255" y1="32" x2="315" y2="78" stroke="#D1FAE5" strokeWidth="1.8" className="animate-mst-flow" />
              <line x1="145" y1="32" x2="175" y2="118" stroke="#D1FAE5" strokeWidth="1.8" className="animate-mst-flow" />

              {/* Weight labels */}
              <text x="86" y="45" fill="#6EE7B7" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">$3M</text>
              <text x="198" y="21" fill="#6EE7B7" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">$4M</text>
              <text x="294" y="46" fill="#6EE7B7" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">$3M</text>
              <text x="134" y="83" fill="#6EE7B7" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="700">$4M</text>
              <text x="92" y="114" fill="#FDA4AF" fontSize="9.5" fontFamily="var(--font-mono)">$9M cycle</text>

              {/* All nodes spanned */}
              {[
                { x: 45, y: 78 },
                { x: 145, y: 32 },
                { x: 255, y: 32 },
                { x: 315, y: 78 },
                { x: 175, y: 118 },
              ].map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="9.5" fill="#065F46" stroke="#34D399" strokeWidth="2.4" />
              ))}
            </svg>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Minimizes total infrastructure build cost across <strong className="text-emerald-300">every vertex</strong>{' '}
            using exactly <span className="font-mono text-emerald-200">V − 1</span> cycle-free edges.
          </p>
        </div>
      </div>

      {/* Important Educational Clarification */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#1B1713] to-[#12100D] border border-amber-400/35 flex items-start gap-3 text-xs text-stone-200 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Not interchangeable: </span>
          Dijkstra’s minimizes the travel distance or time between a specific start and destination.
          Prim’s and Kruskal’s never optimize point-to-point travel routes—they minimize the total
          construction cost of connecting every junction in a network without cycles.
        </div>
      </div>

      {/* Structured Comparison Table */}
      <div className="rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-800/90 text-stone-400 bg-[#0D0B09]">
              <th className="py-3 px-4 font-semibold">Dimension</th>
              <th className="py-3 px-4 font-semibold text-amber-300">Dijkstra’s Algorithm</th>
              <th className="py-3 px-4 font-semibold text-emerald-300">Prim’s Algorithm</th>
              <th className="py-3 px-4 font-semibold text-purple-300">Kruskal’s Algorithm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/70 text-stone-200">
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Problem Solved</td>
              <td className="py-3 px-4">Single-source shortest path between junctions</td>
              <td className="py-3 px-4">Minimum Spanning Tree (connected component)</td>
              <td className="py-3 px-4">Minimum Spanning Tree or Forest (all components)</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Input Assumptions</td>
              <td className="py-3 px-4">Weighted graph with non-negative edge weights; skips closed roads</td>
              <td className="py-3 px-4">Undirected weighted graph; requires a chosen start junction</td>
              <td className="py-3 px-4">Undirected weighted edge list; works on disconnected graphs</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Output</td>
              <td className="py-3 px-4">Shortest route sequence & total distance or travel time</td>
              <td className="py-3 px-4">Tree of V − 1 edges minimizing total construction cost</td>
              <td className="py-3 px-4">Tree (or Forest) of minimum-cost cycle-free edges</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Data Structures</td>
              <td className="py-3 px-4 font-mono text-[11px]">Adjacency list + Binary min-heap</td>
              <td className="py-3 px-4 font-mono text-[11px]">Adjacency list + Binary min-heap</td>
              <td className="py-3 px-4 font-mono text-[11px]">Sorted edge array + Disjoint-Set Union (rank & path compression)</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Time Complexity</td>
              <td className="py-3 px-4 font-mono text-amber-300">O((V + E) log V)</td>
              <td className="py-3 px-4 font-mono text-emerald-300">O((V + E) log V)</td>
              <td className="py-3 px-4 font-mono text-purple-300">O(E log E)</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium text-stone-400">Practical Application</td>
              <td className="py-3 px-4">Turn-by-turn vehicle routing, courier dispatch, packet routing</td>
              <td className="py-3 px-4">Expanding municipal fiber or power grid from an existing substation</td>
              <td className="py-3 px-4">Designing regional rail, utility, or telecom backbones from scratch</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Live Demo City Benchmark Results with Graphic Compute Bars */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-100 flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-400" />
            <span>Live Demo City Run ({startId} → {endId} for routing · All {graph.nodes.length} junctions for MST)</span>
          </h2>
          <span className="text-[11px] text-stone-400">
            Computation timings are approximate and exclude animation playback
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2.5">
            <div className="text-xs font-semibold text-amber-300">Dijkstra (Fastest Time)</div>
            <div className="font-mono text-xl font-bold text-stone-100 tabular-nums">
              {metrics.dijkstraTime.reachable
                ? `${metrics.dijkstraTime.totalTimeMin.toFixed(1)} min`
                : 'Unreachable'}
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${Math.min(100, Math.max(12, (metrics.dijkstraTime.computeTimeMs / maxComputeMs) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-stone-400 font-mono space-y-0.5 tabular-nums">
              <div>Visited nodes: {metrics.dijkstraTime.visitedCount}</div>
              <div>Examined edges: {metrics.dijkstraTime.examinedEdgeCount}</div>
              <div>Compute: ~{metrics.dijkstraTime.computeTimeMs.toFixed(2)} ms</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2.5">
            <div className="text-xs font-semibold text-orange-300">Dijkstra (Shortest Dist)</div>
            <div className="font-mono text-xl font-bold text-stone-100 tabular-nums">
              {metrics.dijkstraDist.reachable
                ? `${metrics.dijkstraDist.totalDistanceKm.toFixed(1)} km`
                : 'Unreachable'}
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-400"
                style={{ width: `${Math.min(100, Math.max(12, (metrics.dijkstraDist.computeTimeMs / maxComputeMs) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-stone-400 font-mono space-y-0.5 tabular-nums">
              <div>Visited nodes: {metrics.dijkstraDist.visitedCount}</div>
              <div>Examined edges: {metrics.dijkstraDist.examinedEdgeCount}</div>
              <div>Compute: ~{metrics.dijkstraDist.computeTimeMs.toFixed(2)} ms</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2.5">
            <div className="text-xs font-semibold text-emerald-300">Prim’s MST (from {startId})</div>
            <div className="font-mono text-xl font-bold text-stone-100 tabular-nums">
              ${metrics.prim.totalCost}M
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(100, Math.max(12, (metrics.prim.computeTimeMs / maxComputeMs) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-stone-400 font-mono space-y-0.5 tabular-nums">
              <div>Tree edges: {metrics.prim.treeEdgeIds.length}</div>
              <div>Heap pops: {metrics.prim.consideredEdgeCount}</div>
              <div>Compute: ~{metrics.prim.computeTimeMs.toFixed(2)} ms</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2.5">
            <div className="text-xs font-semibold text-purple-300">Kruskal’s MST</div>
            <div className="font-mono text-xl font-bold text-stone-100 tabular-nums">
              ${metrics.kruskal.totalCost}M
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-400"
                style={{ width: `${Math.min(100, Math.max(12, (metrics.kruskal.computeTimeMs / maxComputeMs) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-stone-400 font-mono space-y-0.5 tabular-nums">
              <div>Accepted edges: {metrics.kruskal.acceptedEdgeIds.length}</div>
              <div>Sorted checks: {metrics.kruskal.consideredEdgeCount}</div>
              <div>Compute: ~{metrics.kruskal.computeTimeMs.toFixed(2)} ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Big-O Complexity Scaling Explorer */}
      <div className="p-5 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-100">
              Big-O Complexity Scaling Explorer
            </h2>
            <p className="text-xs text-stone-400">
              Compare how binary-heap routing/Prim, edge-sorted Kruskal, and naive V² array scans scale as city size grows.
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-[#0D0B09] p-1 border border-stone-800 text-xs">
            {(
              [
                { id: 'sparse', label: 'Sparse (E≈1.8V)' },
                { id: 'grid', label: 'Urban Grid (E≈2.5V)' },
                { id: 'dense', label: 'Dense (E≈0.25V²)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDensityMode(opt.id)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  densityMode === opt.id
                    ? 'bg-stone-800 text-amber-300'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 rounded-lg bg-[#0D0B09] border border-stone-800/85 p-3">
            <svg
              viewBox="0 0 620 210"
              className="w-full h-48 block"
              role="img"
              aria-label="Algorithm Big-O operation count scaling chart"
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = 180 - frac * 150;
                return (
                  <g key={frac}>
                    <line
                      x1={48}
                      y1={y}
                      x2={598}
                      y2={y}
                      stroke="rgba(120, 113, 108, 0.2)"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={42}
                      y={y + 3}
                      textAnchor="end"
                      fill="#78716C"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                    >
                      {Math.round(scalingSeries.maxOps * frac) >= 1000
                        ? `${(Math.round(scalingSeries.maxOps * frac) / 1000).toFixed(0)}k`
                        : Math.round(scalingSeries.maxOps * frac)}
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line x1={48} y1={24} x2={48} y2={180} stroke="#57534E" strokeWidth={1.2} />
              <line x1={48} y1={180} x2={598} y2={180} stroke="#57534E" strokeWidth={1.2} />

              {/* Curves */}
              {(() => {
                const toX = (v: number) => 48 + ((v - 10) / Math.max(1, scaleV - 10)) * 550;
                const toY = (ops: number) => 180 - (ops / scalingSeries.maxOps) * 150;
                const naivePath = scalingSeries.points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.v).toFixed(1)} ${toY(p.naiveArrayOps).toFixed(1)}`)
                  .join(' ');
                const kruskalPath = scalingSeries.points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.v).toFixed(1)} ${toY(p.kruskalOps).toFixed(1)}`)
                  .join(' ');
                const heapPath = scalingSeries.points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.v).toFixed(1)} ${toY(p.heapOps).toFixed(1)}`)
                  .join(' ');
                return (
                  <>
                    <path
                      d={naivePath}
                      fill="none"
                      stroke="#FB923C"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      opacity={0.85}
                    />
                    <path
                      d={kruskalPath}
                      fill="none"
                      stroke="#C084FC"
                      strokeWidth={2.5}
                    />
                    <path
                      d={heapPath}
                      fill="none"
                      stroke="#FBBF24"
                      strokeWidth={2.5}
                    />
                  </>
                );
              })()}

              {/* Axis labels */}
              <text x={52} y={197} fill="#A8A29E" fontSize="9.5" fontFamily="var(--font-mono)">
                V = 10
              </text>
              <text
                x={598}
                y={197}
                textAnchor="end"
                fill="#FCD34D"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                V = {scaleV} junctions
              </text>
            </svg>

            <div className="mt-2 pt-2 border-t border-stone-800/80 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-stone-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-amber-400 inline-block" />
                <span>Dijkstra / Prim Binary Heap · (V+E) log₂ V</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-purple-400 inline-block" />
                <span>Kruskal Edge Sort · E log₂ E</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-orange-400 inline-block" />
                <span>Naive Array Dijkstra · V²</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-3">
            <div className="p-3 rounded-lg bg-[#0D0B09] border border-stone-800/85 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="bigo-v-slider" className="text-stone-300 font-medium">
                  Network Scale (V)
                </label>
                <span className="font-mono font-semibold text-amber-300 tabular-nums">
                  {scaleV} junctions · {scalingSeries.current.e.toLocaleString()} roads
                </span>
              </div>
              <input
                id="bigo-v-slider"
                type="range"
                min={10}
                max={1000}
                step={10}
                value={scaleV}
                onChange={(e) => setScaleV(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs font-mono tabular-nums">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D0B09] border border-stone-800/85">
                <span className="text-amber-300">Heap Dijkstra / Prim</span>
                <span className="text-stone-100 font-semibold">
                  ~{scalingSeries.current.heapOps.toLocaleString()} ops
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D0B09] border border-stone-800/85">
                <span className="text-purple-300">Kruskal (E log₂ E)</span>
                <span className="text-stone-100 font-semibold">
                  ~{scalingSeries.current.kruskalOps.toLocaleString()} ops
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D0B09] border border-stone-800/85">
                <span className="text-orange-300">Naive Array (V²)</span>
                <span className="text-stone-100 font-semibold">
                  ~{scalingSeries.current.naiveArrayOps.toLocaleString()} ops
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
