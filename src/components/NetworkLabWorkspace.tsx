import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Info,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { KRUSKAL_PSEUDOCODE, runKruskal } from '../algorithms/kruskal';
import { PRIM_PSEUDOCODE, runPrim } from '../algorithms/prim';
import { createDisconnectedDemoCity, createInitialDemoCity } from '../data/demoCity';
import { CityGraph, KruskalResult, PrimResult } from '../types/graph';
import { CityGraphCanvas } from './CityGraphCanvas';

export type NetworkLabTab = 'prim' | 'kruskal' | 'compare';

interface NetworkLabWorkspaceProps {
  activeTab: NetworkLabTab;
  onChangeTab: (tab: NetworkLabTab) => void;
  primStartNodeId: string;
  onChangePrimStartNodeId: (id: string) => void;
  topologyMode: 'connected' | 'disconnected';
  onChangeTopologyMode: (mode: 'connected' | 'disconnected') => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  showGridCoordinates: boolean;
}

export const NetworkLabWorkspace: React.FC<NetworkLabWorkspaceProps> = ({
  activeTab,
  onChangeTab,
  primStartNodeId,
  onChangePrimStartNodeId,
  topologyMode,
  onChangeTopologyMode,
  playbackSpeed,
  onChangePlaybackSpeed,
  showGridCoordinates,
}) => {
  const labGraph: CityGraph = useMemo(() => {
    return topologyMode === 'disconnected'
      ? createDisconnectedDemoCity()
      : createInitialDemoCity();
  }, [topologyMode]);

  const excludeClosed = topologyMode === 'disconnected';

  const primResult: PrimResult = useMemo(
    () => runPrim(labGraph, primStartNodeId, { excludeClosed, recordEvents: true }),
    [labGraph, primStartNodeId, excludeClosed]
  );

  const kruskalResult: KruskalResult = useMemo(
    () => runKruskal(labGraph, { excludeClosed, recordEvents: true }),
    [labGraph, excludeClosed]
  );

  const activeEvents = activeTab === 'prim' ? primResult.events : kruskalResult.events;
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setStepIndex(activeTab === 'compare' ? 0 : Math.max(0, activeEvents.length - 1));
  }, [activeTab, topologyMode, primStartNodeId, activeEvents.length]);

  useEffect(() => {
    if (!isPlaying || activeTab === 'compare') return;
    const maxStep = Math.max(0, activeEvents.length - 1);
    if (stepIndex >= maxStep) {
      setIsPlaying(false);
      return;
    }
    const intervalMs = Math.max(90, Math.round(480 / playbackSpeed));
    const timer = window.setInterval(() => {
      setStepIndex((curr) => {
        if (curr >= maxStep) {
          setIsPlaying(false);
          return curr;
        }
        return curr + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, activeTab, stepIndex, activeEvents.length, playbackSpeed]);

  const primEvent =
    activeTab === 'prim'
      ? primResult.events[Math.min(stepIndex, Math.max(0, primResult.events.length - 1))]
      : null;

  const kruskalEvent =
    activeTab === 'kruskal'
      ? kruskalResult.events[Math.min(stepIndex, Math.max(0, kruskalResult.events.length - 1))]
      : null;

  const edgeById = useMemo(() => {
    const map: Record<string, CityGraph['edges'][number]> = {};
    for (const e of labGraph.edges) map[e.id] = e;
    return map;
  }, [labGraph.edges]);

  const sortedKruskalEdges = useMemo(
    () =>
      labGraph.edges
        .filter((e) => !excludeClosed || !e.closed)
        .slice()
        .sort((a, b) => a.constructionCost - b.constructionCost || a.id.localeCompare(b.id)),
    [labGraph.edges, excludeClosed]
  );

  const kruskalClusters = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const compMap = kruskalEvent?.componentMap;
    for (const node of labGraph.nodes) {
      const root = compMap?.[node.id] ?? node.id;
      if (!groups[root]) groups[root] = [];
      groups[root].push(node.id);
    }
    return Object.values(groups).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  }, [labGraph.nodes, kruskalEvent]);

  // Comparison diff between Prim & Kruskal
  const comparisonDiff = useMemo(() => {
    const primSet = new Set(primResult.treeEdgeIds);
    const kruskalSet = new Set(kruskalResult.acceptedEdgeIds);
    const shared = primResult.treeEdgeIds.filter((id) => kruskalSet.has(id));
    const onlyPrim = primResult.treeEdgeIds.filter((id) => !kruskalSet.has(id));
    const onlyKruskal = kruskalResult.acceptedEdgeIds.filter((id) => !primSet.has(id));
    return { shared, onlyPrim, onlyKruskal };
  }, [primResult, kruskalResult]);

  const pseudocodeLines = activeTab === 'prim' ? PRIM_PSEUDOCODE : KRUSKAL_PSEUDOCODE;
  const activePseudoLine =
    activeTab === 'prim'
      ? primEvent?.pseudocodeLine ?? -1
      : kruskalEvent?.pseudocodeLine ?? -1;

  const fullMeshCost = useMemo(
    () =>
      labGraph.edges
        .filter((e) => !excludeClosed || !e.closed)
        .reduce((acc, e) => acc + e.constructionCost, 0),
    [labGraph.edges, excludeClosed]
  );

  const currentMstCost =
    activeTab === 'prim'
      ? primEvent?.totalCost ?? 0
      : activeTab === 'kruskal'
      ? kruskalEvent?.totalCost ?? 0
      : primResult.totalCost;

  const currentEdgeCount =
    activeTab === 'prim'
      ? primEvent?.treeEdgeIds.length ?? 0
      : activeTab === 'kruskal'
      ? kruskalEvent?.acceptedEdgeIds.length ?? 0
      : primResult.treeEdgeIds.length;

  const targetEdgeCount = Math.max(1, labGraph.nodes.length - 1);
  const edgeProgressPct = Math.min(100, Math.round((currentEdgeCount / targetEdgeCount) * 100));
  const finalOptimalCost = activeTab === 'kruskal' ? kruskalResult.totalCost : primResult.totalCost;
  const savedCost = Math.max(0, fullMeshCost - finalOptimalCost);
  const savedPct = fullMeshCost > 0 ? Math.round((savedCost / fullMeshCost) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-800/80">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#15120F] border border-stone-800/90">
          {(
            [
              { id: 'prim', label: "Prim's Algorithm" },
              { id: 'kruskal', label: "Kruskal's Algorithm" },
              { id: 'compare', label: 'Side-by-Side Comparison' },
            ] as { id: NetworkLabTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-stone-950 font-semibold shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-400">Network State:</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#15120F] border border-stone-800/90">
            <button
              type="button"
              onClick={() => onChangeTopologyMode('connected')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                topologyMode === 'connected'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/45'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Connected City
            </button>
            <button
              type="button"
              onClick={() => onChangeTopologyMode('disconnected')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                topologyMode === 'disconnected'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-400/45'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              River Cut (Disconnected)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Control & Educational Sidebar */}
        <div className="xl:col-span-4 space-y-4">
          {/* Planning Model Notice */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-100">
                Minimum Spanning Tree Lab
              </h2>
              <span className="text-[11px] text-emerald-300 font-mono">Cost in $M</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Simplified undirected planning model. Prim’s and Kruskal’s minimize{' '}
              <strong>total network construction cost</strong> across all junctions—they do not
              compute shortest point-to-point travel routes.
            </p>

            {/* Visual Cost-Efficiency Comparison Meter */}
            <div className="p-2.5 rounded-lg bg-[#0D0B09] border border-stone-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-stone-400">MST vs Full Build (${fullMeshCost}M)</span>
                <span className="text-emerald-300 font-semibold">{savedPct}% saved</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#15120F] overflow-hidden border border-stone-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300"
                  style={{
                    width: `${fullMeshCost > 0 ? Math.max(8, Math.round((finalOptimalCost / fullMeshCost) * 100)) : 50}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                <span>Optimal Tree: ${finalOptimalCost}M</span>
                <span>Avoided Redundancy: ${savedCost}M</span>
              </div>
            </div>

            {(activeTab === 'prim' || activeTab === 'compare') && (
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Prim’s Starting Junction
                </label>
                <select
                  value={primStartNodeId}
                  onChange={(e) => onChangePrimStartNodeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0D0B09] border border-stone-700/80 text-xs text-stone-100 focus:outline-none focus:border-emerald-400"
                >
                  {labGraph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id} · {n.label} ({n.district})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeTab !== 'compare' ? (
            <>
              {/* Playback Controls */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-200">
                    {activeTab === 'prim' ? "Prim's Playback" : "Kruskal's Playback"}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                    Step {Math.min(stepIndex + 1, activeEvents.length)} / {activeEvents.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex(0);
                    }}
                    className="p-2 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-stone-200 cursor-pointer"
                    aria-label="Reset playback"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex((s) => Math.max(0, s - 1));
                    }}
                    className="p-2 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-stone-200 cursor-pointer"
                    aria-label="Previous step"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (stepIndex >= activeEvents.length - 1) setStepIndex(0);
                      setIsPlaying((p) => !p);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-stone-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_16px_-4px_rgba(52,211,153,0.45)]"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Run'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex((s) => Math.min(activeEvents.length - 1, s + 1));
                    }}
                    className="p-2 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-stone-200 cursor-pointer"
                    aria-label="Next step"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <select
                    aria-label="Playback speed"
                    value={playbackSpeed}
                    onChange={(e) => onChangePlaybackSpeed(Number(e.target.value))}
                    className="px-2 py-2 rounded-lg bg-[#0D0B09] border border-stone-700/80 text-[11px] font-mono text-stone-200 focus:outline-none"
                  >
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                    <option value={4}>4×</option>
                  </select>
                </div>

                {/* Live Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-800/80">
                  <div>
                    <div className="text-[11px] text-stone-400">Network Cost</div>
                    <div className="text-base font-semibold font-mono text-emerald-300 tabular-nums">
                      ${currentMstCost}M
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-stone-400">Edges</div>
                    <div className="text-base font-semibold font-mono text-stone-100 tabular-nums">
                      {currentEdgeCount} / {targetEdgeCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-stone-400">Components</div>
                    <div className="text-base font-semibold font-mono text-amber-200 tabular-nums">
                      {activeTab === 'prim'
                        ? primResult.components.length
                        : kruskalEvent?.componentCount ?? kruskalResult.components.length}
                    </div>
                  </div>
                </div>

                {/* Spanning Progress Gauge */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-yellow-300 transition-all duration-300"
                      style={{ width: `${edgeProgressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                    <span>Spanning completion</span>
                    <span>{edgeProgressPct}%</span>
                  </div>
                </div>

                {/* Disconnected / Connected Status */}
                {((activeTab === 'prim' && !primResult.isConnected) ||
                  (activeTab === 'kruskal' && !kruskalResult.isConnected)) ? (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-400/45 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">
                        {activeTab === 'prim' ? primResult.label : kruskalResult.label}
                      </div>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">
                        {activeTab === 'prim'
                          ? `Graph has ${primResult.components.length} disconnected components. Prim's spanned ${primResult.treeNodeIds.length}/${labGraph.nodes.length} reachable junctions from ${primStartNodeId}.`
                          : `Graph has ${kruskalResult.components.length} disconnected components, so Kruskal's produced a Minimum Spanning Forest across all components.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connected Minimum Spanning Tree · ~{(activeTab === 'prim' ? primResult.computeTimeMs : kruskalResult.computeTimeMs).toFixed(2)} ms</span>
                  </div>
                )}

                <p className="text-xs text-stone-300 leading-relaxed bg-[#0D0B09] border border-stone-800/85 rounded-lg p-2.5">
                  {activeTab === 'prim' ? primEvent?.description : kruskalEvent?.description}
                </p>

                {activeTab === 'prim' && primEvent && (
                  <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span>Frontier Candidate Heap (Top 4)</span>
                      <span className="font-mono">{primEvent.candidateEdgeIds.length} edges</span>
                    </div>
                    {primEvent.candidateEdgeIds.length === 0 ? (
                      <p className="text-[11px] text-stone-500">Frontier heap empty.</p>
                    ) : (
                      <div className="divide-y divide-stone-800/70 rounded bg-[#0D0B09] border border-stone-800/85 px-2.5 py-1">
                        {primEvent.candidateEdgeIds
                          .map((id) => edgeById[id])
                          .filter(Boolean)
                          .sort((a, b) => a.constructionCost - b.constructionCost || a.id.localeCompare(b.id))
                          .slice(0, 4)
                          .map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center justify-between py-1 text-[11px] font-mono"
                            >
                              <span className="text-stone-200 truncate">
                                {e.roadName} ({e.from}↔{e.to})
                              </span>
                              <span className="text-emerald-300 tabular-nums shrink-0 ml-2">
                                ${e.constructionCost}M
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'kruskal' && kruskalEvent && (
                  <div className="pt-2 border-t border-stone-800/80 space-y-3">
                    {/* Sorted Edge Queue Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span>Sorted Edge Queue (Upcoming)</span>
                        <span className="font-mono tabular-nums">
                          {sortedKruskalEdges.length} roads
                        </span>
                      </div>
                      <div className="divide-y divide-stone-800/70 rounded bg-[#0D0B09] border border-stone-800/85 px-2.5 py-1">
                        {(() => {
                          const activeIdx = kruskalEvent.activeEdgeId
                            ? sortedKruskalEdges.findIndex(
                                (e) => e.id === kruskalEvent.activeEdgeId
                              )
                            : 0;
                          const startIdx = Math.max(0, activeIdx - 1);
                          return sortedKruskalEdges.slice(startIdx, startIdx + 5).map((e, offset) => {
                            const isActive = e.id === kruskalEvent.activeEdgeId;
                            const isAccepted = kruskalEvent.acceptedEdgeIds.includes(e.id);
                            const isRejected = kruskalEvent.rejectedEdgeIds.includes(e.id);
                            const statusLabel = isActive
                              ? 'Active'
                              : isAccepted
                              ? 'Accepted'
                              : isRejected
                              ? 'Cycle'
                              : 'Queued';
                            const statusColor = isActive
                              ? 'text-amber-300'
                              : isAccepted
                              ? 'text-emerald-300'
                              : isRejected
                              ? 'text-rose-400'
                              : 'text-stone-500';
                            return (
                              <div
                                key={e.id}
                                className={`flex items-center justify-between py-1 text-[11px] font-mono ${
                                  isActive ? 'text-amber-200 font-semibold' : 'text-stone-300'
                                }`}
                              >
                                <span className="truncate">
                                  #{startIdx + offset + 1} {e.from}↔{e.to} · {e.roadName}
                                </span>
                                <span className="flex items-center gap-2 shrink-0 ml-2 tabular-nums">
                                  <span className={statusColor}>{statusLabel}</span>
                                  <span className="text-purple-300">${e.constructionCost}M</span>
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Live Disjoint-Set Component Clusters */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span>Disjoint-Set Components</span>
                        <span className="font-mono text-purple-300 tabular-nums">
                          {kruskalClusters.length} {kruskalClusters.length === 1 ? 'tree' : 'groups'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded bg-[#0D0B09] border border-stone-800/85">
                        {kruskalClusters.slice(0, 10).map((members) => (
                          <span
                            key={members.join('-')}
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono tabular-nums ${
                              members.length > 1
                                ? 'bg-purple-500/15 border-purple-400/40 text-purple-200'
                                : 'bg-stone-900/80 border-stone-800 text-stone-400'
                            }`}
                          >
                            {`{${members.join(',')}}`}
                          </span>
                        ))}
                        {kruskalClusters.length > 10 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono text-stone-500">
                            +{kruskalClusters.length - 10} singletons
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Synchronized Pseudocode Panel */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-2">
                <h3 className="text-xs font-semibold text-stone-200">
                  {activeTab === 'prim' ? "Prim's Pseudocode" : "Kruskal's Pseudocode"}
                </h3>
                <div className="rounded-lg bg-[#0D0B09] border border-stone-800/85 p-2 font-mono text-[11px] space-y-0.5">
                  {pseudocodeLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-2 py-1 rounded transition-colors ${
                        activePseudoLine === idx
                          ? 'bg-emerald-500/20 text-emerald-200 font-semibold border border-emerald-400/30'
                          : 'text-stone-400'
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Side-by-Side Comparison Sidebar */
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-100">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span>Prim’s vs. Kruskal’s on Shared Network</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#0D0B09] border border-emerald-400/45 space-y-1">
                  <div className="text-emerald-300 font-semibold">Prim’s ({primStartNodeId})</div>
                  <div className="font-mono text-lg font-bold text-stone-100 tabular-nums">
                    ${primResult.totalCost}M
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {primResult.treeEdgeIds.length} edges · {primResult.consideredEdgeCount} popped
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#0D0B09] border border-purple-400/45 space-y-1">
                  <div className="text-purple-300 font-semibold">Kruskal’s</div>
                  <div className="font-mono text-lg font-bold text-stone-100 tabular-nums">
                    ${kruskalResult.totalCost}M
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {kruskalResult.acceptedEdgeIds.length} edges · {kruskalResult.consideredEdgeCount} checked
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0B09] border border-stone-800/85 text-xs text-stone-300 space-y-2 leading-relaxed">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    When multiple corridors share the exact same construction cost, Prim’s and
                    Kruskal’s can choose <strong>different valid trees</strong> that achieve the{' '}
                    <strong>exact same minimum total cost</strong>.
                  </span>
                </div>

                {comparisonDiff.onlyPrim.length > 0 || comparisonDiff.onlyKruskal.length > 0 ? (
                  <div className="pt-2 border-t border-stone-800/80 space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-emerald-300 font-semibold">Unique to Prim’s: </span>
                      <span className="font-mono text-stone-200">
                        {comparisonDiff.onlyPrim
                          .map((id) => `${edgeById[id]?.roadName} ($${edgeById[id]?.constructionCost}M)`)
                          .join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-300 font-semibold">Unique to Kruskal’s: </span>
                      <span className="font-mono text-stone-200">
                        {comparisonDiff.onlyKruskal
                          .map((id) => `${edgeById[id]?.roadName} ($${edgeById[id]?.constructionCost}M)`)
                          .join(', ')}
                      </span>
                    </div>
                    <div className="text-stone-400">
                      {comparisonDiff.shared.length} shared corridors selected by both algorithms.
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400">
                    For this starting node and topology, both algorithms selected the exact same edge
                    set.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Graph Canvas */}
        <div className="xl:col-span-8">
          <CityGraphCanvas
            graph={labGraph}
            mode="network-lab"
            weightDisplay="cost"
            startNodeId={activeTab === 'prim' || activeTab === 'compare' ? primStartNodeId : null}
            activeEdgeId={
              activeTab === 'prim'
                ? primEvent?.activeEdgeId ?? null
                : activeTab === 'kruskal'
                ? kruskalEvent?.activeEdgeId ?? null
                : null
            }
            mstTreeNodeIds={
              activeTab === 'prim'
                ? primEvent?.treeNodeIds ?? []
                : activeTab === 'compare'
                ? primResult.treeNodeIds
                : []
            }
            mstSelectedEdgeIds={
              activeTab === 'prim'
                ? primEvent?.treeEdgeIds ?? []
                : activeTab === 'kruskal'
                ? kruskalEvent?.acceptedEdgeIds ?? []
                : primResult.treeEdgeIds
            }
            mstSecondaryEdgeIds={activeTab === 'compare' ? kruskalResult.acceptedEdgeIds : []}
            mstCandidateEdgeIds={activeTab === 'prim' ? primEvent?.candidateEdgeIds ?? [] : []}
            mstRejectedEdgeIds={
              activeTab === 'prim'
                ? primEvent?.rejectedEdgeIds ?? []
                : activeTab === 'kruskal'
                ? kruskalEvent?.rejectedEdgeIds ?? []
                : []
            }
            componentMap={activeTab === 'kruskal' ? kruskalEvent?.componentMap : undefined}
            onNodeClick={
              activeTab === 'prim' || activeTab === 'compare'
                ? (n) => onChangePrimStartNodeId(n.id)
                : undefined
            }
            showGridCoordinates={showGridCoordinates}
          />
        </div>
      </div>
    </div>
  );
};
