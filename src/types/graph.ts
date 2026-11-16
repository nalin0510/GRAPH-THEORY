export type TrafficLevel = 'clear' | 'moderate' | 'heavy' | 'gridlock';

export const TRAFFIC_MULTIPLIERS: Record<TrafficLevel, number> = {
  clear: 1.0,
  moderate: 1.5,
  heavy: 2.4,
  gridlock: 3.5,
};

export const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  clear: 'Clear (1.0×)',
  moderate: 'Moderate (1.5×)',
  heavy: 'Heavy (2.4×)',
  gridlock: 'Gridlock (3.5×)',
};

export interface CityNode {
  id: string;
  label: string;
  district: string;
  x: number; // 0..1000 SVG canvas space
  y: number; // 0..680 SVG canvas space
  kind: 'hub' | 'transit' | 'landmark' | 'junction';
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  roadName: string;
  distanceKm: number;
  baseTimeMin: number;
  trafficMultiplier: number;
  constructionCost: number; // $M USD
  closed: boolean;
  roadClass: 'expressway' | 'arterial' | 'local';
}

export interface CityGraph {
  nodes: CityNode[];
  edges: RoadEdge[];
}

export type DijkstraObjective = 'distance' | 'time';

export type DijkstraEventType =
  | 'init'
  | 'pop-current'
  | 'examine-edge'
  | 'relax-update'
  | 'skip-closed'
  | 'mark-visited'
  | 'complete'
  | 'unreachable';

export interface DijkstraEvent {
  stepIndex: number;
  type: DijkstraEventType;
  currentNodeId: string | null;
  activeEdgeId: string | null;
  targetNodeId: string | null;
  visitedIds: string[];
  frontierIds: string[];
  distances: Record<string, number>;
  treeEdgeIds: string[];
  pathNodeIds: string[];
  pathEdgeIds: string[];
  description: string;
}

export interface DijkstraResult {
  reachable: boolean;
  identicalEndpoints: boolean;
  objective: DijkstraObjective;
  startId: string;
  endId: string;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  totalDistanceKm: number;
  totalTimeMin: number;
  objectiveCost: number;
  visitedCount: number;
  examinedEdgeCount: number;
  computeTimeMs: number;
  events: DijkstraEvent[];
  reason: string;
}

export type MSTAlgorithm = 'prim' | 'kruskal';

export type PrimEventType =
  | 'init'
  | 'consider-edge'
  | 'select-edge'
  | 'skip-visited'
  | 'disconnected-halt'
  | 'complete';

export interface PrimEvent {
  stepIndex: number;
  type: PrimEventType;
  pseudocodeLine: number;
  currentNodeId: string | null;
  activeEdgeId: string | null;
  treeNodeIds: string[];
  treeEdgeIds: string[];
  candidateEdgeIds: string[];
  rejectedEdgeIds: string[];
  totalCost: number;
  description: string;
}

export interface PrimResult {
  algorithm: 'prim';
  startNodeId: string;
  isConnected: boolean;
  label: 'Minimum Spanning Tree' | 'Spanning Tree of Reachable Component (Network Disconnected)';
  components: string[][];
  treeNodeIds: string[];
  treeEdgeIds: string[];
  totalCost: number;
  consideredEdgeCount: number;
  computeTimeMs: number;
  events: PrimEvent[];
}

export type KruskalEventType =
  | 'sort-edges'
  | 'consider-edge'
  | 'accept-edge'
  | 'reject-cycle'
  | 'complete';

export interface KruskalEvent {
  stepIndex: number;
  type: KruskalEventType;
  pseudocodeLine: number;
  activeEdgeId: string | null;
  acceptedEdgeIds: string[];
  rejectedEdgeIds: string[];
  componentMap: Record<string, string>;
  componentCount: number;
  totalCost: number;
  description: string;
}

export interface KruskalResult {
  algorithm: 'kruskal';
  isConnected: boolean;
  label: 'Minimum Spanning Tree' | 'Minimum Spanning Forest';
  components: string[][];
  acceptedEdgeIds: string[];
  rejectedEdgeIds: string[];
  totalCost: number;
  consideredEdgeCount: number;
  computeTimeMs: number;
  events: KruskalEvent[];
}

export type AppSection = 'home' | 'navigate' | 'network-lab' | 'play' | 'compare' | 'about';
export type NavigateMode = 'demo-city' | 'live-map';
export type GameModeId = 'beat-traffic' | 'prims-builder' | 'kruskals-architect';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  trafficByEdgeId: Record<string, number>;
  closedByEdgeId: Record<string, boolean>;
}

export interface GameBestRecord {
  score: number;
  achievedAt: string;
  details: string;
}
