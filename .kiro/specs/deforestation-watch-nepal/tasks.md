# Implementation Plan: Deforestation Watch Nepal

## Overview

Build a fully static, single-page GIS intelligence dashboard using HTML5/CSS3/Vanilla JS (ES6 Modules), TailwindCSS CDN, Leaflet.js, Chart.js, Font Awesome, and Google Fonts Inter. No build step, no backend, no framework. All data is loaded at runtime from local JSON/GeoJSON files via `fetch()`. The implementation follows the module dependency order: foundation → data files → CSS → JS utilities → JS modules → HTML sections → tests.

---

## Tasks

- [x] 1. Project foundation — `index.html` skeleton and CDN wiring
  - Create `index.html` with complete `<head>`: `<meta charset>`, viewport, title, TailwindCSS CDN script, Leaflet CSS CDN, Font Awesome CDN, Google Fonts Inter, and links to `css/style.css`, `css/animations.css`, `css/responsive.css`
  - Add `<body>` shell with `#loading-overlay`, `<header>/<nav id="navbar">`, `<main>`, all named `<section>` elements (`#hero`, `#statistics`, `#map`, `#time-explorer`, `#analytics`, `#comparison`, `#prediction`, `#insights`, `#download`, `#methodology`, `#team`, `#contact`), `<footer id="footer">`
  - Add Leaflet JS CDN, Chart.js CDN, and `<script type="module" src="js/main.js">` at the bottom of `<body>`
  - Apply semantic HTML5 structure: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` with appropriate `aria-labelledby` attributes on all sections
  - Add `#loading-overlay` with spinner and `role="status"`, `aria-label="Loading dashboard data"`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 19.1_

- [x] 2. Data files — Create all five data source files
  - [x] 2.1 Create `data/statistics.json`
    - Write the full schema: top-level fields `forestCoverHa`, `forestLossHa`, `forestGainHa`, `protectedAreasCount`, `districtsCount`, `satelliteImagesCount`, `predictionAccuracyPct`
    - Include `yearlyData` array with entries for years 2015–2026, each with `year`, `forestCoverHa`, `forestLossHa`, `forestGainHa`
    - Include `provinces` array (7 entries) and `districts` array (77 entries) and `composition` array (4 forest type entries)
    - _Requirements: 2.1, 21.1_

  - [x] 2.2 Create `data/prediction.json`
    - Write the full schema: `modelVersion`, `generatedAt`, `confidencePct`, and `districts` array
    - Each district entry: `name`, `riskScore` (0–100), `riskLevel` (Low/Medium/High/Critical), `confidencePct`, and `projectedCover` array for years 2026–2030
    - Include at least 10 districts with varied risk scores spanning all four risk levels; include at least 5 with `riskScore >= 80`
    - _Requirements: 2.2, 21.2_

  - [x] 2.3 Create `data/risk_score.json`
    - Write the full schema: top-level `districts` array where each entry has `name` (string) and `riskScore` (number 0–100)
    - Include all 77 districts consistent with `statistics.json` and `prediction.json` district names
    - _Requirements: 2.3, 21.3_

  - [x] 2.4 Create `data/district.geojson`
    - Write a valid GeoJSON FeatureCollection with Polygon features representing Nepal's administrative district boundaries
    - Each feature `properties`: `name`, `forestCoverHa`, `forestLossHa`, `forestGainHa`, `riskScore`, `province`
    - Use realistic simplified polygon coordinates centered around Nepal's bounding box
    - _Requirements: 2.4, 21.4_

  - [x] 2.5 Create `data/forest.geojson`
    - Write a valid GeoJSON FeatureCollection with MultiPolygon features
    - Each feature `properties`: `type` (one of `"cover"`, `"loss"`, `"gain"`), `year` (integer 2015–2026), `areaHa` (number), `district` (string)
    - Include features for multiple years and all three types so `filterLayersByYear()` has data to filter
    - _Requirements: 2.5, 21.5_


- [x] 3. CSS — Design tokens, animations, and responsive rules
  - [x] 3.1 Create `css/style.css`
    - Define all CSS custom properties on `:root`: color palette (`--color-primary: #16a34a`, danger, warning, info, neutrals, surface), typography scale (`--text-xs` through `--text-5xl`), spacing, shadows, transitions, border-radius tokens
    - Write base resets: `box-sizing`, body font/background/color/line-height, `img`, `a`, `button`
    - Write component classes: `.card`, `.card-critical` (red border), `.btn`, `.btn-primary`, `.btn-outline`, `.badge` variants, `.skeleton-card`, `.stat-card`, `.map-legend`, `.navbar--scrolled`, `.nav-link--active`, `.loading-spinner`
    - _Requirements: 18.3, 18.4, 4.4_

  - [x] 3.2 Create `css/animations.css`
    - Write section reveal rules: `section { opacity: 0; transform: translateY(24px); transition: ... }` and `section.revealed { opacity: 1; transform: none }`
    - Write `@keyframes bounce-down` for scroll indicator; `.scroll-indicator { animation: bounce-down 1.6s ease-in-out infinite }`
    - Write `.section-transitioning { opacity: 0.6; transition: opacity 150ms ease }` for year-change transitions
    - Write `.chart-wrapper { transition: opacity ... }` and `.chart-wrapper.updating { opacity: 0.4 }`
    - Write `@media (prefers-reduced-motion: reduce)` block: disable all animation/transition durations, reset section opacity and transform, remove scroll indicator animation
    - _Requirements: 18.1, 18.5, 18.6, 7.5_

  - [x] 3.3 Create `css/responsive.css`
    - Write all 5-breakpoint media queries: mobile (≤767px), tablet (768–1023px), laptop (1024–1279px), desktop (1280–1535px), large (≥1536px)
    - Map container: `min-height: 600px` on desktop; `min-height: 300px` on mobile
    - Stats grid: 4-column on desktop/tablet; 2-column on mobile
    - Charts grid: 2-column on laptop+; single-column on mobile and tablet
    - Team grid: 3-column on desktop; 2-column on tablet; 1-column on mobile
    - Hamburger nav: hide nav links below 768px; show hamburger; `.nav-menu--open` expands full-width column
    - Comparison slider: `min-height: 400px` desktop; `min-height: 250px` mobile
    - Hero title: `var(--text-5xl)` on desktop; `var(--text-3xl)` on mobile; body `font-size: 14px` on mobile
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_


- [x] 4. JS utilities — `js/utils.js` pure functions
  - [x] 4.1 Implement `js/utils.js`
    - Export `formatNumber(n)`: locale-aware comma formatting via `n.toLocaleString()`
    - Export `formatHa(n)`: calls `formatNumber` then appends `" ha"`
    - Export `getRiskLevel(score)`: returns `'Low'` (0–39), `'Medium'` (40–59), `'High'` (60–79), `'Critical'` (80–100) — must be total (no score in [0,100] returns null/undefined)
    - Export `getRiskColor(score)`: returns `'#22c55e'` (0–39), `'#f59e0b'` (40–59), `'#f97316'` (60–79), `'#ef4444'` (80–100)
    - Export `clamp(value, min, max)`: returns `Math.min(Math.max(value, min), max)`
    - Export `debounce(fn, delay)`: returns debounced wrapper; clears previous timeout on each call
    - Export `animateCounter(el, target, duration)`: uses `requestAnimationFrame`; respects `prefers-reduced-motion` (immediately sets `el.textContent` if matched); writes formatted integers on each frame
    - _Requirements: 8.4, 9.2, 9.7, 21.7_

  - [ ]* 4.2 Write property tests for `utils.js` — `tests/utils.test.js`
    - **Property 1: Risk Level Derivation is Total and Correct** — `fc.integer({ min: 0, max: 100 })` → assert `getRiskLevel` returns exactly the correct label per band; tagged `// Feature: deforestation-watch-nepal, Property 1`
    - **Property 2: Risk Color Coverage** — `fc.integer({ min: 0, max: 100 })` → assert `getRiskColor` returns a string starting with `#` and length ≥ 4; tagged `// Feature: deforestation-watch-nepal, Property 2`
    - **Property 3: Clamp Invariant** — `fc.float(), fc.float(), fc.float()` → normalize min/max, assert `clamp(v, min, max)` result is within `[min, max]`; tagged `// Feature: deforestation-watch-nepal, Property 3`
    - Include example-based tests: `formatNumber(1234567)` → `"1,234,567"`, `formatHa(450000)` → `"450,000 ha"`, `formatNumber(0)` → `"0"`
    - Configure each `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 21.7, 9.2, 9.7, 8.2, 8.4**


- [x] 5. JS data loader — `js/loader.js`
  - [x] 5.1 Implement `js/loader.js`
    - Export `loadAll()`: initiates `Promise.allSettled` across all 5 `fetch()` calls (`data/statistics.json`, `data/prediction.json`, `data/risk_score.json`, `data/district.geojson`, `data/forest.geojson`)
    - For each fulfilled result: call `.json()` to parse; catch parse errors per file (treated as failure)
    - For each rejected result: push `{ file: string, error: Error }` into `errors[]`
    - After settlement: emit `EventBus.emit('data:loaded', { stats, prediction, risk, districtGeo, forestGeo, errors })`
    - For each entry in `errors[]`: emit `EventBus.emit('data:error', { file, error })`
    - Return the full `LoadResult` object; function MUST resolve (never reject) even if all 5 files fail
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 20.3_

  - [ ]* 5.2 Write property tests for `loader.js` — `tests/loader.test.js`
    - **Property 4: Loader Round-Trip** — mock `fetch` to return generated valid `statistics.json` payloads; call `loadAll()`; assert `stats` deep-equals the mock payload and `JSON.parse(JSON.stringify(stats.yearlyData))` is structurally equivalent; tagged `// Feature: deforestation-watch-nepal, Property 4`
    - **Property 5: Loader Resilience** — generate subsets of file indices (1–4 failures) to simulate `fetch` rejection; assert `loadAll()` always resolves; assert `errors[].length` equals the number of failed files; assert `data:loaded` event is emitted; tagged `// Feature: deforestation-watch-nepal, Property 5`
    - Configure each `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 2.1, 2.6, 21.6, 20.3**


- [x] 6. JS entry point — `js/main.js` with EventBus
  - [x] 6.1 Implement `js/main.js`
    - Define and export `EventBus` singleton: `Map<string, Set<Function>>` with `on(event, fn)`, `off(event, fn)`, `emit(event, payload)` methods
    - Import `loadAll` from `loader.js`; import `init` from `map.js`, `charts.js`, `prediction.js`, `ui.js`, `dashboard.js`
    - Inside `DOMContentLoaded`: call `showLoadingOverlay()`, register `EventBus.on('data:loaded', ...)` handler that calls `hideLoadingOverlay()` then initialises all 5 modules in dependency order
    - Register `EventBus.on('data:error', ...)` handler that calls `ui.showErrorToast()`
    - Call `await loadAll()` to trigger the load sequence
    - Implement `showLoadingOverlay()` and `hideLoadingOverlay()` (adds `.fade-out`, removes element after 300ms)
    - _Requirements: 1.4, 2.6, 20.2, 20.5_


- [x] 7. JS map module — `js/map.js`
  - [x] 7.1 Implement map initialisation in `js/map.js`
    - Export `init(districtGeo, forestGeo, risk)`: create `L.map('map-container', { zoomControl: false })` centered at `[28.3949, 84.1240]` zoom 7
    - Add OpenStreetMap tile layer and Esri satellite tile layer; register both in `L.control.layers` (top-right)
    - Add `L.control.scale()` bottom-left; add custom zoom control
    - Build `Forest_Layer` (type==='cover', green fill #22c55e 40%), `Loss_Layer` (type==='loss', red #ef4444 40%), `Gain_Layer` (type==='gain', blue #3b82f6 40%) from `forestGeo` filtered by type
    - Build `Protected_Areas_Layer` (yellow stroke #f59e0b, no fill) and `Admin_Boundaries_Layer` (thin grey stroke) from `districtGeo`
    - Register all 5 overlays in `L.control.layers`; add map legend div (`.map-legend`) listing color codes for active overlays
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.2 Implement map custom controls and interactions in `js/map.js`
    - Add custom Fullscreen control (extends `L.Control`): toggles `.map-fullscreen` CSS class on `#map-container`; `tabIndex=0`, `role="button"`, `aria-label="Toggle fullscreen"`; responds to Enter/Space keydown; traps focus inside when open; Escape closes
    - Add custom Reset View control: `map.setView([28.3949, 84.1240], 7)`; `aria-label="Reset map view"`
    - Add custom District Search control: `<input>` + `<ul>` autocomplete from `districtGeo.features[].properties.name`; on select: `map.fitBounds(layer.getBounds())` + highlight style
    - `Admin_Boundaries_Layer` hover: `mouseover` → `{ color: '#0ea5e9', weight: 3 }` + `bringToFront`; `mouseout` → `resetStyle`
    - `Admin_Boundaries_Layer` click: open `L.popup` with district data table (name, forestCoverHa, forestLossHa, forestGainHa, riskScore, riskLevel, trend); emit `EventBus.emit('map:districtClick', { properties })`; render popup text via `textContent` (not innerHTML)
    - _Requirements: 5.7, 5.8, 5.9, 5.10, 5.11, 5.13, 19.2, 19.3_

  - [x] 7.3 Implement Risk choropleth layer and `filterLayersByYear()` in `js/map.js`
    - Export `filterLayersByYear(year)`: clear `Forest_Layer`, `Loss_Layer`, `Gain_Layer` groups; re-filter `forestGeo.features` by `feature.properties.year === year`; re-add with appropriate styles
    - Build Risk Heat Map choropleth overlay: match each district name in `risk.districts` to corresponding `districtGeo` feature; fill color from `utils.getRiskColor(riskScore)`; add as "Risk Heat Map" in layer switcher (off by default)
    - Subscribe to `EventBus.on('year:changed', ({ year }) => filterLayersByYear(year))`
    - Guard against null `districtGeo` or `forestGeo`: return early with console warning, map still renders with base tile
    - _Requirements: 5.3, 5.12, 9.3_


- [x] 8. JS charts module — `js/charts.js`
  - [x] 8.1 Implement all 6 Chart.js instances in `js/charts.js`
    - Export `init(stats)`: create 6 Chart.js instances on their respective canvas IDs
    - Chart 1 `#chart-trend`: Line (area fill), `yearlyData[].forestCoverHa` by year
    - Chart 2 `#chart-loss`: Bar, `yearlyData[].forestLossHa` by year
    - Chart 3 `#chart-province`: Radar, province metrics from `stats.provinces[]`
    - Chart 4 `#chart-district`: Horizontal Bar, top-10 districts by loss from `stats.districts[]`
    - Chart 5 `#chart-gain`: Bar, `yearlyData[].forestGainHa` by year
    - Chart 6 `#chart-composition`: Doughnut, forest type proportions from `stats.composition`
    - Apply to all: `animation: { duration: 1000, easing: 'easeInOutQuart' }` on initial render; tooltip callback `label: (ctx) => formatHa(ctx.raw)` or `formatNumber` as appropriate
    - Add `<canvas aria-label="...">` description and a visually-hidden `<table>` sibling per chart
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 6.10, 6.11, 18.2, 19.7_

  - [x] 8.2 Implement year-range filter and `filterChartsToYear()` in `js/charts.js`
    - Wire `#year-range-start` and `#year-range-end` `input` events: derive filtered `yearlyData` slice where `start <= year <= end`; swap if start > end; update charts 1, 2, 5 data and call `chart.update('none')`; add/remove `.chart-wrapper.updating` class during update
    - Export `filterChartsToYear(year)`: highlight corresponding bar/point on charts 1, 2, 5 using distinct background color; do not re-filter all data
    - Subscribe to `EventBus.on('year:changed', ({ year }) => filterChartsToYear(year))`
    - Guard against empty `stats.yearlyData`: render charts with empty datasets + "No data available" label overlay
    - _Requirements: 6.8, 7.2_


- [x] 9. JS prediction module — `js/prediction.js`
  - [x] 9.1 Implement Prediction Cards and Top-10 list in `js/prediction.js`
    - Export `init(prediction, risk)`: sort `prediction.districts` descending by `riskScore`; render top-5 cards into `#prediction-cards-container`
    - Each card: district name, risk score (large number), risk level badge (color from `utils.getRiskColor`), confidence percentage
    - Apply `.card-critical` class (red border `border-red-500`, warning icon `fa-triangle-exclamation`, red badge) when `riskScore >= 80`; do NOT apply when `riskScore < 80`
    - Render Top-10 High Risk Districts as `<ol id="top-risk-list">`: source from `risk.districts` sorted descending by `riskScore`, take first 10; each `<li>`: rank, name, score bar, risk level badge
    - Compute average `confidencePct` across all prediction districts; render in `#confidence-badge` as "Model Confidence" percentage
    - _Requirements: 9.1, 9.2, 9.5, 9.7, 9.8_

  - [x] 9.2 Implement prediction charts and `highlightYearOnChart()` in `js/prediction.js`
    - Render Historical vs. Predicted chart (`#chart-historical-predicted`): Line chart; Dataset 1 "Actual" — `statistics.yearlyData` for 2015–2025, solid line, `borderDash: []`, color `#16a34a`; Dataset 2 "Predicted" — aggregated `projectedCover` 2026–2030, dashed `borderDash: [6, 3]`, color `#f59e0b`
    - Render Future Forest Cover chart (`#chart-future-cover`): Bar chart; sum `projectedCover` across all districts per year 2026–2030; Y-axis label "Projected Forest Cover (ha)"
    - Export `highlightYearOnChart(year)`: if 2015–2025, highlight that point on Historical dataset; if 2026–2030, highlight corresponding bar in Future Cover chart
    - Subscribe to `EventBus.on('year:changed', ({ year }) => highlightYearOnChart(year))`
    - _Requirements: 9.4, 9.6_

  - [ ]* 9.3 Write property tests for prediction cards — `tests/prediction.test.js`
    - **Property 7: Prediction Card Critical Badge Invariant** — `fc.record({ name: fc.string(), riskScore: fc.integer({ min: 0, max: 100 }) })` → call `renderPredictionCard(district)`; assert `.card-critical` present iff `riskScore >= 80`; tagged `// Feature: deforestation-watch-nepal, Property 7`
    - Configure `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 9.7**


- [x] 10. JS dashboard module — `js/dashboard.js` (Time Explorer)
  - [x] 10.1 Implement Time Explorer rendering and year selection in `js/dashboard.js`
    - Export `init(yearlyData)`: extract all unique years from `yearlyData`, sort ascending; render horizontal flex row of `<button class="year-btn" data-year="...">` elements into `#year-timeline`; active year gets `.year-btn--active`
    - Implement `selectYear(year)`: remove `.year-btn--active` from all buttons; add to target; add `.section-transitioning` to `#analytics`, `#statistics`, `#insights`, `#prediction`; emit `EventBus.emit('year:changed', { year })`; after 300ms remove `.section-transitioning`
    - Wire `click` event on year buttons to `selectYear`
    - Wire `keydown` on `#year-timeline` container: `ArrowRight` → next year; `ArrowLeft` → previous year
    - On init: call `selectYear(Math.max(...years))` — most recent year
    - Export helper `getDefaultYear(yearlyData)` returning `Math.max(...years)` for testability
    - Export helper `filterByYearRange(yearlyData, start, end)` returning entries where `entry.year >= start && entry.year <= end` for testability
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 10.2 Write property tests for year filter and default year — `tests/yearFilter.test.js`
    - **Property 8: Year Filter Produces Bounded Results** — `fc.array(fc.record({ year: fc.integer({ min: 2015, max: 2026 }), forestCoverHa: fc.float({ min: 0 }) }))` + two year integers → normalize `[start, end]`; assert all results have `entry.year >= start && entry.year <= end`; tagged `// Feature: deforestation-watch-nepal, Property 8`
    - **Property 9: Time Explorer Defaults to Most Recent Year** — `fc.array(fc.record({ year: fc.integer({ min: 2015, max: 2026 }) }), { minLength: 1 })` → assert `getDefaultYear(data)` equals `Math.max(...data.map(d => d.year))`; tagged `// Feature: deforestation-watch-nepal, Property 9`
    - Configure each `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 6.8, 7.2, 7.6**


- [x] 11. JS UI module — `js/ui.js` (Statistics Cards, Insights, Slider, Navbar, Downloads, Reveals)
  - [x] 11.1 Implement Statistics Cards in `js/ui.js`
    - Export `init(stats)`: render 7 `.skeleton-card` elements into `#stats-cards-grid` immediately (before data); on call replace with real `.stat-card` elements for all 7 metrics with Font Awesome icon, formatted number, and descriptive label
    - Wire `IntersectionObserver` (threshold 0.3) on each value element: on first intersection call `utils.animateCounter(el, target, 2000)`; disconnect after trigger
    - Export `renderStatCards(year)`: look up `stats.yearlyData.find(d => d.year === year)`; update `forestCoverHa`, `forestLossHa`, `forestGainHa` card values only (other 4 are year-independent)
    - Subscribe to `EventBus.on('year:changed', ({ year }) => renderStatCards(year))`
    - Export `showErrorToast(message)`: render `<div role="alert" aria-live="assertive">` in fixed bottom-right container; auto-dismiss after 8s; close button; max 5 stacked
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 2.7, 19.5_

  - [x] 11.2 Implement Environmental Insights in `js/ui.js`
    - Export `renderInsights(year)`: derive all 6 insight cards from `districtGeo.features`: (1) max `forestLossHa` district, (2) max `forestGainHa` district, (3) max `|forestLossHa - forestGainHa|`, (4) min `|forestLossHa - forestGainHa|`, (5) nationwide annual % change, (6) protected forest summary
    - Replace `#insights-grid` innerHTML with 6 rendered cards; each card has title, numeric value, one-sentence description
    - Apply color-coded accents: danger red for loss insights, success green for gain insights, info blue for neutral
    - Subscribe to `EventBus.on('year:changed', ({ year }) => renderInsights(year))`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 11.3 Implement Before/After Slider in `js/ui.js`
    - Write HTML structure for `#comparison-slider`: `.slider-before` with `<img src="assets/images/satellite-2018.jpg" alt="Nepal forest cover 2018">`, `.slider-after` with `clip-path: inset(0 50% 0 0)` and `<img alt="Nepal forest cover 2025">`, `.slider-handle` with `tabindex="0"`, `role="slider"`, `aria-label="Comparison divider"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="50"`
    - Implement `updateSlider(pct)`: clamp via `utils.clamp(pct, 0, 100)`; set `.slider-after` `clip-path: inset(0 ${100 - pct}% 0 0)`; set `.slider-handle` `left: ${pct}%`; set `aria-valuenow`
    - Wire `pointerdown` → `setPointerCapture` → `pointermove` (compute pct from `clientX`) → `pointerup` (release capture)
    - Wire `keydown` on handle: `ArrowLeft` → `updateSlider(sliderPct - 2)`; `ArrowRight` → `updateSlider(sliderPct + 2)`
    - Add `onerror` on both `<img>` tags to replace `src` with grey placeholder SVG
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 16.6, 19.2_

  - [x] 11.4 Implement Navigation Bar, Download Center, and Section Reveal in `js/ui.js`
    - Navbar: wire `window.scroll` with `debounce(fn, 50)`; add `.navbar--scrolled` when `scrollY > 80`; `IntersectionObserver` (threshold 0.5) on all `<section>` elements to set `.nav-link--active` on matching nav link; hamburger `#hamburger-btn` toggles `.nav-menu--open` on `#nav-links` and `aria-expanded` attribute
    - Download Center: for each of 4 assets issue `HEAD` fetch; on 200 render enabled card with download `<a>`, file size, Font Awesome icon; on error/non-200 render disabled card with `aria-disabled="true"` and "Not available" label; prevent click on disabled cards
    - Section Reveal: `IntersectionObserver` (threshold 0.1) on all `<section>` elements; on intersection add `.revealed`; disconnect entry after first trigger; skip entirely when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 17.1, 17.2, 17.3, 17.4, 17.5, 18.1, 18.6, 20.1_

  - [ ]* 11.5 Write property and unit tests for UI — `tests/ui.test.js`
    - **Property 6: Stats Cards Match Data** — generate valid `statistics.json` objects; call `ui.init(stats)`; assert all 7 rendered card numeric values equal corresponding fields; tagged `// Feature: deforestation-watch-nepal, Property 6`
    - **Property 11: Form Rejects Invalid** — generate form field combinations where ≥1 required field is empty or email invalid; simulate form submit; assert form fields NOT cleared, success message NOT shown, `.field-error` present for each invalid field; tagged `// Feature: deforestation-watch-nepal, Property 11`
    - **Property 12: Insights Identify Extremes** — generate `districtGeo` FeatureCollections (minLength 1); call `renderInsights()`; assert highest loss card names the district with max `forestLossHa` and highest gain card names the district with max `forestGainHa`; tagged `// Feature: deforestation-watch-nepal, Property 12`
    - Include example-based tests: 7 `.stat-card` elements rendered, 7 `.skeleton-card` before data, hamburger toggles `.nav-menu--open`, slider `aria-valuenow` updates on drag, download card `aria-disabled="true"` on 404, back-to-top scrolls `window.scrollY === 0`
    - Configure each `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 4.1, 2.7, 14.3, 10.1**


- [x] 12. Checkpoint — Core modules wired together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. HTML sections — Hero, Statistics, Map, Time Explorer, Analytics
  - [ ] 13.1 Implement Hero Section HTML in `index.html`
    - Add `<canvas id="particle-canvas" aria-hidden="true">` absolute-positioned above background, below text
    - Add hero background `<div>` with satellite image (`assets/images/hero-bg.jpg`, `loading="lazy"`) and dark semi-transparent overlay
    - Add `.hero-title` "Deforestation Watch Nepal" Inter font ≥3rem on desktop; add subtitle ≤2 lines
    - Add 3 hero stat card placeholders (Forest Cover, Forest Loss, Forest Gain) sourced from `statistics.json` via `ui.init`
    - Add scroll indicator (`<button class="scroll-indicator" aria-label="Scroll to statistics">`) with bounce animation; wire `click` and `keydown` (Enter/Space) to smooth scroll to `#statistics`
    - Add `<section id="statistics">` with `<div id="stats-cards-grid">` (skeleton then real cards via `ui.js`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1–4.5_

  - [~] 13.2 Implement Map, Time Explorer, and Analytics sections HTML in `index.html`
    - Add `<section id="map">` with `<div id="map-container" style="min-height:600px">` (Leaflet init target)
    - Add `<section id="time-explorer">` with `<div id="year-timeline" role="group" aria-label="Year selection timeline">`
    - Add year-range filter controls `<input id="year-range-start">` and `<input id="year-range-end">` above charts
    - Add `<section id="analytics">` with `<div id="charts-grid">` containing 6 `.chart-wrapper > <canvas>` elements with IDs `chart-trend`, `chart-loss`, `chart-province`, `chart-district`, `chart-gain`, `chart-composition`; each `<canvas>` has descriptive `aria-label`; each has adjacent visually-hidden `<table>` for accessibility
    - _Requirements: 5.1, 5.13, 6.1–6.11, 7.1, 7.3, 19.1, 19.7_

- [ ] 14. HTML sections — Comparison, Prediction, Insights, Download, Methodology, Team, Contact, Footer
  - [~] 14.1 Implement Comparison, Prediction, and Insights sections HTML in `index.html`
    - Add `<section id="comparison">` with `#comparison-slider` structure (before/after images + handle); images use `loading="lazy"`
    - Add `<section id="prediction">` with `#confidence-badge`, `#prediction-cards-container`, `<ol id="top-risk-list">`, and two chart canvases (`#chart-historical-predicted`, `#chart-future-cover`)
    - Add `<section id="insights">` with `<div id="insights-grid">`
    - _Requirements: 8.1–8.6, 9.1–9.8, 10.1–10.4_

  - [~] 14.2 Implement Download Center, Methodology, Team, Contact, and Footer HTML in `index.html`
    - Add `<section id="download">` with `<div id="download-cards">` (cards populated by `ui.js`)
    - Add `<section id="methodology">` with 8 static subsections (icons + headings + paragraphs): Satellite Imagery Acquisition, Python Analysis Pipeline, QGIS Workflow, GeoJSON Generation, Data Cleaning, Trend Analysis, Prediction Model Architecture, Known Limitations — readable without JS
    - Add `<section id="team">` with `<div id="team-grid">` containing team member cards with `<img loading="lazy">` (fallback `onerror` placeholder), name, role, GitHub/LinkedIn `<a rel="noopener noreferrer" target="_blank">`
    - Add `<section id="contact">` with `<form id="contact-form" novalidate>`: fields Name, Email, Subject, Message each with explicit `<label for="...">` and adjacent `<span class="field-error" role="alert">` placeholder; contact info aside
    - Add `<footer id="footer">`: dark background, GitHub/Documentation/License links, Back to Top button (smooth scroll, Enter/Space keyboard support), copyright with current year
    - _Requirements: 11.1–11.5, 12.1–12.3, 13.1–13.4, 14.1–14.5, 15.1–15.5, 19.1–19.6_


- [x] 15. JS particle animation and contact form in `js/ui.js`
  - [x] 15.1 Implement Hero particle animation in `js/ui.js`
    - Add `initParticles()`: select `#particle-canvas`; resize canvas to match hero dimensions on init and on window resize (debounced)
    - Spawn ~60 floating dots with random positions, velocities, and radii; each frame: update positions, wrap at edges, draw with `ctx.arc`
    - Use `requestAnimationFrame` loop; skip animation (or immediately return) if `prefers-reduced-motion` is set
    - _Requirements: 3.3, 18.5, 18.6_

  - [x] 15.2 Implement contact form client-side validation in `js/ui.js`
    - Wire `#contact-form` `submit` event with `event.preventDefault()`
    - Validate: Name non-empty, Email matches `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, Subject non-empty, Message non-empty
    - On any invalid field: set `.field-error` text adjacent to that field; do NOT clear form fields; do NOT show success message
    - On all fields valid: call `form.reset()`; show `#contact-success` element
    - _Requirements: 14.2, 14.3, 14.5_

- [ ] 16. District search property test — `tests/search.test.js`
  - [ ]* 16.1 Write property test for district search filter — `tests/search.test.js`
    - Export `filterDistrictNames(names, query)` from `map.js` or `utils.js` for isolated testing
    - **Property 10: District Search Filter is Inclusive and Case-Insensitive** — `fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 77 })` + `fc.string({ minLength: 1, maxLength: 10 })` → assert results length equals `names.filter(n => n.toLowerCase().includes(q.toLowerCase())).length` and every result is in expected set; tagged `// Feature: deforestation-watch-nepal, Property 10`
    - Configure `fc.assert` with `{ numRuns: 100 }`
    - **Validates: Requirements 5.9**


- [ ] 17. Integration tests — `tests/integration.test.js`
  - [ ]* 17.1 Write integration tests — `tests/integration.test.js`
    - Test: `loadAll()` resolves with all 5 non-null fields when all fetches succeed — mock `fetch` with valid fixture files, assert all `stats`, `prediction`, `risk`, `districtGeo`, `forestGeo` are non-null
    - Test: `year:changed` event updates all consumers — emit `EventBus.emit('year:changed', { year: 2020 })`; assert DOM updates in stats cards, insights grid, and `highlightYearOnChart` called
    - Test: map popup shows correct district data — simulate `click` on Admin_Boundaries layer feature; assert popup `textContent` contains district name and `forestCoverHa` value matching the `districtGeo` fixture
    - Test: Chart.js charts initialise without thrown errors — call `charts.init(sampleStats)` with valid fixture; assert no uncaught exceptions and 6 `<canvas>` elements have Chart.js instances
    - Test: `loadAll()` partial failure path — mock 2 of 5 fetches to reject; assert `loadAll()` resolves, `errors.length === 2`, `data:loaded` event emitted, non-failed fields are non-null
    - _Requirements: 2.1–2.6, 7.2, 5.11_

- [ ] 18. README and test framework setup
  - [~] 18.1 Create `README.md`
    - Write project overview: what Deforestation Watch Nepal is, technology stack summary
    - Write setup instructions: "Open `index.html` in any modern browser — no build step required"
    - Document the data files: purpose, schema summary, and location for each of the 5 files
    - Document assets directory structure; list CDN dependencies with version numbers
    - Note the test framework: fast-check + Vitest; include `npm install` and `npx vitest --run` commands for running tests
    - _Requirements: 1.1, 1.2_

  - [x] 18.2 Set up test framework
    - Create `package.json` with `vitest` and `fast-check` as `devDependencies` (pinned exact versions)
    - Create `vitest.config.js` configured for browser-like test environment (`jsdom`)
    - Create placeholder test files for all 7 test files with the `// Feature: deforestation-watch-nepal` tag comment at the top of each
    - Verify `npx vitest --run` executes without errors on the placeholder files
    - _Requirements: (test infrastructure)_

- [~] 19. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- All 12 correctness properties from the design are covered by PBT sub-tasks in this plan:
  - Properties 1, 2, 3 → task 4.2 (`tests/utils.test.js`)
  - Properties 4, 5 → task 5.2 (`tests/loader.test.js`)
  - Property 6 → task 11.5 (`tests/ui.test.js`)
  - Property 7 → task 9.3 (`tests/prediction.test.js`)
  - Properties 8, 9 → task 10.2 (`tests/yearFilter.test.js`)
  - Property 10 → task 16.1 (`tests/search.test.js`)
  - Properties 11, 12 → task 11.5 (`tests/ui.test.js`)
- Dependency order strictly followed: utils (task 4) before all consumers; data files (task 2) before JS modules; CSS (task 3) independent; main.js/EventBus (task 6) before UI wiring; test framework setup (task 18.2) before all test sub-tasks
- The test framework (Vitest + fast-check) must be set up before running PBT tasks; run with `npx vitest --run` (single execution, no watch mode)
- Checkpoints at tasks 12 and 19 validate incremental correctness before proceeding

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "2.2", "2.3", "2.4", "2.5", "3.1", "3.2", "3.3", "18.2"] },
    { "id": 1, "tasks": ["4.1", "6.1"] },
    { "id": 2, "tasks": ["4.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "7.1", "8.1", "9.1", "10.1", "11.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "8.2", "9.2", "10.2", "11.2", "11.3", "11.4"] },
    { "id": 5, "tasks": ["9.3", "13.1", "13.2", "15.1", "15.2"] },
    { "id": 6, "tasks": ["11.5", "14.1", "14.2", "16.1"] },
    { "id": 7, "tasks": ["17.1", "18.1"] }
  ]
}
```
