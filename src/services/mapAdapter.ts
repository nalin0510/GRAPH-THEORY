import { runDijkstra } from '../algorithms/dijkstra';
import { CityGraph, DijkstraObjective, DijkstraResult } from '../types/graph';

export interface LatLngPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface LiveRouteStep {
  instruction: string;
  distanceText: string;
  durationText: string;
}

export interface LiveRouteSummary {
  provider: 'Google Maps Routes API';
  distanceMeters: number;
  durationMillis: number;
  steps: LiveRouteStep[];
}

export interface GeolocationSnapshot {
  status: 'idle' | 'locating' | 'ready' | 'watching' | 'error';
  coords: LatLngPoint | null;
  accuracyMeters: number | null;
  errorMessage: string | null;
  errorCode: 'permission-denied' | 'timeout' | 'unavailable' | 'insecure-context' | 'unsupported' | null;
}

/**
 * Replaceable mapping service adapter separating Demo City's graph engine
 * from external live mapping providers (Google Maps Platform).
 */
export interface SimulatedRoutingAdapter {
  kind: 'simulated-graph';
  computeRoute(
    graph: CityGraph,
    startId: string,
    endId: string,
    objective: DijkstraObjective
  ): DijkstraResult;
}

export const demoCityRoutingAdapter: SimulatedRoutingAdapter = {
  kind: 'simulated-graph',
  computeRoute(graph, startId, endId, objective) {
    return runDijkstra(graph, startId, endId, objective, { recordEvents: true });
  },
};

export function getGoogleMapsBrowserKey(): string {
  const viteKey = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;
  const globalKey = (globalThis as { GOOGLE_MAPS_API_KEY?: string }).GOOGLE_MAPS_API_KEY;
  const raw = (viteKey || globalKey || '').trim();
  if (!raw || raw === 'YOUR_GOOGLE_MAPS_API_KEY' || raw === 'MY_GOOGLE_MAPS_API_KEY') {
    return '';
  }
  return raw;
}

export function isSecureGeolocationContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function formatGeolocationError(err: GeolocationPositionError): {
  code: GeolocationSnapshot['errorCode'];
  message: string;
} {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return {
        code: 'permission-denied',
        message:
          'Location permission was denied. Allow location access in your browser site settings or search an origin address manually.',
      };
    case err.TIMEOUT:
      return {
        code: 'timeout',
        message:
          'Location request timed out before a fix was acquired. Try again outdoors or enter an origin address.',
      };
    case err.POSITION_UNAVAILABLE:
    default:
      return {
        code: 'unavailable',
        message:
          'Position is currently unavailable from your device location services. Enter an origin address manually.',
      };
  }
}
