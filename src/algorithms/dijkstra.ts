import {
  CityGraph,
  DijkstraEvent,
  DijkstraObjective,
  DijkstraResult,
  RoadEdge,
} from '../types/graph';
import { MinPriorityQueue } from './priorityQueue';

export function getEdgeEffectiveTime(edge: RoadEdge): number {
  return edge.baseTimeMin * edge.trafficMultiplier;
}

export function getEdgeObjectiveWeight(edge: RoadEdge, objective: DijkstraObjective): number {
  if (edge.closed) return Number.POSITIVE_INFINITY;
  const raw = objective === 'distance' ? edge.distanceKm : getEdgeEffectiveTime(edge);
  if (raw < 0 || Number.isNaN(raw)) {
    throw new Error(`Dijkstra requires non-negative edge weights (edge ${edge.id} has ${raw}).`);
  }
  return raw;
}

interface AdjacencyNeighbor {
  edge: RoadEdge;
  neighborId: string;
}

function buildAdjacencyList(graph: CityGraph): Record<string, AdjacencyNeighbor[]> {
  const adj: Record<string, AdjacencyNeighbor[]> = {};
  for (const node of graph.nodes) {
    adj[node.id] = [];
  }
  const sortedEdges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of sortedEdges) {
    if (adj[edge.from]) adj[edge.from].push({ edge, neighborId: edge.to });
    if (adj[edge.to]) adj[edge.to].push({ edge, neighborId: edge.from });
  }
  for (const nodeId of Object.keys(adj)) {
    adj[nodeId].sort((a, b) => a.neighborId.localeCompare(b.neighborId) || a.edge.id.localeCompare(b.edge.id));
  }
  return adj;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function runDijkstra(
  graph: CityGraph,
  startId: string,
  endId: string,
  objective: DijkstraObjective,
  options: { recordEvents?: boolean } = {}
): DijkstraResult {
  const recordEvents = options.recordEvents !== false;
  const startTime = nowMs();

  // Validate non-negative weights upfront across all edges
  for (const edge of graph.edges) {
    if (edge.distanceKm < 0 || edge.baseTimeMin < 0 || edge.trafficMultiplier < 0) {
      throw new Error(`Negative weight detected on edge ${edge.id}. Dijkstra requires non-negative weights.`);
    }
  }

  const nodeMap: Record<string, string> = {};
  for (const n of graph.nodes) nodeMap[n.id] = n.label;

  if (!nodeMap[startId] || !nodeMap[endId]) {
    const computeTimeMs = Math.max(0.01, nowMs() - startTime);
    return {
      reachable: false,
      identicalEndpoints: false,
      objective,
      startId,
      endId,
      pathNodeIds: [],
      pathEdgeIds: [],
      totalDistanceKm: 0,
      totalTimeMin: 0,
      objectiveCost: Number.POSITIVE_INFINITY,
      visitedCount: 0,
      examinedEdgeCount: 0,
      computeTimeMs,
      events: [],
      reason: 'Start or destination node does not exist in the graph.',
    };
  }

  const adj = buildAdjacencyList(graph);
  const distances: Record<string, number> = {};
  const prevNode: Record<string, string | null> = {};
  const prevEdge: Record<string, RoadEdge | null> = {};
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();

  for (const node of graph.nodes) {
    distances[node.id] = node.id === startId ? 0 : Number.POSITIVE_INFINITY;
    prevNode[node.id] = null;
    prevEdge[node.id] = null;
  }

  const events: DijkstraEvent[] = [];
  let stepIndex = 0;

  const snapshotTreeEdges = (): string[] =>
    Object.values(prevEdge)
      .filter((e): e is RoadEdge => e !== null)
      .map((e) => e.id);

  const snapshotFrontier = (): string[] => {
    const set = new Set<string>();
    for (const item of pq.toArray()) {
      if (!visited.has(item.value)) set.add(item.value);
    }
    return Array.from(set);
  };

  const pushEvent = (
    partial: Omit<DijkstraEvent, 'stepIndex' | 'visitedIds' | 'frontierIds' | 'distances' | 'treeEdgeIds'>
  ) => {
    if (!recordEvents) return;
    events.push({
      stepIndex: stepIndex++,
      visitedIds: Array.from(visited),
      frontierIds: snapshotFrontier(),
      distances: { ...distances },
      treeEdgeIds: snapshotTreeEdges(),
      ...partial,
    });
  };

  if (startId === endId) {
    visited.add(startId);
    pushEvent({
      type: 'complete',
      currentNodeId: startId,
      activeEdgeId: null,
      targetNodeId: endId,
      pathNodeIds: [startId],
      pathEdgeIds: [],
      description: `Start and destination are both ${nodeMap[startId]} (${startId}). Optimal cost is 0.`,
    });
    return {
      reachable: true,
      identicalEndpoints: true,
      objective,
      startId,
      endId,
      pathNodeIds: [startId],
      pathEdgeIds: [],
      totalDistanceKm: 0,
      totalTimeMin: 0,
      objectiveCost: 0,
      visitedCount: 1,
      examinedEdgeCount: 0,
      computeTimeMs: Math.max(0.01, nowMs() - startTime),
      events,
      reason: 'Start and destination refer to the same junction.',
    };
  }

  pq.push(startId, 0, startId);
  pushEvent({
    type: 'init',
    currentNodeId: startId,
    activeEdgeId: null,
    targetNodeId: null,
    pathNodeIds: [],
    pathEdgeIds: [],
    description: `Initialized Dijkstra from ${nodeMap[startId]} (${startId}) optimizing for ${
      objective === 'distance' ? 'shortest distance (km)' : 'fastest travel time (min)'
    }.`,
  });

  let examinedEdgeCount = 0;
  let reachedDestination = false;

  while (!pq.isEmpty()) {
    const top = pq.pop()!;
    const u = top.value;

    if (visited.has(u)) {
      continue;
    }
    if (top.priority === Number.POSITIVE_INFINITY) {
      break;
    }

    pushEvent({
      type: 'pop-current',
      currentNodeId: u,
      activeEdgeId: null,
      targetNodeId: null,
      pathNodeIds: [],
      pathEdgeIds: [],
      description: `Selected ${nodeMap[u]} (${u}) from priority queue with best ${
        objective === 'distance' ? `${distances[u].toFixed(1)} km` : `${distances[u].toFixed(1)} min`
      }.`,
    });

    if (u === endId) {
      visited.add(u);
      reachedDestination = true;
      break;
    }

    for (const { edge, neighborId: v } of adj[u]) {
      if (visited.has(v)) continue;
      examinedEdgeCount += 1;

      if (edge.closed) {
        pushEvent({
          type: 'skip-closed',
          currentNodeId: u,
          activeEdgeId: edge.id,
          targetNodeId: v,
          pathNodeIds: [],
          pathEdgeIds: [],
          description: `Skipped closed road ${edge.roadName} (${u} ↔ ${v}).`,
        });
        continue;
      }

      const weight = getEdgeObjectiveWeight(edge, objective);
      const candidate = distances[u] + weight;

      pushEvent({
        type: 'examine-edge',
        currentNodeId: u,
        activeEdgeId: edge.id,
        targetNodeId: v,
        pathNodeIds: [],
        pathEdgeIds: [],
        description: `Examining ${edge.roadName} (${u} → ${v}): weight ${weight.toFixed(1)} ${
          objective === 'distance' ? 'km' : 'min'
        }. Candidate = ${candidate.toFixed(1)}.`,
      });

      const currentBest = distances[v];
      const isBetter =
        candidate < currentBest - 1e-9 ||
        (Math.abs(candidate - currentBest) <= 1e-9 &&
          prevNode[v] !== null &&
          u.localeCompare(prevNode[v]!) < 0);

      if (isBetter) {
        distances[v] = Number(candidate.toFixed(4));
        prevNode[v] = u;
        prevEdge[v] = edge;
        pq.push(v, distances[v], v);

        pushEvent({
          type: 'relax-update',
          currentNodeId: u,
          activeEdgeId: edge.id,
          targetNodeId: v,
          pathNodeIds: [],
          pathEdgeIds: [],
          description: `Updated ${nodeMap[v]} (${v}) best cost to ${distances[v].toFixed(1)} ${
            objective === 'distance' ? 'km' : 'min'
          } via ${edge.roadName}.`,
        });
      }
    }

    visited.add(u);
    pushEvent({
      type: 'mark-visited',
      currentNodeId: u,
      activeEdgeId: null,
      targetNodeId: null,
      pathNodeIds: [],
      pathEdgeIds: [],
      description: `Settled ${nodeMap[u]} (${u}); shortest known cost finalized.`,
    });
  }

  const computeTimeMs = Math.max(0.01, nowMs() - startTime);

  if (!reachedDestination || distances[endId] === Number.POSITIVE_INFINITY) {
    pushEvent({
      type: 'unreachable',
      currentNodeId: null,
      activeEdgeId: null,
      targetNodeId: endId,
      pathNodeIds: [],
      pathEdgeIds: [],
      description: `Destination ${nodeMap[endId]} (${endId}) is unreachable from ${nodeMap[startId]} (${startId}) under current road closures.`,
    });
    return {
      reachable: false,
      identicalEndpoints: false,
      objective,
      startId,
      endId,
      pathNodeIds: [],
      pathEdgeIds: [],
      totalDistanceKm: 0,
      totalTimeMin: 0,
      objectiveCost: Number.POSITIVE_INFINITY,
      visitedCount: visited.size,
      examinedEdgeCount,
      computeTimeMs,
      events,
      reason: 'No open path connects start and destination (disconnected network or road closures).',
    };
  }

  const pathNodeIds: string[] = [];
  const pathEdgeIds: string[] = [];
  let totalDistanceKm = 0;
  let totalTimeMin = 0;

  let cursor: string | null = endId;
  while (cursor !== null) {
    pathNodeIds.unshift(cursor);
    const edgeUsed = prevEdge[cursor];
    if (edgeUsed) {
      pathEdgeIds.unshift(edgeUsed.id);
      totalDistanceKm += edgeUsed.distanceKm;
      totalTimeMin += getEdgeEffectiveTime(edgeUsed);
    }
    cursor = prevNode[cursor];
  }

  totalDistanceKm = Number(totalDistanceKm.toFixed(2));
  totalTimeMin = Number(totalTimeMin.toFixed(2));
  const objectiveCost = objective === 'distance' ? totalDistanceKm : totalTimeMin;

  pushEvent({
    type: 'complete',
    currentNodeId: endId,
    activeEdgeId: null,
    targetNodeId: endId,
    pathNodeIds,
    pathEdgeIds,
    description: `Optimal route found: ${pathNodeIds.join(' → ')} (${totalDistanceKm.toFixed(1)} km · ${totalTimeMin.toFixed(1)} min).`,
  });

  return {
    reachable: true,
    identicalEndpoints: false,
    objective,
    startId,
    endId,
    pathNodeIds,
    pathEdgeIds,
    totalDistanceKm,
    totalTimeMin,
    objectiveCost,
    visitedCount: visited.size,
    examinedEdgeCount,
    computeTimeMs,
    events,
    reason: `Shortest ${objective === 'distance' ? 'distance' : 'travel-time'} path computed.`,
  };
}
