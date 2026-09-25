# AGENTS.md

## What this is

A single-page PWA for planning the seating chart of a dragon boat crew (RDC team). Users assign people to seats (10 banks × left/right, drummer, steer), track weight balance between sides, mark seat status (approved/questioned/maybe), and manage multiple named "profiles" (e.g. different race dates/classes), each with its own people list and seating.

No backend. All state lives in the browser via `localStorage`.

## Stack

Vanilla HTML/CSS/JS. No framework, no build step, no bundler, no package manager, no dependencies.

- `index.html` — single page, all modals are static markup toggled via the `hidden` attribute.
- `js/app.js` — entire app logic, wrapped in one IIFE, ES5-style (`var`, function declarations, no modules, no classes).
- `css/style.css` — all styles, custom properties under `:root` for the color/design tokens.
- `service-worker.js` — cache-first-ish PWA service worker; bump `CACHE_NAME` when the asset list or caching strategy changes.
- `manifest.webmanifest` — PWA manifest.
- `icons/` — app icons.
- `.github/workflows/deploy-pages.yml` — deploys the repo root as-is to GitHub Pages on push to `master`.

## Running locally

Static files only — serve the directory root with any static file server and open `index.html`, e.g.:

```
python3 -m http.server 8000
```

There is no dev server, no test suite, no linter configured in this repo.

## Conventions

- Keep it dependency-free and build-free. Don't introduce a bundler, framework, or npm dependency unless explicitly asked.
- JS style matches the existing file: IIFE + `"use strict"`, `var`, plain function declarations, DOM built with `document.createElement` (no template strings for HTML, no innerHTML for user-controlled content).
- All state (profiles, people, seat assignments) lives in the single `state` object in `js/app.js` and is persisted via `saveState()`/`loadState()` under `STORAGE_KEY`. If the shape of `state` changes, bump `STORAGE_KEY` (see `LEGACY_STORAGE_KEY` migration in `buildInitialState()` for the pattern) rather than silently breaking existing saved data.
- Seat IDs follow the pattern `bank-<1-10>-<l|r>`, plus `drummer` and `steer`. Side is derived from the `-l`/`-r` suffix (`getSeatSide`).
- UI copy is in Russian (this is the product's language). Code identifiers and comments are in English.
- When editing `css/style.css` or `js/app.js`, bump the cache-busting query string on their `<link>`/`<script>` tags in `index.html` (currently `?4`) and add the changed asset paths to `ASSETS` / bump `CACHE_NAME` in `service-worker.js` if the file list changes, so the PWA cache doesn't serve stale files.
- Weight, side-restriction, and default-roster constants near the top of `js/app.js` (`DEFAULT_ROWER_NAMES`, `DEFAULT_SEAT_ASSIGNMENTS`, `DEFAULT_PERSON_SIDES`, `EMPTY_BOAT_WEIGHT`, etc.) seed a brand-new profile — treat them as sample/default data, not logic to be generalized.

## Deployment

Push to `master` triggers `.github/workflows/deploy-pages.yml`, which publishes the entire repo root to GitHub Pages. There's no staging environment or build artifact — what's committed is what ships.
