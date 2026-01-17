# Developer Guide

## Technical Stack

- **Framework:** React 19
- **Bundler:** Vite
- **Styling:** Tailwind CSS (loaded via CDN in index.html)
- **Icons:** Lucide React
- **Networking:** PeerJS (WebRTC)
- **Animations:** Framer Motion (loaded via CDN in index.html)

## Core Concepts

### `usePeerSession` Hook

The "Brain" of the application. It manages the PeerJS lifecycle, connection mesh, distributed election logic, and QoS monitoring.

#### State vs. Refs

To prevent stale closures in asynchronous WebRTC event listeners, the hook uses `useRef` for critical network state:

- `connectionsRef`: A Map of active `DataConnection` objects.
- `gameStateRef`: The latest authoritative state (synced with the React `gameState` state).
- `qualityMetricsRef`: Rolling history of latencies, jitter, and a `pendingSequences` map for packet loss calculation.
- `modPeerIdRef`: Tracks the current Mod for heartbeat monitoring.
- `heartbeatSequenceRef`: An incrementing counter used to uniquely identify heartbeat probes.

#### Connection Lifecycle

1. **Discovery Phase:** Connect to `mai-q-[CODE]` Beacon.
2. **Handshake Phase:** Send `HELLO` -> Receive `PEER_DISCOVERY`.
3. **Mesh Phase:** Connect to all IDs in `PEER_DISCOVERY`.
4. **Sync Phase:** Receive `SYNC_STATE` from a service peer.

### `sessionUtils` (The Reducer)

Located in `utils/sessionUtils.ts`, this file contains the business logic for queue management. It is a pure function: `(GameState, ClientAction, PeerID) => GameState`.

**Key Responsibilities:**

- **Player Joining:** Handles new UUIDs vs. reconnecting UUIDs (ID swapping via `replacePlayerIdInGameState`).
- **Merge Logic:** `mergeMessages` provides safe, deduplicated chat history merging across P2P state updates, preventing history gaps during mod transitions.
- **Queue Logic:** Automatically pairing players in `MATCH` mode, handling `PARTNER` joins, and managing the `currentSession`.
- **Voting:** Implementing the `REQUEST_SOLO` and `CAST_VOTE` logic, including auto-approval thresholds.
- **State Hashing:** Generating a unique hash of the state (`hashState`) for optimized broadcasts.

### QoS Calculation

The `updateServicePeers` function (inside the hook) runs every 5 seconds on the Mod's client.

- It calculates a score for every online player based on a weighted average of Latency, Jitter, and Packet Loss.
- **Packet Loss Measurement:** The system sends a sequence-numbered `HEARTBEAT`. If a `PONG` with the matching sequence isn't received within 5s, it is marked as lost.
- It picks the top 2 (excluding the Mod) to be additional `servicePeers`.
- This ensures that if the Mod has a poor connection to some players, the other service peers can "bridge" the state updates.

---

## Development Workflow

### Adding a New Feature

1. **Define Type:** Add the new action to `ClientAction` in `types.ts`.
2. **Implement Logic:** Add the case in `sessionUtils.ts`. Increment the `version`.
3. **Expose Action:** Add a wrapper function in `usePeerSession.ts` that calls `sendAction`.
4. **Update UI:** Use the new function in the relevant View.

### Local Development

1. `npm install`
2. `npm run dev`

*Important: PeerJS requires a Secure Context. Access via `localhost:5173`. To test between devices on the same network, you may need to use a tool like `localtunnel` or `ngrok` to provide an HTTPS endpoint.*

---

## Testing Strategies

Distributed systems are hard to test manually. Use these scenarios to verify stability:

### 1. Mod Migration & State Continuity

- Join with 3 players (A, B, C).
- Send several chat messages from Player C.
- Close Player A (Mod).
- Verify that Player B or C becomes Mod within 10 seconds.
- **Critical:** Verify that Player C's chat messages are still visible for the new Mod and other players (verifies atomic state handoff).

### 2. Service Peer Redundancy

- Join with 4 players.
- Identify the 3 service peers.
- Disconnect one of the *non-mod* service peers.
- Verify that the Mod selects a new service peer and the queue remains functional.

### 3. ID Recovery

- Join a session and enter the queue.
- Refresh your browser.
- Verify that your entry in the queue is still there and your name appears as "Online" (the system should have swapped your old Peer ID for your new one using your persistent UUID).

---

## Deployment

The project is deployed via GitHub Pages using the `gh-pages` package.

```bash
npm run deploy
```

Configuration is handled in `vite.config.ts` (`base` path) and `package.json` (`homepage` field).
