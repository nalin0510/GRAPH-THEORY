import assert from 'node:assert/strict';
import test from 'node:test';
import { DisjointSet } from '../algorithms/disjointSet';
import { runDijkstra } from '../algorithms/dijkstra';
import { runKruskal } from '../algorithms/kruskal';
import { runPrim } from '../algorithms/prim';
import { createDisconnectedDemoCity, createInitialDemoCity } from '../data/demoCity';
import {
  BEAT_TRAFFIC_LEVELS,
  buildBeatTrafficGraph,
  buildSubgraphForNodes,
  computeBeatTrafficScore,
  computeMSTGameScore,
  evaluateKruskalDecision,
  evaluatePrimMove,
  MST_CHALLENGE_LEVELS,
  validateAllCuratedLevels,
} from '../data/gameLevels';
import { CityGraph } from '../types/graph';

test('1. Known shortest-path example & identical start/destination handling', () => {
  const smallGraph: CityGraph = {
    nodes: [
      { id: 'A', label: 'A', district: 'D', x: 0, y: 0, kind: 'hub' },
      { id: 'B', label: 'B', district: 'D', x: 10, y: 0, kind: 'hub' },
      { id: 'C', label: 'C', district: 'D', x: 20, y: 0, kind: 'hub' },
      { id: 'D', label: 'D', district: 'D', x: 10, y: 10, kind: 'hub' },
    ],
    edges: [
      { id: 'E1', from: 'A', to: 'B', roadName: 'AB', distanceKm: 4, baseTimeMin: 4, trafficMultiplier: 1, constructionCost: 4, closed: false, roadClass: 'arterial' },
      { id: 'E2', from: 'B', to: 'C', roadName: 'BC', distanceKm: 5, baseTimeMin: 5, trafficMultiplier: 1, constructionCost: 5, closed: false, roadClass: 'arterial' },
      { id: 'E3', from: 'A', to: 'D', roadName: 'AD', distanceKm: 2, baseTimeMin: 2, trafficMultiplier: 1, constructionCost: 2, closed: false, roadClass: 'arterial' },
      { id: 'E4', from: 'D', to: 'C', roadName: 'DC', distanceKm: 3, baseTimeMin: 3, trafficMultiplier: 1, constructionCost: 3, closed: false, roadClass: 'arterial' },
    ],
  };

  const res = runDijkstra(smallGraph, 'A', 'C', 'distance');
  assert.equal(res.reachable, true);
  assert.deepEqual(res.pathNodeIds, ['A', 'D', 'C']);
  assert.equal(res.totalDistanceKm, 5);
  assert.ok(res.events.length > 0);

  const same = runDijkstra(smallGraph, 'A', 'A', 'distance');
  assert.equal(same.reachable, true);
  assert.equal(same.identicalEndpoints, true);
  assert.equal(same.totalDistanceKm, 0);
  assert.deepEqual(same.pathNodeIds, ['A']);
});

test('2. Unreachable destination when bridges/roads isolate target', () => {
  const disconnected = createDisconnectedDemoCity();
  const res = runDijkstra(disconnected, 'J1', 'J22', 'time');
  assert.equal(res.reachable, false);
  assert.deepEqual(res.pathNodeIds, []);
  assert.equal(res.events.at(-1)?.type, 'unreachable');
});

test('3. Closed road changes the optimal route', () => {
  const city = createInitialDemoCity();
  const initial = runDijkstra(city, 'J1', 'J9', 'time');
  assert.equal(initial.reachable, true);

  // Close every road on the initial route except first if needed; closing the first edge forces a detour
  const firstEdgeId = initial.pathEdgeIds[0];
  const modified: CityGraph = {
    ...city,
    edges: city.edges.map((e) => (e.id === firstEdgeId ? { ...e, closed: true } : e)),
  };
  const rerouted = runDijkstra(modified, 'J1', 'J9', 'time');
  assert.equal(rerouted.reachable, true);
  assert.notDeepEqual(rerouted.pathEdgeIds, initial.pathEdgeIds);
  assert.ok(!rerouted.pathEdgeIds.includes(firstEdgeId));
});

test('4. Distance and time objectives produce different routes on Demo City', () => {
  const city = createInitialDemoCity();
  const byDistance = runDijkstra(city, 'J1', 'J22', 'distance');
  const byTime = runDijkstra(city, 'J1', 'J22', 'time');

  assert.equal(byDistance.reachable, true);
  assert.equal(byTime.reachable, true);
  assert.notDeepEqual(byDistance.pathNodeIds, byTime.pathNodeIds);
  assert.ok(byDistance.totalDistanceKm <= byTime.totalDistanceKm);
  assert.ok(byTime.totalTimeMin <= byDistance.totalTimeMin);
});

test("5. Prim's and Kruskal's produce identical minimum total construction cost on Demo City", () => {
  const city = createInitialDemoCity();
  const primFromJ1 = runPrim(city, 'J1');
  const primFromJ19 = runPrim(city, 'J19');
  const kruskal = runKruskal(city);

  assert.equal(primFromJ1.isConnected, true);
  assert.equal(primFromJ19.isConnected, true);
  assert.equal(kruskal.isConnected, true);

  assert.equal(primFromJ1.treeEdgeIds.length, city.nodes.length - 1);
  assert.equal(kruskal.acceptedEdgeIds.length, city.nodes.length - 1);
  assert.equal(primFromJ1.totalCost, kruskal.totalCost);
  assert.equal(primFromJ19.totalCost, kruskal.totalCost);
});

test('6. Equal-cost alternatives preserve minimum cost across tie-breaking choices', () => {
  const tieGraph: CityGraph = {
    nodes: [
      { id: 'N1', label: 'N1', district: 'T', x: 0, y: 0, kind: 'hub' },
      { id: 'N2', label: 'N2', district: 'T', x: 10, y: 0, kind: 'hub' },
      { id: 'N3', label: 'N3', district: 'T', x: 10, y: 10, kind: 'hub' },
      { id: 'N4', label: 'N4', district: 'T', x: 0, y: 10, kind: 'hub' },
    ],
    edges: [
      { id: 'E1', from: 'N1', to: 'N2', roadName: 'Top', distanceKm: 1, baseTimeMin: 1, trafficMultiplier: 1, constructionCost: 5, closed: false, roadClass: 'local' },
      { id: 'E2', from: 'N2', to: 'N3', roadName: 'Right', distanceKm: 1, baseTimeMin: 1, trafficMultiplier: 1, constructionCost: 5, closed: false, roadClass: 'local' },
      { id: 'E3', from: 'N3', to: 'N4', roadName: 'Bottom', distanceKm: 1, baseTimeMin: 1, trafficMultiplier: 1, constructionCost: 5, closed: false, roadClass: 'local' },
      { id: 'E4', from: 'N4', to: 'N1', roadName: 'Left', distanceKm: 1, baseTimeMin: 1, trafficMultiplier: 1, constructionCost: 5, closed: false, roadClass: 'local' },
    ],
  };

  const primA = runPrim(tieGraph, 'N1');
  const primB = runPrim(tieGraph, 'N3');
  const kruskal = runKruskal(tieGraph);

  assert.equal(primA.totalCost, 15);
  assert.equal(primB.totalCost, 15);
  assert.equal(kruskal.totalCost, 15);
  assert.notDeepEqual(primA.treeEdgeIds, primB.treeEdgeIds);
});

test("7. Disconnected networks are detected by Prim's and labeled Minimum Spanning Forest by Kruskal's", () => {
  const disconnected = createDisconnectedDemoCity();
  const prim = runPrim(disconnected, 'J1', { excludeClosed: true });
  const kruskal = runKruskal(disconnected, { excludeClosed: true });

  assert.equal(prim.isConnected, false);
  assert.equal(prim.components.length, 2);
  assert.equal(prim.label, 'Spanning Tree of Reachable Component (Network Disconnected)');
  assert.ok(prim.treeNodeIds.length < disconnected.nodes.length);

  assert.equal(kruskal.isConnected, false);
  assert.equal(kruskal.components.length, 2);
  assert.equal(kruskal.label, 'Minimum Spanning Forest');
  assert.equal(kruskal.acceptedEdgeIds.length, disconnected.nodes.length - 2);
});

test('8. DisjointSet cycle detection accurately identifies same-component edges', () => {
  const dsu = new DisjointSet(['A', 'B', 'C', 'D']);
  assert.equal(dsu.union('A', 'B'), true);
  assert.equal(dsu.union('B', 'C'), true);
  assert.equal(dsu.connected('A', 'C'), true);
  assert.equal(dsu.union('A', 'C'), false); // Cycle edge
  assert.equal(dsu.getComponentCount(), 2);
});

test('9. Curated game levels are solvable and move validation/scoring behave fairly', () => {
  const validation = validateAllCuratedLevels();
  assert.equal(validation.valid, true, validation.issues.join('; '));

  // Beat the Traffic scoring
  const btGraph = buildBeatTrafficGraph(BEAT_TRAFFIC_LEVELS[0]);
  const btOpt = runDijkstra(btGraph, BEAT_TRAFFIC_LEVELS[0].startId, BEAT_TRAFFIC_LEVELS[0].endId, 'time');
  const perfect = computeBeatTrafficScore({
    playerTimeMin: btOpt.totalTimeMin,
    optimalTimeMin: btOpt.totalTimeMin,
    hintsUsed: 0,
  });
  assert.equal(perfect.score, 1000);
  assert.equal(perfect.excessTimeMin, 0);

  const slower = computeBeatTrafficScore({
    playerTimeMin: btOpt.totalTimeMin * 1.25,
    optimalTimeMin: btOpt.totalTimeMin,
    hintsUsed: 1,
  });
  assert.equal(slower.score, 700); // round(1000 * 0.8) - 100

  // Prim's Builder move validation
  const mstGraph = buildSubgraphForNodes(MST_CHALLENGE_LEVELS[0].nodeIds);
  const treeNodes = new Set<string>([MST_CHALLENGE_LEVELS[0].startNodeId]);
  const frontierEdges = mstGraph.edges.filter((e) => treeNodes.has(e.from) !== treeNodes.has(e.to));
  const minCost = Math.min(...frontierEdges.map((e) => e.constructionCost));
  const cheapestEdge = frontierEdges.find((e) => e.constructionCost === minCost)!;

  const validMove = evaluatePrimMove({
    graph: mstGraph,
    treeNodes,
    selectedEdgeId: cheapestEdge.id,
  });
  assert.equal(validMove.valid, true);
  assert.equal(validMove.isCheapestFrontier, true);

  // Non-adjacent edge must be rejected
  const nonAdjacent = mstGraph.edges.find((e) => !treeNodes.has(e.from) && !treeNodes.has(e.to))!;
  const invalidMove = evaluatePrimMove({
    graph: mstGraph,
    treeNodes,
    selectedEdgeId: nonAdjacent.id,
  });
  assert.equal(invalidMove.valid, false);

  // Kruskal's Architect cycle evaluation
  const kDsu = new DisjointSet(MST_CHALLENGE_LEVELS[0].nodeIds);
  const firstEdge = mstGraph.edges[0];
  const acceptSafe = evaluateKruskalDecision({ dsu: kDsu, edge: firstEdge, decision: 'accept' });
  assert.equal(acceptSafe.correct, true);
  kDsu.union(firstEdge.from, firstEdge.to);

  const rejectCycle = evaluateKruskalDecision({ dsu: kDsu, edge: firstEdge, decision: 'reject' });
  assert.equal(rejectCycle.correct, true);
  assert.equal(rejectCycle.wouldFormCycle, true);

  const mstScore = computeMSTGameScore({
    playerTotalCost: 30,
    optimalTotalCost: 30,
    mistakes: 0,
    hintsUsed: 1,
    hintPenaltyEach: 75,
  });
  assert.equal(mstScore.score, 925);
});
