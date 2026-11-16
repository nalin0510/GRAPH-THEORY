import { CityGraph, CityNode, RoadEdge } from '../types/graph';

export const DEMO_CITY_NODES: CityNode[] = [
  // West Harbor & Coast
  { id: 'J1', label: 'Harbor Pier', district: 'Harborfront', x: 90, y: 155, kind: 'landmark' },
  { id: 'J2', label: 'North Docks', district: 'Harborfront', x: 185, y: 82, kind: 'transit' },
  { id: 'J3', label: 'Marina Gate', district: 'Harborfront', x: 95, y: 345, kind: 'junction' },
  { id: 'J4', label: 'Old Market', district: 'Old Town', x: 215, y: 245, kind: 'hub' },
  { id: 'J5', label: 'Lighthouse Pt', district: 'Harborfront', x: 115, y: 525, kind: 'landmark' },
  { id: 'J6', label: 'Foundry Row', district: 'Old Town', x: 245, y: 425, kind: 'junction' },

  // Tech Quarter & Midtown
  { id: 'J7', label: 'Tech Campus', district: 'Tech Quarter', x: 355, y: 92, kind: 'landmark' },
  { id: 'J8', label: 'Signal Hub', district: 'Tech Quarter', x: 365, y: 210, kind: 'hub' },
  { id: 'J9', label: 'Civic Plaza', district: 'Civic Plaza', x: 375, y: 345, kind: 'hub' },
  { id: 'J10', label: 'North Ridge', district: 'Tech Quarter', x: 525, y: 105, kind: 'junction' },
  { id: 'J11', label: 'Midtown Sq', district: 'Civic Plaza', x: 515, y: 240, kind: 'hub' },
  { id: 'J12', label: 'Rail Central', district: 'Rail Yard', x: 355, y: 500, kind: 'transit' },
  { id: 'J13', label: 'Grand Viaduct', district: 'Civic Plaza', x: 530, y: 375, kind: 'hub' },
  { id: 'J14', label: 'South Freight', district: 'Rail Yard', x: 265, y: 595, kind: 'junction' },
  { id: 'J15', label: 'South Crossing', district: 'Rail Yard', x: 485, y: 560, kind: 'transit' },

  // East Rivergate, University & BioPark (across River Channel at x ~ 640)
  { id: 'J16', label: 'East Locks', district: 'Rivergate', x: 695, y: 95, kind: 'junction' },
  { id: 'J17', label: 'North Bridgehead', district: 'Rivergate', x: 690, y: 215, kind: 'transit' },
  { id: 'J18', label: 'Uni Crest', district: 'University Hills', x: 830, y: 120, kind: 'landmark' },
  { id: 'J19', label: 'Rivergate Hub', district: 'Rivergate', x: 705, y: 360, kind: 'hub' },
  { id: 'J20', label: 'Faculty Green', district: 'University Hills', x: 875, y: 255, kind: 'junction' },
  { id: 'J21', label: 'South Bridgehead', district: 'Airport Belt', x: 695, y: 535, kind: 'transit' },
  { id: 'J22', label: 'BioPark Lab', district: 'University Hills', x: 895, y: 390, kind: 'landmark' },
  { id: 'J23', label: 'Aero Terminal', district: 'Airport Belt', x: 865, y: 565, kind: 'transit' },
  { id: 'J24', label: 'Solar Depot', district: 'Airport Belt', x: 785, y: 465, kind: 'junction' },
];

export const DEMO_CITY_EDGES: RoadEdge[] = [
  // Harborfront & Old Town
  { id: 'E01', from: 'J1', to: 'J2', roadName: 'Harbor Loop N', distanceKm: 2.1, baseTimeMin: 2.3, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'expressway' },
  { id: 'E02', from: 'J1', to: 'J4', roadName: 'Pier Avenue', distanceKm: 1.8, baseTimeMin: 2.8, trafficMultiplier: 1.5, constructionCost: 5, closed: false, roadClass: 'arterial' },
  { id: 'E03', from: 'J1', to: 'J3', roadName: 'Seawall Drive', distanceKm: 2.4, baseTimeMin: 3.4, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'arterial' },
  { id: 'E04', from: 'J2', to: 'J4', roadName: 'Customhouse St', distanceKm: 2.2, baseTimeMin: 3.6, trafficMultiplier: 1.5, constructionCost: 6, closed: false, roadClass: 'local' },
  { id: 'E05', from: 'J2', to: 'J7', roadName: 'North Expressway', distanceKm: 2.5, baseTimeMin: 2.2, trafficMultiplier: 1.0, constructionCost: 11, closed: false, roadClass: 'expressway' },
  { id: 'E06', from: 'J3', to: 'J4', roadName: 'Marina Boulevard', distanceKm: 1.9, baseTimeMin: 2.9, trafficMultiplier: 1.0, constructionCost: 5, closed: false, roadClass: 'arterial' },
  { id: 'E07', from: 'J3', to: 'J5', roadName: 'Coastline Way', distanceKm: 2.6, baseTimeMin: 3.1, trafficMultiplier: 1.0, constructionCost: 8, closed: false, roadClass: 'arterial' },
  { id: 'E08', from: 'J3', to: 'J6', roadName: 'Tidewater Road', distanceKm: 2.1, baseTimeMin: 3.3, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'local' },
  { id: 'E09', from: 'J4', to: 'J8', roadName: 'Clocktower Rd', distanceKm: 2.0, baseTimeMin: 3.0, trafficMultiplier: 1.5, constructionCost: 7, closed: false, roadClass: 'arterial' },
  { id: 'E10', from: 'J4', to: 'J9', roadName: 'Old Town Spine', distanceKm: 1.9, baseTimeMin: 3.5, trafficMultiplier: 2.4, constructionCost: 9, closed: false, roadClass: 'arterial' },
  { id: 'E11', from: 'J5', to: 'J6', roadName: 'Beacon Street', distanceKm: 2.3, baseTimeMin: 3.2, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'local' },
  { id: 'E12', from: 'J5', to: 'J14', roadName: 'South Causeway', distanceKm: 2.9, baseTimeMin: 3.1, trafficMultiplier: 1.0, constructionCost: 9, closed: false, roadClass: 'expressway' },

  // Tech Quarter, Civic Plaza & Rail Yard
  { id: 'E13', from: 'J6', to: 'J9', roadName: 'Foundry Arch', distanceKm: 1.8, baseTimeMin: 2.9, trafficMultiplier: 1.5, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E14', from: 'J6', to: 'J12', roadName: 'Ironworks Ave', distanceKm: 1.7, baseTimeMin: 2.6, trafficMultiplier: 1.0, constructionCost: 5, closed: false, roadClass: 'local' },
  { id: 'E15', from: 'J7', to: 'J8', roadName: 'Silicon Lane', distanceKm: 1.6, baseTimeMin: 2.2, trafficMultiplier: 1.0, constructionCost: 4, closed: false, roadClass: 'arterial' },
  { id: 'E16', from: 'J7', to: 'J10', roadName: 'Ridge Expressway', distanceKm: 2.4, baseTimeMin: 2.1, trafficMultiplier: 1.0, constructionCost: 10, closed: false, roadClass: 'expressway' },
  { id: 'E17', from: 'J8', to: 'J9', roadName: 'Civic Connector', distanceKm: 1.7, baseTimeMin: 2.8, trafficMultiplier: 1.5, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E18', from: 'J8', to: 'J11', roadName: 'Fiber Corridor', distanceKm: 2.0, baseTimeMin: 2.5, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'arterial' },
  { id: 'E19', from: 'J9', to: 'J11', roadName: 'Midtown Promenade', distanceKm: 2.1, baseTimeMin: 3.4, trafficMultiplier: 2.4, constructionCost: 8, closed: false, roadClass: 'arterial' },
  { id: 'E20', from: 'J9', to: 'J13', roadName: 'Central Tunnel', distanceKm: 1.8, baseTimeMin: 3.1, trafficMultiplier: 2.4, constructionCost: 12, closed: false, roadClass: 'arterial' },
  { id: 'E21', from: 'J9', to: 'J12', roadName: 'Station Approach', distanceKm: 2.1, baseTimeMin: 3.0, trafficMultiplier: 1.5, constructionCost: 6, closed: false, roadClass: 'local' },
  { id: 'E22', from: 'J10', to: 'J11', roadName: 'Summit Drop', distanceKm: 1.9, baseTimeMin: 2.4, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E23', from: 'J11', to: 'J13', roadName: 'Plaza Avenue', distanceKm: 1.7, baseTimeMin: 2.7, trafficMultiplier: 1.5, constructionCost: 5, closed: false, roadClass: 'arterial' },
  { id: 'E24', from: 'J12', to: 'J14', roadName: 'Yard Spur', distanceKm: 1.8, baseTimeMin: 2.5, trafficMultiplier: 1.0, constructionCost: 4, closed: false, roadClass: 'local' },
  { id: 'E25', from: 'J12', to: 'J15', roadName: 'Freight Bypass', distanceKm: 2.0, baseTimeMin: 2.4, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E26', from: 'J13', to: 'J15', roadName: 'Viaduct South', distanceKm: 2.5, baseTimeMin: 3.2, trafficMultiplier: 1.0, constructionCost: 8, closed: false, roadClass: 'arterial' },
  { id: 'E27', from: 'J14', to: 'J15', roadName: 'Southern Ring', distanceKm: 2.9, baseTimeMin: 2.8, trafficMultiplier: 1.0, constructionCost: 9, closed: false, roadClass: 'expressway' },

  // Three River Crossings (Connecting West & East Demo City)
  { id: 'E28', from: 'J10', to: 'J16', roadName: 'North Locks Bridge', distanceKm: 2.6, baseTimeMin: 2.4, trafficMultiplier: 1.0, constructionCost: 13, closed: false, roadClass: 'expressway' },
  { id: 'E29', from: 'J13', to: 'J19', roadName: 'Grand River Bridge', distanceKm: 2.1, baseTimeMin: 3.1, trafficMultiplier: 1.5, constructionCost: 13, closed: false, roadClass: 'arterial' },
  { id: 'E30', from: 'J15', to: 'J21', roadName: 'South Metro Bridge', distanceKm: 2.8, baseTimeMin: 2.7, trafficMultiplier: 1.0, constructionCost: 13, closed: false, roadClass: 'expressway' },

  // East Bank: Rivergate, University Hills & Airport Belt
  { id: 'E31', from: 'J16', to: 'J17', roadName: 'Locks Parkway', distanceKm: 1.6, baseTimeMin: 2.1, trafficMultiplier: 1.0, constructionCost: 5, closed: false, roadClass: 'arterial' },
  { id: 'E32', from: 'J16', to: 'J18', roadName: 'University Way', distanceKm: 2.1, baseTimeMin: 2.0, trafficMultiplier: 1.0, constructionCost: 8, closed: false, roadClass: 'expressway' },
  { id: 'E33', from: 'J17', to: 'J19', roadName: 'Rivergate Quay', distanceKm: 1.9, baseTimeMin: 2.8, trafficMultiplier: 1.5, constructionCost: 7, closed: false, roadClass: 'arterial' },
  { id: 'E34', from: 'J17', to: 'J18', roadName: 'Scholars Climb', distanceKm: 2.2, baseTimeMin: 2.7, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'local' },
  { id: 'E35', from: 'J18', to: 'J20', roadName: 'Campus Crest', distanceKm: 1.9, baseTimeMin: 2.0, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'expressway' },
  { id: 'E36', from: 'J19', to: 'J20', roadName: 'Botanic Drive', distanceKm: 2.5, baseTimeMin: 3.2, trafficMultiplier: 1.0, constructionCost: 8, closed: false, roadClass: 'arterial' },
  { id: 'E37', from: 'J19', to: 'J24', roadName: 'East Arterial', distanceKm: 1.8, baseTimeMin: 2.5, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E38', from: 'J19', to: 'J21', roadName: 'Lower Quay', distanceKm: 2.3, baseTimeMin: 3.0, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'arterial' },
  { id: 'E39', from: 'J20', to: 'J22', roadName: 'BioPark Avenue', distanceKm: 1.7, baseTimeMin: 1.8, trafficMultiplier: 1.0, constructionCost: 5, closed: false, roadClass: 'expressway' },
  { id: 'E40', from: 'J22', to: 'J24', roadName: 'Genome Lane', distanceKm: 1.8, baseTimeMin: 2.4, trafficMultiplier: 1.0, constructionCost: 6, closed: false, roadClass: 'arterial' },
  { id: 'E41', from: 'J22', to: 'J23', roadName: 'Terminal Express', distanceKm: 2.4, baseTimeMin: 2.5, trafficMultiplier: 1.0, constructionCost: 9, closed: false, roadClass: 'expressway' },
  { id: 'E42', from: 'J21', to: 'J24', roadName: 'Solar Link', distanceKm: 1.6, baseTimeMin: 2.2, trafficMultiplier: 1.0, constructionCost: 5, closed: false, roadClass: 'local' },
  { id: 'E43', from: 'J21', to: 'J23', roadName: 'Runway Perimeter', distanceKm: 2.3, baseTimeMin: 2.4, trafficMultiplier: 1.0, constructionCost: 7, closed: false, roadClass: 'expressway' },
];

export const RIVER_BRIDGE_IDS = ['E28', 'E29', 'E30'] as const;

export function createInitialDemoCity(): CityGraph {
  return {
    nodes: DEMO_CITY_NODES.map((n) => ({ ...n })),
    edges: DEMO_CITY_EDGES.map((e) => ({ ...e })),
  };
}

export function createDisconnectedDemoCity(): CityGraph {
  const base = createInitialDemoCity();
  return {
    nodes: base.nodes,
    edges: base.edges.map((e) =>
      (RIVER_BRIDGE_IDS as readonly string[]).includes(e.id) ? { ...e, closed: true } : e
    ),
  };
}

export function createRushHourDemoCity(): CityGraph {
  const base = createInitialDemoCity();
  const heavyIds = new Set(['E05', 'E16', 'E19', 'E20', 'E29', 'E33']);
  const gridlockIds = new Set(['E10', 'E23']);
  return {
    nodes: base.nodes,
    edges: base.edges.map((e) => ({
      ...e,
      trafficMultiplier: gridlockIds.has(e.id)
        ? 3.5
        : heavyIds.has(e.id)
        ? 2.4
        : e.trafficMultiplier,
    })),
  };
}

export function createBridgeMaintenanceDemoCity(): CityGraph {
  const base = createInitialDemoCity();
  return {
    nodes: base.nodes,
    edges: base.edges.map((e) =>
      e.id === 'E28' || e.id === 'E16' ? { ...e, closed: true } : e
    ),
  };
}
