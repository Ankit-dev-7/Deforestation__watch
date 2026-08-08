/**
 * js/main.js — Application entry point and EventBus
 * Requirements: 1.4, 2.6, 20.2, 20.5
 */

// ============================================================
// EventBus — imported for local use, and re-exported for consumers
// ============================================================

import { EventBus } from './eventbus.js';
export { EventBus } from './eventbus.js';

// ============================================================
// Module imports
// ============================================================

import { loadAll } from './loader.js';
import { init as initMap } from './map.js';
import { init as initCharts } from './charts.js';
import { init as initPrediction } from './prediction.js';
import { init as initUI } from './ui.js';
import { init as initDashboard } from './dashboard.js';

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // Mark HTML as JS-active so the section reveal animation kicks in
  document.documentElement.classList.add('js-loaded');

  // Immediately reveal sections already in the viewport so they're
  // not stuck invisible while data is still loading.
  document.querySelectorAll('section').forEach(sec => {
    const rect = sec.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      sec.classList.add('revealed');
    }
  });

  // Safety fallback: reveal all sections after 8s in case JS errors block init
  const revealFallback = setTimeout(() => {
    document.querySelectorAll('section').forEach(s => s.classList.add('revealed'));
  }, 8000);

  // Wire the footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // data:loaded — initialise all modules in dependency order
  EventBus.on('data:loaded', ({ stats, prediction, risk, districtGeo, forestGeo }) => {
    clearTimeout(revealFallback); // data loaded — cancel safety fallback

    // 1. UI first — renders skeleton → real stat cards, wires navbar/slider/reveals
    if (stats) initUI(stats, districtGeo);

    // 2. Map — needs geo data
    initMap(districtGeo, forestGeo, risk);

    // 3. Charts — needs yearlyData
    if (stats) initCharts(stats);

    // 4. Prediction — needs prediction + risk data
    if (prediction && risk) initPrediction(prediction, risk, stats);

    // 5. Dashboard (Time Explorer) — emits year:changed(defaultYear) last
    if (stats && stats.yearlyData) {
      initDashboard(stats.yearlyData);
    }
  });

  // data:error — show non-blocking toast per failed file
  EventBus.on('data:error', ({ file, error }) => {
    // showErrorToast may not be available if ui.js failed; guard it
    import('./ui.js').then(({ showErrorToast }) => {
      showErrorToast(`Failed to load ${file}: ${error.message}`);
    }).catch(() => {
      console.error(`[Loader] Failed to load ${file}:`, error);
    });
  });

  // Trigger all fetches — loader emits events on completion
  await loadAll();
});
