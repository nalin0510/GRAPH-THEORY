import { useCallback, useEffect, useState } from 'react';
import { Menu, Play, X } from 'lucide-react';
import { AboutView } from './components/AboutView';
import { CompareView } from './components/CompareView';
import { GuidedDemoBar, GUIDED_DEMO_STEPS } from './components/GuidedDemoBar';
import { HomeView } from './components/HomeView';
import { NavigateWorkspace } from './components/NavigateWorkspace';
import { NetworkLabTab, NetworkLabWorkspace } from './components/NetworkLabWorkspace';
import { PlayWorkspace } from './components/PlayWorkspace';
import {
  createBridgeMaintenanceDemoCity,
  createInitialDemoCity,
  createRushHourDemoCity,
} from './data/demoCity';
import {
  AppSection,
  CityGraph,
  DifficultyLevel,
  DijkstraObjective,
  GameModeId,
  NavigateMode,
  RoadEdge,
} from './types/graph';
import { loadSettings, saveSettings } from './utils/storage';

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'navigate', label: 'Navigate' },
  { id: 'network-lab', label: 'Network Lab' },
  { id: 'play', label: 'Play' },
  { id: 'compare', label: 'Compare' },
];

export default function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [section, setSection] = useState<AppSection>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Quota banner state for auto-provisioned Google Maps key
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Shared Demo City Graph state
  const [graph, setGraph] = useState<CityGraph>(() => createInitialDemoCity());
  const [startId, setStartId] = useState('J1');
  const [endId, setEndId] = useState('J22');
  const [objective, setObjective] = useState<DijkstraObjective>('time');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [navMode, setNavMode] = useState<NavigateMode>('demo-city');
  const [routeRunNonce, setRouteRunNonce] = useState(0);
  const [lastChangeReason, setLastChangeReason] = useState<string | null>(null);

  // Network Lab state
  const [labTab, setLabTab] = useState<NetworkLabTab>('prim');
  const [primStartNodeId, setPrimStartNodeId] = useState('J1');
  const [topologyMode, setTopologyMode] = useState<'connected' | 'disconnected'>('connected');

  // Play state
  const [activeGame, setActiveGame] = useState<GameModeId>('beat-traffic');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy');
  const [playAutoStartNonce, setPlayAutoStartNonce] = useState(0);

  // Guided Competition Demo state
  const [demoStepIndex, setDemoStepIndex] = useState<number | null>(null);

  const updateSettings = (patch: Partial<typeof settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleUpdateEdge = useCallback(
    (edgeId: string, patch: Partial<Pick<RoadEdge, 'trafficMultiplier' | 'closed'>>) => {
      setLastChangeReason(null);
      setGraph((prev) => ({
        ...prev,
        edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
      }));
    },
    []
  );

  const handleResetCity = useCallback(() => {
    setGraph(createInitialDemoCity());
    setSelectedEdgeId(null);
    setLastChangeReason(null);
    setRouteRunNonce((n) => n + 1);
  }, []);

  const handleHomeNavigate = useCallback(
    (
      targetSection: AppSection,
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
    ) => {
      setSection(targetSection);
      setMobileMenuOpen(false);
      if (!opts) return;

      if (opts.preset === 'baseline') {
        setGraph(createInitialDemoCity());
        setLastChangeReason(null);
      } else if (opts.preset === 'rush-hour') {
        setGraph(createRushHourDemoCity());
        setLastChangeReason('Loaded Morning Rush Hour preset with heavy downtown & arterial congestion.');
      } else if (opts.preset === 'bridge-cut') {
        setGraph(createBridgeMaintenanceDemoCity());
        setLastChangeReason('Loaded Bridge Maintenance preset closing E16 and North Locks Bridge (E28).');
      }

      if (opts.navMode) setNavMode(opts.navMode);
      if (opts.startId) setStartId(opts.startId);
      if (opts.endId) setEndId(opts.endId);
      if (opts.objective) setObjective(opts.objective);
      if (opts.labTab) setLabTab(opts.labTab);
      if (opts.topology) setTopologyMode(opts.topology);
      if (opts.game) setActiveGame(opts.game);
      if (opts.difficulty) setDifficulty(opts.difficulty);
      setRouteRunNonce((n) => n + 1);
    },
    []
  );

  const applyGuidedDemoStep = useCallback((idx: number) => {
    setDemoStepIndex(idx);
    setMobileMenuOpen(false);

    if (idx === 0) {
      setSection('navigate');
      setNavMode('demo-city');
      setGraph(createInitialDemoCity());
      setStartId('J1');
      setEndId('J22');
      setObjective('time');
      setSelectedEdgeId(null);
      setLastChangeReason(null);
      setRouteRunNonce((n) => n + 1);
    } else if (idx === 1) {
      setSection('navigate');
      setNavMode('demo-city');
      const fresh = createInitialDemoCity();
      setGraph({
        nodes: fresh.nodes,
        edges: fresh.edges.map((e) => (e.id === 'E16' ? { ...e, trafficMultiplier: 3.5 } : e)),
      });
      setStartId('J1');
      setEndId('J22');
      setObjective('time');
      setSelectedEdgeId('E16');
      setLastChangeReason(null);
    } else if (idx === 2) {
      setSection('navigate');
      setNavMode('demo-city');
      const fresh = createInitialDemoCity();
      setGraph({
        nodes: fresh.nodes,
        edges: fresh.edges.map((e) => (e.id === 'E16' ? { ...e, trafficMultiplier: 3.5 } : e)),
      });
      setStartId('J1');
      setEndId('J22');
      setObjective('time');
      setSelectedEdgeId('E16');
      setLastChangeReason(
        'Gridlock (3.5×) on Ridge Expressway (E16) raised the northern corridor above 19.0 min, shifting Dijkstra’s fastest route onto the southern expressway via South Metro Bridge (E30).'
      );
      setRouteRunNonce((n) => n + 1);
    } else if (idx === 3) {
      setSection('network-lab');
      setTopologyMode('connected');
      setPrimStartNodeId('J1');
      setLabTab('prim');
    } else if (idx === 4) {
      setSection('network-lab');
      setTopologyMode('connected');
      setPrimStartNodeId('J1');
      setLabTab('compare');
    } else if (idx === 5) {
      setSection('play');
      setActiveGame('beat-traffic');
      setDifficulty('easy');
      setPlayAutoStartNonce((n) => n + 1);
    }
  }, []);

  const handleStartGuidedDemo = () => {
    applyGuidedDemoStep(0);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0A0908] text-stone-100">
      {/* Subtle Architectural Backdrop for Inner Workspaces */}
      {section !== 'home' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          <div className="absolute inset-0 atlas-backdrop-grid opacity-55" />
          <div className="absolute -top-44 left-1/4 w-[620px] h-[420px] rounded-full bg-amber-500/[0.065] blur-3xl" />
          <div className="absolute top-1/3 -right-24 w-[520px] h-[420px] rounded-full bg-orange-500/[0.05] blur-3xl" />
          <div className="absolute -bottom-36 left-1/3 w-[560px] h-[360px] rounded-full bg-emerald-500/[0.04] blur-3xl" />
        </div>
      )}

      {/* Quota Exceeded Banner (for auto-provisioned Maps demo key) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Single-Row Top Bar (Rendered inside the application workspaces, keeping Home as a separate full-3D landing view) */}
      {section !== 'home' && (
      <header className="border-b border-stone-800/90 bg-[#100E0C]/92 backdrop-blur-md sticky top-0 z-30 shadow-[0_6px_30px_-14px_rgba(0,0,0,0.9)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setSection('home')}
            className="text-lg font-display font-bold tracking-tight bg-gradient-to-r from-stone-50 via-amber-200 to-amber-400 bg-clip-text text-transparent whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 rounded"
          >
            RouteVerse
          </button>

          {/* Zone 2: Concise Single-line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'text-amber-300 border-amber-400'
                      : 'text-stone-300 hover:text-white border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartGuidedDemo}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 text-xs font-semibold transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer shadow-[0_4px_18px_-4px_rgba(245,158,11,0.45)]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{demoStepIndex !== null ? 'Restart Guided Demo' : 'Start Guided Demo'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <nav
            className="md:hidden px-4 pb-3 pt-1 border-t border-stone-800/90 flex flex-wrap gap-2 bg-[#100E0C]"
            aria-label="Mobile Navigation"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  section === item.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                    : 'text-stone-300 hover:bg-stone-800/80'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>
      )}

      {/* Main Content Stage */}
      <main
        className={
          section === 'home'
            ? 'relative z-10 flex-1 w-full'
            : 'relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-5'
        }
      >
        {section === 'home' && (
          <HomeView
            graph={graph}
            onNavigateTo={handleHomeNavigate}
            onStartGuidedDemo={handleStartGuidedDemo}
          />
        )}

        {section === 'navigate' && (
          <NavigateWorkspace
            graph={graph}
            onUpdateEdge={handleUpdateEdge}
            onReplaceGraph={(g) => {
              setLastChangeReason(null);
              setGraph(g);
            }}
            onResetCity={handleResetCity}
            startId={startId}
            endId={endId}
            onChangeStartId={setStartId}
            onChangeEndId={setEndId}
            objective={objective}
            onChangeObjective={setObjective}
            selectedEdgeId={selectedEdgeId}
            onSelectEdgeId={setSelectedEdgeId}
            navMode={navMode}
            onChangeNavMode={setNavMode}
            playbackSpeed={settings.playbackSpeed}
            onChangePlaybackSpeed={(speed) => updateSettings({ playbackSpeed: speed })}
            showGridCoordinates={settings.showGridCoordinates}
            routeRunNonce={routeRunNonce}
            lastChangeReason={lastChangeReason}
          />
        )}

        {section === 'network-lab' && (
          <NetworkLabWorkspace
            activeTab={labTab}
            onChangeTab={setLabTab}
            primStartNodeId={primStartNodeId}
            onChangePrimStartNodeId={setPrimStartNodeId}
            topologyMode={topologyMode}
            onChangeTopologyMode={setTopologyMode}
            playbackSpeed={settings.playbackSpeed}
            onChangePlaybackSpeed={(speed) => updateSettings({ playbackSpeed: speed })}
            showGridCoordinates={settings.showGridCoordinates}
          />
        )}

        {section === 'play' && (
          <PlayWorkspace
            activeGame={activeGame}
            onChangeGame={setActiveGame}
            difficulty={difficulty}
            onChangeDifficulty={setDifficulty}
            timerEnabled={settings.timerEnabled}
            onToggleTimer={(enabled) => updateSettings({ timerEnabled: enabled })}
            showGridCoordinates={settings.showGridCoordinates}
            autoStartNonce={playAutoStartNonce}
          />
        )}

        {section === 'compare' && (
          <CompareView graph={graph} startId={startId} endId={endId} />
        )}

        {section === 'about' && <AboutView onStartDemo={handleStartGuidedDemo} />}
      </main>

      {/* Guided Competition Demo Controller */}
      {demoStepIndex !== null && (
        <GuidedDemoBar
          activeStepIndex={demoStepIndex}
          onPrev={() => applyGuidedDemoStep(Math.max(0, demoStepIndex - 1))}
          onNext={() =>
            applyGuidedDemoStep(Math.min(GUIDED_DEMO_STEPS.length - 1, demoStepIndex + 1))
          }
          onRestart={() => applyGuidedDemoStep(0)}
          onExit={() => setDemoStepIndex(null)}
        />
      )}
    </div>
  );
}
