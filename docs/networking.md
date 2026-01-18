# Networking Guide

This page explains the network configuration, debugging tips, and troubleshooting steps for the P2P layer used by MaiMaiMai.

## Overview

- **Primary stack:** Y.js + y-webrtc for CRDT-based P2P synchronization.
- **Persistence:** `y-indexeddb` keeps room state persisted locally (IndexedDB).
- **Signaling:** Public signaling servers (configured in `constants.ts`) are used for peer discovery; TURN relays help with NAT traversal.

> Note: `peerjs` exists in the repository (and is available via the import map), but the production synchronization stack uses **Y.js + y-webrtc**. PeerJS is optional/legacy and not required for the app's core sync logic.

---

## Where to configure

- `constants.ts` exposes the important network configuration:
  - `YJS_CONFIG.SIGNALING_SERVERS` — array of WebSocket endpoints for y-webrtc signaling.
  - `YJS_CONFIG.MAX_CONNECTIONS` — connection limits per peer.
  - `ICE_SERVERS` — ICE/STUN/TURN servers used for WebRTC NAT traversal.

Edit those values and rebuild/deploy to change runtime behavior.

## Running locally

- For local signaling testing, you can add `ws://localhost:4444` to `YJS_CONFIG.SIGNALING_SERVERS` and run a local y-webrtc signaling server. This is useful when developing on an isolated network or for reproducible debugging.

## Debugging checklist

1. Open Browser DevTools → Console
   - Look for console messages such as:
     - `[Y.js] IndexedDB synced` (persistence is working)
     - `[Y.js] WebRTC connected: true` (provider connected)
     - `Session not found. Double check the code!` (join validation timed out)
2. Inspect IndexedDB and LocalStorage to confirm the presence of persisted room state and identity keys (see `constants.ts` for names).
3. Verify signaling servers are reachable via your network (firewall restrictions often block WebSocket connections).
4. If peers cannot connect in restricted networks, add a TURN server entry to `ICE_SERVERS` with valid credentials.

## Common failure modes

- Peers never see each other: signaling servers unreachable or blocked by firewall.
- Session appears empty on join: join validation timeout fired because `meta.sessionName` and `players` were empty. This usually indicates the host didn't create the session or state didn't propagate.
- Too few connections: mobile networks or CGNAT can limit direct peer connections; using TURN relays mitigates this.

## Advanced

- To scale or harden deployments, run your own y-webrtc signaling cluster or add trusted TURN providers.
- You can add additional signaling servers to `YJS_CONFIG.SIGNALING_SERVERS` for high-availability.

---

If you run into networking issues not covered here, add an issue with console logs and steps to reproduce, and include the `YJS_CONFIG` settings you are using.
