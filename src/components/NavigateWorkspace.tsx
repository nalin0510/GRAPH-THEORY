import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookmarkPlus,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Info,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { getEdgeEffectiveTime, runDijkstra } from '../algorithms/dijkstra';
import {
  createBridgeMaintenanceDemoCity,
  createInitialDemoCity,
  createRushHourDemoCity,
} from '../data/demoCity';
import { demoCityRoutingAdapter } from '../services/mapAdapter';
import {
  CityGraph,
  CityNode,
  DijkstraObjective,
  DijkstraResult,
  NavigateMode,
  RoadEdge,
  SavedScenario,
  TRAFFIC_LABELS,
  TRAFFIC_MULTIPLIERS,
  TrafficLevel,
} from '../types/graph';
import { deleteScenario, loadSavedScenarios, saveScenario } from '../utils/storage';
import { CityGraphCanvas } from './CityGraphCanvas';
import { LiveMapView } from './LiveMapView';

interface NavigateWorkspaceProps {
  graph: CityGraph;
  onUpdateEdge: (edgeId: string, patch: Partial<Pick<RoadEdge, 'trafficMultiplier' | 'closed'>>) => void;
  onReplaceGraph: (nextGraph: CityGraph) => void;
  onResetCity: () => void;
  startId: string;
  endId: string;
  onChangeStartId: (id: string) => void;
  onChangeEndId: (id: string) => void;
  objective: DijkstraObjective;
  onChangeObjective: (obj: DijkstraObjective) => void;
  selectedEdgeId: string | null;
  onSelectEdgeId: (id: string | null) => void;
  navMode: NavigateMode;
  onChangeNavMode: (mode: NavigateMode) => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  showGridCoordinates: boolean;
  routeRunNonce: number;
  lastChangeReason: string | null;
}

interface SearchableNodeSelectProps {
  label: string;
  nodes: CityNode[];
  value: string;
  onChange: (id: string) => void;
  isPicking: boolean;
  onTogglePick: () => void;
  accent: 'emerald' | 'amber' | 'orange';
}

const SearchableNodeSelect: React.FC<SearchableNodeSelectProps> = ({
  label,
  nodes,
  value,
  onChange,
  isPicking,
  onTogglePick,
  accent,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const current = nodes.find((n) => n.id === value);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.id.toLowerCase().includes(q) ||
        n.label.toLowerCase().includes(q) ||
        n.district.toLowerCase().includes(q)
    );
  }, [nodes, filter]);

  const borderClass =
    accent === 'emerald'
      ? 'border-emerald-500/40 hover:border-emerald-400/70'
      : accent === 'orange'
      ? 'border-orange-500/40 hover:border-orange-400/70'
      : 'border-amber-500/45 hover:border-amber-400/75';

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-stone-300">{label}</label>
        <button
          type="button"
          onClick={onTogglePick}
          className={`text-[11px] font-medium transition-colors cursor-pointer ${
            isPicking ? 'text-amber-300 underline' : 'text-stone-400 hover:text-amber-300'
          }`}
        >
          {isPicking ? 'Cancel map pick' : 'Pick on map'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setFilter('');
        }}
        className={`w-full px-3 py-2 rounded-lg bg-[#0D0B09] border text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${borderClass}`}
      >
        <span className="truncate text-stone-100 font-medium">
          {current ? `${current.id} · ${current.label}` : 'Select junction'}
        </span>
        <span className="text-[11px] text-stone-400 shrink-0">{current?.district}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg bg-[#181410] border border-stone-700/80 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-stone-800/80 relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search junction or district…"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#0D0B09] border border-stone-800 rounded text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto divide-y divide-stone-800/60">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-stone-500">No matching junctions.</li>
            ) : (
              filtered.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(n.id);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-stone-800/70 cursor-pointer ${
                      n.id === value ? 'bg-amber-950/60 text-amber-200' : 'text-stone-200'
                    }`}
                  >
                    <span className="font-medium">
                      {n.id} · {n.label}
                    </span>
                    <span className="text-[11px] text-stone-400">{n.district}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

function computeRouteWithOptionalWaypoint(
  graph: CityGraph,
  startId: string,
  waypointId: string | null,
  endId: string,
  objective: DijkstraObjective
): DijkstraResult {
  if (!waypointId) {
    return demoCityRoutingAdapter.computeRoute(graph, startId, endId, objective);
  }
  const leg1 = demoCityRoutingAdapter.computeRoute(graph, startId, waypointId, objective);
  const leg2 = demoCityRoutingAdapter.computeRoute(graph, waypointId, endId, objective);

  if (!leg1.reachable || !leg2.reachable) {
    return {
      ...leg1,
      reachable: false,
      endId,
      pathNodeIds: [],
      pathEdgeIds: [],
      totalDistanceKm: 0,
      totalTimeMin: 0,
      objectiveCost: Number.POSITIVE_INFINITY,
      visitedCount: leg1.visitedCount + leg2.visitedCount,
      examinedEdgeCount: leg1.examinedEdgeCount + leg2.examinedEdgeCount,
      computeTimeMs: Number((leg1.computeTimeMs + leg2.computeTimeMs).toFixed(2)),
      events: leg1.reachable ? leg2.events : leg1.events,
      reason: !leg1.reachable
        ? `Waypoint ${waypointId} is unreachable from ${startId}.`
        : `Destination ${endId} is unreachable from waypoint ${waypointId}.`,
    };
  }

  const combinedNodes = [...leg1.pathNodeIds, ...leg2.pathNodeIds.slice(1)];
  const combinedEdges = [...leg1.pathEdgeIds, ...leg2.pathEdgeIds];
  const totalDistanceKm = Number((leg1.totalDistanceKm + leg2.totalDistanceKm).toFixed(2));
  const totalTimeMin = Number((leg1.totalTimeMin + leg2.totalTimeMin).toFixed(2));

  return {
    reachable: true,
    identicalEndpoints: false,
    objective,
    startId,
    endId,
    pathNodeIds: combinedNodes,
    pathEdgeIds: combinedEdges,
    totalDistanceKm,
    totalTimeMin,
    objectiveCost: objective === 'distance' ? totalDistanceKm : totalTimeMin,
    visitedCount: leg1.visitedCount + leg2.visitedCount,
    examinedEdgeCount: leg1.examinedEdgeCount + leg2.examinedEdgeCount,
    computeTimeMs: Number((leg1.computeTimeMs + leg2.computeTimeMs).toFixed(2)),
    events: leg1.events,
    reason: `2-leg route via waypoint ${waypointId}.`,
  };
}

export const NavigateWorkspace: React.FC<NavigateWorkspaceProps> = ({
  graph,
  onUpdateEdge,
  onReplaceGraph,
  onResetCity,
  startId,
  endId,
  onChangeStartId,
  onChangeEndId,
  objective,
  onChangeObjective,
  selectedEdgeId,
  onSelectEdgeId,
  navMode,
  onChangeNavMode,
  playbackSpeed,
  onChangePlaybackSpeed,
  showGridCoordinates,
  routeRunNonce,
  lastChangeReason,
}) => {
  const [waypointId, setWaypointId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<'none' | 'start' | 'waypoint' | 'end'>('none');
  const [showAlgoViz, setShowAlgoViz] = useState(true);
  const [result, setResult] = useState<DijkstraResult>(() =>
    computeRouteWithOptionalWaypoint(graph, startId, null, endId, objective)
  );
  const [previousResult, setPreviousResult] = useState<DijkstraResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Playback state
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Scenarios (localStorage + JSON export)
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => loadSavedScenarios());
  const [scenarioName, setScenarioName] = useState('');
  const [showScenarios, setShowScenarios] = useState(false);

  const selectedEdge = useMemo(
    () => graph.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [graph.edges, selectedEdgeId]
  );

  const nodeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const n of graph.nodes) map[n.id] = n.label;
    return map;
  }, [graph.nodes]);

  const alternateObjectiveResult = useMemo(() => {
    const altObj: DijkstraObjective = objective === 'time' ? 'distance' : 'time';
    return computeRouteWithOptionalWaypoint(graph, startId, waypointId, endId, altObj);
  }, [graph, startId, waypointId, endId, objective]);

  const trafficHealth = useMemo(() => {
    let clear = 0;
    let congested = 0;
    let closed = 0;
    for (const e of graph.edges) {
      if (e.closed) closed += 1;
      else if (e.trafficMultiplier > 1.05) congested += 1;
      else clear += 1;
    }
    const total = Math.max(1, graph.edges.length);
    return {
      clear,
      congested,
      closed,
      total,
      clearPct: (clear / total) * 100,
      congestedPct: (congested / total) * 100,
      closedPct: (closed / total) * 100,
    };
  }, [graph.edges]);

  const recalculate = (opts: { jumpToEnd?: boolean } = {}) => {
    const next = computeRouteWithOptionalWaypoint(graph, startId, waypointId, endId, objective);
    setPreviousResult((prev) =>
      result && result.startId === startId && result.endId === endId ? result : prev
    );
    setResult(next);
    setIsDirty(false);
    setIsPlaying(false);
    if (opts.jumpToEnd !== false || !showAlgoViz) {
      setStepIndex(Math.max(0, next.events.length - 1));
    } else {
      setStepIndex(0);
    }
  };

  useEffect(() => {
    const next = computeRouteWithOptionalWaypoint(graph, startId, waypointId, endId, objective);
    setResult((prev) => {
      if (prev && prev.startId === startId && prev.endId === endId) {
        setPreviousResult(prev);
      } else {
        setPreviousResult(null);
      }
      return next;
    });
    setIsDirty(false);
    setIsPlaying(false);
    setStepIndex(Math.max(0, next.events.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startId, waypointId, endId, objective, routeRunNonce]);

  useEffect(() => {
    setIsPlaying(false);
    setIsDirty(true);
  }, [graph.edges]);

  useEffect(() => {
    setIsDirty(false);
  }, [routeRunNonce]);

  useEffect(() => {
    if (!isPlaying || !showAlgoViz) return;
    const maxStep = Math.max(0, result.events.length - 1);
    if (stepIndex >= maxStep) {
      setIsPlaying(false);
      return;
    }
    const intervalMs = Math.max(90, Math.round(450 / playbackSpeed));
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
  }, [isPlaying, showAlgoViz, stepIndex, result.events.length, playbackSpeed]);

  const activeEvent = showAlgoViz
    ? result.events[Math.min(stepIndex, Math.max(0, result.events.length - 1))]
    : result.events[Math.max(0, result.events.length - 1)];

  const frontierSorted = useMemo(() => {
    if (!activeEvent) return [];
    return activeEvent.frontierIds
      .map((id) => ({
        id,
        label: nodeLabelMap[id] ?? id,
        cost: activeEvent.distances[id],
      }))
      .filter((item) => Number.isFinite(item.cost))
      .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
      .slice(0, 5);
  }, [activeEvent, nodeLabelMap]);

  const routeChangeExplanation = useMemo(() => {
    if (lastChangeReason) return lastChangeReason;
    if (!previousResult) return null;

    const prevPath = previousResult.pathEdgeIds.join(',');
    const nextPath = result.pathEdgeIds.join(',');

    if (previousResult.reachable && !result.reachable) {
      return 'Road closures severed all paths between start and destination, making the destination unreachable.';
    }
    if (!previousResult.reachable && result.reachable) {
      return 'Reopening road capacity restored a connected corridor to the destination.';
    }
    if (prevPath !== nextPath && result.reachable) {
      const prevEdgesAffected = previousResult.pathEdgeIds
        .map((id) => graph.edges.find((e) => e.id === id))
        .filter((e): e is RoadEdge => Boolean(e && (e.closed || e.trafficMultiplier > 1.0)));

      if (prevEdgesAffected.length > 0) {
        const cause = prevEdgesAffected
          .map((e) =>
            e.closed
              ? `${e.roadName} was closed`
              : `${e.roadName} traffic increased to ${e.trafficMultiplier}×`
          )
          .join('; ');
        const deltaMin = (result.totalTimeMin - previousResult.totalTimeMin).toFixed(1);
        const deltaKm = (result.totalDistanceKm - previousResult.totalDistanceKm).toFixed(1);
        return `Route shifted because ${cause}. New optimal path: ${result.totalTimeMin.toFixed(1)} min (${Number(deltaMin) >= 0 ? `+${deltaMin}` : deltaMin} min) and ${result.totalDistanceKm.toFixed(1)} km (${Number(deltaKm) >= 0 ? `+${deltaKm}` : deltaKm} km).`;
      }
      if (previousResult.objective !== result.objective) {
        return result.objective === 'distance'
          ? `Switched to Shortest Distance: minimized physical length (${result.totalDistanceKm.toFixed(1)} km) even through slower local segments.`
          : `Switched to Fastest Time: prioritized clear expressways (${result.totalTimeMin.toFixed(1)} min) over shorter congested streets.`;
      }
    }
    return null;
  }, [lastChangeReason, previousResult, result, graph.edges]);

  const handleNodeClick = (node: CityNode) => {
    if (pickMode === 'start') {
      onChangeStartId(node.id);
      setPickMode('none');
    } else if (pickMode === 'waypoint') {
      setWaypointId(node.id);
      setPickMode('none');
    } else if (pickMode === 'end') {
      onChangeEndId(node.id);
      setPickMode('none');
    }
  };

  const handleTrafficSet = (edge: RoadEdge, level: TrafficLevel) => {
    setIsPlaying(false);
    onUpdateEdge(edge.id, { trafficMultiplier: TRAFFIC_MULTIPLIERS[level] });
  };

  const handleSaveScenario = () => {
    const trimmed = scenarioName.trim();
    if (!trimmed) return;
    const trafficByEdgeId: Record<string, number> = {};
    const closedByEdgeId: Record<string, boolean> = {};
    for (const e of graph.edges) {
      if (e.trafficMultiplier !== 1.0) trafficByEdgeId[e.id] = e.trafficMultiplier;
      if (e.closed) closedByEdgeId[e.id] = true;
    }
    const next = saveScenario({
      id: `scn-${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      trafficByEdgeId,
      closedByEdgeId,
    });
    setScenarios(next);
    setScenarioName('');
  };

  const handleLoadScenario = (scenario: SavedScenario) => {
    const fresh = createInitialDemoCity();
    onReplaceGraph({
      nodes: fresh.nodes,
      edges: fresh.edges.map((e) => ({
        ...e,
        trafficMultiplier: scenario.trafficByEdgeId[e.id] ?? e.trafficMultiplier,
        closed: scenario.closedByEdgeId[e.id] ?? false,
      })),
    });
    setShowScenarios(false);
  };

  const handleExportScenarioJson = () => {
    const payload = {
      name: 'RouteVerse Demo City Snapshot',
      exportedAt: new Date().toISOString(),
      startId,
      waypointId,
      endId,
      objective,
      modifiedEdges: graph.edges
        .filter((e) => e.closed || e.trafficMultiplier !== 1.0)
        .map((e) => ({
          id: e.id,
          roadName: e.roadName,
          trafficMultiplier: e.trafficMultiplier,
          closed: e.closed,
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'routeverse-scenario.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Mode Sub-Switcher + Scenario Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-800/80">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#15120F] border border-stone-800/90">
          <button
            type="button"
            onClick={() => onChangeNavMode('demo-city')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              navMode === 'demo-city'
                ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            Demo City (Dijkstra Visualizer)
          </button>
          <button
            type="button"
            onClick={() => onChangeNavMode('live-map')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              navMode === 'live-map'
                ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            Live Map (Google Maps & GPS)
          </button>
        </div>

        {navMode === 'demo-city' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-400">Presets:</span>
            <button
              type="button"
              onClick={() => onResetCity()}
              className="px-2.5 py-1 rounded-md bg-[#14110E] hover:bg-stone-800 border border-stone-800 text-stone-200 cursor-pointer transition-colors"
            >
              Baseline City
            </button>
            <button
              type="button"
              onClick={() => onReplaceGraph(createRushHourDemoCity())}
              className="px-2.5 py-1 rounded-md bg-orange-500/15 hover:bg-orange-500/25 border border-orange-400/45 text-orange-200 cursor-pointer transition-colors"
            >
              Rush Hour
            </button>
            <button
              type="button"
              onClick={() => onReplaceGraph(createBridgeMaintenanceDemoCity())}
              className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/45 text-rose-200 cursor-pointer transition-colors"
            >
              Bridge Closure
            </button>
          </div>
        ) : (
          <p className="text-xs text-stone-400">
            Real-world road-following routes supplied by Google Maps
          </p>
        )}
      </div>

      {navMode === 'live-map' ? (
        <LiveMapView onSwitchToDemoCity={() => onChangeNavMode('demo-city')} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Control & Telemetry Sidebar */}
          <div className="xl:col-span-4 space-y-4">
            {/* Route Planner Card */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-100">Route Planner</h2>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowScenarios((s) => !s)}
                    className="text-xs text-stone-300 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                    title="Saved local scenarios"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Scenarios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetCity();
                      setPreviousResult(null);
                    }}
                    className="text-xs text-stone-300 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {showScenarios && (
                <div className="p-3 rounded-lg bg-[#0D0B09] border border-stone-800/90 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="Save traffic/closures as…"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-[#15120F] border border-stone-700/80 rounded text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveScenario}
                      disabled={!scenarioName.trim()}
                      className="px-2.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-stone-950 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                  {scenarios.length === 0 ? (
                    <p className="text-[11px] text-stone-500">
                      No saved scenarios yet. Saved locally in this browser.
                    </p>
                  ) : (
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {scenarios.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[#15120F]"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadScenario(s)}
                            className="text-left text-stone-200 hover:text-amber-300 truncate flex-1 cursor-pointer"
                          >
                            {s.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => setScenarios(deleteScenario(s.id))}
                            className="text-stone-500 hover:text-rose-400 ml-2 cursor-pointer"
                            aria-label={`Delete scenario ${s.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={handleExportScenarioJson}
                    className="w-full py-1.5 px-2.5 rounded bg-[#15120F] hover:bg-stone-800 border border-stone-700/80 text-[11px] text-stone-300 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export Current Scenario JSON</span>
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                <SearchableNodeSelect
                  label="Start Junction"
                  nodes={graph.nodes}
                  value={startId}
                  onChange={onChangeStartId}
                  isPicking={pickMode === 'start'}
                  onTogglePick={() => setPickMode((p) => (p === 'start' ? 'none' : 'start'))}
                  accent="emerald"
                />

                {waypointId ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setWaypointId(null);
                          if (pickMode === 'waypoint') setPickMode('none');
                        }}
                        className="text-[11px] text-rose-300 hover:text-rose-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Remove Waypoint</span>
                      </button>
                    </div>
                    <SearchableNodeSelect
                      label="Intermediate Waypoint"
                      nodes={graph.nodes}
                      value={waypointId}
                      onChange={setWaypointId}
                      isPicking={pickMode === 'waypoint'}
                      onTogglePick={() =>
                        setPickMode((p) => (p === 'waypoint' ? 'none' : 'waypoint'))
                      }
                      accent="orange"
                    />
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  {!waypointId ? (
                    <button
                      type="button"
                      onClick={() => setWaypointId('J9')}
                      className="px-2.5 py-1 rounded bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-[11px] text-stone-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-amber-400" />
                      <span>Add Waypoint</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const prevStart = startId;
                      onChangeStartId(endId);
                      onChangeEndId(prevStart);
                    }}
                    className="px-2.5 py-1 rounded bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-[11px] text-stone-300 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-amber-400" />
                    <span>Swap</span>
                  </button>
                </div>

                <SearchableNodeSelect
                  label="Destination Junction"
                  nodes={graph.nodes}
                  value={endId}
                  onChange={onChangeEndId}
                  isPicking={pickMode === 'end'}
                  onTogglePick={() => setPickMode((p) => (p === 'end' ? 'none' : 'end'))}
                  accent="amber"
                />
              </div>

              {/* Objective Toggle */}
              <div>
                <span className="block text-xs font-medium text-stone-300 mb-1.5">
                  Optimization Objective
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0D0B09] border border-stone-800/85">
                  <button
                    type="button"
                    onClick={() => onChangeObjective('time')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      objective === 'time'
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-stone-950 font-semibold'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Fastest time
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeObjective('distance')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      objective === 'distance'
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-stone-950 font-semibold'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    Shortest distance
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => recalculate({ jumpToEnd: true })}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center gap-2 cursor-pointer ${
                    isDirty
                      ? 'bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-stone-950 shadow-[0_6px_18px_-4px_rgba(249,115,22,0.45)]'
                      : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 shadow-[0_6px_18px_-4px_rgba(245,158,11,0.4)]'
                  }`}
                >
                  <RouteIcon className="w-3.5 h-3.5" />
                  <span>{isDirty ? 'Recalculate After Changes' : 'Calculate Optimal Route'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAlgoViz((v) => !v)}
                  className="py-2.5 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-200 inline-flex items-center gap-1.5 cursor-pointer"
                  title="Toggle Dijkstra visualization"
                >
                  {showAlgoViz ? (
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span>Steps</span>
                </button>
              </div>
            </div>

            {/* Route Result Summary with Visual Corridor Graphics */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
              {result.reachable ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {result.identicalEndpoints
                          ? 'Same Junction (0 cost)'
                          : waypointId
                          ? `Optimal via ${waypointId}`
                          : `Optimal ${objective === 'time' ? 'Fastest' : 'Shortest'} Route`}
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono tabular-nums">
                      ~{result.computeTimeMs.toFixed(2)} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-800/80">
                    <div>
                      <div className="text-[11px] text-stone-400">Est. Time</div>
                      <div className="text-base font-semibold font-mono text-amber-300 tabular-nums">
                        {result.totalTimeMin.toFixed(1)} min
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Distance</div>
                      <div className="text-base font-semibold font-mono text-stone-100 tabular-nums">
                        {result.totalDistanceKm.toFixed(1)} km
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Explored</div>
                      <div className="text-base font-semibold font-mono text-amber-200 tabular-nums">
                        {result.visitedCount} / {graph.nodes.length}
                      </div>
                    </div>
                  </div>

                  {/* Visual Node Exploration Progress Gauge */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((result.visitedCount / Math.max(1, graph.nodes.length)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span>Search expansion coverage</span>
                      <span>
                        {Math.round((result.visitedCount / Math.max(1, graph.nodes.length)) * 100)}%
                      </span>
                    </div>
                  </div>

                  {alternateObjectiveResult.reachable &&
                    alternateObjectiveResult.pathNodeIds.join(',') !==
                      result.pathNodeIds.join(',') && (
                      <div className="text-[11px] text-stone-300 bg-[#0D0B09] border border-stone-800/80 rounded-lg px-2.5 py-2">
                        {objective === 'time' ? 'Shortest distance alt: ' : 'Fastest time alt: '}
                        <span className="font-mono text-amber-200 tabular-nums">
                          {alternateObjectiveResult.totalDistanceKm.toFixed(1)} km ·{' '}
                          {alternateObjectiveResult.totalTimeMin.toFixed(1)} min
                        </span>
                      </div>
                    )}

                  {/* Visual Hop Chain Schematic */}
                  <div className="text-xs text-stone-300 border-t border-stone-800/80 pt-2.5 space-y-1.5">
                    <span className="text-stone-400 block">
                      Route Sequence ({result.pathNodeIds.length} junctions)
                    </span>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                      {result.pathNodeIds.map((id, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === result.pathNodeIds.length - 1;
                        return (
                          <React.Fragment key={`${id}-${idx}`}>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${
                                isFirst
                                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                  : isLast
                                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                  : 'bg-[#0D0B09] border-stone-700/80 text-stone-200'
                              }`}
                              title={nodeLabelMap[id] ?? id}
                            >
                              {id}
                            </span>
                            {!isLast && <span className="text-amber-400/80">→</span>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clickable Turn-by-Turn Route Segments */}
                  {result.pathEdgeIds.length > 0 && (
                    <div className="border-t border-stone-800/80 pt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span>Turn-by-Turn Legs</span>
                        <span className="font-mono text-stone-500">Click leg to inspect</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto divide-y divide-stone-800/60 rounded-lg bg-[#0D0B09] border border-stone-800/85">
                        {result.pathEdgeIds.map((edgeId, idx) => {
                          const edge = graph.edges.find((e) => e.id === edgeId);
                          if (!edge) return null;
                          const effMin = getEdgeEffectiveTime(edge);
                          const isSelected = selectedEdgeId === edge.id;
                          return (
                            <button
                              key={edge.id}
                              type="button"
                              onClick={() => onSelectEdgeId(edge.id)}
                              className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 text-[11px] transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/15 text-amber-100'
                                  : 'hover:bg-stone-900/75 text-stone-300'
                              }`}
                            >
                              <div className="min-w-0 flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-stone-500 tabular-nums w-4 shrink-0">
                                  {idx + 1}.
                                </span>
                                <span className="truncate font-medium">{edge.roadName}</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums shrink-0">
                                {edge.trafficMultiplier > 1.05 && (
                                  <span className="text-orange-300">{edge.trafficMultiplier}×</span>
                                )}
                                <span className="text-stone-400">{edge.distanceKm.toFixed(1)}km</span>
                                <span className="text-amber-300 font-semibold">
                                  {effMin.toFixed(1)}m
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Destination Unreachable</span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{result.reason}</p>
                </div>
              )}

              {routeChangeExplanation && (
                <div className="p-2.5 rounded-lg bg-amber-950/35 border border-amber-400/35 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{routeChangeExplanation}</span>
                </div>
              )}
            </div>

            {/* Dijkstra Visualization Playback + Live Min-Heap Frontier Inspector */}
            {showAlgoViz && (
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-stone-200">
                    Dijkstra’s Step Playback
                  </h3>
                  <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                    Step {Math.min(stepIndex + 1, result.events.length)} / {result.events.length}
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
                    aria-label="Reset playback to step 1"
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
                      if (stepIndex >= result.events.length - 1) setStepIndex(0);
                      setIsPlaying((p) => !p);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-400/20 to-orange-500/20 hover:from-amber-400/30 hover:to-orange-500/30 border border-amber-400/45 text-xs font-semibold text-amber-100 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Animate Search'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex((s) => Math.min(result.events.length - 1, s + 1));
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

                {activeEvent && (
                  <p className="text-xs text-stone-300 leading-relaxed bg-[#0D0B09] border border-stone-800/85 rounded-lg p-2.5">
                    {activeEvent.description}
                  </p>
                )}

                {/* Live Min-Heap Frontier State */}
                <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Priority Queue Frontier (Top 5)</span>
                    <span className="font-mono">{activeEvent?.frontierIds.length ?? 0} queued</span>
                  </div>
                  {frontierSorted.length === 0 ? (
                    <p className="text-[11px] text-stone-500">Queue settled or empty at this step.</p>
                  ) : (
                    <div className="divide-y divide-stone-800/70 rounded bg-[#0D0B09] border border-stone-800/85 px-2.5 py-1">
                      {frontierSorted.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between py-1 text-[11px] font-mono"
                        >
                          <span className="text-stone-200">
                            {f.id} · {f.label}
                          </span>
                          <span className="text-amber-300 tabular-nums">
                            {f.cost.toFixed(1)} {objective === 'distance' ? 'km' : 'min'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Road Inspector with Visual Traffic Load Meter */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-stone-200">Road Inspector</h3>
                {selectedEdge && (
                  <span className="text-[11px] font-mono text-amber-300">{selectedEdge.id}</span>
                )}
              </div>

              {!selectedEdge ? (
                <p className="text-xs text-stone-400">
                  Click any road segment on the city graph to adjust simulated traffic congestion or
                  close the road.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-stone-100">{selectedEdge.roadName}</div>
                      <div className="text-[11px] text-stone-400">
                        {selectedEdge.from} ({nodeLabelMap[selectedEdge.from]}) ↔ {selectedEdge.to} (
                        {nodeLabelMap[selectedEdge.to]})
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-stone-300 tabular-nums">
                      <div>{selectedEdge.distanceKm.toFixed(1)} km</div>
                      <div>
                        {selectedEdge.closed
                          ? 'CLOSED'
                          : `${getEdgeEffectiveTime(selectedEdge).toFixed(1)} min`}
                      </div>
                    </div>
                  </div>

                  {/* Live Congestion Load Graphic Gauge */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          selectedEdge.closed
                            ? 'bg-rose-500'
                            : selectedEdge.trafficMultiplier >= 2.5
                            ? 'bg-red-600'
                            : selectedEdge.trafficMultiplier >= 1.5
                            ? 'bg-orange-500'
                            : 'bg-emerald-400'
                        }`}
                        style={{
                          width: selectedEdge.closed
                            ? '100%'
                            : `${Math.min(100, Math.round((selectedEdge.trafficMultiplier / 3.5) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span>Corridor Load</span>
                      <span>
                        {selectedEdge.closed
                          ? 'BLOCKED'
                          : `${selectedEdge.trafficMultiplier.toFixed(1)}×`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] text-stone-400 mb-1.5">
                      Simulated Traffic Level
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(TRAFFIC_MULTIPLIERS) as TrafficLevel[]).map((lvl) => {
                        const active =
                          !selectedEdge.closed &&
                          Math.abs(selectedEdge.trafficMultiplier - TRAFFIC_MULTIPLIERS[lvl]) < 0.05;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleTrafficSet(selectedEdge, lvl)}
                            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-[#0D0B09] border-stone-800 text-stone-300 hover:border-stone-600'
                            }`}
                          >
                            {TRAFFIC_LABELS[lvl]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        onUpdateEdge(selectedEdge.id, { closed: !selectedEdge.closed });
                      }}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        selectedEdge.closed
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                          : 'bg-rose-500/15 border-rose-400/45 text-rose-200 hover:bg-rose-500/25'
                      }`}
                    >
                      {selectedEdge.closed ? 'Reopen Road' : 'Close Road (Simulate Incident)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Dominant Graph Canvas + Citywide Corridor Health Bar */}
          <div className="xl:col-span-8 space-y-2.5">
            {/* Compact Visual Corridor Health Distribution Strip */}
            <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#1B1713] to-[#12100D] border border-stone-800/90 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className="text-stone-300 font-semibold">City Corridor Health:</span>
                <span className="text-emerald-300">{trafficHealth.clear} clear</span>
                <span className="text-orange-300">{trafficHealth.congested} congested</span>
                <span className="text-rose-300">{trafficHealth.closed} closed</span>
              </div>
              <div className="flex-1 min-w-[160px] max-w-xs h-2 rounded-full bg-[#0D0B09] overflow-hidden flex border border-stone-800/80">
                <div
                  className="bg-emerald-400/85 h-full transition-all duration-300"
                  style={{ width: `${trafficHealth.clearPct}%` }}
                />
                <div
                  className="bg-orange-500 h-full transition-all duration-300"
                  style={{ width: `${trafficHealth.congestedPct}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${trafficHealth.closedPct}%` }}
                />
              </div>
            </div>

            <CityGraphCanvas
              graph={graph}
              mode="navigate"
              weightDisplay={objective === 'distance' ? 'distance' : 'time'}
              startNodeId={startId}
              endNodeId={endId}
              visitedNodeIds={activeEvent?.visitedIds ?? []}
              frontierNodeIds={activeEvent?.frontierIds ?? []}
              currentNodeId={waypointId ?? activeEvent?.currentNodeId ?? null}
              activeEdgeId={activeEvent?.activeEdgeId ?? null}
              treeEdgeIds={activeEvent?.treeEdgeIds ?? []}
              routeEdgeIds={
                !isDirty && (!showAlgoViz || stepIndex >= result.events.length - 1 || Boolean(waypointId))
                  ? result.pathEdgeIds
                  : activeEvent?.pathEdgeIds ?? []
              }
              routeNodeIds={
                !isDirty && (!showAlgoViz || stepIndex >= result.events.length - 1 || Boolean(waypointId))
                  ? result.pathNodeIds
                  : activeEvent?.pathNodeIds ?? []
              }
              selectedEdgeId={selectedEdgeId}
              pickMode={pickMode === 'waypoint' ? 'start' : pickMode}
              onNodeClick={handleNodeClick}
              onEdgeClick={(edge) => onSelectEdgeId(edge.id)}
              showGridCoordinates={showGridCoordinates}
            />
            {isDirty && (
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-950/40 border border-amber-400/45 text-xs text-amber-200 flex items-center justify-between gap-3">
                <span>
                  Road conditions changed. Click <strong>Recalculate After Changes</strong> to update
                  the optimal route.
                </span>
                <button
                  type="button"
                  onClick={() => recalculate({ jumpToEnd: true })}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 font-semibold whitespace-nowrap cursor-pointer"
                >
                  Recalculate Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
