import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { CityGraph, CityNode, RoadEdge } from '../types/graph';

export type EdgeWeightDisplay = 'time' | 'distance' | 'cost' | 'none';

export interface CityGraphCanvasProps {
  graph: CityGraph;
  mode: 'navigate' | 'network-lab' | 'game-traffic' | 'game-prim' | 'game-kruskal';
  weightDisplay: EdgeWeightDisplay;
  // Navigation / Dijkstra overlays
  startNodeId?: string | null;
  endNodeId?: string | null;
  visitedNodeIds?: string[];
  frontierNodeIds?: string[];
  currentNodeId?: string | null;
  activeEdgeId?: string | null;
  treeEdgeIds?: string[];
  routeEdgeIds?: string[];
  routeNodeIds?: string[];
  // MST / Games overlays
  mstSelectedEdgeIds?: string[];
  mstSecondaryEdgeIds?: string[]; // Used in Side-by-Side Comparison (Kruskal overlay)
  mstCandidateEdgeIds?: string[];
  mstRejectedEdgeIds?: string[];
  mstTreeNodeIds?: string[];
  componentMap?: Record<string, string>;
  hintEdgeIds?: string[];
  selectedEdgeId?: string | null;
  pickMode?: 'none' | 'start' | 'end';
  // Interactions
  onNodeClick?: (node: CityNode) => void;
  onEdgeClick?: (edge: RoadEdge) => void;
  showGridCoordinates?: boolean;
  highlightNodeIds?: string[]; // Optional subset focus (used in MST games)
}

const COMPONENT_PALETTE = [
  '#FBBF24', // burnished gold
  '#34D399', // jade emerald
  '#C084FC', // orchid violet
  '#FB923C', // warm tangerine
  '#38BDF8', // cerulean accent
  '#FB7185', // crimson coral
  '#2DD4BF', // teal
  '#F472B6', // magenta-rose
];

const DISTRICT_SECTORS = [
  {
    name: 'HARBORFRONT',
    labelX: 84,
    labelY: 42,
    path: 'M 72,22 L 265,22 L 295,210 L 260,590 L 66,590 C 80,450 68,260 72,22 Z',
    fill: 'rgba(45, 212, 191, 0.03)',
    stroke: 'rgba(45, 212, 191, 0.12)',
  },
  {
    name: 'TECH QUARTER',
    labelX: 335,
    labelY: 42,
    path: 'M 290,22 L 585,22 L 580,220 L 310,220 Z',
    fill: 'rgba(192, 132, 252, 0.035)',
    stroke: 'rgba(192, 132, 252, 0.12)',
  },
  {
    name: 'CIVIC PLAZA',
    labelX: 416,
    labelY: 256,
    path: 'M 310,236 L 578,236 L 590,458 L 295,458 Z',
    fill: 'rgba(251, 191, 36, 0.038)',
    stroke: 'rgba(251, 191, 36, 0.14)',
  },
  {
    name: 'RAIL YARD',
    labelX: 332,
    labelY: 642,
    path: 'M 278,476 L 590,476 L 586,658 L 266,658 Z',
    fill: 'rgba(251, 146, 60, 0.032)',
    stroke: 'rgba(251, 146, 60, 0.11)',
  },
  {
    name: 'RIVERGATE',
    labelX: 682,
    labelY: 42,
    path: 'M 672,22 L 972,22 L 972,250 L 675,250 Z',
    fill: 'rgba(16, 185, 129, 0.035)',
    stroke: 'rgba(52, 211, 153, 0.11)',
  },
  {
    name: 'UNIVERSITY HILLS',
    labelX: 816,
    labelY: 288,
    path: 'M 678,268 L 972,268 L 972,462 L 682,462 Z',
    fill: 'rgba(192, 132, 252, 0.035)',
    stroke: 'rgba(192, 132, 252, 0.11)',
  },
  {
    name: 'AIRPORT BELT',
    labelX: 785,
    labelY: 642,
    path: 'M 674,480 L 972,480 L 972,658 L 670,658 Z',
    fill: 'rgba(245, 158, 11, 0.03)',
    stroke: 'rgba(245, 158, 11, 0.11)',
  },
];

export const CityGraphCanvas: React.FC<CityGraphCanvasProps> = ({
  graph,
  mode,
  weightDisplay,
  startNodeId,
  endNodeId,
  visitedNodeIds = [],
  frontierNodeIds = [],
  currentNodeId,
  activeEdgeId,
  treeEdgeIds = [],
  routeEdgeIds = [],
  routeNodeIds = [],
  mstSelectedEdgeIds = [],
  mstSecondaryEdgeIds = [],
  mstCandidateEdgeIds = [],
  mstRejectedEdgeIds = [],
  mstTreeNodeIds = [],
  componentMap,
  hintEdgeIds = [],
  selectedEdgeId,
  pickMode = 'none',
  onNodeClick,
  onEdgeClick,
  showGridCoordinates = true,
  highlightNodeIds,
}) => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 500, y: 340 });
  const [isDragging, setIsDragging] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  }>({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startPanX: 500,
    startPanY: 340,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const nodeById = useMemo(() => {
    const record: Record<string, CityNode> = {};
    for (const n of graph.nodes) record[n.id] = n;
    return record;
  }, [graph.nodes]);

  const visitedSet = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);
  const frontierSet = useMemo(() => new Set(frontierNodeIds), [frontierNodeIds]);
  const treeEdgeSet = useMemo(() => new Set(treeEdgeIds), [treeEdgeIds]);
  const routeEdgeSet = useMemo(() => new Set(routeEdgeIds), [routeEdgeIds]);
  const routeNodeSet = useMemo(() => new Set(routeNodeIds), [routeNodeIds]);
  const mstSelectedSet = useMemo(() => new Set(mstSelectedEdgeIds), [mstSelectedEdgeIds]);
  const mstSecondarySet = useMemo(() => new Set(mstSecondaryEdgeIds), [mstSecondaryEdgeIds]);
  const mstCandidateSet = useMemo(() => new Set(mstCandidateEdgeIds), [mstCandidateEdgeIds]);
  const mstRejectedSet = useMemo(() => new Set(mstRejectedEdgeIds), [mstRejectedEdgeIds]);
  const mstTreeNodeSet = useMemo(() => new Set(mstTreeNodeIds), [mstTreeNodeIds]);
  const hintSet = useMemo(() => new Set(hintEdgeIds), [hintEdgeIds]);
  const highlightSet = useMemo(
    () => (highlightNodeIds ? new Set(highlightNodeIds) : null),
    [highlightNodeIds]
  );

  // Map component roots consistently to palette indices
  const componentColorByRoot = useMemo(() => {
    const map: Record<string, string> = {};
    if (!componentMap) return map;
    const roots = Array.from(new Set(Object.values(componentMap))).sort();
    roots.forEach((root, idx) => {
      map[root] = COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length];
    });
    return map;
  }, [componentMap]);

  const getEdgeLabelText = (edge: RoadEdge): string => {
    if (edge.closed) return 'CLOSED';
    if (weightDisplay === 'distance') return `${edge.distanceKm.toFixed(1)} km`;
    if (weightDisplay === 'cost') return `$${edge.constructionCost}M`;
    if (weightDisplay === 'time') {
      const mins = edge.baseTimeMin * edge.trafficMultiplier;
      return edge.trafficMultiplier > 1.0
        ? `${mins.toFixed(1)}m (${edge.trafficMultiplier}×)`
        : `${mins.toFixed(1)}m`;
    }
    return '';
  };

  const visibleNodeCount = highlightSet ? highlightSet.size : graph.nodes.length;
  const visibleEdgeCount = useMemo(
    () =>
      highlightSet
        ? graph.edges.filter((e) => highlightSet.has(e.from) && highlightSet.has(e.to)).length
        : graph.edges.length,
    [graph.edges, highlightSet]
  );

  const clampPan = (nextX: number, nextY: number, z: number) => {
    const vw = 1000 / z;
    const vh = 680 / z;
    return {
      x: Math.max(vw / 2, Math.min(1000 - vw / 2, nextX)),
      y: Math.max(vh / 2, Math.min(680 - vh / 2, nextY)),
    };
  };

  const handleZoomChange = (delta: number) => {
    setZoom((prev) => {
      const next = Math.max(1, Math.min(2.4, Number((prev + delta).toFixed(2))));
      setPan((p) => (next === 1 ? { x: 500, y: 340 } : clampPan(p.x, p.y, next)));
      return next;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 500, y: 340 });
  };

  const viewWidth = 1000 / zoom;
  const viewHeight = 680 / zoom;
  const clampedCenter = clampPan(pan.x, pan.y, zoom);
  const viewBoxStr = `${(clampedCenter.x - viewWidth / 2).toFixed(1)} ${(
    clampedCenter.y -
    viewHeight / 2
  ).toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`;

  const routeSvgPath = useMemo(() => {
    if ((mode !== 'navigate' && mode !== 'game-traffic') || routeNodeIds.length < 2) return null;
    const pts = routeNodeIds
      .map((id) => nodeById[id])
      .filter((n): n is CityNode => Boolean(n));
    if (pts.length < 2) return null;
    return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [mode, routeNodeIds, nodeById]);

  return (
    <div className="relative w-full h-full min-h-[440px] bg-[#0D0B09] rounded-xl border border-stone-800/95 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] overflow-hidden select-none">
      {/* Subtle Top Viewport Corner Telemetry Strip (Real Graph Counts Only) */}
      <div className="pointer-events-none absolute top-2.5 left-3.5 right-3.5 z-10 flex items-center justify-between text-[10px] font-mono text-stone-400">
        <span className="px-2 py-0.5 rounded bg-[#14110E]/85 border border-stone-800/80">
          {visibleNodeCount} Junctions · {visibleEdgeCount} Corridors
        </span>
        <span className="hidden sm:inline px-2 py-0.5 rounded bg-[#14110E]/85 border border-stone-800/80 text-amber-300/85">
          {mode === 'navigate' || mode === 'game-traffic'
            ? 'Dynamic Traffic Topology'
            : 'Undirected Backbone Grid'}
        </span>
      </div>

      {/* Pick-on-graph mode prompt bar */}
      {pickMode !== 'none' && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg bg-amber-950/95 border border-amber-400/60 text-xs font-medium text-amber-100 shadow-lg">
          Click any junction on the map to set{' '}
          <span className="font-semibold text-amber-300">
            {pickMode === 'start' ? 'Start Location' : 'Destination'}
          </span>
        </div>
      )}

      <svg
        viewBox={viewBoxStr}
        className={`w-full h-full block ${
          zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        role="img"
        aria-label="RouteVerse Interactive City Graph Canvas"
        onPointerDown={(e) => {
          if (zoom <= 1 || e.button !== 0) return;
          dragRef.current = {
            active: true,
            moved: false,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startPanX: clampedCenter.x,
            startPanY: clampedCenter.y,
          };
          setIsDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const dxPx = e.clientX - dragRef.current.startClientX;
          const dyPx = e.clientY - dragRef.current.startClientY;
          if (Math.hypot(dxPx, dyPx) > 4) {
            dragRef.current.moved = true;
          }
          const scaleX = viewWidth / rect.width;
          const scaleY = viewHeight / rect.height;
          setPan(
            clampPan(
              dragRef.current.startPanX - dxPx * scaleX,
              dragRef.current.startPanY - dyPx * scaleY,
              zoom
            )
          );
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
          setIsDragging(false);
        }}
        onPointerLeave={() => {
          dragRef.current.active = false;
          setIsDragging(false);
        }}
        onClickCapture={(e) => {
          if (dragRef.current.moved) {
            e.stopPropagation();
            dragRef.current.moved = false;
          }
        }}
      >
        <defs>
          <radialGradient id="atlas-bg" cx="50%" cy="46%" r="65%">
            <stop offset="0%" stopColor="#1D1712" />
            <stop offset="55%" stopColor="#120F0C" />
            <stop offset="100%" stopColor="#090807" />
          </radialGradient>

          <pattern id="minor-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path
              d="M 25 0 L 0 0 0 25"
              fill="none"
              stroke="rgba(214, 211, 209, 0.04)"
              strokeWidth="0.75"
            />
          </pattern>

          <pattern id="major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#minor-grid)" />
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="rgba(245, 158, 11, 0.09)"
              strokeWidth="1"
            />
            <path
              d="M -3 0 L 3 0 M 0 -3 L 0 3"
              fill="none"
              stroke="rgba(251, 191, 36, 0.25)"
              strokeWidth="1"
            />
          </pattern>

          <linearGradient id="river-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D2226" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#133136" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0D2226" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="harbor-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0C1E22" stopOpacity="0.96" />
            <stop offset="65%" stopColor="#112A2F" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#090807" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="route-core-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#FEF08A" />
          </linearGradient>

          <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Deep Obsidian Bronze Base Canvas */}
        <rect width="1000" height="680" fill="url(#atlas-bg)" />

        {/* Dual-Scale Coordinate Grid */}
        {showGridCoordinates && <rect width="1000" height="680" fill="url(#major-grid)" />}

        {/* Concentric Geospatial Range Rings centered near Civic Plaza */}
        <g className="pointer-events-none" opacity="0.5">
          {[140, 270, 410].map((r) => (
            <circle
              key={r}
              cx={475}
              cy={340}
              r={r}
              fill="none"
              stroke="rgba(245, 158, 11, 0.09)"
              strokeDasharray="4 6"
              strokeWidth={1}
            />
          ))}
          <line
            x1={475}
            y1={20}
            x2={475}
            y2={660}
            stroke="rgba(245, 158, 11, 0.055)"
            strokeWidth={1}
          />
          <line
            x1={25}
            y1={340}
            x2={975}
            y2={340}
            stroke="rgba(245, 158, 11, 0.055)"
            strokeWidth={1}
          />
        </g>

        {/* District Zone Polygons */}
        <g className="pointer-events-none">
          {DISTRICT_SECTORS.map((sector) => (
            <g key={sector.name}>
              <path
                d={sector.path}
                fill={sector.fill}
                stroke={sector.stroke}
                strokeWidth={1}
                strokeDasharray="6 6"
              />
              <text
                x={sector.labelX}
                y={sector.labelY}
                fill="#78716C"
                fontSize="9.5"
                fontWeight="700"
                letterSpacing="0.16em"
              >
                {sector.name}
              </text>
            </g>
          ))}
        </g>

        {/* Western Harbor Shoreline & Pier Contours */}
        <path
          d="M 0,0 L 72,0 C 56,140 60,280 76,410 C 88,515 74,605 56,680 L 0,680 Z"
          fill="url(#harbor-grad)"
        />
        <path
          d="M 72,0 C 56,140 60,280 76,410 C 88,515 74,605 56,680"
          fill="none"
          stroke="rgba(45, 212, 191, 0.3)"
          strokeWidth="1.6"
        />
        {/* Coastal Depth Contour + Pier Spurs */}
        <path
          d="M 48,0 C 35,150 40,290 54,420 C 64,520 50,605 35,680"
          fill="none"
          stroke="rgba(45, 212, 191, 0.16)"
          strokeWidth="1"
          className="animate-river-current"
        />
        {[175, 310, 455].map((py) => (
          <line
            key={py}
            x1={42}
            y1={py}
            x2={70}
            y2={py}
            stroke="rgba(45, 212, 191, 0.25)"
            strokeWidth={2}
          />
        ))}

        {/* Rivergate Channel separating West/Central and East Bank */}
        <path
          d="M 608,0 C 625,130 595,250 618,370 C 638,480 605,590 616,680 L 658,680 C 647,590 680,480 660,370 C 637,250 667,130 650,0 Z"
          fill="url(#river-grad)"
        />
        <path
          d="M 608,0 C 625,130 595,250 618,370 C 638,480 605,590 616,680 M 650,0 C 667,130 637,250 660,370 C 680,480 647,590 658,680"
          fill="none"
          stroke="rgba(45, 212, 191, 0.3)"
          strokeWidth="1.2"
        />
        {/* Animated Center River Current Streams */}
        <path
          d="M 629,0 C 646,130 616,250 639,370 C 659,480 626,590 637,680"
          fill="none"
          stroke="rgba(94, 234, 212, 0.22)"
          strokeWidth="1.5"
          className="animate-river-current pointer-events-none"
        />

        {/* Edges */}
        {graph.edges.map((edge) => {
          const from = nodeById[edge.from];
          const to = nodeById[edge.to];
          if (!from || !to) return null;

          const isSubgraphDimmed =
            highlightSet !== null && (!highlightSet.has(edge.from) || !highlightSet.has(edge.to));
          if (isSubgraphDimmed) return null;

          const isHovered = hoveredEdgeId === edge.id;
          const isSelected = selectedEdgeId === edge.id;
          const isActiveStep = activeEdgeId === edge.id;
          const isRoute = routeEdgeSet.has(edge.id);
          const isTree = treeEdgeSet.has(edge.id);
          const isMstPrimary = mstSelectedSet.has(edge.id);
          const isMstSecondary = mstSecondarySet.has(edge.id);
          const isMstCandidate = mstCandidateSet.has(edge.id);
          const isMstRejected = mstRejectedSet.has(edge.id);
          const isHint = hintSet.has(edge.id);

          const isRiverBridge =
            (from.x < 625 && to.x > 640) || (to.x < 625 && from.x > 640);

          // Determine visual stroke & pattern
          let stroke = edge.roadClass === 'expressway' ? '#57534E' : '#3F3A36';
          let strokeWidth = edge.roadClass === 'expressway' ? 4 : 2.6;
          let strokeDasharray: string | undefined = undefined;
          let opacity = 0.88;

          if (mode === 'navigate' || mode === 'game-traffic') {
            if (edge.closed) {
              stroke = '#F43F5E';
              strokeWidth = 3.2;
              strokeDasharray = '6 5';
              opacity = 0.94;
            } else if (edge.trafficMultiplier >= 3.0) {
              stroke = '#DC2626';
              strokeWidth = 5;
            } else if (edge.trafficMultiplier >= 2.0) {
              stroke = '#EA580C';
              strokeWidth = 4.4;
            } else if (edge.trafficMultiplier >= 1.4) {
              stroke = '#F97316';
              strokeWidth = 3.6;
            }

            if (isTree && !isRoute) {
              stroke = '#B45309';
              strokeWidth = 3.8;
              opacity = 0.96;
            }
            if (isActiveStep) {
              stroke = '#FDBA74';
              strokeWidth = 6;
              opacity = 1;
            }
            if (isRoute) {
              stroke = '#FACC15';
              strokeWidth = 6.5;
              opacity = 1;
            }
          } else {
            // Network Lab & MST Games
            if (edge.closed) {
              stroke = '#57534E';
              strokeDasharray = '4 6';
              opacity = 0.28;
            } else if (isMstRejected) {
              stroke = '#FB7185';
              strokeWidth = 2.6;
              strokeDasharray = '5 4';
              opacity = 0.72;
            } else if (isMstPrimary && isMstSecondary) {
              stroke = '#10B981';
              strokeWidth = 6;
              opacity = 1;
            } else if (isMstPrimary) {
              stroke = '#10B981';
              strokeWidth = 6;
              opacity = 1;
            } else if (isMstSecondary) {
              stroke = '#C084FC';
              strokeWidth = 4.8;
              strokeDasharray = '9 4';
              opacity = 1;
            } else if (isMstCandidate) {
              stroke = '#FBBF24';
              strokeWidth = 3.8;
              strokeDasharray = '4 3';
              opacity = 0.96;
            }
            if (isActiveStep) {
              stroke = '#FDE047';
              strokeWidth = 6;
              opacity = 1;
            }
          }

          if (isHint) {
            stroke = '#FEF08A';
            strokeWidth = 5.5;
            opacity = 1;
          }

          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const labelText = getEdgeLabelText(edge);
          const showLabel =
            weightDisplay !== 'none' &&
            (isHovered ||
              isSelected ||
              isRoute ||
              isActiveStep ||
              isMstPrimary ||
              isMstSecondary ||
              isMstCandidate ||
              isHint ||
              edge.closed ||
              (mode === 'navigate' && edge.trafficMultiplier >= 2.0) ||
              highlightSet !== null ||
              weightDisplay === 'cost');

          const badgeWidth = labelText.length * 6.6 + 16;

          return (
            <g
              key={edge.id}
              className={onEdgeClick ? 'cursor-pointer' : ''}
              role={onEdgeClick ? 'button' : undefined}
              tabIndex={onEdgeClick ? 0 : undefined}
              aria-label={`${edge.roadName} from ${from.label} to ${to.label}, ${edge.distanceKm} km, $${edge.constructionCost}M${edge.closed ? ', closed' : ''}`}
              onClick={() => onEdgeClick?.(edge)}
              onKeyDown={(e) => {
                if (onEdgeClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onEdgeClick(edge);
                }
              }}
              onMouseEnter={() => setHoveredEdgeId(edge.id)}
              onMouseLeave={() => setHoveredEdgeId(null)}
            >
              {/* Asphalt Roadbed Casing (Architectural Depth) */}
              {!edge.closed && (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#090807"
                  strokeWidth={strokeWidth + 4.5}
                  strokeOpacity={0.88}
                  strokeLinecap="round"
                />
              )}

              {/* Bridge Span Pylons / Girders for River Crossings */}
              {isRiverBridge && (
                <g className="pointer-events-none" opacity={edge.closed ? 0.35 : 0.9}>
                  <line
                    x1={mx - nx * 9}
                    y1={my - ny * 9}
                    x2={mx + nx * 9}
                    y2={my + ny * 9}
                    stroke="#FBBF24"
                    strokeWidth={2}
                    strokeOpacity={0.45}
                  />
                  <line
                    x1={mx - (dx / len) * 18 - nx * 7}
                    y1={my - (dy / len) * 18 - ny * 7}
                    x2={mx + (dx / len) * 18 - nx * 7}
                    y2={my + (dy / len) * 18 - ny * 7}
                    stroke="#78716C"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={mx - (dx / len) * 18 + nx * 7}
                    y1={my - (dy / len) * 18 + ny * 7}
                    x2={mx + (dx / len) * 18 + nx * 7}
                    y2={my + (dy / len) * 18 + ny * 7}
                    stroke="#78716C"
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {/* Selection / Congestion / Active Glow Halo */}
              {(isSelected ||
                isHovered ||
                isHint ||
                isRoute ||
                isMstPrimary ||
                (mode === 'navigate' && !edge.closed && edge.trafficMultiplier >= 2.0)) && (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={
                    isHint
                      ? '#FEF08A'
                      : isRoute
                      ? '#FACC15'
                      : isMstPrimary
                      ? '#10B981'
                      : isSelected || isHovered
                      ? '#FBBF24'
                      : '#EA580C'
                  }
                  strokeWidth={strokeWidth + (isRoute || isMstPrimary ? 7 : 5)}
                  strokeOpacity={isRoute || isMstPrimary ? 0.24 : 0.22}
                  strokeLinecap="round"
                  filter={isRoute ? 'url(#glow-gold)' : isMstPrimary ? 'url(#glow-emerald)' : undefined}
                />
              )}

              {/* Base Edge Line */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />

              {/* Subtle Highway Median Lane Line on Unhighlighted Expressways */}
              {edge.roadClass === 'expressway' &&
                !edge.closed &&
                !isRoute &&
                !isMstPrimary &&
                !isActiveStep && (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="rgba(214, 211, 209, 0.25)"
                    strokeWidth={1}
                    strokeDasharray="4 6"
                    className="pointer-events-none"
                  />
                )}

              {/* Animated Directional Flow Overlay for Optimal Route */}
              {isRoute && !edge.closed && (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#FFFBEB"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  className="animate-route-flow pointer-events-none"
                />
              )}

              {/* Animated Fiber Backbone Pulse for Prim/Kruskal MST */}
              {isMstPrimary && !edge.closed && (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#D1FAE5"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  className="animate-mst-flow pointer-events-none"
                />
              )}

              {/* Invisible wide touch/click target */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="transparent"
                strokeWidth={18}
              />

              {/* Edge Weight / Closure Tactical Badge */}
              {showLabel && labelText && (
                <g transform={`translate(${mx}, ${my})`} className="pointer-events-none">
                  <rect
                    x={-badgeWidth / 2}
                    y={-9.5}
                    width={badgeWidth}
                    height={19}
                    rx={4.5}
                    fill={
                      edge.closed
                        ? '#3B0819'
                        : isRoute
                        ? '#362304'
                        : isMstPrimary
                        ? '#03291F'
                        : '#14110E'
                    }
                    stroke={
                      edge.closed
                        ? '#FB7185'
                        : isRoute
                        ? '#FACC15'
                        : isMstPrimary
                        ? '#34D399'
                        : isMstSecondary
                        ? '#C084FC'
                        : edge.trafficMultiplier >= 2.0 &&
                          (mode === 'navigate' || mode === 'game-traffic')
                        ? '#F97316'
                        : '#44403C'
                    }
                    strokeWidth={1}
                  />
                  {/* Left color accent strip inside tag */}
                  <rect
                    x={-badgeWidth / 2 + 2}
                    y={-6.5}
                    width={2.5}
                    height={13}
                    rx={1}
                    fill={
                      edge.closed
                        ? '#FB7185'
                        : isRoute
                        ? '#FACC15'
                        : isMstPrimary
                        ? '#34D399'
                        : isMstSecondary
                        ? '#C084FC'
                        : edge.trafficMultiplier >= 2.0 &&
                          (mode === 'navigate' || mode === 'game-traffic')
                        ? '#FB923C'
                        : '#78716C'
                    }
                  />
                  <text
                    x={2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      edge.closed
                        ? '#FECDD3'
                        : isRoute
                        ? '#FEF9C3'
                        : isMstPrimary
                        ? '#A7F3D0'
                        : isMstSecondary
                        ? '#E9D5FF'
                        : edge.trafficMultiplier >= 2.0 &&
                          (mode === 'navigate' || mode === 'game-traffic')
                        ? '#FED7AA'
                        : '#D6D3D1'
                    }
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="600"
                  >
                    {labelText}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Animated Route Courier Beacon traveling optimal Dijkstra path */}
        {routeSvgPath && !prefersReducedMotion && (
          <g className="pointer-events-none">
            <circle r={7.5} fill="#FACC15" fillOpacity={0.28}>
              <animateMotion
                dur={`${Math.max(2.4, Math.min(6.5, routeNodeIds.length * 0.72)).toFixed(1)}s`}
                repeatCount="indefinite"
                path={routeSvgPath}
              />
            </circle>
            <circle r={3.6} fill="#FFFBEB" stroke="#FACC15" strokeWidth={1.6}>
              <animateMotion
                dur={`${Math.max(2.4, Math.min(6.5, routeNodeIds.length * 0.72)).toFixed(1)}s`}
                repeatCount="indefinite"
                path={routeSvgPath}
              />
            </circle>
          </g>
        )}

        {/* Nodes / Junctions */}
        {graph.nodes.map((node) => {
          if (highlightSet && !highlightSet.has(node.id)) return null;

          const isStart = startNodeId === node.id;
          const isEnd = endNodeId === node.id;
          const isCurrent = currentNodeId === node.id;
          const isVisited = visitedSet.has(node.id);
          const isFrontier = frontierSet.has(node.id);
          const isRouteNode = routeNodeSet.has(node.id);
          const isMstNode = mstTreeNodeSet.has(node.id);
          const isHovered = hoveredNodeId === node.id;

          let fill = '#161310';
          let stroke = '#78716C';
          let radius = node.kind === 'hub' ? 11.5 : 9.2;

          if (mode === 'navigate' || mode === 'game-traffic') {
            if (isVisited) {
              fill = '#78350F';
              stroke = '#F59E0B';
            }
            if (isFrontier) {
              fill = '#2B1F11';
              stroke = '#FBBF24';
            }
            if (isRouteNode) {
              fill = '#422006';
              stroke = '#FACC15';
              radius = 11.5;
            }
            if (isCurrent) {
              fill = '#B45309';
              stroke = '#FEFCE8';
              radius = 13.5;
            }
            if (isStart) {
              fill = '#059669';
              stroke = '#A7F3D0';
              radius = 13.5;
            }
            if (isEnd) {
              fill = '#D97706';
              stroke = '#FEF08A';
              radius = 13.5;
            }
          } else {
            if (componentMap && componentMap[node.id]) {
              const compColor = componentColorByRoot[componentMap[node.id]] || '#78716C';
              fill = '#161310';
              stroke = compColor;
            }
            if (isMstNode) {
              fill = '#065F46';
              stroke = '#34D399';
              radius = 11.5;
            }
            if (isStart || isCurrent) {
              fill = '#059669';
              stroke = '#ECFDF5';
              radius = 13.5;
            }
          }

          const octR = radius + 4.5;
          const octPoints = Array.from({ length: 8 }, (_, idx) => {
            const ang = (idx * Math.PI) / 4 + Math.PI / 8;
            return `${(Math.cos(ang) * octR).toFixed(1)},${(Math.sin(ang) * octR).toFixed(1)}`;
          }).join(' ');

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className={onNodeClick ? 'cursor-pointer focus:outline-none' : 'focus:outline-none'}
              role={onNodeClick ? 'button' : undefined}
              tabIndex={onNodeClick ? 0 : undefined}
              aria-label={`${node.label} (${node.id}), ${node.district}${isStart ? ', Start' : ''}${isEnd ? ', Destination' : ''}`}
              onClick={() => onNodeClick?.(node)}
              onKeyDown={(e) => {
                if (onNodeClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onNodeClick(node);
                }
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            >
              {/* Animated Beacon Halo for Start, Destination & Active Cursor */}
              {(isStart || isEnd || isCurrent) && (
                <circle
                  r={radius + 5}
                  fill="none"
                  stroke={isStart ? '#34D399' : isEnd ? '#FACC15' : '#FB923C'}
                  strokeWidth={1.8}
                  className="animate-beacon-ring pointer-events-none"
                />
              )}

              {/* Outer Tactical Frame / Hub Octagon */}
              {node.kind === 'hub' && (
                <polygon
                  points={octPoints}
                  fill="none"
                  stroke={isStart ? '#34D399' : isEnd ? '#FACC15' : '#57534E'}
                  strokeWidth={1.2}
                  strokeOpacity={0.75}
                />
              )}

              {/* Outer focus / active ring */}
              {(isStart || isEnd || isCurrent || isHovered) && (
                <circle
                  r={radius + 6.5}
                  fill="none"
                  stroke={isStart ? '#10B981' : isEnd ? '#FACC15' : '#FBBF24'}
                  strokeWidth={1.8}
                  strokeOpacity={0.62}
                />
              )}

              {/* Touch-friendly invisible hit circle */}
              <circle r={22} fill="transparent" />

              {/* Outer Socket Well */}
              <circle r={radius + 1.5} fill="#0A0908" />

              {/* Main Node Circle */}
              <circle r={radius} fill={fill} stroke={stroke} strokeWidth={2.4} />

              {/* Role indicator inside start/end */}
              {(isStart || isEnd) && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FAFAF9"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  {isStart ? 'S' : 'D'}
                </text>
              )}

              {/* Precision Inner Core Dot for hubs & landmarks */}
              {!isStart && !isEnd && (node.kind === 'hub' || node.kind === 'landmark') && (
                <circle
                  r={2.5}
                  fill={isRouteNode ? '#FEF08A' : isMstNode ? '#6EE7B7' : '#A8A29E'}
                  className="pointer-events-none"
                />
              )}

              {/* Clean High-Contrast Text Halo Label */}
              <text
                y={radius + 14.5}
                textAnchor="middle"
                fill="#0A0908"
                stroke="#0A0908"
                strokeWidth={4}
                strokeLinejoin="round"
                fontSize="10.5"
                fontWeight="600"
                className="pointer-events-none"
              >
                {node.id} · {node.label}
              </text>
              <text
                y={radius + 14.5}
                textAnchor="middle"
                fill={isStart || isEnd || isRouteNode || isMstNode ? '#FAFAF9' : '#D6D3D1'}
                fontSize="10.5"
                fontWeight="600"
                className="pointer-events-none"
              >
                {node.id} · {node.label}
              </text>
            </g>
          );
        })}

        {/* Vector Compass Rose (Top Right of Map Stage) */}
        <g transform="translate(946, 70)" className="pointer-events-none" opacity="0.68">
          <circle r={18} fill="rgba(13,11,9,0.78)" stroke="rgba(251,191,36,0.35)" strokeWidth={1} />
          <path d="M 0,-14 L 4,-3 L 0,0 L -4,-3 Z" fill="#FBBF24" />
          <path d="M 0,14 L 3,4 L 0,0 L -3,4 Z" fill="#57534E" />
          <line x1={-12} y1={0} x2={12} y2={0} stroke="rgba(168,162,158,0.35)" strokeWidth={1} />
          <text
            y={-21}
            textAnchor="middle"
            fill="#FCD34D"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            N
          </text>
        </g>

        {/* Bottom-Left Cartographic Scale Bar */}
        <g transform="translate(88, 658)" className="pointer-events-none" opacity="0.68">
          <path d="M 0,0 L 0,5 L 80,5 L 80,0" fill="none" stroke="#78716C" strokeWidth={1.3} />
          <line x1={40} y1={2} x2={40} y2={5} stroke="#78716C" strokeWidth={1.2} />
          <text
            x={86}
            y={5}
            fill="#A8A29E"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
          >
            {(1.0 / zoom).toFixed(1)} km
          </text>
        </g>
      </svg>

      {/* Compact Canvas Zoom / Pan Control Bar */}
      <div className="absolute bottom-12 right-3 z-10 flex items-center gap-1 p-1 rounded-lg bg-[#14110E]/92 border border-stone-800/90 shadow-lg">
        <button
          type="button"
          onClick={() => handleZoomChange(-0.35)}
          disabled={zoom <= 1}
          title="Zoom out"
          aria-label="Zoom out"
          className="p-1.5 rounded text-stone-300 hover:bg-stone-800/80 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="px-1.5 text-[10px] font-mono text-amber-200 tabular-nums min-w-[36px] text-center">
          {zoom.toFixed(1)}×
        </span>
        <button
          type="button"
          onClick={() => handleZoomChange(0.35)}
          disabled={zoom >= 2.4}
          title="Zoom in"
          aria-label="Zoom in"
          className="p-1.5 rounded text-stone-300 hover:bg-stone-800/80 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        {zoom > 1 && (
          <button
            type="button"
            onClick={handleResetView}
            title="Reset zoom and pan"
            aria-label="Reset zoom and pan"
            className="p-1.5 rounded text-amber-300 hover:bg-stone-800/80 cursor-pointer transition-colors border-l border-stone-800/80 pl-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Accessible Legend (Color + Pattern + Text Label) */}
      <div className="px-4 py-2.5 bg-[#120F0C]/95 border-t border-stone-800/90 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] text-stone-300">
        {mode === 'navigate' || mode === 'game-traffic' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-stone-500 inline-block" />
              <span>Clear road</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-1 bg-orange-600 inline-block rounded-full" />
              <span>Congestion (1.5×–3.5×)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-rose-500 inline-block" />
              <span>Closed road</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-amber-700 inline-block" />
              <span>Explored</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-1 bg-yellow-400 inline-block rounded-full shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
              <span>Optimal route</span>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-1 bg-emerald-400 inline-block rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span>{mstSecondaryEdgeIds.length > 0 ? "Prim's MST" : 'Selected MST edge'}</span>
            </span>
            {mstSecondaryEdgeIds.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-purple-400 inline-block" />
                <span>Kruskal's MST</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />
              <span>Frontier candidate</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-rose-400 inline-block" />
              <span>Rejected (cycle)</span>
            </span>
          </div>
        )}
        <span className="text-stone-400">
          {mode === 'navigate' || mode === 'game-traffic'
            ? 'Simulated city traffic · Click any road to inspect'
            : 'Undirected planning model · Edge weights in $M'}
        </span>
      </div>
    </div>
  );
};
