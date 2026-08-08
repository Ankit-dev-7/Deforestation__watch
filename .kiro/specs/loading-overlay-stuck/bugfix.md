# Bugfix Requirements Document

## Introduction

The Deforestation Watch Nepal dashboard gets stuck on "Loading data..." indefinitely when opened in the browser. The loading overlay never disappears and no content is displayed. The root cause is a circular ES module dependency: `loader.js` imports `EventBus` from `main.js`, while `main.js` imports `loadAll` from `loader.js`. In ES modules, this circular import causes `EventBus` to be `undefined` when `loader.js` first executes, so the call to `EventBus.emit('data:loaded', payload)` fails silently with a TypeError. Because `hideLoadingOverlay()` is only called inside the `'data:loaded'` event handler in `main.js`, the overlay is never removed and the dashboard never renders.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the browser loads the dashboard and `loader.js` executes before `EventBus` is initialised THEN the system receives `undefined` for the `EventBus` import due to the circular ES module dependency between `loader.js` and `main.js`

1.2 WHEN `loadAll()` in `loader.js` calls `EventBus.emit('data:loaded', payload)` and `EventBus` is `undefined` THEN the system throws a silent TypeError and the `'data:loaded'` event is never emitted

1.3 WHEN the `'data:loaded'` event is never emitted THEN the system never calls `hideLoadingOverlay()` and the loading overlay remains visible indefinitely

1.4 WHEN the loading overlay remains visible indefinitely THEN the system never initialises any of the UI, map, charts, prediction, or dashboard modules, leaving the page blank beneath the overlay

### Expected Behavior (Correct)

2.1 WHEN the browser loads the dashboard THEN the system SHALL resolve `EventBus` as a fully initialised object in all modules that import it, with no circular dependency causing an `undefined` binding

2.2 WHEN `loadAll()` in `loader.js` calls `EventBus.emit('data:loaded', payload)` THEN the system SHALL successfully emit the `'data:loaded'` event to all registered handlers

2.3 WHEN the `'data:loaded'` event is emitted after all data files are fetched THEN the system SHALL call `hideLoadingOverlay()` and remove the loading overlay within 300 ms

2.4 WHEN the loading overlay is removed THEN the system SHALL initialise the UI, map, charts, prediction, and dashboard modules with the fetched data and display the full dashboard content

### Unchanged Behavior (Regression Prevention)

3.1 WHEN data files are fetched successfully THEN the system SHALL CONTINUE TO emit `'data:loaded'` with the complete payload (`stats`, `prediction`, `risk`, `districtGeo`, `forestGeo`) as before

3.2 WHEN a data file fails to load THEN the system SHALL CONTINUE TO emit `'data:error'` with the file name and error object, and display an error toast without crashing the rest of the dashboard

3.3 WHEN `EventBus.on(event, fn)` is called THEN the system SHALL CONTINUE TO register the handler and fire it when the matching event is emitted

3.4 WHEN `EventBus.emit(event, payload)` is called THEN the system SHALL CONTINUE TO invoke all registered handlers for that event with the given payload

3.5 WHEN `EventBus.off(event, fn)` is called THEN the system SHALL CONTINUE TO remove the specified handler so it no longer receives events

3.6 WHEN the `'year:changed'` event is emitted by `dashboard.js` THEN the system SHALL CONTINUE TO update the map layers, charts, stat cards, insights, and prediction highlights in all subscriber modules

3.7 WHEN `map.js`, `charts.js`, `ui.js`, `prediction.js`, and `dashboard.js` import `EventBus` THEN the system SHALL CONTINUE TO provide each module with the same shared singleton instance so events are correctly propagated across modules
