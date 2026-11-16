import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Play,
  RotateCcw,
  ShieldAlert,
  Trophy,
  Undo2,
  XCircle,
} from 'lucide-react';
import { DisjointSet } from '../algorithms/disjointSet';
import { getEdgeEffectiveTime, runDijkstra } from '../algorithms/dijkstra';
import { runPrim } from '../algorithms/prim';
import {
  BEAT_TRAFFIC_LEVELS,
  buildBeatTrafficGraph,
  buildSubgraphForNodes,
  computeBeatTrafficScore,
  computeMSTGameScore,
  computeRouteMetrics,
  evaluateKruskalDecision,
  evaluatePrimMove,
  MST_CHALLENGE_LEVELS,
} from '../data/gameLevels';
import { CityGraph, CityNode, DifficultyLevel, GameModeId, RoadEdge } from '../types/graph';
import { GameScoreMap, loadGameScores, makeScoreKey, saveGameScoreIfBest } from '../utils/storage';
import { CityGraphCanvas } from './CityGraphCanvas';

interface PlayWorkspaceProps {
  activeGame: GameModeId;
  onChangeGame: (game: GameModeId) => void;
  difficulty: DifficultyLevel;
  onChangeDifficulty: (diff: DifficultyLevel) => void;
  timerEnabled: boolean;
  onToggleTimer: (enabled: boolean) => void;
  showGridCoordinates: boolean;
  autoStartNonce?: number;
}

type Phase = 'rules' | 'playing' | 'results';

export const PlayWorkspace: React.FC<PlayWorkspaceProps> = ({
  activeGame,
  onChangeGame,
  difficulty,
  onChangeDifficulty,
  timerEnabled,
  onToggleTimer,
  showGridCoordinates,
  autoStartNonce = 0,
}) => {
  const [phase, setPhase] = useState<Phase>('rules');
  const [scores, setScores] = useState<GameScoreMap>(() => loadGameScores());
  const [isNewBest, setIsNewBest] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintEdgeIds, setHintEdgeIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'info' | 'good' | 'bad'; text: string } | null>(null);

  // Beat the Traffic state
  const [btNodePath, setBtNodePath] = useState<string[]>([]);
  const [btReplayOptimal, setBtReplayOptimal] = useState(false);

  // Prim's Builder state
  const [primTreeNodes, setPrimTreeNodes] = useState<string[]>([]);
  const [primEdgeIds, setPrimEdgeIds] = useState<string[]>([]);
  const [primCost, setPrimCost] = useState(0);
  const [primMistakes, setPrimMistakes] = useState(0);
  const [primHintsAlwaysOn, setPrimHintsAlwaysOn] = useState(false);

  // Kruskal's Architect state
  const [kruskalEdgeIdx, setKruskalEdgeIdx] = useState(0);
  const [kruskalAcceptedIds, setKruskalAcceptedIds] = useState<string[]>([]);
  const [kruskalRejectedIds, setKruskalRejectedIds] = useState<string[]>([]);
  const [kruskalCost, setKruskalCost] = useState(0);
  const [kruskalMistakes, setKruskalMistakes] = useState(0);
  const [kruskalDsuState, setKruskalDsuState] = useState<Record<string, string>>({});

  const btLevel = useMemo(
    () => BEAT_TRAFFIC_LEVELS.find((l) => l.difficulty === difficulty) ?? BEAT_TRAFFIC_LEVELS[0],
    [difficulty]
  );

  const mstLevel = useMemo(
    () => MST_CHALLENGE_LEVELS.find((l) => l.difficulty === difficulty) ?? MST_CHALLENGE_LEVELS[0],
    [difficulty]
  );

  const activeGraph: CityGraph = useMemo(() => {
    if (activeGame === 'beat-traffic') {
      return buildBeatTrafficGraph(btLevel);
    }
    return buildSubgraphForNodes(mstLevel.nodeIds);
  }, [activeGame, btLevel, mstLevel]);

  const btOptimal = useMemo(() => {
    if (activeGame !== 'beat-traffic') return null;
    return runDijkstra(activeGraph, btLevel.startId, btLevel.endId, 'time', { recordEvents: false });
  }, [activeGame, activeGraph, btLevel]);

  const mstOptimal = useMemo(() => {
    if (activeGame === 'beat-traffic') return null;
    return runPrim(activeGraph, mstLevel.startNodeId, { recordEvents: false });
  }, [activeGame, activeGraph, mstLevel]);

  const sortedKruskalEdges = useMemo(() => {
    return [...activeGraph.edges].sort(
      (a, b) => a.constructionCost - b.constructionCost || a.id.localeCompare(b.id)
    );
  }, [activeGraph.edges]);

  const resetAndStartGame = (startImmediately = true) => {
    setElapsedSec(0);
    setHintsUsed(0);
    setHintEdgeIds([]);
    setIsNewBest(false);
    setBtReplayOptimal(false);
    setFeedback(null);

    if (activeGame === 'beat-traffic') {
      setBtNodePath([btLevel.startId]);
    } else if (activeGame === 'prims-builder') {
      setPrimTreeNodes([mstLevel.startNodeId]);
      setPrimEdgeIds([]);
      setPrimCost(0);
      setPrimMistakes(0);
    } else {
      const dsu = new DisjointSet(mstLevel.nodeIds);
      setKruskalEdgeIdx(0);
      setKruskalAcceptedIds([]);
      setKruskalRejectedIds([]);
      setKruskalCost(0);
      setKruskalMistakes(0);
      setKruskalDsuState(dsu.getComponentMap());
    }

    setPhase(startImmediately ? 'playing' : 'rules');
  };

  // Reset to rules screen when game or difficulty changes
  useEffect(() => {
    resetAndStartGame(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame, difficulty]);

  // Guided demo jump-start trigger
  useEffect(() => {
    if (autoStartNonce > 0) {
      resetAndStartGame(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartNonce]);

  // Optional timer tick
  useEffect(() => {
    if (phase !== 'playing' || !timerEnabled) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, timerEnabled]);

  // Live DSU helper reconstructed from accepted edges for Kruskal's Architect
  const currentKruskalDsu = useMemo(() => {
    const dsu = new DisjointSet(mstLevel.nodeIds);
    for (const eid of kruskalAcceptedIds) {
      const e = activeGraph.edges.find((edge) => edge.id === eid);
      if (e) dsu.union(e.from, e.to);
    }
    return dsu;
  }, [mstLevel.nodeIds, kruskalAcceptedIds, activeGraph.edges]);

  // Beat the Traffic metrics
  const btMetrics = useMemo(() => {
    if (activeGame !== 'beat-traffic') return { edgeIds: [], distanceKm: 0, timeMin: 0 };
    return computeRouteMetrics(activeGraph, btNodePath);
  }, [activeGame, activeGraph, btNodePath]);

  const btScoreData = useMemo(() => {
    if (!btOptimal) return null;
    return computeBeatTrafficScore({
      playerTimeMin: btMetrics.timeMin,
      optimalTimeMin: btOptimal.totalTimeMin,
      hintsUsed,
    });
  }, [btOptimal, btMetrics.timeMin, hintsUsed]);

  const mstScoreData = useMemo(() => {
    if (!mstOptimal) return null;
    const playerCost = activeGame === 'prims-builder' ? primCost : kruskalCost;
    const mistakes = activeGame === 'prims-builder' ? primMistakes : kruskalMistakes;
    return computeMSTGameScore({
      playerTotalCost: playerCost,
      optimalTotalCost: mstOptimal.totalCost,
      mistakes,
      hintsUsed,
      hintPenaltyEach: activeGame === 'prims-builder' ? 75 : 60,
    });
  }, [
    mstOptimal,
    activeGame,
    primCost,
    kruskalCost,
    primMistakes,
    kruskalMistakes,
    hintsUsed,
  ]);

  // Handlers for Beat the Traffic
  const handleBeatTrafficStep = (nextNodeId: string) => {
    if (phase !== 'playing') return;
    const currNodeId = btNodePath[btNodePath.length - 1];
    if (nextNodeId === currNodeId) return;

    // Prevent loops back into already visited node except via Undo
    if (btNodePath.includes(nextNodeId)) {
      setFeedback({
        kind: 'bad',
        text: `Junction ${nextNodeId} is already in your route. Use Undo to step back.`,
      });
      return;
    }

    const connectingEdge = activeGraph.edges.find(
      (e) =>
        (e.from === currNodeId && e.to === nextNodeId) ||
        (e.to === currNodeId && e.from === nextNodeId)
    );

    if (!connectingEdge) {
      setFeedback({
        kind: 'bad',
        text: `No direct road connects ${currNodeId} to ${nextNodeId}. Select an adjacent road or junction.`,
      });
      return;
    }
    if (connectingEdge.closed) {
      setFeedback({
        kind: 'bad',
        text: `${connectingEdge.roadName} is closed! Pick an open detour.`,
      });
      return;
    }

    const nextPath = [...btNodePath, nextNodeId];
    setBtNodePath(nextPath);
    setHintEdgeIds([]);
    setFeedback({
      kind: 'good',
      text: `Took ${connectingEdge.roadName} (+${getEdgeEffectiveTime(connectingEdge).toFixed(1)} min).`,
    });

    if (nextNodeId === btLevel.endId && btOptimal) {
      const finalMetrics = computeRouteMetrics(activeGraph, nextPath);
      const scored = computeBeatTrafficScore({
        playerTimeMin: finalMetrics.timeMin,
        optimalTimeMin: btOptimal.totalTimeMin,
        hintsUsed,
      });
      const saved = saveGameScoreIfBest(
        'beat-traffic',
        difficulty,
        scored.score,
        `${finalMetrics.timeMin.toFixed(1)} min vs ${btOptimal.totalTimeMin.toFixed(1)} min optimal`
      );
      setScores(saved.scores);
      setIsNewBest(saved.isNewBest);
      setPhase('results');
    }
  };

  const handleBeatTrafficEdgeClick = (edge: RoadEdge) => {
    if (phase !== 'playing') return;
    const currNodeId = btNodePath[btNodePath.length - 1];
    if (edge.from === currNodeId) {
      handleBeatTrafficStep(edge.to);
    } else if (edge.to === currNodeId) {
      handleBeatTrafficStep(edge.from);
    } else {
      setFeedback({
        kind: 'bad',
        text: `${edge.roadName} does not connect to your current junction (${currNodeId}).`,
      });
    }
  };

  // Handler for Prim's Builder
  const handlePrimEdgeClick = (edge: RoadEdge) => {
    if (phase !== 'playing') return;
    const treeSet = new Set(primTreeNodes);
    const evalRes = evaluatePrimMove({
      graph: activeGraph,
      treeNodes: treeSet,
      selectedEdgeId: edge.id,
    });

    if (!evalRes.valid || !evalRes.newNodeId) {
      setPrimMistakes((m) => m + 1);
      setFeedback({ kind: 'bad', text: evalRes.feedback });
      return;
    }

    const nextNodes = [...primTreeNodes, evalRes.newNodeId];
    const nextEdges = [...primEdgeIds, edge.id];
    const nextCost = primCost + edge.constructionCost;
    const nextMistakes = evalRes.isCheapestFrontier ? primMistakes : primMistakes + 1;

    setPrimTreeNodes(nextNodes);
    setPrimEdgeIds(nextEdges);
    setPrimCost(nextCost);
    if (!evalRes.isCheapestFrontier) setPrimMistakes(nextMistakes);
    setHintEdgeIds([]);
    setFeedback({
      kind: evalRes.isCheapestFrontier ? 'good' : 'info',
      text: evalRes.feedback,
    });

    if (nextNodes.length === mstLevel.nodeIds.length && mstOptimal) {
      const scored = computeMSTGameScore({
        playerTotalCost: nextCost,
        optimalTotalCost: mstOptimal.totalCost,
        mistakes: nextMistakes,
        hintsUsed,
        hintPenaltyEach: 75,
      });
      const saved = saveGameScoreIfBest(
        'prims-builder',
        difficulty,
        scored.score,
        `$${nextCost}M vs $${mstOptimal.totalCost}M optimal`
      );
      setScores(saved.scores);
      setIsNewBest(saved.isNewBest);
      setPhase('results');
    }
  };

  // Handler for Kruskal's Architect
  const handleKruskalDecision = (decision: 'accept' | 'reject') => {
    if (phase !== 'playing') return;
    const edge = sortedKruskalEdges[kruskalEdgeIdx];
    if (!edge) return;

    const evalRes = evaluateKruskalDecision({
      dsu: currentKruskalDsu,
      edge,
      decision,
    });

    let nextAccepted = kruskalAcceptedIds;
    let nextRejected = kruskalRejectedIds;
    let nextCost = kruskalCost;
    let nextMistakes = kruskalMistakes;

    if (evalRes.correct) {
      if (decision === 'accept') {
        nextAccepted = [...kruskalAcceptedIds, edge.id];
        nextCost += edge.constructionCost;
        currentKruskalDsu.union(edge.from, edge.to);
      } else {
        nextRejected = [...kruskalRejectedIds, edge.id];
      }
      setFeedback({ kind: 'good', text: evalRes.feedback });
    } else {
      nextMistakes += 1;
      // Apply the mathematically valid state progression only if player corrects, OR advance with penalty:
      // Let's keep them on the edge so they learn why and make the valid move!
      setPrimMistakes((m) => m);
      setKruskalMistakes(nextMistakes);
      setFeedback({ kind: 'bad', text: `${evalRes.feedback} (−60 pt mistake penalty; try the other choice.)` });
      return;
    }

    setKruskalAcceptedIds(nextAccepted);
    setKruskalRejectedIds(nextRejected);
    setKruskalCost(nextCost);
    setKruskalDsuState(currentKruskalDsu.getComponentMap());
    setHintEdgeIds([]);

    const targetEdges = mstLevel.nodeIds.length - 1;
    const nextIdx = kruskalEdgeIdx + 1;

    if (nextAccepted.length >= targetEdges || nextIdx >= sortedKruskalEdges.length) {
      if (mstOptimal) {
        const scored = computeMSTGameScore({
          playerTotalCost: nextCost,
          optimalTotalCost: mstOptimal.totalCost,
          mistakes: nextMistakes,
          hintsUsed,
          hintPenaltyEach: 60,
        });
        const saved = saveGameScoreIfBest(
          'kruskals-architect',
          difficulty,
          scored.score,
          `$${nextCost}M vs $${mstOptimal.totalCost}M optimal`
        );
        setScores(saved.scores);
        setIsNewBest(saved.isNewBest);
      }
      setPhase('results');
    } else {
      setKruskalEdgeIdx(nextIdx);
    }
  };

  // Hint Action
  const handleHint = () => {
    if (phase !== 'playing') return;
    if (activeGame === 'beat-traffic') {
      const currNodeId = btNodePath[btNodePath.length - 1];
      const subOpt = runDijkstra(activeGraph, currNodeId, btLevel.endId, 'time', {
        recordEvents: false,
      });
      if (subOpt.reachable && subOpt.pathEdgeIds.length > 0) {
        setHintsUsed((h) => h + 1);
        setHintEdgeIds([subOpt.pathEdgeIds[0]]);
        const edge = activeGraph.edges.find((e) => e.id === subOpt.pathEdgeIds[0]);
        setFeedback({
          kind: 'info',
          text: `Hint (−100 pts): Optimal next road from ${currNodeId} is ${edge?.roadName ?? subOpt.pathEdgeIds[0]}.`,
        });
      }
    } else if (activeGame === 'prims-builder') {
      const treeSet = new Set(primTreeNodes);
      const frontier = activeGraph.edges.filter((e) => treeSet.has(e.from) !== treeSet.has(e.to));
      if (frontier.length > 0) {
        const minCost = Math.min(...frontier.map((e) => e.constructionCost));
        const bestIds = frontier.filter((e) => e.constructionCost === minCost).map((e) => e.id);
        setHintsUsed((h) => h + 1);
        setHintEdgeIds(bestIds);
        setFeedback({
          kind: 'info',
          text: `Hint (−75 pts): Highlighted ${bestIds.length} cheapest frontier road(s) costing $${minCost}M.`,
        });
      }
    } else {
      const edge = sortedKruskalEdges[kruskalEdgeIdx];
      if (edge) {
        const cycle = currentKruskalDsu.connected(edge.from, edge.to);
        setHintsUsed((h) => h + 1);
        setFeedback({
          kind: 'info',
          text: cycle
            ? `Hint (−60 pts): Find(${edge.from}) === Find(${edge.to}). Accepting ${edge.roadName} would form a cycle — Reject it.`
            : `Hint (−60 pts): ${edge.from} and ${edge.to} are in separate components — Accept ${edge.roadName}.`,
        });
      }
    }
  };

  // Valid cheapest frontier edges when "Show frontier hints" is enabled in Prim's Builder
  const primAutoHintIds = useMemo(() => {
    if (activeGame !== 'prims-builder' || !primHintsAlwaysOn || phase !== 'playing') return [];
    const treeSet = new Set(primTreeNodes);
    const frontier = activeGraph.edges.filter((e) => treeSet.has(e.from) !== treeSet.has(e.to));
    if (frontier.length === 0) return [];
    const minCost = Math.min(...frontier.map((e) => e.constructionCost));
    return frontier.filter((e) => e.constructionCost === minCost).map((e) => e.id);
  }, [activeGame, primHintsAlwaysOn, phase, primTreeNodes, activeGraph.edges]);

  const personalBest = scores[makeScoreKey(activeGame, difficulty)];
  const currentKruskalEdge = sortedKruskalEdges[kruskalEdgeIdx] ?? null;

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Game & Difficulty Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-800/80">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#15120F] border border-stone-800/90">
          {(
            [
              { id: 'beat-traffic', label: 'A. Beat the Traffic' },
              { id: 'prims-builder', label: "B. Prim's Builder" },
              { id: 'kruskals-architect', label: "C. Kruskal's Architect" },
            ] as { id: GameModeId; label: string }[]
          ).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChangeGame(g.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeGame === g.id
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-stone-950 font-semibold shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#15120F] border border-stone-800/90">
            {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeDifficulty(d)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize cursor-pointer transition-colors ${
                  difficulty === d
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/45 font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleTimer(!timerEnabled)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              timerEnabled
                ? 'bg-[#1B1713] border-stone-700/80 text-amber-200'
                : 'bg-[#0D0B09] border-stone-800/80 text-stone-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{timerEnabled ? 'Timer On' : 'Timer Off'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Game Control Panel */}
        <div className="xl:col-span-4 space-y-4">
          {/* Level Header & Personal Best */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] text-amber-300 font-medium capitalize">
                  {difficulty} Level
                </p>
                <h2 className="text-base font-display font-semibold text-stone-100">
                  {activeGame === 'beat-traffic' ? btLevel.title : mstLevel.title}
                </h2>
              </div>
              {timerEnabled && (
                <div className="text-right font-mono text-sm font-semibold text-stone-200 tabular-nums">
                  {formatClock(elapsedSec)}
                </div>
              )}
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              {activeGame === 'beat-traffic' ? btLevel.briefing : mstLevel.briefing}
            </p>

            <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs">
              <span className="text-stone-400 inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Personal Best (saved locally)</span>
              </span>
              <span className="font-mono font-semibold text-amber-300 tabular-nums">
                {personalBest ? `${personalBest.score} pts` : '—'}
              </span>
            </div>

            {/* 9-Challenge Mastery Matrix */}
            <div className="pt-2.5 border-t border-stone-800/80 space-y-2">
              {(() => {
                const games: { id: GameModeId; short: string }[] = [
                  { id: 'beat-traffic', short: 'Traffic' },
                  { id: 'prims-builder', short: "Prim's" },
                  { id: 'kruskals-architect', short: "Kruskal's" },
                ];
                const diffs: DifficultyLevel[] = ['easy', 'medium', 'hard'];
                const cleared = games.reduce(
                  (acc, g) =>
                    acc +
                    diffs.filter((d) => Boolean(scores[makeScoreKey(g.id, d)])).length,
                  0
                );
                return (
                  <>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-400 font-medium">Challenge Mastery Matrix</span>
                      <span className="font-mono text-amber-300 tabular-nums">
                        {cleared} / 9 cleared
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      <div />
                      {diffs.map((d) => (
                        <div
                          key={d}
                          className="text-center text-stone-500 uppercase tracking-wider py-0.5"
                        >
                          {d.slice(0, 3)}
                        </div>
                      ))}
                      {games.map((g) => (
                        <React.Fragment key={g.id}>
                          <div className="text-stone-300 flex items-center truncate pr-1 font-sans text-[11px]">
                            {g.short}
                          </div>
                          {diffs.map((d) => {
                            const entry = scores[makeScoreKey(g.id, d)];
                            const isSelectedCell = activeGame === g.id && difficulty === d;
                            return (
                              <button
                                key={`${g.id}-${d}`}
                                type="button"
                                onClick={() => {
                                  if (activeGame !== g.id) onChangeGame(g.id);
                                  if (difficulty !== d) onChangeDifficulty(d);
                                }}
                                title={`${g.short} (${d})`}
                                className={`py-1 rounded border text-center tabular-nums cursor-pointer transition-colors ${
                                  isSelectedCell
                                    ? 'bg-amber-500/20 border-amber-400/70 text-amber-200 font-semibold'
                                    : entry
                                    ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-300 hover:border-emerald-400/70'
                                    : 'bg-[#0D0B09] border-stone-800/80 text-stone-500 hover:border-stone-700'
                                }`}
                              >
                                {entry ? entry.score : '—'}
                              </button>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {phase === 'rules' && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-stone-100 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rules & Scoring Formula</span>
                </h3>
                {activeGame === 'beat-traffic' && (
                  <div className="text-xs text-stone-300 space-y-1.5 leading-relaxed">
                    <p>
                      Click connected roads or adjacent junctions to chart a path from{' '}
                      <strong className="text-emerald-300">{btLevel.startId}</strong> to{' '}
                      <strong className="text-amber-300">{btLevel.endId}</strong>. Avoid closed roads
                      and heavy congestion.
                    </p>
                    <p className="font-mono text-[11px] text-stone-400 bg-[#0D0B09] p-2.5 rounded-lg border border-stone-800/85">
                      Score = max(0, round(1000 × OptimalTime / YourTime) − 100 × Hints)
                    </p>
                  </div>
                )}
                {activeGame === 'prims-builder' && (
                  <div className="text-xs text-stone-300 space-y-1.5 leading-relaxed">
                    <p>
                      Grow the network starting from{' '}
                      <strong className="text-emerald-300">{mstLevel.startNodeId}</strong>. Always
                      select the cheapest frontier road connecting your tree to an unvisited
                      junction.
                    </p>
                    <p className="font-mono text-[11px] text-stone-400 bg-[#0D0B09] p-2.5 rounded-lg border border-stone-800/85">
                      Score = max(0, round(1000 × OptimalCost / YourCost) − 60 × Mistakes − 75 × Hints)
                    </p>
                  </div>
                )}
                {activeGame === 'kruskals-architect' && (
                  <div className="text-xs text-stone-300 space-y-1.5 leading-relaxed">
                    <p>
                      Roads are queued from lowest to highest cost. For each candidate edge, decide
                      whether to <strong>Accept</strong> it or <strong>Reject</strong> it if both
                      endpoints are already connected (forming a cycle).
                    </p>
                    <p className="font-mono text-[11px] text-stone-400 bg-[#0D0B09] p-2.5 rounded-lg border border-stone-800/85">
                      Score = max(0, round(1000 × OptimalCost / YourCost) − 60 × Mistakes − 60 × Hints)
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => resetAndStartGame(true)}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_6px_18px_-4px_rgba(245,158,11,0.45)]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Challenge</span>
              </button>
            </div>
          )}

          {phase === 'playing' && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-4">
              {activeGame === 'beat-traffic' && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] text-stone-400">Your Time</div>
                      <div className="font-mono text-base font-semibold text-amber-300 tabular-nums">
                        {btMetrics.timeMin.toFixed(1)} min
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Target Optimal</div>
                      <div className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                        {btOptimal?.totalTimeMin.toFixed(1)} min
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">At Junction</div>
                      <div className="font-mono text-base font-semibold text-stone-100">
                        {btNodePath[btNodePath.length - 1]}
                      </div>
                    </div>
                  </div>
                  {/* Visual Budget Pacing Bar */}
                  {btOptimal && btOptimal.totalTimeMin > 0 && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            btMetrics.timeMin > btOptimal.totalTimeMin
                              ? 'bg-orange-400'
                              : 'bg-gradient-to-r from-emerald-400 to-amber-400'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.round((btMetrics.timeMin / btOptimal.totalTimeMin) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                        <span>Pace vs Optimal Target</span>
                        <span>{Math.round((btMetrics.timeMin / btOptimal.totalTimeMin) * 100)}%</span>
                      </div>
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-stone-300 bg-[#0D0B09] p-2.5 rounded-lg border border-stone-800/85">
                    Path: {btNodePath.join(' → ')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={btNodePath.length <= 1}
                      onClick={() => {
                        setBtNodePath((p) => p.slice(0, -1));
                        setHintEdgeIds([]);
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 disabled:opacity-40 border border-stone-700/80 text-xs text-stone-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleHint}
                      className="flex-1 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-xs text-amber-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Hint (−100)</span>
                    </button>
                  </div>
                </>
              )}

              {activeGame === 'prims-builder' && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] text-stone-400">Your Cost</div>
                      <div className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                        ${primCost}M
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Connected</div>
                      <div className="font-mono text-base font-semibold text-stone-100 tabular-nums">
                        {primTreeNodes.length} / {mstLevel.nodeIds.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Mistakes</div>
                      <div className="font-mono text-base font-semibold text-rose-300 tabular-nums">
                        {primMistakes}
                      </div>
                    </div>
                  </div>

                  {/* MST Build Progress Gauge */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300"
                        style={{
                          width: `${Math.round((primTreeNodes.length / Math.max(1, mstLevel.nodeIds.length)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span>Grid coverage</span>
                      <span>
                        {Math.round((primTreeNodes.length / Math.max(1, mstLevel.nodeIds.length)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="inline-flex items-center gap-2 text-stone-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={primHintsAlwaysOn}
                        onChange={(e) => setPrimHintsAlwaysOn(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      <span>Show cheapest frontier hints</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHint}
                      className="flex-1 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-xs text-amber-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Highlight Best (−75)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetAndStartGame(true)}
                      className="py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-300 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restart</span>
                    </button>
                  </div>
                </>
              )}

              {activeGame === 'kruskals-architect' && currentKruskalEdge && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] text-stone-400">Cost Built</div>
                      <div className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                        ${kruskalCost}M
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Accepted</div>
                      <div className="font-mono text-base font-semibold text-stone-100 tabular-nums">
                        {kruskalAcceptedIds.length} / {mstLevel.nodeIds.length - 1}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Mistakes</div>
                      <div className="font-mono text-base font-semibold text-rose-300 tabular-nums">
                        {kruskalMistakes}
                      </div>
                    </div>
                  </div>

                  {/* MST Build Progress Gauge */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[#0D0B09] overflow-hidden border border-stone-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-400 via-amber-400 to-emerald-400 transition-all duration-300"
                        style={{
                          width: `${Math.round((kruskalAcceptedIds.length / Math.max(1, mstLevel.nodeIds.length - 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span>Tree edges accepted</span>
                      <span>
                        {Math.round((kruskalAcceptedIds.length / Math.max(1, mstLevel.nodeIds.length - 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-400/50 space-y-1">
                    <div className="text-[11px] text-amber-300 font-medium">
                      Candidate Edge {kruskalEdgeIdx + 1} of {sortedKruskalEdges.length}
                    </div>
                    <div className="text-sm font-semibold text-stone-100">
                      {currentKruskalEdge.roadName} · ${currentKruskalEdge.constructionCost}M
                    </div>
                    <div className="text-xs font-mono text-stone-400">
                      Connects {currentKruskalEdge.from} ↔ {currentKruskalEdge.to}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleKruskalDecision('accept')}
                      className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-stone-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Edge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKruskalDecision('reject')}
                      className="py-2.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject (Cycle)</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHint}
                      className="flex-1 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-xs text-amber-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Check DSU (−60)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetAndStartGame(true)}
                      className="py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-300 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restart</span>
                    </button>
                  </div>
                </>
              )}

              {feedback && (
                <div
                  className={`p-2.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
                    feedback.kind === 'good'
                      ? 'bg-emerald-950/40 border-emerald-400/45 text-emerald-200'
                      : feedback.kind === 'bad'
                      ? 'bg-rose-950/40 border-rose-400/45 text-rose-200'
                      : 'bg-amber-950/40 border-amber-400/45 text-amber-200'
                  }`}
                >
                  {feedback.kind === 'bad' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 hidden" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              {activeGame === 'beat-traffic' && (
                <button
                  type="button"
                  onClick={() => resetAndStartGame(true)}
                  className="w-full py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-300 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart Level</span>
                </button>
              )}
            </div>
          )}

          {phase === 'results' && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-emerald-400/45 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                  <Award className="w-4 h-4" />
                  <span>Challenge Complete</span>
                </div>
                {isNewBest && (
                  <span className="text-xs font-semibold text-amber-300">New Local Best!</span>
                )}
              </div>

              {activeGame === 'beat-traffic' && btScoreData && btOptimal && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] text-stone-400">Final Score</div>
                      <div className="font-mono text-xl font-bold text-amber-300 tabular-nums">
                        {btScoreData.score}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Your Time</div>
                      <div className="font-mono text-base font-semibold text-stone-100 tabular-nums">
                        {btMetrics.timeMin.toFixed(1)}m
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Optimal</div>
                      <div className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                        {btOptimal.totalTimeMin.toFixed(1)}m
                      </div>
                    </div>
                  </div>
                  <p className="text-stone-300 leading-relaxed">
                    {btScoreData.excessTimeMin === 0
                      ? 'You matched Dijkstra’s exact fastest route! Zero excess travel time.'
                      : `Your route took +${btScoreData.excessTimeMin.toFixed(1)} min longer than Dijkstra’s optimal path (${btOptimal.pathNodeIds.join(' → ')}).`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBtReplayOptimal((v) => !v)}
                    className="w-full py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-amber-400/45 text-amber-200 text-xs font-medium cursor-pointer"
                  >
                    {btReplayOptimal ? 'Showing Optimal Route on Map' : 'Compare Optimal Route on Map'}
                  </button>
                </div>
              )}

              {activeGame !== 'beat-traffic' && mstScoreData && mstOptimal && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] text-stone-400">Final Score</div>
                      <div className="font-mono text-xl font-bold text-emerald-300 tabular-nums">
                        {mstScoreData.score}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Your Cost</div>
                      <div className="font-mono text-base font-semibold text-stone-100 tabular-nums">
                        ${activeGame === 'prims-builder' ? primCost : kruskalCost}M
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-stone-400">Optimal MST</div>
                      <div className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                        ${mstOptimal.totalCost}M
                      </div>
                    </div>
                  </div>
                  <p className="text-stone-300 leading-relaxed">
                    {mstScoreData.excessCost === 0
                      ? 'You built a true Minimum Spanning Tree at the lowest possible construction cost!'
                      : `Your network cost $${mstScoreData.excessCost}M above the optimal MST ($${mstOptimal.totalCost}M).`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => resetAndStartGame(true)}
                  className="py-2 px-3 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-stone-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextDiff: DifficultyLevel =
                      difficulty === 'easy' ? 'medium' : difficulty === 'medium' ? 'hard' : 'easy';
                    onChangeDifficulty(nextDiff);
                  }}
                  className="py-2 px-3 rounded-lg bg-[#0D0B09] hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-200 font-medium cursor-pointer"
                >
                  {difficulty === 'hard' ? 'Back to Easy' : 'Next Difficulty'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Interactive Game Canvas */}
        <div className="xl:col-span-8">
          <CityGraphCanvas
            graph={activeGraph}
            mode={
              activeGame === 'beat-traffic'
                ? 'game-traffic'
                : activeGame === 'prims-builder'
                ? 'game-prim'
                : 'game-kruskal'
            }
            weightDisplay={activeGame === 'beat-traffic' ? 'time' : 'cost'}
            startNodeId={
              activeGame === 'beat-traffic'
                ? btLevel.startId
                : activeGame === 'prims-builder'
                ? mstLevel.startNodeId
                : null
            }
            endNodeId={activeGame === 'beat-traffic' ? btLevel.endId : null}
            currentNodeId={
              activeGame === 'beat-traffic' && phase === 'playing'
                ? btNodePath[btNodePath.length - 1]
                : null
            }
            routeNodeIds={
              activeGame === 'beat-traffic'
                ? btReplayOptimal && btOptimal
                  ? btOptimal.pathNodeIds
                  : btNodePath
                : []
            }
            routeEdgeIds={
              activeGame === 'beat-traffic'
                ? btReplayOptimal && btOptimal
                  ? btOptimal.pathEdgeIds
                  : btMetrics.edgeIds
                : []
            }
            mstTreeNodeIds={activeGame === 'prims-builder' ? primTreeNodes : []}
            mstSelectedEdgeIds={
              activeGame === 'prims-builder'
                ? primEdgeIds
                : activeGame === 'kruskals-architect'
                ? kruskalAcceptedIds
                : []
            }
            mstRejectedEdgeIds={activeGame === 'kruskals-architect' ? kruskalRejectedIds : []}
            activeEdgeId={
              activeGame === 'kruskals-architect' && phase === 'playing'
                ? currentKruskalEdge?.id ?? null
                : null
            }
            componentMap={activeGame === 'kruskals-architect' ? kruskalDsuState : undefined}
            hintEdgeIds={[...hintEdgeIds, ...primAutoHintIds]}
            highlightNodeIds={activeGame === 'beat-traffic' ? undefined : mstLevel.nodeIds}
            onNodeClick={(node: CityNode) => {
              if (activeGame === 'beat-traffic') handleBeatTrafficStep(node.id);
            }}
            onEdgeClick={(edge: RoadEdge) => {
              if (activeGame === 'beat-traffic') handleBeatTrafficEdgeClick(edge);
              if (activeGame === 'prims-builder') handlePrimEdgeClick(edge);
            }}
            showGridCoordinates={showGridCoordinates}
          />
        </div>
      </div>
    </div>
  );
};
