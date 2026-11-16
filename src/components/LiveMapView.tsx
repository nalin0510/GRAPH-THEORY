/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ArrowRight,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Square,
} from 'lucide-react';
import {
  formatGeolocationError,
  GeolocationSnapshot,
  getGoogleMapsBrowserKey,
  isSecureGeolocationContext,
  LatLngPoint,
  LiveRouteStep,
  LiveRouteSummary,
} from '../services/mapAdapter';

interface LiveMapViewProps {
  onSwitchToDemoCity: () => void;
}

type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

function isQuotaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429') ||
    msg.includes('Quota')
  );
}

interface PlaceAutocompleteFieldProps {
  label: string;
  placeholder: string;
  valueLabel: string;
  onSelectPoint: (point: LatLngPoint) => void;
}

const PlaceAutocompleteField: React.FC<PlaceAutocompleteFieldProps> = ({
  label,
  placeholder,
  valueLabel,
  onSelectPoint,
}) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState(valueLabel);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    setQuery(valueLabel);
  }, [valueLabel]);

  useEffect(() => {
    if (!placesLib || !open) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed === valueLabel) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError(null);
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('Unable to fetch place suggestions right now.');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [placesLib, query, open, valueLabel]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      setLoading(true);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      if (place.location) {
        const display =
          place.displayName || place.formattedAddress || suggestion.placePrediction.text.text;
        setQuery(display);
        setOpen(false);
        setSuggestions([]);
        sessionTokenRef.current = null;
        onSelectPoint({
          lat: place.location.lat(),
          lng: place.location.lng(),
          label: display,
        });
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setSearchError('Unable to load details for that place.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-stone-300 mb-1.5">{label}</label>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2 text-xs bg-[#0D0B09] border border-stone-800 rounded-lg text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
        />
        {loading && (
          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {searchError && <p className="text-[11px] text-rose-400 mt-1">{searchError}</p>}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-[#191511] border border-stone-800 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-stone-800/70">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleSelectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-xs text-stone-200 hover:bg-stone-800/60 transition-colors"
              >
                {s.placePrediction?.text.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface RouteOverlayProps {
  origin: LatLngPoint | null;
  destination: LatLngPoint | null;
  travelMode: TravelMode;
  routeTrigger: number;
  onResult: (res: LiveRouteSummary | null) => void;
  onError: (msg: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}

const LiveRouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  routeTrigger,
  onResult,
  onError,
  onLoadingChange,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !routesLib || !origin || !destination || routeTrigger === 0) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    onError(null);
    onLoadingChange(true);

    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    const RouteClass = (routesLib as unknown as {
      Route?: { computeRoutes: (req: unknown) => Promise<{ routes?: any[] }> };
    }).Route;

    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') {
      onLoadingChange(false);
      onError('Google Routes library is not available in this browser session.');
      return;
    }

    RouteClass.computeRoutes(request)
      .then(({ routes }) => {
        onLoadingChange(false);
        if (!routes || routes.length === 0) {
          onResult(null);
          onError('No route returned by Google Maps Routes API for these locations.');
          return;
        }

        const primaryRoute = routes[0];
        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines: google.maps.Polyline[] = primaryRoute.createPolylines();
          newPolylines.forEach((poly) => {
            poly.setOptions({
              strokeColor: '#F59E0B',
              strokeWeight: 6,
              strokeOpacity: 0.92,
            });
            poly.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const rawSteps: any[] = primaryRoute.legs?.[0]?.steps ?? [];
        const steps: LiveRouteStep[] = rawSteps.map((s, idx) => {
          const instruction =
            s?.navigationInstruction?.instructions ||
            s?.instructions ||
            `Segment ${idx + 1}`;
          const meters = typeof s?.distanceMeters === 'number' ? s.distanceMeters : null;
          const millis = typeof s?.durationMillis === 'number' ? s.durationMillis : null;
          return {
            instruction: String(instruction),
            distanceText:
              meters !== null
                ? meters >= 1000
                  ? `${(meters / 1000).toFixed(1)} km`
                  : `${Math.round(meters)} m`
                : 'Distance supplied on map',
            durationText:
              millis !== null ? `${Math.max(1, Math.round(millis / 60000))} min` : '',
          };
        });

        onResult({
          provider: 'Google Maps Routes API',
          distanceMeters: primaryRoute.distanceMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
          steps,
        });
      })
      .catch((err: unknown) => {
        onLoadingChange(false);
        onResult(null);
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onError(
          err instanceof Error
            ? `Routing request failed: ${err.message}`
            : 'Unable to calculate live route. Check network connectivity or API quota.'
        );
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin, destination, travelMode, routeTrigger, onResult, onError, onLoadingChange]);

  return (
    <>
      {origin && (
        <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }} title={origin.label || 'Origin'}>
          <Pin background="#059669" borderColor="#A7F3D0" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker
          position={{ lat: destination.lat, lng: destination.lng }}
          title={destination.label || 'Destination'}
        >
          <Pin background="#D97706" borderColor="#FEF08A" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      )}
    </>
  );
};

export const LiveMapView: React.FC<LiveMapViewProps> = ({ onSwitchToDemoCity }) => {
  const apiKey = getGoogleMapsBrowserKey();

  const [origin, setOrigin] = useState<LatLngPoint | null>({
    lat: 37.7749,
    lng: -122.4194,
    label: 'San Francisco Civic Center',
  });
  const [destination, setDestination] = useState<LatLngPoint | null>({
    lat: 37.808,
    lng: -122.4177,
    label: 'Fisherman’s Wharf',
  });
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [routeTrigger, setRouteTrigger] = useState(0);
  const [routeSummary, setRouteSummary] = useState<LiveRouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [geo, setGeo] = useState<GeolocationSnapshot>({
    status: 'idle',
    coords: null,
    accuracyMeters: null,
    errorMessage: null,
    errorCode: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGeo((prev) => ({
      ...prev,
      status: prev.coords ? 'ready' : 'idle',
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleUseMyLocation = (continuous: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({
        status: 'error',
        coords: null,
        accuracyMeters: null,
        errorCode: 'unsupported',
        errorMessage: 'Browser geolocation is not supported in this browser.',
      });
      return;
    }
    if (!isSecureGeolocationContext()) {
      setGeo({
        status: 'error',
        coords: null,
        accuracyMeters: null,
        errorCode: 'insecure-context',
        errorMessage:
          'Browser geolocation requires HTTPS or localhost. Open RouteVerse over a secure origin to share your device location.',
      });
      return;
    }

    stopTracking();
    setGeo((prev) => ({ ...prev, status: 'locating', errorMessage: null, errorCode: null }));

    const onSuccess = (pos: GeolocationPosition) => {
      const point: LatLngPoint = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        label: `My Location (±${Math.round(pos.coords.accuracy)} m)`,
      };
      setGeo({
        status: continuous ? 'watching' : 'ready',
        coords: point,
        accuracyMeters: Math.round(pos.coords.accuracy),
        errorMessage: null,
        errorCode: null,
      });
      setOrigin(point);
    };

    const onFail = (err: GeolocationPositionError) => {
      const parsed = formatGeolocationError(err);
      setGeo({
        status: 'error',
        coords: null,
        accuracyMeters: null,
        errorCode: parsed.code,
        errorMessage: parsed.message,
      });
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000,
    };

    if (continuous) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onFail, options);
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onFail, options);
    }
  };

  if (!apiKey) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-12 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg p-6 md:p-8 flex flex-col justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium text-amber-300 tracking-wide">
              Optional Live Map Integration
            </p>
            <h2 className="text-2xl font-display font-semibold text-stone-100">
              Google Maps API credentials are not configured
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Live Map uses the Google Maps JavaScript SDK, Places API (New), and Routes API to
              compute real road-following routes. RouteVerse’s core Demo City, Dijkstra’s
              visualizer, Network Lab, and Strategy Games all run locally with zero external API keys.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-[#0D0B09] border border-stone-800/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-stone-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Local / Production Setup</span>
              </div>
              <p className="text-stone-400 leading-relaxed">
                Add <code className="text-amber-300">VITE_GOOGLE_MAPS_API_KEY</code> to your{' '}
                <code className="text-stone-300">.env</code> file (see{' '}
                <code className="text-stone-300">.env.example</code>). Restrict browser keys by HTTP
                referrer and limit enabled APIs to Maps JavaScript, Places (New), and Routes API.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#0D0B09] border border-stone-800/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-stone-200">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Browser Geolocation Notice</span>
              </div>
              <p className="text-stone-400 leading-relaxed">
                Location access is only requested when you click “Use my location” and requires a
                secure HTTPS context or <code className="text-stone-300">localhost</code>. No
                coordinates are stored on a server.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSwitchToDemoCity}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 text-stone-950 text-sm font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Continue in Demo City</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Controls Panel */}
      <div className="lg:col-span-4 space-y-4">
        <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-stone-100">Live Map Routing</h2>
              <p className="text-xs text-stone-400">
                Powered by Google Maps Routes & Places (New)
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToDemoCity}
              className="text-xs text-amber-300 hover:text-amber-200 underline whitespace-nowrap cursor-pointer"
            >
              Switch to Demo City
            </button>
          </div>

          <APIProvider apiKey={apiKey} libraries={['places', 'routes']}>
            <div className="space-y-3">
              <PlaceAutocompleteField
                label="Origin"
                placeholder="Search starting address or place"
                valueLabel={origin?.label ?? ''}
                onSelectPoint={(pt) => {
                  setOrigin(pt);
                  setRouteSummary(null);
                }}
              />

              {/* Geolocation Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUseMyLocation(false)}
                  disabled={geo.status === 'locating'}
                  className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs font-medium text-stone-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  <span>{geo.status === 'locating' ? 'Locating…' : 'Use my location'}</span>
                </button>

                {geo.status === 'watching' ? (
                  <button
                    type="button"
                    onClick={stopTracking}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/70 border border-rose-400/45 text-xs font-medium text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop tracking</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUseMyLocation(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-stone-800/80 border border-stone-800 text-xs text-stone-300 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live GPS</span>
                  </button>
                )}
              </div>

              {geo.coords && geo.accuracyMeters !== null && (
                <p className="text-[11px] text-emerald-300 font-mono">
                  GPS fix: {geo.coords.lat}, {geo.coords.lng} · Accuracy ±{geo.accuracyMeters} m
                </p>
              )}
              {geo.errorMessage && (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-400/35 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{geo.errorMessage}</span>
                </div>
              )}

              <PlaceAutocompleteField
                label="Destination"
                placeholder="Search destination address or place"
                valueLabel={destination?.label ?? ''}
                onSelectPoint={(pt) => {
                  setDestination(pt);
                  setRouteSummary(null);
                }}
              />

              {/* Travel Mode */}
              <div>
                <span className="block text-xs font-medium text-stone-300 mb-1.5">Travel Mode</span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-[#0D0B09] rounded-lg border border-stone-800">
                  {(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'] as TravelMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTravelMode(m)}
                      className={`py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        travelMode === m
                          ? 'bg-gradient-to-r from-amber-400 to-orange-300 text-stone-950 font-semibold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {m === 'DRIVING'
                        ? 'Drive'
                        : m === 'WALKING'
                        ? 'Walk'
                        : m === 'BICYCLING'
                        ? 'Bike'
                        : 'Transit'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!origin || !destination || routeLoading}
                onClick={() => setRouteTrigger((n) => n + 1)}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 disabled:opacity-50 text-stone-950 text-xs font-semibold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_-4px_rgba(245,158,11,0.4)]"
              >
                {routeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{routeLoading ? 'Computing Live Route…' : 'Calculate Live Route'}</span>
              </button>
            </div>
          </APIProvider>

          <p className="text-[11px] text-stone-400 leading-relaxed border-t border-stone-800/90 pt-3">
            Note: Live Map routes are supplied by Google Maps Routes API. Interactive Dijkstra
            step-by-step visualization runs on Demo City’s open graph because tile maps do not
            expose raw editable road-graph edges to the browser.
          </p>
        </div>

        {/* Route Instructions / Error Panel */}
        {routeError && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-400/45 text-xs text-rose-200 space-y-2">
            <div className="font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Route Service Error</span>
            </div>
            <p className="leading-relaxed">{routeError}</p>
          </div>
        )}

        {routeSummary && (
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#1B1713] to-[#12100D] border border-stone-800/90 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-300">{routeSummary.provider}</span>
              <span className="text-xs font-mono text-stone-200 tabular-nums">
                {(routeSummary.distanceMeters / 1000).toFixed(2)} km ·{' '}
                {Math.max(1, Math.round(routeSummary.durationMillis / 60000))} min
              </span>
            </div>

            {routeSummary.steps.length > 0 ? (
              <div className="max-h-56 overflow-y-auto divide-y divide-stone-800/70 pr-1">
                {routeSummary.steps.map((s, idx) => (
                  <div key={idx} className="py-2 text-xs">
                    <p className="text-stone-200">{s.instruction}</p>
                    <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                      {s.distanceText}
                      {s.durationText ? ` · ${s.durationText}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                Route polyline rendered on the map. Detailed turn steps were not included in this
                response.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Map Canvas */}
      <div className="lg:col-span-8 min-h-[480px] h-[560px] rounded-xl overflow-hidden border border-stone-800/90 bg-[#0D0B09] shadow-lg">
        <APIProvider apiKey={apiKey} libraries={['places', 'routes']}>
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={origin ?? { lat: 37.7749, lng: -122.4194 }}
            defaultZoom={13}
            gestureHandling="greedy"
            colorScheme="DARK"
            className="w-full h-full"
          >
            <LiveRouteOverlay
              origin={origin}
              destination={destination}
              travelMode={travelMode}
              routeTrigger={routeTrigger}
              onResult={setRouteSummary}
              onError={setRouteError}
              onLoadingChange={setRouteLoading}
            />
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
};
