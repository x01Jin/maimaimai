
# Developer Guide

## Setup

This project uses **React 19** and **ES Modules** via an import map. No build step (Webpack/Vite) is strictly required for development, but a local server is needed to serve the files.

### Prerequisites

- Node.js (for serving) or any static file server (e.g., Python `http.server`, VS Code Live Server).

*Note: P2P features (WebRTC) require a Secure Context (HTTPS) or `localhost`.*

## Core Concepts

### `usePeerSession` Hook

This hook encapsulates the complex distributed system logic.

#### Key Internal Refs

To handle the asynchronous nature of WebRTC without stale closures, the hook relies heavily on `useRef`:

- `pendingHostIdRef`: Used during host transfer. If we are passing the host to Peer B, we temporarily ignore "disconnect" events from Peer B. This is because destroying the Beacon (shared connection) often triggers a disconnect event, but we want to maintain the session via the direct mesh connection.
- `lastHostPulseRef`: Tracks the timestamp of the last message from the Host. Used by the "Monitor Loop" to trigger elections if the host goes silent for >6 seconds.
- `gameStateRef`: Keeps a reference to the latest state for use inside event listeners (like `peer.on('data')`) where the React closure might otherwise be stale.

#### Connection Retry Logic

The `joinSession` function implements an exponential backoff retry mechanism. This is critical during Host Migration: if a user tries to join exactly when the Beacon is being swapped from Old Host to New Host, the connection might fail. The retry logic ensures they eventually connect once the New Host captures the Beacon.

### `sessionUtils` (in `sessionUtils.ts`)

All state mutations happen here. It must remain pure.

- **Input:** `(State, Action, PeerID)`
- **Output:** `NewState`

When adding new actions:

1. Define the action type in `types.ts`.
2. Add the case in `sessionUtils.ts` (inside `sessionUtils` function).
3. Ensure `version` is incremented.
4. If the action requires specific permissions (e.g., only Host can remove players), enforce that check within the UI or the reducer logic.

## Contribution Guidelines

1. **Stateless UI:** Keep views (QueueView, PlayersView) as stateless as possible; rely on the `gameState` passed from the hook.
2. **Protocol Changes:** If you modify `types.ts`, ensure backward compatibility or increment the protocol version if breaking changes are made.
3. **Testing:**
    - Test **Host Transfer** by having the host explicitly pass the role.
    - Test **Host Failure** by closing the host tab abruptly.
    - Test **Rejoining** by having a host leave and try to join again immediately.

## Deployment (GitHub Pages)

This repository is set up to deploy a **project site** to GitHub Pages (e.g. <https://x01jin.github.io/maimaimai>).

Quick steps:

1. Ensure `homepage` in `package.json` is set to `https://<your-username>.github.io/<repo-name>` (already set for `x01jin/maimaimai`).
2. Install the dev dependency: `npm install --save-dev gh-pages`.
3. Build and deploy:

   - `npm run predeploy` (or `npm run build`)
   - `npm run deploy` (pushes the `dist` folder to the `gh-pages` branch)

Notes:

- `vite.config.ts` has `base` configured to `'/maimaimai/'` so static assets resolve correctly on GitHub Pages.
- For a user/org site (`username.github.io`), set `base` to `'/'` and use the repository name accordingly.
- The deployment will publish to the `gh-pages` branch; you can configure the GitHub Pages source in the repository settings if necessary.

---
