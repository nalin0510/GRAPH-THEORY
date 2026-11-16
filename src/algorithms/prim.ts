import { CityGraph, PrimEvent, PrimResult, RoadEdge } from '../types/graph';
import { DisjointSet } from './disjointSet';
import { MinPriorityQueue } from './priorityQueue';

export const PRIM_PSEUDOCODE: string[] = [
  '1. Initialize tree T ← {startNode}',
  '2. Push all edges incident to startNode into min-heap PQ',
  '3. while PQ is not empty and |T| < |V|:',
  '4.   (cost, edge) ← PQ.extractMin()',
  '5.   if both endpoints of edge are already in T: continue',
  '6.   add new endpoint v and edge to T',
  '7.   for each neighbor edge e of v not in T: PQ.push(e)',
  '8. if |T| < |V|: report disconnected components (no single MST)',
];

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function runPrim(
  graph: CityGraph,
  startNodeId: string,
  options: { excludeClosed?: boolean; recordEvents?: boolean } = {}
): PrimResult {
  const excludeClosed = options.excludeClosed ?? false;
  const recordEvents = options.recordEvents !== false;
  const startTime = nowMs();

  const activeEdges = [...graph.edges]
    .filter((e) => (!excludeClosed ? true : !e.closed))
    .sort((a, b) => a.id.localeCompare(b.id));

  const nodeIds = graph.nodes.map((n) => n.id);
  const dsu = new DisjointSet(nodeIds);
  for (const edge of activeEdges) {
    dsu.union(edge.from, edge.to);
  }
  const components = dsu.getComponents();
  const isGraphConnected = components.length <= 1;

  const adj: Record<string, { edge: RoadEdge; neighborId: string }[]> = {};
  for (const id of nodeIds) adj[id] = [];
  for (const edge of activeEdges) {
    adj[edge.from].push({ edge, neighborId: edge.to });
    adj[edge.to].push({ edge, neighborId: edge.from });
  }
  for (const id of nodeIds) {
    adj[id].sort((a, b) => a.edge.constructionCost - b.edge.constructionCost || a.edge.id.localeCompare(b.edge.id));
  }

  const validStart = nodeIds.includes(startNodeId) ? startNodeId : nodeIds[0];
  const nodeLabelMap: Record<string, string> = {};
  for (const n of graph.nodes) nodeLabelMap[n.id] = n.label;

  const treeNodes = new Set<string>();
  const treeEdgeIds: string[] = [];
  const rejectedEdgeIds: string[] = [];
  const pq = new MinPriorityQueue<RoadEdge>();
  const events: PrimEvent[] = [];
  let stepIndex = 0;
  let totalCost = 0;
  let consideredEdgeCount = 0;

  const getCandidateFrontierIds = (): string[] => {
    const set = new Set<string>();
    for (const item of pq.toArray()) {
      const e = item.value;
      const inFrom = treeNodes.has(e.from);
      const inTo = treeNodes.has(e.to);
      if (inFrom !== inTo) set.add(e.id);
    }
    return Array.from(set);
  };

  const pushEvent = (partial: Omit<PrimEvent, 'stepIndex' | 'treeNodeIds' | 'treeEdgeIds' | 'candidateEdgeIds' | 'rejectedEdgeIds' | 'totalCost'>) => {
    if (!recordEvents) return;
    events.push({
      stepIndex: stepIndex++,
      treeNodeIds: Array.from(treeNodes),
      treeEdgeIds: [...treeEdgeIds],
      candidateEdgeIds: getCandidateFrontierIds(),
      rejectedEdgeIds: [...rejectedEdgeIds],
      totalCost,
      ...partial,
    });
  };

  if (!validStart) {
    return {
      algorithm: 'prim',
      startNodeId,
      isConnected: true,
      label: 'Minimum Spanning Tree',
      components: [],
      treeNodeIds: [],
      treeEdgeIds: [],
      totalCost: 0,
      consideredEdgeCount: 0,
      computeTimeMs: Math.max(0.01, nowMs() - startTime),
      events: [],
    };
  }

  const tieKey = (e: RoadEdge) => `${String(Math.round(e.distanceKm * 100)).padStart(5, '0')}-${e.id}`;

  treeNodes.add(validStart);
  for (const { edge } of adj[validStart]) {
    pq.push(edge, edge.constructionCost, tieKey(edge));
  }

  pushEvent({
    type: 'init',
    pseudocodeLine: 0,
    currentNodeId: validStart,
    activeEdgeId: null,
    description: `Started Prim's algorithm at ${nodeLabelMap[validStart]} (${validStart}). Added ${adj[validStart].length} incident edges to frontier heap.`,
  });

  while (!pq.isEmpty() && treeNodes.size < nodeIds.length) {
    const item = pq.pop()!;
    const edge = item.value;
    consideredEdgeCount += 1;

    const fromIn = treeNodes.has(edge.from);
    const toIn = treeNodes.has(edge.to);

    pushEvent({
      type: 'consider-edge',
      pseudocodeLine: 3,
      currentNodeId: null,
      activeEdgeId: edge.id,
      description: `Popped lowest-cost frontier edge ${edge.roadName} ($${edge.constructionCost}M, ${edge.from} ↔ ${edge.to}).`,
    });

    if (fromIn && toIn) {
      rejectedEdgeIds.push(edge.id);
      pushEvent({
        type: 'skip-visited',
        pseudocodeLine: 4,
        currentNodeId: null,
        activeEdgeId: edge.id,
        description: `Skipped ${edge.roadName} ($${edge.constructionCost}M): both ${edge.from} and ${edge.to} are already inside the tree.`,
      });
      continue;
    }

    const newNode = fromIn ? edge.to : edge.from;
    treeNodes.add(newNode);
    treeEdgeIds.push(edge.id);
    totalCost += edge.constructionCost;

    for (const { edge: nextEdge, neighborId } of adj[newNode]) {
      if (!treeNodes.has(neighborId)) {
        pq.push(nextEdge, nextEdge.constructionCost, tieKey(nextEdge));
      }
    }

    pushEvent({
      type: 'select-edge',
      pseudocodeLine: 5,
      currentNodeId: newNode,
      activeEdgeId: edge.id,
      description: `Selected ${edge.roadName} ($${edge.constructionCost}M) to connect ${nodeLabelMap[newNode]} (${newNode}). Running cost: $${totalCost}M.`,
    });
  }

  const spannedAllNodes = treeNodes.size === nodeIds.length && isGraphConnected;
  const computeTimeMs = Math.max(0.01, nowMs() - startTime);

  if (!spannedAllNodes) {
    pushEvent({
      type: 'disconnected-halt',
      pseudocodeLine: 7,
      currentNodeId: null,
      activeEdgeId: null,
      description: `Network is disconnected (${components.length} components). Prim's spanned ${treeNodes.size}/${nodeIds.length} junctions from ${validStart}; no single spanning tree exists.`,
    });
  } else {
    pushEvent({
      type: 'complete',
      pseudocodeLine: 7,
      currentNodeId: null,
      activeEdgeId: null,
      description: `Minimum Spanning Tree complete: ${treeEdgeIds.length} corridors connecting all ${nodeIds.length} junctions for $${totalCost}M total construction cost.`,
    });
  }

  return {
    algorithm: 'prim',
    startNodeId: validStart,
    isConnected: spannedAllNodes,
    label: spannedAllNodes
      ? 'Minimum Spanning Tree'
      : 'Spanning Tree of Reachable Component (Network Disconnected)',
    components,
    treeNodeIds: Array.from(treeNodes),
    treeEdgeIds,
    totalCost,
    consideredEdgeCount,
    computeTimeMs,
    events,
  };
}
