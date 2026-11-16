import { DisjointSet } from '../algorithms/disjointSet';
import { getEdgeEffectiveTime, runDijkstra } from '../algorithms/dijkstra';
import { runKruskal } from '../algorithms/kruskal';
import { runPrim } from '../algorithms/prim';
import { CityGraph, CityNode, DifficultyLevel, RoadEdge } from '../types/graph';
import { DEMO_CITY_EDGES, DEMO_CITY_NODES } from './demoCity';

export interface BeatTrafficLevel {
  id: string;
  difficulty: DifficultyLevel;
  title: string;
  briefing: string;
  startId: string;
  endId: string;
  trafficOverrides: Record<string, number>;
  closedEdgeIds: string[];
  timeLimitSec: number;
}

export interface MSTChallengeLevel {
  id: string;
  difficulty: DifficultyLevel;
  title: string;
  briefing: string;
  nodeIds: string[];
  startNodeId: string; // Used in Prim's Builder
  timeLimitSec: number;
}

export const BEAT_TRAFFIC_LEVELS: BeatTrafficLevel[] = [
  {
    id: 'bt-easy',
    difficulty: 'easy',
    title: 'Harbor Commute',
    briefing: 'Find the fastest path from Harbor Pier (J1) to Civic Plaza (J9) while Old Town Spine is gridlocked.',
    startId: 'J1',
    endId: 'J9',
    trafficOverrides: { E10: 3.5, E02: 2.4 },
    closedEdgeIds: [],
    timeLimitSec: 90,
  },
  {
    id: 'bt-medium',
    difficulty: 'medium',
    title: 'Bridge Closure Detour',
    briefing: 'Reach Uni Crest (J18) from Old Market (J4) with the North Expressway closed and Midtown congested.',
    startId: 'J4',
    endId: 'J18',
    trafficOverrides: { E19: 3.5, E20: 2.4, E33: 2.4 },
    closedEdgeIds: ['E05', 'E29'],
    timeLimitSec: 120,
  },
  {
    id: 'bt-hard',
    difficulty: 'hard',
    title: 'Cross-Metro Rush Hour',
    briefing: 'Navigate from Lighthouse Pt (J5) to Aero Terminal (J23) through severe central closures and heavy arterial traffic.',
    startId: 'J5',
    endId: 'J23',
    trafficOverrides: { E27: 3.5, E20: 3.5, E26: 2.4, E38: 2.4 },
    closedEdgeIds: ['E29', 'E43'],
    timeLimitSec: 150,
  },
];

export const MST_CHALLENGE_LEVELS: MSTChallengeLevel[] = [
  {
    id: 'mst-easy',
    difficulty: 'easy',
    title: 'Harbor Micro-Grid (6 Junctions)',
    briefing: 'Connect all 6 western waterfront junctions with minimum total fiber construction cost ($M).',
    nodeIds: ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'],
    startNodeId: 'J1',
    timeLimitSec: 90,
  },
  {
    id: 'mst-medium',
    difficulty: 'medium',
    title: 'East Bank Backbone (9 Junctions)',
    briefing: 'Span the 9 East Bank hubs across Rivergate, University Hills, and Airport Belt at minimum total cost.',
    nodeIds: ['J16', 'J17', 'J18', 'J19', 'J20', 'J21', 'J22', 'J23', 'J24'],
    startNodeId: 'J19',
    timeLimitSec: 120,
  },
  {
    id: 'mst-hard',
    difficulty: 'hard',
    title: 'Tech-Civic Core (11 Junctions)',
    briefing: 'Design the minimum-cost fiber backbone linking Harbor, Tech Quarter, Civic Plaza, and Rail Yard.',
    nodeIds: ['J1', 'J2', 'J4', 'J6', 'J7', 'J8', 'J9', 'J10', 'J11', 'J12', 'J13'],
    startNodeId: 'J9',
    timeLimitSec: 160,
  },
];

export function buildBeatTrafficGraph(level: BeatTrafficLevel): CityGraph {
  const closedSet = new Set(level.closedEdgeIds);
  const edges: RoadEdge[] = DEMO_CITY_EDGES.map((e) => ({
    ...e,
    trafficMultiplier: level.trafficOverrides[e.id] ?? e.trafficMultiplier,
    closed: closedSet.has(e.id),
  }));
  return {
    nodes: DEMO_CITY_NODES.map((n) => ({ ...n })),
    edges,
  };
}

export function buildSubgraphForNodes(nodeIds: string[]): CityGraph {
  const allowed = new Set(nodeIds);
  const nodes: CityNode[] = DEMO_CITY_NODES.filter((n) => allowed.has(n.id)).map((n) => ({ ...n }));
  const edges: RoadEdge[] = DEMO_CITY_EDGES.filter(
    (e) => allowed.has(e.from) && allowed.has(e.to)
  ).map((e) => ({ ...e, closed: false }));
  return { nodes, edges };
}

export function computeBeatTrafficScore(params: {
  playerTimeMin: number;
  optimalTimeMin: number;
  hintsUsed: number;
}): {
  score: number;
  excessTimeMin: number;
  ratioPct: number;
  formulaText: string;
} {
  const { playerTimeMin, optimalTimeMin, hintsUsed } = params;
  const excess = Math.max(0, Number((playerTimeMin - optimalTimeMin).toFixed(2)));
  const baseRatio = playerTimeMin > 0 ? Math.min(1, optimalTimeMin / playerTimeMin) : 1;
  const hintPenalty = hintsUsed * 100;
  const rawScore = Math.round(1000 * baseRatio) - hintPenalty;
  return {
    score: Math.max(0, rawScore),
    excessTimeMin: excess,
    ratioPct: Math.round(baseRatio * 100),
    formulaText: 'Score = max(0, round(1000 × (OptimalTime / YourTime)) − 100 × Hints)',
  };
}

export function evaluatePrimMove(params: {
  graph: CityGraph;
  treeNodes: Set<string>;
  selectedEdgeId: string;
}): {
  valid: boolean;
  isCheapestFrontier: boolean;
  minFrontierCost: number;
  chosenCost: number;
  newNodeId: string | null;
  feedback: string;
} {
  const { graph, treeNodes, selectedEdgeId } = params;
  const edge = graph.edges.find((e) => e.id === selectedEdgeId);
  if (!edge) {
    return {
      valid: false,
      isCheapestFrontier: false,
      minFrontierCost: 0,
      chosenCost: 0,
      newNodeId: null,
      feedback: 'Selected road does not exist in this level.',
    };
  }

  const fromIn = treeNodes.has(edge.from);
  const toIn = treeNodes.has(edge.to);

  if (fromIn && toIn) {
    return {
      valid: false,
      isCheapestFrontier: false,
      minFrontierCost: 0,
      chosenCost: edge.constructionCost,
      newNodeId: null,
      feedback: `Invalid move: ${edge.roadName} connects ${edge.from} and ${edge.to}, which are both already in your tree (this would create a cycle).`,
    };
  }

  if (!fromIn && !toIn) {
    return {
      valid: false,
      isCheapestFrontier: false,
      minFrontierCost: 0,
      chosenCost: edge.constructionCost,
      newNodeId: null,
      feedback: `Invalid move: ${edge.roadName} (${edge.from} ↔ ${edge.to}) is not attached to your growing tree yet. Prim's only expands along frontier edges.`,
    };
  }

  // Compute all valid frontier edges and find minimum cost (handles ties fairly)
  const frontierEdges = graph.edges.filter((e) => treeNodes.has(e.from) !== treeNodes.has(e.to));
  const minFrontierCost = Math.min(...frontierEdges.map((e) => e.constructionCost));
  const isCheapestFrontier = edge.constructionCost === minFrontierCost;
  const newNodeId = fromIn ? edge.to : edge.from;

  return {
    valid: true,
    isCheapestFrontier,
    minFrontierCost,
    chosenCost: edge.constructionCost,
    newNodeId,
    feedback: isCheapestFrontier
      ? `Optimal frontier choice! ${edge.roadName} ($${edge.constructionCost}M) matches the minimum frontier cost ($${minFrontierCost}M).`
      : `Valid connection, but not greedy-optimal: ${edge.roadName} costs $${edge.constructionCost}M while a $${minFrontierCost}M frontier edge was available.`,
  };
}

export function computeMSTGameScore(params: {
  playerTotalCost: number;
  optimalTotalCost: number;
  mistakes: number;
  hintsUsed: number;
  hintPenaltyEach: number;
}): {
  score: number;
  excessCost: number;
  formulaText: string;
} {
  const { playerTotalCost, optimalTotalCost, mistakes, hintsUsed, hintPenaltyEach } = params;
  const excessCost = Math.max(0, playerTotalCost - optimalTotalCost);
  const ratio = playerTotalCost > 0 ? Math.min(1, optimalTotalCost / playerTotalCost) : 1;
  const raw = Math.round(1000 * ratio) - mistakes * 60 - hintsUsed * hintPenaltyEach;
  return {
    score: Math.max(0, raw),
    excessCost,
    formulaText: `Score = max(0, round(1000 × (OptimalCost / YourCost)) − 60 × Mistakes − ${hintPenaltyEach} × Hints)`,
  };
}

export function evaluateKruskalDecision(params: {
  dsu: DisjointSet;
  edge: RoadEdge;
  decision: 'accept' | 'reject';
}): {
  correct: boolean;
  wouldFormCycle: boolean;
  feedback: string;
} {
  const { dsu, edge, decision } = params;
  const wouldFormCycle = dsu.connected(edge.from, edge.to);

  if (decision === 'accept') {
    if (wouldFormCycle) {
      return {
        correct: false,
        wouldFormCycle: true,
        feedback: `Incorrect: ${edge.from} and ${edge.to} already share component ${dsu.find(edge.from)}. Accepting ${edge.roadName} creates a cycle!`,
      };
    }
    return {
      correct: true,
      wouldFormCycle: false,
      feedback: `Correct! ${edge.from} and ${edge.to} belonged to separate components, so ${edge.roadName} ($${edge.constructionCost}M) merges them without a cycle.`,
    };
  } else {
    if (wouldFormCycle) {
      return {
        correct: true,
        wouldFormCycle: true,
        feedback: `Correct rejection! ${edge.from} and ${edge.to} are already connected in the same component, so ${edge.roadName} would form a cycle.`,
      };
    }
    return {
      correct: false,
      wouldFormCycle: false,
      feedback: `Incorrect rejection: ${edge.from} and ${edge.to} are in separate components — accepting ${edge.roadName} ($${edge.constructionCost}M) is safe and needed for minimum cost.`,
    };
  }
}

export function validateAllCuratedLevels(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const lvl of BEAT_TRAFFIC_LEVELS) {
    const g = buildBeatTrafficGraph(lvl);
    const res = runDijkstra(g, lvl.startId, lvl.endId, 'time', { recordEvents: false });
    if (!res.reachable) {
      issues.push(`Beat the Traffic level ${lvl.id} is unreachable.`);
    }
  }

  for (const lvl of MST_CHALLENGE_LEVELS) {
    const g = buildSubgraphForNodes(lvl.nodeIds);
    const primRes = runPrim(g, lvl.startNodeId, { recordEvents: false });
    const kruskalRes = runKruskal(g, { recordEvents: false });
    if (!primRes.isConnected || !kruskalRes.isConnected) {
      issues.push(`MST level ${lvl.id} subgraph is disconnected.`);
    }
    if (primRes.totalCost !== kruskalRes.totalCost) {
      issues.push(`MST level ${lvl.id} Prim vs Kruskal cost mismatch.`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function computeRouteMetrics(graph: CityGraph, nodePath: string[]): {
  edgeIds: string[];
  distanceKm: number;
  timeMin: number;
} {
  const edgeIds: string[] = [];
  let distanceKm = 0;
  let timeMin = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = nodePath[i];
    const b = nodePath[i + 1];
    const edge = graph.edges.find(
      (e) => !e.closed && ((e.from === a && e.to === b) || (e.from === b && e.to === a))
    );
    if (edge) {
      edgeIds.push(edge.id);
      distanceKm += edge.distanceKm;
      timeMin += getEdgeEffectiveTime(edge);
    }
  }
  return {
    edgeIds,
    distanceKm: Number(distanceKm.toFixed(2)),
    timeMin: Number(timeMin.toFixed(2)),
  };
}
