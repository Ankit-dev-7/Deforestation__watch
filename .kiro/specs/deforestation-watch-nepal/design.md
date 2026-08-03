# Design Document — Deforestation Watch Nepal

## Overview

Deforestation Watch Nepal is a fully static, single-page GIS intelligence dashboard. It visualises Nepal's forest cover dynamics (2015–2026), district-level deforestation risk, AI-generated predictions, and environmental insights. The entire system runs in the browser; all data comes from pre-generated local files fetched at runtime via `fetch()`.

**Technology stack (all via CDN):**
- HTML5 / CSS3 / Vanilla JavaScript (ES6 Modules)
- TailwindCSS CDN — utility classes
- Leaflet.js — interactive GIS map
- Chart.js — all charts
- Font Awesome — iconography
- Google Fonts (Inter) — typography

**Design principles:**
- Zero build step, zero backend, zero framework
- All numbers derived from fetched data; nothing hardcoded
- Event-driven coordination via a central `EventBus` so every module is decoupled
- Progressive enhancement: static content (Methodology, Team, Footer) is readable without JS

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          index.html                                  │
│  CDN: TailwindCSS, Leaflet, Chart.js, Font Awesome, Google Fonts     │
│  <script type="module" src="js/main.js">                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ imports
        ┌────────────────────┼────────────────────────────┐
        ▼                    ▼                            ▼
   js/loader.js         js/utils.js               js/main.js
        │                                               │
        │ emits data:loaded                             │ orchestrates
        ▼                                               ▼
   EventBus ──────────────────────────────────────────────────────────
        │                                               │
   ┌────┼───────────────────────────────────────────┐   │
   ▼    ▼         ▼            ▼           ▼        ▼   │
js/map.js  js/charts.js  js/prediction.js  js/ui.js  js/dashboard.js
```

### Module Dependency Graph

```
main.js
  ├── loader.js        (no dependencies on other custom modules)
  ├── utils.js         (no dependencies on other custom modules)
  ├── map.js           (imports utils.js)
  ├── charts.js        (imports utils.js)
  ├── prediction.js    (imports utils.js)
  ├── ui.js            (imports utils.js)
  └── dashboard.js     (imports utils.js)
```

### EventBus Design

A minimal pub/sub singleton exported from `js/main.js` (or a dedicated `js/eventbus.js`). Uses `Map<string, Set<Function>>` internally.

```javascript
// Exported from js/main.js or js/eventbus.js
export const EventBus = {
  _listeners: new Map(),
  on(event, fn)  { ... },
  off(event, fn) { ... },
  emit(event, payload) { ... }
};
```

**Events table:**

| Event name        | Emitter        | Payload                        | Consumers                                |
|-------------------|----------------|--------------------------------|------------------------------------------|
| `data:loaded`     | `loader.js`    | `{ stats, prediction, risk, districtGeo, forestGeo }` | `main.js` → bootstraps all modules |
| `data:error`      | `loader.js`    | `{ file: string, error: Error }` | `ui.js` (error toast)               |
| `year:changed`    | `dashboard.js` | `{ year: number }`             | `map.js`, `charts.js`, `ui.js`, `prediction.js` |
| `map:districtClick` | `map.js`     | `{ properties: object }`       | `ui.js` (optional side-panel update)     |

---

## Data Flow

### Page Load Sequence

```
1. Browser parses index.html
2. <script type="module" src="js/main.js"> fires
3. main.js shows loading progress indicator (#loading-overlay)
4. main.js calls loader.loadAll()
5. loader.js initiates Promise.allSettled([
     fetch('data/statistics.json'),
     fetch('data/prediction.json'),
     fetch('data/risk_score.json'),
     fetch('data/district.geojson'),
     fetch('data/forest.geojson')
   ])
6. For each settled result:
     fulfilled → parse JSON / GeoJSON
     rejected  → EventBus.emit('data:error', { file, error })
7. loader.js emits EventBus.emit('data:loaded', payload)
8. main.js receives data:loaded:
     a. Hides loading overlay
     b. Calls map.init(districtGeo, forestGeo, risk)
     c. Calls charts.init(stats)
     d. Calls prediction.init(prediction, risk)
     e. Calls ui.init(stats)
     f. Calls dashboard.init(stats.yearlyData)  ← sets default year
9. dashboard.init emits year:changed(mostRecentYear)
10. All consumers update for the default year
```

### Year Change Sequence

```
User clicks year on timeline
  └── dashboard.js
        ├── updates active year visually
        ├── triggers CSS fade class on dependent sections
        └── EventBus.emit('year:changed', { year })
              ├── map.js: filterLayersByYear(year)
              ├── charts.js: filterChartsToYear(year)
              ├── ui.js: renderStatCards(year) + renderInsights(year)
              └── prediction.js: highlightYearOnChart(year)
```

### Data Routing Summary

```
statistics.json  →  ui.js (Statistics_Cards, hero stats)
                 →  charts.js (all 6 Chart.js charts)
                 →  ui.js (Environmental_Insights derivation)
                 →  dashboard.js (yearlyData for timeline range)

prediction.json  →  prediction.js (Prediction Cards, top-10 list,
                                   Historical vs Predicted chart,
                                   Future Forest Cover chart)

risk_score.json  →  prediction.js (top-10 ranked list)
                 →  map.js (choropleth Risk Heat Map layer)

district.geojson →  map.js (Admin_Boundaries_Layer, popup data)

forest.geojson   →  map.js (Forest_Layer, Loss_Layer, Gain_Layer)
```

---

## Components and Interfaces

### `js/loader.js` — Data_Loader

**Responsibility:** Fetch all 5 data files in parallel. Surface failures without crashing the dashboard.

**Exports:**
```javascript
export async function loadAll(): Promise<LoadResult>
```

**`LoadResult` type:**
```javascript
{
  stats:       object | null,   // statistics.json parsed
  prediction:  object | null,   // prediction.json parsed
  risk:        object | null,   // risk_score.json parsed
  districtGeo: object | null,   // district.geojson parsed (GeoJSON FeatureCollection)
  forestGeo:   object | null,   // forest.geojson parsed (GeoJSON FeatureCollection)
  errors:      Array<{ file: string, error: Error }>
}
```

**Implementation notes:**
- Uses `Promise.allSettled` (never `Promise.all`) so one failure doesn't block others.
- Each fulfilled result is `.json()`-parsed; rejected results populate `errors[]`.
- After settlement: emits `data:loaded` with the full payload, then emits `data:error` for each entry in `errors[]`.
- File identity strings: `'statistics.json'`, `'prediction.json'`, `'risk_score.json'`, `'district.geojson'`, `'forest.geojson'`.

---

### `js/utils.js` — Pure Utility Functions

**Exports (all pure functions, no side effects):**

```javascript
export function formatNumber(n: number): string
// Locale-aware: formatNumber(1234567) → "1,234,567"

export function formatHa(n: number): string
// formatHa(450000) → "450,000 ha"

export function getRiskLevel(score: number): 'Low'|'Medium'|'High'|'Critical'
// 0–39 → 'Low', 40–59 → 'Medium', 60–79 → 'High', 80–100 → 'Critical'

export function getRiskColor(score: number): string
// Returns hex color for choropleth:
// 0–39   → '#22c55e'  (green)
// 40–59  → '#f59e0b'  (amber)
// 60–79  → '#f97316'  (orange)
// 80–100 → '#ef4444'  (red)

export function clamp(value: number, min: number, max: number): number
// Returns Math.min(Math.max(value, min), max)

export function debounce(fn: Function, delay: number): Function
// Standard leading-edge debounce wrapper

export function animateCounter(
  el: HTMLElement,
  target: number,
  duration: number   // ms, default 2000
): void
// Uses requestAnimationFrame; writes formatted integers to el.textContent
// Respects prefers-reduced-motion: if matched, sets value immediately
```

---

### `js/map.js` — GIS_Map

**Responsibility:** All Leaflet map initialisation, layer management, controls, interaction events.

**Exports:**
```javascript
export function init(districtGeo, forestGeo, risk): void
export function filterLayersByYear(year: number): void  // called by EventBus year:changed
```

**Initialisation sequence:**
1. `L.map('map-container', { zoomControl: false })` — disable default zoom control to position it manually.
2. Center: `[28.3949, 84.1240]`, zoom: `7`.
3. Add base tile layers to `L.control.layers`:
   - **OpenStreetMap**: `L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '...' })`
   - **Satellite**: `L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '...' })`
4. Create overlay `L.layerGroup` instances from `forestGeo` filtered by `type`:
   - `Forest_Layer` — `type === 'cover'` → green fill (#22c55e, 40% opacity)
   - `Loss_Layer`   — `type === 'loss'` → red fill (#ef4444, 40% opacity)
   - `Gain_Layer`   — `type === 'gain'` → blue fill (#3b82f6, 40% opacity)
5. `Protected_Areas_Layer` — yellow stroke (#f59e0b), no fill; source from `districtGeo` features tagged as protected (or a separate subset).
6. `Admin_Boundaries_Layer` — district boundaries from `districtGeo`; thin grey stroke, no fill by default.
7. Add `L.control.layers(baseLayers, overlays)` — top-right.
8. Add `L.control.scale()` — bottom-left.
9. Add custom **Fullscreen** control (extends `L.Control`): toggles CSS class `.map-fullscreen` on `#map-container`; ARIA label "Toggle fullscreen".
10. Add custom **Reset View** control: calls `map.setView([28.3949, 84.1240], 7)`; ARIA label "Reset map view".
11. Add custom **District Search** control: `<input>` + `<ul>` autocomplete dropdown; filters district names from `districtGeo.features`; on select: `map.fitBounds(layer.getBounds())` + apply highlight style.

**Risk Choropleth Layer (Risk Heat Map):**
- Built from `risk` data (risk_score.json `districts` array).
- Matches each district name to the corresponding `districtGeo` feature by `properties.name`.
- Fill color from `utils.getRiskColor(riskScore)`.
- Added as a named overlay "Risk Heat Map" in the layer switcher.
- Toggled off by default; user enables it via Layer Switcher.

**Hover / Click interactions on `Admin_Boundaries_Layer`:**
- `mouseover`: `layer.setStyle({ color: '#0ea5e9', weight: 3 })`; `layer.bringToFront()`
- `mouseout`: reset to default style via `geojsonLayer.resetStyle(layer)`
- `click`: open `L.popup` with HTML table:
  ```
  District: {name}
  Forest Cover: {forestCoverHa} ha
  Forest Loss:  {forestLossHa} ha
  Forest Gain:  {forestGainHa} ha
  Risk Score:   {riskScore}
  Risk Level:   {riskLevel}
  Trend:        {trend}%
  ```
  Also emits `EventBus.emit('map:districtClick', { properties })`.

**`filterLayersByYear(year)`:**
- Clears `Forest_Layer`, `Loss_Layer`, `Gain_Layer` layer groups.
- Re-filters `forestGeo.features` by `feature.properties.year === year`.
- Re-adds matching features with appropriate styles.

**Keyboard accessibility:**
- All custom controls have `tabIndex=0`, `role="button"`, `aria-label`.
- Fullscreen also responds to `keydown` Enter/Space.

---

### `js/charts.js` — Analytics_Dashboard Charts

**Responsibility:** Create and manage all 6 Chart.js instances. Respond to year-range filter changes.

**Exports:**
```javascript
export function init(stats: object): void
export function filterChartsToYear(year: number): void   // EventBus year:changed consumer
```

**Chart inventory:**

| # | Chart ID | Type | Data source | X-axis | Y-axis |
|---|----------|------|-------------|--------|--------|
| 1 | `#chart-trend` | Line (area fill) | `yearlyData[].forestCoverHa` | year | ha |
| 2 | `#chart-loss` | Bar | `yearlyData[].forestLossHa` | year | ha |
| 3 | `#chart-province` | Radar | Province metrics from `stats.provinces[]` | province | multi-metric |
| 4 | `#chart-district` | Horizontal Bar | Top 10 districts by loss from `stats.districts[]` | district | ha |
| 5 | `#chart-gain` | Bar | `yearlyData[].forestGainHa` | year | ha |
| 6 | `#chart-composition` | Doughnut | Forest type proportions from `stats.composition` | type label | % |

**Year-range filter:**
- Two `<input type="range">` or two `<select>` elements: `#year-range-start`, `#year-range-end`.
- On `input` event: call `filterChartsToYear(year)`.
- `filterChartsToYear` derives a filtered `yearlyData` slice where `start <= year <= end`.
- For each chart: `chart.data.labels = filteredLabels; chart.data.datasets[n].data = filteredData; chart.update('none')` (no animation on filter update).

**Animation config:**
- Initial render: `animation: { duration: 1000, easing: 'easeInOutQuart' }`.
- Filter updates: `chart.update('none')`.

**Tooltip callbacks (applied to all charts):**
```javascript
plugins: {
  tooltip: {
    callbacks: {
      label: (ctx) => `${ctx.dataset.label}: ${formatHa(ctx.raw)}`
    }
  }
}
```

**`filterChartsToYear(year)`** (EventBus consumer):
- Highlights the bar/point at `year` on charts 1, 2, 5 using a distinct background color.
- Does NOT re-filter all charts; only highlights the selected year within the existing displayed range.

---

### `js/prediction.js` — Prediction_Dashboard

**Responsibility:** Render all prediction-related UI from `prediction.json` and `risk_score.json`.

**Exports:**
```javascript
export function init(prediction: object, risk: object): void
export function highlightYearOnChart(year: number): void  // EventBus year:changed consumer
```

**Prediction Cards** (`#prediction-cards-container`):
- Render cards for the top 5 districts sorted by `riskScore` descending.
- Each card shows: district name, risk score (large number), risk level badge, confidence percentage.
- **Critical treatment** (riskScore ≥ 80): add class `.card-critical` → red border (`border-red-500`), warning icon (`fa-triangle-exclamation`), red badge text.
- Use `utils.getRiskLevel(score)` and `utils.getRiskColor(score)` for badge color.

**Top 10 High Risk Districts list** (`#top-risk-list`):
- Source: `risk_score.json` → sort descending by `riskScore` → take first 10.
- Render as ordered `<ol>` with rank number, district name, score bar, and level badge.

**Historical vs. Predicted Chart** (`#chart-historical-predicted`):
- Chart.js Line chart.
- Dataset 1: "Actual" — `yearlyData` from `statistics.json` for years 2015–2025 (solid line, `borderDash: []`).
- Dataset 2: "Predicted" — aggregated `projectedCover` from `prediction.json` for years 2026–2030 (dashed line, `borderDash: [6, 3]`).
- Color: actual = primary green (`#16a34a`), predicted = amber (`#f59e0b`).

**Future Forest Cover Chart** (`#chart-future-cover`):
- Chart.js Bar chart.
- Data: aggregated `projectedCover` summed across all districts per year (2026–2030).
- Y-axis label: "Projected Forest Cover (ha)".

**`highlightYearOnChart(year)`:**
- If `year` is in 2015–2025 range: draws a vertical annotation line (or sets `pointBackgroundColor` highlight) on the Historical dataset.
- If `year` is in 2026–2030 range: highlights the corresponding bar in the Future Cover chart.

**Model Confidence Badge** (`#confidence-badge`):
- Computes `confidencePct` as the average across all prediction districts.
- Renders as a prominent `<span>` with percentage and label "Model Confidence".

---

### `js/dashboard.js` — Time Explorer + Coordinator

**Responsibility:** Render and manage the year timeline. Emit `year:changed` events.

**Exports:**
```javascript
export function init(yearlyData: Array<{ year: number }>): void
```

**Timeline rendering** (`#time-explorer`):
- Extract all unique years from `yearlyData`, sorted ascending.
- Render a horizontal flex row of year buttons: `<button class="year-btn" data-year="2015">2015</button>` … `<button data-year="2026">2026</button>`.
- Active year gets class `.year-btn--active` (forest green background, white text).

**Interaction:**
- `click` on any year button: call `selectYear(year)`.
- `keydown` on year container: `ArrowRight` → next year, `ArrowLeft` → previous year.

**`selectYear(year)`:**
1. Remove `.year-btn--active` from all buttons, add to target.
2. Add `.section-transitioning` class to `#analytics`, `#statistics`, `#insights`, `#prediction` (triggers CSS fade).
3. `EventBus.emit('year:changed', { year })`.
4. After 300ms: remove `.section-transitioning`.

**Default year:**
- On `init`: call `selectYear(Math.max(...years))` — most recent year.

---

### `js/ui.js` — UI Components

**Responsibility:** Statistics Cards, Environmental Insights, Before/After Slider, Navigation Bar, Download Center, Section Reveal Animations.

**Exports:**
```javascript
export function init(stats: object): void
export function renderStatCards(year: number): void       // EventBus year:changed consumer
export function renderInsights(year: number): void        // EventBus year:changed consumer
export function showErrorToast(message: string): void     // EventBus data:error consumer
```

#### Statistics Cards (`#stats-cards-grid`)

**Seven metrics rendered from `stats`:**

| Slot | Field | Icon class | Color theme |
|------|-------|------------|-------------|
| 1 | `forestCoverHa` | `fa-tree` | green |
| 2 | `forestLossHa` | `fa-arrow-down` | amber |
| 3 | `forestGainHa` | `fa-arrow-up` | green |
| 4 | `protectedAreasCount` | `fa-shield` | blue |
| 5 | `districtsCount` | `fa-map` | blue |
| 6 | `satelliteImagesCount` | `fa-satellite` | blue |
| 7 | `predictionAccuracyPct` | `fa-chart-line` | green |

**Skeleton state:** Before `data:loaded`, render 7 `<div class="skeleton-card">` elements of identical dimensions (Tailwind `animate-pulse`).

**Counter animation:** `IntersectionObserver` with `threshold: 0.3`. On first intersection: call `utils.animateCounter(valueEl, target, 2000)`. The observer is disconnected after triggering (fires once).

**`renderStatCards(year)`:** Looks up `stats.yearlyData.find(d => d.year === year)` and updates `forestCoverHa`, `forestLossHa`, `forestGainHa` card values (the other 4 are year-independent aggregates).

#### Environmental Insights (`#insights-grid`)

**Six derived insight cards:**

| # | Title | Derivation |
|---|-------|-----------|
| 1 | Highest Forest Loss District | `districtGeo` feature with max `forestLossHa` for selected year |
| 2 | Highest Forest Gain District | `districtGeo` feature with max `forestGainHa` for selected year |
| 3 | Fastest Changing District | max `|forestLossHa - forestGainHa|` for selected year |
| 4 | Most Stable District | min `|forestLossHa - forestGainHa|` for selected year |
| 5 | Annual % Change (nationwide) | `(forestLossHa - forestGainHa) / forestCoverHa * 100` for selected year |
| 6 | Protected Forest Summary | Sum of `forestCoverHa` for protected districts |

**Color coding:** Loss insights → red accent; Gain insights → green accent; Neutral → blue accent.

**`renderInsights(year)`:** Re-derives all 6 cards and replaces `#insights-grid` innerHTML.

#### Before/After Slider (`#comparison-slider`)

**HTML structure:**
```html
<div id="comparison-slider" class="slider-container">
  <div class="slider-before">
    <img src="assets/images/satellite-2018.jpg" alt="Nepal forest cover 2018">
    <span class="slider-label">2018</span>
  </div>
  <div class="slider-after" style="clip-path: inset(0 50% 0 0)">
    <img src="assets/images/satellite-2025.jpg" alt="Nepal forest cover 2025">
    <span class="slider-label">2025</span>
  </div>
  <div class="slider-handle" tabindex="0" role="slider"
       aria-label="Comparison divider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
    <div class="slider-line"></div>
    <div class="slider-grip"></div>
  </div>
</div>
```

**Position state:** `sliderPct` (0–100), initialised to 50.

**`updateSlider(pct)`:**
- `pct = clamp(pct, 0, 100)`
- `.slider-after` `clip-path: inset(0 ${100 - pct}% 0 0)`
- `.slider-handle` `left: ${pct}%`
- `handle.setAttribute('aria-valuenow', pct)`

**Pointer events:**
- `pointerdown` on handle → `setPointerCapture` → listen `pointermove` / `pointerup`.
- On `pointermove`: `pct = (e.clientX - rect.left) / rect.width * 100`; call `updateSlider(clamp(pct, 0, 100))`.

**Keyboard events on handle:**
- `ArrowLeft`: `updateSlider(sliderPct - 2)`
- `ArrowRight`: `updateSlider(sliderPct + 2)`

**Touch:** handled via `pointer` events (unified pointer model); no separate touch handler needed.

#### Navigation Bar (`#navbar`)

- **Scroll detection:** `window.addEventListener('scroll', ...)` with `debounce(fn, 50)`. If `scrollY > 80`: add class `.navbar--scrolled` (frosted-glass / solid background). Remove class when back to top.
- **Active section:** `IntersectionObserver` on all `<section>` elements with `threshold: 0.5`. On intersection: find matching nav link by `href="#section-id"` and add `.nav-link--active`.
- **Hamburger menu:** `#hamburger-btn` toggles `.nav-menu--open` on `#nav-menu`. ARIA: `aria-expanded` toggled on button.

#### Download Center (`#download-cards`)

**For each asset (CSV, GeoJSON, PNG export, PDF report):**
1. Issue `HEAD` fetch to the asset path.
2. If 200: render enabled card with download link, file size label, icon.
3. If error / non-200: render disabled card with "Not available" label; `aria-disabled="true"`.

Assets paths:
```
assets/downloads/nepal-forest-data.csv
assets/downloads/nepal-districts.geojson
assets/downloads/nepal-forest-map.png
assets/downloads/nepal-forest-report.pdf
```

#### Section Reveal Animations

- `IntersectionObserver` with `threshold: 0.1` on all `<section>` elements.
- On intersection: add `.revealed` class (triggers CSS fade-in + translate-up).
- Observer disconnects the entry after first trigger (one-shot).
- Skipped entirely if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

---

### `js/main.js` — Entry Point

**Responsibility:** Bootstrap the entire application. Orchestrate module initialisation in dependency order.

```javascript
import { loadAll }        from './loader.js';
import { EventBus }       from './eventbus.js';   // or defined here
import { init as initMap }         from './map.js';
import { init as initCharts }      from './charts.js';
import { init as initPrediction }  from './prediction.js';
import { init as initUI }          from './ui.js';
import { init as initDashboard }   from './dashboard.js';

document.addEventListener('DOMContentLoaded', async () => {
  showLoadingOverlay();

  EventBus.on('data:loaded', ({ stats, prediction, risk, districtGeo, forestGeo }) => {
    hideLoadingOverlay();
    initUI(stats);                           // renders skeletons → real cards
    initMap(districtGeo, forestGeo, risk);  // needs geo data
    initCharts(stats);                       // needs yearlyData
    initPrediction(prediction, risk);        // needs prediction + risk
    initDashboard(stats.yearlyData);         // emits year:changed(defaultYear)
  });

  EventBus.on('data:error', ({ file, error }) => {
    ui.showErrorToast(`Failed to load ${file}: ${error.message}`);
  });

  await loadAll();   // loader internally emits data:loaded / data:error
});
```

**Loading overlay:**
- `#loading-overlay`: full-screen fixed div with spinner + progress text.
- `showLoadingOverlay()`: sets `display: flex`.
- `hideLoadingOverlay()`: adds `.fade-out` class, removes element after 300ms transition.

---

## Data Models

### `data/statistics.json` Schema

```jsonc
{
  "forestCoverHa":          4400000,   // number — total cover, latest year
  "forestLossHa":           12000,     // number — total loss, latest year
  "forestGainHa":           4500,      // number — total gain, latest year
  "protectedAreasCount":    20,        // number — count of protected areas
  "districtsCount":         77,        // number — always 77
  "satelliteImagesCount":   1240,      // number — images processed
  "predictionAccuracyPct":  87.4,      // number — model accuracy %
  "yearlyData": [
    { "year": 2015, "forestCoverHa": 4520000, "forestLossHa": 9800,  "forestGainHa": 3200 },
    { "year": 2016, "forestCoverHa": 4510000, "forestLossHa": 10200, "forestGainHa": 3500 },
    // ... through 2026
  ],
  "provinces": [
    { "name": "Koshi",       "forestCoverHa": 600000, "forestLossHa": 1200, "forestGainHa": 400 },
    // ... 7 provinces
  ],
  "districts": [
    { "name": "Taplejung", "forestCoverHa": 80000, "forestLossHa": 350, "forestGainHa": 120, "trend": -0.4 },
    // ... 77 districts
  ],
  "composition": [
    { "label": "Tropical Forest", "pct": 38 },
    { "label": "Subtropical Forest", "pct": 29 },
    { "label": "Temperate Forest",  "pct": 22 },
    { "label": "Alpine Forest",     "pct": 11 }
  ]
}
```

### `data/prediction.json` Schema

```jsonc
{
  "modelVersion": "1.0.0",
  "generatedAt": "2025-01-01",
  "confidencePct": 84.2,       // overall model confidence
  "districts": [
    {
      "name":          "Sindhuli",
      "riskScore":     82,       // 0–100
      "riskLevel":     "Critical",  // derived: 0-39 Low, 40-59 Medium, 60-79 High, 80-100 Critical
      "confidencePct": 88,
      "projectedCover": [
        { "year": 2026, "forestCoverHa": 45000 },
        { "year": 2027, "forestCoverHa": 43500 },
        { "year": 2028, "forestCoverHa": 42100 },
        { "year": 2029, "forestCoverHa": 40800 },
        { "year": 2030, "forestCoverHa": 39600 }
      ]
    }
    // ... all 77 districts
  ]
}
```

### `data/risk_score.json` Schema

```jsonc
{
  "districts": [
    { "name": "Sindhuli",  "riskScore": 82 },
    { "name": "Makwanpur", "riskScore": 74 }
    // ... all 77 districts
  ]
}
```

### `data/district.geojson` Schema

```jsonc
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "properties": {
        "name":          "Taplejung",
        "forestCoverHa": 80000,
        "forestLossHa":  350,
        "forestGainHa":  120,
        "riskScore":     42,
        "province":      "Koshi"
      }
    }
  ]
}
```

### `data/forest.geojson` Schema

```jsonc
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "MultiPolygon", "coordinates": [[...]] },
      "properties": {
        "type":   "cover",   // "cover" | "loss" | "gain"
        "year":   2022,
        "areaHa": 4400000,
        "district": "Taplejung"
      }
    }
  ]
}
```

---

## HTML Structure (`index.html`)

### Document Head

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deforestation Watch Nepal</title>
  <!-- CDN: TailwindCSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- CDN: Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <!-- CDN: Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Custom CSS -->
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/animations.css">
  <link rel="stylesheet" href="css/responsive.css">
</head>
```

### Body Structure

```html
<body>
  <!-- Loading Overlay -->
  <div id="loading-overlay" role="status" aria-label="Loading dashboard data">
    <div class="loading-spinner"></div>
    <p id="loading-text">Loading data...</p>
  </div>

  <!-- Navigation -->
  <header>
    <nav id="navbar" aria-label="Main navigation">
      <!-- logo, nav links, hamburger -->
    </nav>
  </header>

  <main>
    <section id="hero" aria-label="Hero">
      <canvas id="particle-canvas" aria-hidden="true"></canvas>
      <!-- background image div -->
      <!-- hero text + hero stat cards -->
      <!-- scroll indicator -->
    </section>

    <section id="statistics" aria-labelledby="stats-heading">
      <h2 id="stats-heading">Forest Statistics</h2>
      <div id="stats-cards-grid"></div>
    </section>

    <section id="map" aria-labelledby="map-heading">
      <h2 id="map-heading">Interactive Forest Map</h2>
      <div id="map-container" style="min-height:600px"></div>
    </section>

    <section id="time-explorer" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Time Explorer</h2>
      <div id="year-timeline" role="group" aria-label="Year selection timeline"></div>
    </section>

    <section id="analytics" aria-labelledby="analytics-heading">
      <h2 id="analytics-heading">Analytics Dashboard</h2>
      <!-- year-range filter controls -->
      <div id="charts-grid">
        <div class="chart-wrapper"><canvas id="chart-trend"></canvas></div>
        <div class="chart-wrapper"><canvas id="chart-loss"></canvas></div>
        <div class="chart-wrapper"><canvas id="chart-province"></canvas></div>
        <div class="chart-wrapper"><canvas id="chart-district"></canvas></div>
        <div class="chart-wrapper"><canvas id="chart-gain"></canvas></div>
        <div class="chart-wrapper"><canvas id="chart-composition"></canvas></div>
      </div>
    </section>

    <section id="comparison" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading">Before / After Comparison</h2>
      <div id="comparison-slider"><!-- slider structure --></div>
    </section>

    <section id="prediction" aria-labelledby="prediction-heading">
      <h2 id="prediction-heading">AI Deforestation Risk Predictions</h2>
      <div id="confidence-badge"></div>
      <div id="prediction-cards-container"></div>
      <ol id="top-risk-list" aria-label="Top 10 high risk districts"></ol>
      <div class="chart-wrapper"><canvas id="chart-historical-predicted"></canvas></div>
      <div class="chart-wrapper"><canvas id="chart-future-cover"></canvas></div>
    </section>

    <section id="insights" aria-labelledby="insights-heading">
      <h2 id="insights-heading">Environmental Insights</h2>
      <div id="insights-grid"></div>
    </section>

    <section id="download" aria-labelledby="download-heading">
      <h2 id="download-heading">Download Center</h2>
      <div id="download-cards"></div>
    </section>

    <section id="methodology" aria-labelledby="methodology-heading">
      <h2 id="methodology-heading">Methodology</h2>
      <!-- static content: 8 subsections -->
    </section>

    <section id="team" aria-labelledby="team-heading">
      <h2 id="team-heading">Our Team</h2>
      <div id="team-grid"></div>
    </section>

    <section id="contact" aria-labelledby="contact-heading">
      <h2 id="contact-heading">Contact Us</h2>
      <form id="contact-form" novalidate><!-- fields --></form>
    </section>
  </main>

  <footer id="footer">
    <!-- links, copyright, back-to-top -->
  </footer>

  <!-- CDN: Leaflet JS -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <!-- CDN: Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <!-- Entry point (ES6 module) -->
  <script type="module" src="js/main.js"></script>
</body>
```

---

## CSS Architecture

### `css/style.css` — Design Tokens and Base Styles

**CSS custom properties (defined on `:root`):**
```css
:root {
  /* Colors */
  --color-primary:       #16a34a;   /* forest green 600 */
  --color-primary-dark:  #15803d;   /* forest green 700 */
  --color-primary-light: #bbf7d0;   /* forest green 200 */
  --color-danger:        #ef4444;   /* red 500 */
  --color-warning:       #f59e0b;   /* amber 500 */
  --color-info:          #3b82f6;   /* blue 500 */
  --color-neutral-50:    #f8fafc;
  --color-neutral-900:   #0f172a;
  --color-surface:       #ffffff;
  --color-surface-raised:#f1f5f9;

  /* Typography */
  --font-base:    'Inter', sans-serif;
  --text-xs:      0.75rem;
  --text-sm:      0.875rem;
  --text-base:    1rem;
  --text-lg:      1.125rem;
  --text-xl:      1.25rem;
  --text-2xl:     1.5rem;
  --text-3xl:     1.875rem;
  --text-4xl:     2.25rem;
  --text-5xl:     3rem;

  /* Spacing */
  --spacing-section: 6rem;

  /* Shadows */
  --shadow-card:  0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.06);
  --shadow-hover: 0 4px 16px rgba(22,163,74,.18);

  /* Transitions */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow:   400ms ease;

  /* Border radius */
  --radius-card: 0.75rem;
  --radius-btn:  0.5rem;
}
```

**Base resets:**
- `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`
- `body { font-family: var(--font-base); background: var(--color-neutral-50); color: var(--color-neutral-900); line-height: 1.6; }`
- `img { max-width: 100%; display: block; }`
- `a { color: inherit; text-decoration: none; }`
- `button { cursor: pointer; border: none; background: none; }`

**Component classes:**
- `.card` — white background, `border-radius: var(--radius-card)`, `box-shadow: var(--shadow-card)`, padding `1.5rem`.
- `.card-critical` — `border: 2px solid var(--color-danger)`.
- `.btn` — base button style; `.btn-primary` — green fill; `.btn-outline` — green border.
- `.badge` — inline pill: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`.
- `.skeleton-card` — grey `animate-pulse` rectangle.
- `.stat-card` — extends `.card` with flex column layout, icon row, large number, label.
- `.map-legend` — absolute positioned div inside map container; white background, border, padding.
- `.navbar--scrolled` — `background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); box-shadow: 0 1px 4px rgba(0,0,0,.08);`
- `.nav-link--active` — `color: var(--color-primary); font-weight: 600;`
- `.loading-spinner` — circular CSS spinner using border + border-top-color.

### `css/animations.css` — Animation Definitions

**Section reveal:**
```css
section { opacity: 0; transform: translateY(24px); transition: opacity var(--transition-slow), transform var(--transition-slow); }
section.revealed { opacity: 1; transform: translateY(0); }
```

**Counter animation:** Handled via JS `animateCounter` (rAF); no pure-CSS keyframe needed.

**Hero particle canvas:** `#particle-canvas { position: absolute; inset: 0; z-index: 1; pointer-events: none; }`

**Scroll indicator bounce:**
```css
@keyframes bounce-down {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(6px); }
}
.scroll-indicator { animation: bounce-down 1.6s ease-in-out infinite; }
```

**Before/After slider handle transition:** `transition: left 0ms linear;` (no easing — must follow pointer exactly).

**Chart wrapper fade (year-range filter):**
```css
.chart-wrapper { transition: opacity var(--transition-fast); }
.chart-wrapper.updating { opacity: 0.4; }
```

**Section transitioning (year change):**
```css
.section-transitioning { opacity: 0.6; transition: opacity 150ms ease; }
```

**`prefers-reduced-motion` overrides:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  section { opacity: 1 !important; transform: none !important; }
  .scroll-indicator { animation: none; }
}
```

### `css/responsive.css` — Breakpoints

**Five breakpoints:**

| Name | Min width | Max width |
|------|-----------|-----------|
| Mobile | 320px | 767px |
| Tablet | 768px | 1023px |
| Laptop | 1024px | 1279px |
| Desktop | 1280px | 1535px |
| Large | 1536px | — |

**Key responsive rules:**

```css
/* Map height */
#map-container { min-height: 600px; }
@media (max-width: 767px) { #map-container { min-height: 300px; } }

/* Stats grid */
#stats-cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
@media (max-width: 767px) { #stats-cards-grid { grid-template-columns: repeat(2, 1fr); } }

/* Charts grid */
#charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
@media (max-width: 767px)  { #charts-grid { grid-template-columns: 1fr; } }
@media (max-width: 1023px) { #charts-grid { grid-template-columns: 1fr; } }

/* Team grid */
#team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
@media (max-width: 1023px) { #team-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px)  { #team-grid { grid-template-columns: 1fr; } }

/* Hamburger nav */
@media (max-width: 767px) {
  #nav-links { display: none; }
  #nav-links.nav-menu--open { display: flex; flex-direction: column; width: 100%; }
  #hamburger-btn { display: block; }
}
@media (min-width: 768px) { #hamburger-btn { display: none; } }

/* Slider */
#comparison-slider { min-height: 400px; }
@media (max-width: 767px) { #comparison-slider { min-height: 250px; } }

/* Hero title */
.hero-title { font-size: var(--text-5xl); }
@media (max-width: 767px) { .hero-title { font-size: var(--text-3xl); } }

/* Body font minimum */
@media (max-width: 767px) { body { font-size: 14px; } }

/* Large display: max content width */
@media (min-width: 1536px) { .container { max-width: 1400px; } }
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Risk Level Derivation is Total and Correct

*For any* numeric `riskScore` in the range [0, 100], `utils.getRiskLevel(score)` SHALL return exactly one of `"Low"` (0–39), `"Medium"` (40–59), `"High"` (60–79), or `"Critical"` (80–100). No score in this range shall produce `null`, `undefined`, or any other value.

**Validates: Requirements 21.7, 9.2, 9.7**

---

### Property 2: Risk Color Coverage

*For any* numeric `riskScore` in [0, 100], `utils.getRiskColor(score)` SHALL return a non-empty hex string. Combined with Property 1: the color returned shall be consistent with the risk level (green for Low, amber for Medium, orange for High, red for Critical).

**Validates: Requirements 9.3, 5.11**

---

### Property 3: Clamp Invariant

*For any* numbers `value`, `min`, and `max` where `min ≤ max`, `utils.clamp(value, min, max)` SHALL return a value `r` such that `min ≤ r ≤ max`. Specifically: if `value < min` → returns `min`; if `value > max` → returns `max`; otherwise returns `value`.

**Validates: Requirements 8.2, 8.4** (slider divider position is always within bounds)

---

### Property 4: Loader Round-Trip — Statistics Data Preservation

*For any* valid `statistics.json` payload, after `loadAll()` resolves, the `stats` field in the returned payload SHALL be deep-equal to the parsed JSON object. Serialising `stats.yearlyData` to JSON and parsing it again SHALL produce an array structurally equivalent to the original.

**Validates: Requirements 2.1, 21.6**

---

### Property 5: Loader Resilience — Partial Failure

*For any* subset of the 5 data files that fails to fetch (1 through 4 failures), `loadAll()` SHALL still resolve (not reject). The resolved payload SHALL contain `null` for each failed file and a non-empty `errors[]` array identifying each failed file by name. The `data:loaded` event SHALL still be emitted with the partial payload.

**Validates: Requirements 2.6, 20.3**

---

### Property 6: Statistics Card Values Match Loaded Data

*For any* valid `statistics.json` object, the 7 rendered Statistics Card values in the DOM SHALL numerically equal the corresponding fields (`forestCoverHa`, `forestLossHa`, `forestGainHa`, `protectedAreasCount`, `districtsCount`, `satelliteImagesCount`, `predictionAccuracyPct`) after `ui.init(stats)` completes.

**Validates: Requirements 4.1, 2.7**

---

### Property 7: Prediction Card Critical Badge Invariant

*For any* district object in `prediction.json`, if `riskScore ≥ 80`, the rendered Prediction Card for that district SHALL have the `.card-critical` class applied. If `riskScore < 80`, the `.card-critical` class SHALL NOT be applied.

**Validates: Requirements 9.7**

---

### Property 8: Year Filter Produces Bounded Results

*For any* valid `yearlyData` array and any integer pair `[start, end]` where `start ≤ end`, the array returned by the year-range filter function SHALL contain only entries where `entry.year >= start && entry.year <= end`. No out-of-range entries shall appear.

**Validates: Requirements 6.8, 7.2**

---

### Property 9: Time Explorer Defaults to Most Recent Year

*For any* valid `yearlyData` array with at least one entry, calling `dashboard.init(yearlyData)` SHALL result in the selected year being `Math.max(...yearlyData.map(d => d.year))`. The `year:changed` event emitted by init SHALL carry this maximum year.

**Validates: Requirements 7.6**

---

### Property 10: District Search Filter is Inclusive and Case-Insensitive

*For any* non-empty search string `q` and any list of district names, the autocomplete filter SHALL return exactly those district names where `name.toLowerCase().includes(q.toLowerCase())`. No matching district shall be absent from results; no non-matching district shall appear.

**Validates: Requirements 5.9**

---

### Property 11: Contact Form Rejects Invalid Submissions

*For any* combination of form field values where at least one required field (Name, Email, Subject, Message) is empty or the Email field does not match a valid email pattern, submitting the form SHALL NOT clear the fields or show a success message. Each invalid field SHALL have an inline error message in the DOM.

**Validates: Requirements 14.3**

---

### Property 12: Environmental Insights Correctly Identify Extremes

*For any* valid `districtGeo` FeatureCollection with at least one feature, the derived "Highest Forest Loss District" insight SHALL name the district whose `forestLossHa` is strictly the maximum across all features. The "Highest Forest Gain District" insight SHALL name the district with strictly maximum `forestGainHa`.

**Validates: Requirements 10.1**

---

### Property Reflection (Redundancy Analysis)

After reviewing all 12 properties:

- Properties 1 and 2 are **related but non-redundant**: Property 1 tests the string label; Property 2 tests the color string — different outputs from potentially different code paths.
- Properties 4 and 6 are **non-redundant**: Property 4 tests the loader data pipeline; Property 6 tests the DOM rendering layer.
- Properties 5 and 4 are **non-redundant**: Property 5 tests failure resilience; Property 4 tests the happy path.
- Properties 8 and 9 are **non-redundant**: Property 8 tests arbitrary year ranges; Property 9 tests the specific default-year initialisation behaviour.
- No properties can be fully merged without losing distinct coverage. All 12 are retained.

---

## Error Handling

### Data Loading Errors

| Scenario | Handling |
|----------|---------|
| One or more `fetch()` calls reject | `Promise.allSettled` catches individual failures; partial `LoadResult` returned |
| JSON parse error on a file | Caught in `.then(r => r.json()).catch(...)` per file; file treated as failed |
| All 5 files fail | `data:loaded` still emitted with all-`null` payload; dashboard renders skeletons indefinitely with persistent error toasts |
| Network unavailable | Same as individual file failure; browser-standard error message surfaced |

**Error toast UI:**
- `ui.showErrorToast(message)`: renders a `<div role="alert" aria-live="assertive">` in a fixed bottom-right container.
- Auto-dismisses after 8 seconds; also has a close button.
- Multiple errors stack vertically (up to 5 visible).

### Map Errors

| Scenario | Handling |
|----------|---------|
| `district.geojson` is null | `map.init` returns early; map still renders with base tile + message overlay |
| `forest.geojson` is null | Forest/Loss/Gain layer groups remain empty; layer switcher items disabled |
| Invalid GeoJSON feature | Leaflet handles gracefully; malformed feature is skipped via try/catch in the `L.geoJSON` `onEachFeature` callback |
| Tile server unreachable | Leaflet shows grey tiles; no dashboard crash |

### Chart Errors

| Scenario | Handling |
|----------|---------|
| `stats.yearlyData` is empty | Charts render with empty datasets and a "No data available" label overlay |
| `stats.provinces` missing | Province radar chart skipped; placeholder message rendered |
| Invalid year in year-range filter (start > end) | `filterChartsToYear` swaps start/end before filtering |

### Slider Errors

| Scenario | Handling |
|----------|---------|
| Satellite images missing (404) | `<img>` `onerror` replaces src with a grey placeholder SVG |
| Container width 0 on init | Guard: `if (containerWidth <= 0) return;` in pointer handler |

### Contact Form

- Client-side validation only (no backend submit).
- `novalidate` attribute on `<form>` to prevent native browser popups in favour of custom inline messages.
- Validation on `submit` event: check each field; show `<span class="field-error" role="alert">` adjacent to each invalid field.
- On valid submission: `form.reset()`, show `#contact-success` message.

### Download Center

- `HEAD` fetch errors (network failure): card shown in disabled state with "Not available".
- `HEAD` fetch returning non-2xx: same disabled state.
- Click on disabled card: `event.preventDefault()`; no download attempted.

---

## Testing Strategy

### Dual Testing Approach

This feature combines **property-based tests** for pure logic functions and **example-based unit/integration tests** for UI rendering, DOM interactions, and external library integration.

### Property-Based Testing Library

Use **[fast-check](https://fast-check.io/)** (JavaScript/TypeScript), run via **Vitest** (`vitest --run`).

Minimum **100 iterations** per property test (fast-check default is 100; configure with `{ numRuns: 100 }`).

Each test is tagged:
```
// Feature: deforestation-watch-nepal, Property N: <property text>
```

### Property-Based Tests

#### Test file: `tests/utils.test.js`

```javascript
// Feature: deforestation-watch-nepal, Property 1: Risk Level Derivation is Total and Correct
fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
  const level = getRiskLevel(score);
  if (score <= 39)  return level === 'Low';
  if (score <= 59)  return level === 'Medium';
  if (score <= 79)  return level === 'High';
  return level === 'Critical';
}), { numRuns: 100 });

// Feature: deforestation-watch-nepal, Property 2: Risk Color Coverage
fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
  const color = getRiskColor(score);
  return typeof color === 'string' && color.startsWith('#') && color.length >= 4;
}), { numRuns: 100 });

// Feature: deforestation-watch-nepal, Property 3: Clamp Invariant
fc.assert(fc.property(
  fc.float(), fc.float(), fc.float(),
  (v, a, b) => {
    const [min, max] = a <= b ? [a, b] : [b, a];
    const r = clamp(v, min, max);
    return r >= min && r <= max;
  }
), { numRuns: 100 });
```

#### Test file: `tests/loader.test.js`

```javascript
// Feature: deforestation-watch-nepal, Property 4: Loader Round-Trip — Statistics Data Preservation
// Mocks fetch to return generated stats objects; verifies payload equality

// Feature: deforestation-watch-nepal, Property 5: Loader Resilience — Partial Failure
// Generates subsets of [0..4] indices to fail; verifies loadAll() always resolves
```

#### Test file: `tests/yearFilter.test.js`

```javascript
// Feature: deforestation-watch-nepal, Property 8: Year Filter Produces Bounded Results
fc.assert(fc.property(
  fc.array(fc.record({ year: fc.integer({ min: 2015, max: 2026 }), forestCoverHa: fc.float({ min: 0 }) })),
  fc.integer({ min: 2015, max: 2026 }),
  fc.integer({ min: 2015, max: 2026 }),
  (yearlyData, a, b) => {
    const [start, end] = [Math.min(a,b), Math.max(a,b)];
    const result = filterByYearRange(yearlyData, start, end);
    return result.every(d => d.year >= start && d.year <= end);
  }
), { numRuns: 100 });

// Feature: deforestation-watch-nepal, Property 9: Time Explorer Defaults to Most Recent Year
fc.assert(fc.property(
  fc.array(fc.record({ year: fc.integer({ min: 2015, max: 2026 }) }), { minLength: 1 }),
  (yearlyData) => {
    const expected = Math.max(...yearlyData.map(d => d.year));
    const result = getDefaultYear(yearlyData);
    return result === expected;
  }
), { numRuns: 100 });
```

#### Test file: `tests/search.test.js`

```javascript
// Feature: deforestation-watch-nepal, Property 10: District Search Filter
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 77 }),
  fc.string({ minLength: 1, maxLength: 10 }),
  (names, query) => {
    const results = filterDistrictNames(names, query);
    const expected = names.filter(n => n.toLowerCase().includes(query.toLowerCase()));
    return results.length === expected.length &&
           results.every(r => expected.includes(r));
  }
), { numRuns: 100 });
```

#### Test file: `tests/prediction.test.js`

```javascript
// Feature: deforestation-watch-nepal, Property 7: Prediction Card Critical Badge Invariant
fc.assert(fc.property(
  fc.record({ name: fc.string(), riskScore: fc.integer({ min: 0, max: 100 }) }),
  (district) => {
    const card = renderPredictionCard(district);
    if (district.riskScore >= 80) return card.classList.contains('card-critical');
    return !card.classList.contains('card-critical');
  }
), { numRuns: 100 });
```

### Example-Based Unit Tests

| Test | Assertion |
|------|-----------|
| `formatNumber(1234567)` | Returns `"1,234,567"` |
| `formatHa(450000)` | Returns `"450,000 ha"` |
| `formatNumber(0)` | Returns `"0"` |
| Statistics cards render 7 elements | `querySelectorAll('.stat-card').length === 7` |
| Skeleton cards render before data | `querySelectorAll('.skeleton-card').length === 7` |
| Nav hamburger toggles menu on mobile | `.nav-menu--open` class toggled |
| Contact form shows success on valid input | `#contact-success` visible, form fields empty |
| Contact form shows errors on empty submit | `.field-error` elements present for each empty field |
| Download card disabled when HEAD returns 404 | `aria-disabled="true"` on card |
| Slider handle aria-valuenow updates on drag | `getAttribute('aria-valuenow')` matches computed pct |
| Back to top scrolls to hero | `window.scrollY === 0` after button click |
| Team photo fallback on missing image | `img.src` contains placeholder SVG on `onerror` |

### Integration Tests

| Test | Approach |
|------|---------|
| `loadAll()` returns all 5 datasets when all fetch succeed | Mock `fetch` to return valid fixtures; assert all payload fields non-null |
| `year:changed` event updates all consumers | Emit event, assert DOM updates in map, charts, stats, insights |
| Map popups show correct district data | Simulate layer click, assert popup content matches `districtGeo` properties |
| Chart.js charts initialise with no console errors | Render with sample data, check no thrown errors |

### Accessibility Checks

- Run [axe-core](https://github.com/dequelabs/axe-core) automated scan on rendered page.
- Verify: all `<img>` have `alt`, all icon-only buttons have `aria-label`, form fields have `<label>`, map controls have `aria-label`.
- Manual test: keyboard-only navigation through all interactive elements (Tab, Enter, Space, Arrow keys).

### Performance Checks (Manual)

- Verify `Promise.allSettled` initiates all 5 fetches concurrently (Chrome DevTools Network waterfall).
- Verify `loading="lazy"` on below-fold images.
- Verify loading overlay is hidden after `data:loaded`.

---

## Security and Performance Notes

### Security

- All `fetch()` calls use relative paths (e.g., `'data/statistics.json'`). No external data endpoints are contacted.
- No user input is ever sent to a server (contact form is display-only with client-side validation).
- No `eval()`, `innerHTML` insertions of unescaped user data, or dynamic `<script>` injection.
- District names from GeoJSON are rendered via `textContent` (not `innerHTML`) in popups to prevent XSS.
- External links (GitHub, LinkedIn, team pages) use `rel="noopener noreferrer"` and `target="_blank"`.
- Content Security Policy (CSP) meta tag recommended in `index.html` for production deployment:
  ```html
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com; img-src 'self' https://*.tile.openstreetmap.org https://server.arcgisonline.com data:;">
  ```

### Performance

| Concern | Mitigation |
|---------|-----------|
| All 5 data files needed before rendering | `Promise.allSettled` parallelises all fetches |
| Large GeoJSON files (district + forest) | Files are loaded once and cached in module-level variables; never re-fetched |
| Leaflet tile re-fetching | Leaflet's internal tile cache prevents re-fetch on layer toggle |
| Heavy Chart.js bundle | Loaded from CDN with browser caching; loaded after DOMContentLoaded |
| Below-fold images | `loading="lazy"` on all `<img>` tags below `#hero` |
| Non-critical JS modules | `js/main.js` defers `initCharts`, `initPrediction` calls to after initial paint (can use `setTimeout(fn, 0)` or `requestIdleCallback` for non-map modules) |
| `prefers-reduced-motion` | All transitions/animations disabled via CSS override; no rAF counters run (immediate value set) |
| IntersectionObserver | Used instead of `scroll` event for section reveal and active nav detection — no continuous scroll listener overhead |
| `debounce` on resize and scroll handlers | Prevents excessive repaints; 50ms debounce on navbar scroll handler |

### Accessibility Summary

| Requirement | Implementation |
|-------------|---------------|
| Semantic HTML5 | `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<figure>`, `<figcaption>` used throughout |
| ARIA labels | All icon-only buttons, map controls, slider handle, hamburger, loading overlay |
| Keyboard navigation | Tab order follows DOM order; no focus traps outside fullscreen overlay |
| Focus indicators | CSS `:focus-visible` with 2px outline at `var(--color-primary)` — 3:1+ contrast |
| Alt text | All informational `<img>` have descriptive `alt`; decorative images use `alt=""` |
| WCAG 2.1 AA contrast | Text on white: `#0f172a` on `#f8fafc` = 16:1. Green on white: `#15803d` on white = 5.9:1 |
| Fullscreen focus trap | On fullscreen open: `#map-container` gets `tabIndex=-1`; Escape closes fullscreen and returns focus |
| Form labels | Each form field has explicit `<label for="field-id">` |
| Live regions | Error toasts use `role="alert"` and `aria-live="assertive"` |
| Chart accessibility | Each `<canvas>` has `aria-label` describing the chart; data also available in adjacent `<table>` (visually hidden) |

---

## File-by-File Implementation Checklist

This checklist enumerates every file a developer must create, with the minimum viable contents.

### Root

- `index.html` — full HTML document as specified in §HTML Structure above
- `README.md` — project overview, setup instructions (open `index.html` in browser), data file descriptions

### `js/`

| File | Key exports | Key dependencies |
|------|-------------|-----------------|
| `main.js` | `EventBus` | All other JS modules |
| `loader.js` | `loadAll()` | EventBus |
| `utils.js` | `formatNumber`, `formatHa`, `getRiskLevel`, `getRiskColor`, `clamp`, `debounce`, `animateCounter` | None |
| `map.js` | `init()`, `filterLayersByYear()` | `utils.js`, Leaflet (global `L`) |
| `charts.js` | `init()`, `filterChartsToYear()` | `utils.js`, Chart.js (global `Chart`) |
| `prediction.js` | `init()`, `highlightYearOnChart()` | `utils.js`, Chart.js |
| `ui.js` | `init()`, `renderStatCards()`, `renderInsights()`, `showErrorToast()` | `utils.js` |
| `dashboard.js` | `init()` | `utils.js`, EventBus |

### `css/`

| File | Contents |
|------|---------|
| `style.css` | CSS custom properties, resets, component classes |
| `animations.css` | Keyframes, reveal, bounce, reduced-motion overrides |
| `responsive.css` | All 5 breakpoint media queries |

### `data/`

| File | Source | Schema section |
|------|--------|---------------|
| `statistics.json` | Python pipeline output | §Data Models — statistics.json |
| `prediction.json` | Python ML model output | §Data Models — prediction.json |
| `risk_score.json` | Python ML model output | §Data Models — risk_score.json |
| `district.geojson` | QGIS export | §Data Models — district.geojson |
| `forest.geojson` | QGIS export | §Data Models — forest.geojson |

### `assets/`

```
assets/
  images/
    satellite-2018.jpg    ← Before/After slider (2018)
    satellite-2025.jpg    ← Before/After slider (2025)
    team-[name].jpg       ← Team member photos
    hero-bg.jpg           ← Hero section background
  icons/                  ← Any SVG icons not served by Font Awesome
  videos/                 ← Reserved; not used in current spec
  downloads/
    nepal-forest-data.csv
    nepal-districts.geojson
    nepal-forest-map.png
    nepal-forest-report.pdf
```

### `tests/`

```
tests/
  utils.test.js           ← Properties 1, 2, 3 + unit tests for formatNumber/formatHa
  loader.test.js          ← Properties 4, 5
  yearFilter.test.js      ← Properties 8, 9
  search.test.js          ← Property 10
  prediction.test.js      ← Property 7
  ui.test.js              ← Properties 6, 11, 12 + example-based tests
  integration.test.js     ← Load/event flow integration tests
```

---

*End of design document.*
