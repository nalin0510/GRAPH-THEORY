# RouteVerse

**Tagline:** Navigate smarter. Connect better. Master the graph.

RouteVerse is an interactive navigation command centre, graph algorithm visualizer, and strategy game platform demonstrating **Dijkstra’s**, **Prim’s**, and **Kruskal’s** algorithms on a custom 24-junction, 43-road **Demo City** network—with optional Google Maps Platform Live Map integration.

## Key Experiences

1. **Navigate (`Demo City` & `Live Map`)**
   - **Demo City:** Runs 100% locally with zero API keys. Searchable start/destination selectors, pick-on-map mode, Fastest Time vs. Shortest Distance objectives, interactive Road Inspector (traffic multipliers `1.0×–3.5×` & road closures), route-change explanation, local scenario save/load (`localStorage`), and step-by-step Dijkstra visualization playback.
   - **Live Map (Optional):** Integrates Google Maps JavaScript API, Places API (New), and Routes API (`@vis.gl/react-google-maps`) with browser geolocation (`Use my location` / `Live GPS` with accuracy display). Falls back to a clean setup panel if credentials are omitted.
2. **Network Lab (`Prim’s` & `Kruskal’s`)**
   - Uses the shared Demo City network with construction cost (`$M`) weights as a simplified undirected planning model.
   - Step-by-step playback synchronized with highlighted pseudocode, plus a **Side-by-Side Comparison** demonstrating how Prim’s and Kruskal’s produce equal-cost trees with different edge choices on ties, and a **River Cut (Disconnected)** preset illustrating disconnected components and Minimum Spanning Forests.
3. **Play (`Strategy Games`)**
   - **Beat the Traffic**, **Prim’s Builder**, and **Kruskal’s Architect** across Easy, Medium, and Hard levels with rules, documented scoring formulas, hints, optional timer, optimal-route replay, and device-local high scores.
4. **Compare & Guided Demo**
   - Complexity & data structure comparison (`O((V + E) log V)` vs. `O(E log E)`), live decoupled Demo City benchmarks, and a 6-step **Start Guided Demo** walkthrough.

## Architecture

- `src/types/graph.ts`: Core TypeScript domain models for nodes, edges, algorithm events, scenarios, and games.
- `src/algorithms/`: Pure TypeScript implementations (`priorityQueue.ts`, `disjointSet.ts`, `dijkstra.ts`, `prim.ts`, `kruskal.ts`) completely decoupled from React and map SDKs.
- `src/data/`: `demoCity.ts` (24-junction weighted graph) and `gameLevels.ts` (curated solvable levels, move validators, and scoring formulas).
- `src/services/mapAdapter.ts`: Replaceable adapter boundary separating Demo City graph routing from Google Maps Live Map integration.
- `src/components/`: Interactive SVG graph canvas, Live Map view, workspaces, Comparison, About, and Guided Demo controller.
- `src/tests/algorithms.test.ts`: Automated test suite verifying correctness, edge cases, tie-breaking, disconnected graphs, cycle detection, and game scoring.

## Local Setup

```bash
npm install
npm run dev
```

### Optional Google Maps Live Map Setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_GOOGLE_MAPS_API_KEY` to a Google Maps Platform browser API key with **Maps JavaScript API**, **Places API (New)**, and **Routes API** enabled.
3. Restrict the key in Google Cloud Console by **HTTP referrers** and limit it strictly to those three APIs.

## Verification

```bash
npm run lint
npm run build
npx tsx --test src/tests/algorithms.test.ts
```
