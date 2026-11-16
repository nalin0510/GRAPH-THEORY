import { CityGraph, KruskalEvent, KruskalResult } from '../types/graph';
import { DisjointSet } from './disjointSet';

export const KRUSKAL_PSEUDOCODE: string[] = [
  '1. Sort all edges in nondecreasing order of construction cost',
  '2. Initialize Disjoint-Set Union (each junction in its own component)',
  '3. for each edge (u, v, cost) in sorted edges:',
  '4.   if Find(u) ≠ Find(v):',
  '5.     Accept edge (u, v) into forest & Union(u, v)',
  '6.   else:',
  '7.     Reject edge (u, v) — would form a cycle',
  '8. Return Minimum Spanning Tree (or Forest if components > 1)',
];

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function runKruskal(
  graph: CityGraph,
  options: { excludeClosed?: boolean; recordEvents?: boolean } = {}
): KruskalResult {
  const excludeClosed = options.excludeClosed ?? false;
  const recordEvents = options.recordEvents !== false;
  const startTime = nowMs();

  const nodeIds = graph.nodes.map((n) => n.id);
  const dsu = new DisjointSet(nodeIds);

  const sortedEdges = [...graph.edges]
    .filter((e) => (!excludeClosed ? true : !e.closed))
    .sort((a, b) => a.constructionCost - b.constructionCost || a.id.localeCompare(b.id));

  const acceptedEdgeIds: string[] = [];
  const rejectedEdgeIds: string[] = [];
  const events: KruskalEvent[] = [];
  let stepIndex = 0;
  let totalCost = 0;
  let consideredEdgeCount = 0;

  const pushEvent = (
    partial: Omit<
      KruskalEvent,
      'stepIndex' | 'acceptedEdgeIds' | 'rejectedEdgeIds' | 'componentMap' | 'componentCount' | 'totalCost'
    >
  ) => {
    if (!recordEvents) return;
    events.push({
      stepIndex: stepIndex++,
      acceptedEdgeIds: [...acceptedEdgeIds],
      rejectedEdgeIds: [...rejectedEdgeIds],
      componentMap: dsu.getComponentMap(),
      componentCount: dsu.getComponentCount(),
      totalCost,
      ...partial,
    });
  };

  pushEvent({
    type: 'sort-edges',
    pseudocodeLine: 0,
    activeEdgeId: null,
    description: `Sorted ${sortedEdges.length} candidate corridors in nondecreasing order of construction cost ($M). Initialized ${nodeIds.length} singleton components.`,
  });

  const targetEdgeCount = Math.max(0, nodeIds.length - 1);

  for (const edge of sortedEdges) {
    if (acceptedEdgeIds.length >= targetEdgeCount) {
      break;
    }

    consideredEdgeCount += 1;

    pushEvent({
      type: 'consider-edge',
      pseudocodeLine: 2,
      activeEdgeId: edge.id,
      description: `Checking ${edge.roadName} (${edge.from} ↔ ${edge.to}) costing $${edge.constructionCost}M.`,
    });

    if (!dsu.connected(edge.from, edge.to)) {
      dsu.union(edge.from, edge.to);
      acceptedEdgeIds.push(edge.id);
      totalCost += edge.constructionCost;

      pushEvent({
        type: 'accept-edge',
        pseudocodeLine: 4,
        activeEdgeId: edge.id,
        description: `Accepted ${edge.roadName} ($${edge.constructionCost}M): merged components of ${edge.from} and ${edge.to}. Components left: ${dsu.getComponentCount()}.`,
      });
    } else {
      rejectedEdgeIds.push(edge.id);

      pushEvent({
        type: 'reject-cycle',
        pseudocodeLine: 6,
        activeEdgeId: edge.id,
        description: `Rejected ${edge.roadName} ($${edge.constructionCost}M): ${edge.from} and ${edge.to} are already connected (would form a cycle).`,
      });
    }
  }

  const components = dsu.getComponents();
  const isConnected = components.length <= 1;
  const label = isConnected ? 'Minimum Spanning Tree' : 'Minimum Spanning Forest';
  const computeTimeMs = Math.max(0.01, nowMs() - startTime);

  pushEvent({
    type: 'complete',
    pseudocodeLine: 7,
    activeEdgeId: null,
    description: isConnected
      ? `Minimum Spanning Tree complete: ${acceptedEdgeIds.length} corridors connecting all ${nodeIds.length} junctions for $${totalCost}M.`
      : `Minimum Spanning Forest complete across ${components.length} disconnected components: ${acceptedEdgeIds.length} corridors for $${totalCost}M.`,
  });

  return {
    algorithm: 'kruskal',
    isConnected,
    label,
    components,
    acceptedEdgeIds,
    rejectedEdgeIds,
    totalCost,
    consideredEdgeCount,
    computeTimeMs,
    events,
  };
}
