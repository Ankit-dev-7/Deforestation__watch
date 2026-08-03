/**
 * js/main.js — Application entry point and EventBus
 * Requirements: 1.4, 2.6, 20.2, 20.5
 */

// ============================================================
// EventBus — minimal pub/sub singleton
// ============================================================

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

export const EventBus = {
  /**
   * Subscribe to an event.
   * @param {string}   event
   * @param {Function} fn
   */
  on(event, fn) {
    if (!_listeners.has(event)) {
      _listeners.set(event, new Set());
    }
    _listeners.get(event).add(fn);
  },

  /**
   * Unsubscribe from an event.
   * @param {string}   event
   * @param {Function} fn
   */
  off(event, fn) {
    if (_listeners.has(event)) {
      _listeners.get(event).delete(fn);
    }
  },

  /**
   * Emit an event with an optional payload.
   * @param {string} event
   * @param {*}      [payload]
   */
  emit(event, payload) {
    if (_listeners.has(event)) {
      for (const fn of _listeners.get(event)) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  },
};

// ============================================================
// Module imports (deferred — ES6 dynamic imports after paint)
// ============================================================

import { loadAll } from './loader.js';
import { init as initMap } from './map.js';
import { init as initCharts } from './charts.js';
import { init as initPrediction } from './prediction.js';
import { init as initUI } from './ui.js';
import { init as initDashboard } from './dashboard.js';

// ============================================================
// Loading overlay helpers
// ============================================================

function showLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  setTimeout(() => {
    overlay.remove();
  }, 300);
}

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  showLoadingOverlay();

  // Wire the footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // data:loaded — initialise all modules in dependency order
  EventBus.on('data:loaded', ({ stats, prediction, risk, districtGeo, forestGeo }) => {
    hideLoadingOverlay();

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
