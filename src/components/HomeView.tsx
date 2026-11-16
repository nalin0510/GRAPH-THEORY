import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  GitBranch,
  Info,
  MapPin,
  Orbit,
  Play,
  Route as RouteIcon,
} from 'lucide-react';
import { runDijkstra } from '../algorithms/dijkstra';
import { runPrim } from '../algorithms/prim';
import {
  AppSection,
  CityGraph,
  CityNode,
  DifficultyLevel,
  DijkstraObjective,
  GameModeId,
  NavigateMode,
} from '../types/graph';
import { CameraPreset, HeroThreeScene, SceneMode } from './HeroThreeScene';
import { NetworkLabTab } from './NetworkLabWorkspace';

interface HomeViewProps {
  graph: CityGraph;
  onNavigateTo: (
    section: AppSection,
    opts?: {
      navMode?: NavigateMode;
      startId?: string;
      endId?: string;
      objective?: DijkstraObjective;
      labTab?: NetworkLabTab;
      topology?: 'connected' | 'disconnected';
      game?: GameModeId;
      difficulty?: DifficultyLevel;
      preset?: 'baseline' | 'rush-hour' | 'bridge-cut';
    }
  ) => void;
  onStartGuidedDemo: () => void;
}

const SCENE_MODE_OPTIONS: { id: SceneMode; label: string }[] = [
  { id: 'dijkstra-north', label: 'Dijkstra Fastest (J1→J22)' },
  { id: 'prim-mst', label: 'Prim Fiber MST' },
  { id: 'dijkstra-south', label: 'Cross-River (J5→J18)' },
];

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'aerial', label: 'Aerial' },
  { id: 'harbor', label: 'Harbor' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'top', label: 'Top-Down' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  graph,
  onNavigateTo,
  onStartGuidedDemo,
}) => {
  const [sceneMode, setSceneMode] = useState<SceneMode>('dijkstra-north');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('aerial');
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [rushHour, setRushHour] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CityNode | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const liveSceneMetric = useMemo(() => {
    const heavyIds = new Set(['E05', 'E16', 'E19', 'E20', 'E29', 'E33']);
    const gridlockIds = new Set(['E10', 'E23']);
    const activeGraph: CityGraph = rushHour
      ? {
          nodes: graph.nodes,
          edges: graph.edges.map((e) => ({
            ...e,
            trafficMultiplier: gridlockIds.has(e.id)
              ? 3.5
              : heavyIds.has(e.id)
              ? 2.8
              : e.trafficMultiplier,
          })),
        }
      : graph;

    if (sceneMode === 'prim-mst') {
      const prim = runPrim(activeGraph, 'J1', { recordEvents: false });
      return `${prim.treeEdgeIds.length} corridors · $${prim.totalCost}M total build`;
    }
    const sId = sceneMode === 'dijkstra-south' ? 'J5' : 'J1';
    const eId = sceneMode === 'dijkstra-south' ? 'J18' : 'J22';
    const d = runDijkstra(activeGraph, sId, eId, 'time', { recordEvents: false });
    return `${d.totalTimeMin.toFixed(1)} min · ${d.totalDistanceKm.toFixed(1)} km · ${d.pathNodeIds.length} hops`;
  }, [graph, sceneMode, rushHour]);

  const selectedNodeRoute = useMemo(() => {
    if (!selectedNode || selectedNode.id === 'J1') return null;
    return runDijkstra(graph, 'J1', selectedNode.id, 'time', { recordEvents: false });
  }, [graph, selectedNode]);

  // Keyboard shortcut 'H' toggles HUD controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0A0908] select-none">
      {/* 1. Full-Viewport Isolated WebGL 3D Scene */}
      <div className="absolute inset-0 z-0">
        <HeroThreeScene
          graph={graph}
          sceneMode={sceneMode}
          cameraPreset={cameraPreset}
          autoOrbit={autoOrbit}
          rushHour={rushHour}
          selectedNodeId={selectedNode?.id ?? null}
          onSelectNode={setSelectedNode}
        />
      </div>

      {/* Subtle Radial Center Contrast Vignette for Bold Centered Wordmark */}
      {!zenMode && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_42%,rgba(10,9,8,0.64)_0%,rgba(10,9,8,0.24)_48%,transparent_78%)]"
        />
      )}

      {/* Subtle Selected-Junction Bar at Top-Center if User Clicks a 3D Beacon */}
      {selectedNode && !zenMode && (
        <div className="pointer-events-none absolute top-5 inset-x-0 z-20 flex justify-center px-4">
          <div className="pointer-events-auto px-4 py-2 rounded-lg bg-[#14110E]/95 border border-amber-400/55 flex flex-wrap items-center gap-3 text-xs font-mono text-amber-200">
            <span>
              {selectedNode.id} · {selectedNode.label} ({selectedNode.district})
            </span>
            {selectedNodeRoute && selectedNodeRoute.reachable && (
              <span className="text-stone-300 tabular-nums">
                J1→{selectedNode.id}: {selectedNodeRoute.totalTimeMin.toFixed(1)}m ·{' '}
                {selectedNodeRoute.totalDistanceKm.toFixed(1)}km
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                onNavigateTo('navigate', {
                  navMode: 'demo-city',
                  endId: selectedNode.id === 'J1' ? 'J22' : selectedNode.id,
                  preset: rushHour ? 'rush-hour' : 'baseline',
                })
              }
              className="text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Route to junction →
            </button>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-stone-400 hover:text-stone-200 cursor-pointer"
              aria-label="Clear selection"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 2. Bold, Big Centered Application Name & Primary Entry Actions */}
      {!zenMode && (
        <section
          aria-label="RouteVerse 3D Introduction"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 pb-28"
        >
          <div className="max-w-3xl space-y-4">
            <p className="text-[11px] md:text-xs font-mono uppercase tracking-[0.28em] text-amber-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              Graph Theory · Navigation · Strategy
            </p>

            <h1
              className="font-display font-extrabold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-stone-50 via-amber-200 to-amber-500 drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)]"
              style={{ fontSize: 'clamp(3.4rem, 9vw, 6.75rem)' }}
            >
              RouteVerse
            </h1>

            <p className="text-sm md:text-lg text-stone-200 font-medium tracking-wide max-w-xl mx-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
              Navigate smarter. Connect better. Master the graph.
            </p>

            <div className="pointer-events-auto pt-3 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onNavigateTo('navigate', {
                    navMode: 'demo-city',
                    preset: rushHour ? 'rush-hour' : 'baseline',
                  })
                }
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 text-sm md:text-base font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-[0_10px_32px_-6px_rgba(245,158,11,0.55)]"
              >
                <span>Enter Application</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onStartGuidedDemo}
                className="px-5 py-3.5 rounded-xl bg-[#15120F]/95 hover:bg-stone-800/90 border border-amber-800/60 text-stone-100 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4 text-amber-400 fill-current" />
                <span>Start Guided Demo</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1020px,94vw)] flex flex-col items-center">
        <div className="pointer-events-auto mb-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="px-3 py-1 rounded-t-lg bg-[#15120F]/95 border border-b-0 border-stone-800 text-[11px] font-mono text-stone-300 hover:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Toggle Controls (H)"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setZenMode((v) => !v)}
            className="px-2.5 py-1 rounded-t-lg bg-[#15120F]/95 border border-b-0 border-stone-800 text-[11px] font-mono text-stone-300 hover:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Toggle pure 3D view"
          >
            {zenMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Title</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                <span>Pure 3D</span>
              </>
            )}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full rounded-xl bg-[#15120F]/95 border border-stone-800 p-3 space-y-2.5 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.95)]">
            {/* Row 1: 3D Simulation Modes, Rush Hour Sim & Camera Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-800/90">
              <div className="flex flex-wrap items-center gap-1">
                {SCENE_MODE_OPTIONS.map((opt) => {
                  const active = sceneMode === opt.id;
                  const isMst = opt.id === 'prim-mst';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSceneMode(opt.id)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? isMst
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-stone-950 font-semibold'
                            : 'bg-gradient-to-r from-amber-400 to-orange-300 text-stone-950 font-semibold'
                          : 'bg-[#0D0B09] text-stone-300 hover:text-white border border-stone-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setRushHour((v) => !v)}
                  disabled={sceneMode === 'prim-mst'}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
                    rushHour && sceneMode !== 'prim-mst'
                      ? 'bg-orange-500/20 text-orange-200 border border-orange-400/55'
                      : 'bg-[#0D0B09] text-stone-300 hover:text-orange-200 border border-stone-800'
                  }`}
                  title="Simulate 3D rush-hour traffic rerouting"
                >
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>{rushHour ? 'Rush Hour On' : 'Rush Hour Sim'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {CAMERA_OPTIONS.map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className={`px-2 py-1.5 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                      cameraPreset === cam.id
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                        : 'bg-[#0D0B09] text-stone-400 hover:text-stone-200 border border-stone-800'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setAutoOrbit((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    autoOrbit
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/45'
                      : 'bg-[#0D0B09] text-stone-400 border border-stone-800'
                  }`}
                >
                  <Orbit className="w-3 h-3" />
                  <span>{autoOrbit ? 'Orbit On' : 'Orbit Off'}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Live Computed Readout + Inner Application Workspaces Menu */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-amber-200/90 tabular-nums">
                {liveSceneMetric}
              </span>

              <nav
                className="flex flex-wrap items-center gap-1.5"
                aria-label="Enter Application Workspaces"
              >
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTo('navigate', {
                      navMode: 'demo-city',
                      preset: rushHour ? 'rush-hour' : 'baseline',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-amber-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RouteIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Navigate</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTo('navigate', { navMode: 'live-map' })}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-stone-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Live Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTo('network-lab', { labTab: 'prim' })}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Network Lab</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTo('play', { game: 'beat-traffic' })}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-orange-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Play</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTo('compare')}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-purple-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  <span>Compare</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTo('about')}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-stone-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-stone-400" />
                  <span>About</span>
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
