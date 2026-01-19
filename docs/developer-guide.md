# Developer Guide

## Technical Stack

- **Framework:** React 19
- **Bundler:** Vite
- **Styling:** Tailwind CSS (loaded via CDN in index.html)
- **Icons:** Lucide React (npm package)
- **Networking:** Y.js + y-webrtc (CRDTs over WebRTC)
- **Animations:** Framer Motion (npm package)

### Networking & Debugging

- **Primary stack:** The app uses **Y.js + y-webrtc** for peer-to-peer synchronization and `y-indexeddb` for local persistence. PeerJS is included as an optional/legacy dependency but is not relied on for core sync.
- **Configuration:** Network-related constants live in `constants.ts` (`YJS_CONFIG.SIGNALING_SERVERS`, `MAX_CONNECTIONS`) and `ICE_SERVERS`. Edit these values to point at different signaling servers or add TURN relays.
- **Local testing:** Add `ws://localhost:4444` to `YJS_CONFIG.SIGNALING_SERVERS` to test with a local y-webrtc signaling server.
- **Debug tips:** Watch console logs for `[Y.js] IndexedDB synced`, `[Y.js] WebRTC connected`, and any `Session not found` errors (triggered by the join validation timeout). Use browser devtools to inspect IndexedDB (site storage) and LocalStorage keys listed in `constants.ts` to verify persisted state.
- **Troubleshooting:** If peers do not see each other, verify signaling servers are reachable, check network restrictions (NAT/Firewall), and consider adding a TURN relay for environments with restrictive NAT.

## Core Concepts

### Y.js Hooks Architecture

The application state is managed through a set of focused custom hooks located in `hooks/yjs/`. These hooks interact with the shared Y.js document (`Y.Doc`).

| Hook | Responsibility |
| `useYjsSession.ts` | The main entry point. Initializes the Y.Doc, WebRTC provider, and composes other hooks. |
| `useYjsPlayers.ts` | Manages the `players` Map. Handles joining, leaving, mod elections, and presence heartbeats. |
| `useYjsQueue.ts` | Manages the `queue` Array. Handles adding/removing entries, matchmaking logic, and auto-advancing sessions. |
| `useYjsChat.ts` | Manages the `messages` Array. Handles sending/receiving chat messages and cleaning up old messages. |
| `useYjsMod.ts` | Manages the `mod` Map. Handles moderator ID storage and active voting sessions. |
| `useYjsAwareness.ts` | Wraps the ephemeral Y.js Awareness protocol (used for real-time peer counts, separate from persisted player state). |

### Player Presence & Heartbeat

The application separates "Ephemeral Awareness" from "Persisted Player State".

**Persisted Player State (`useYjsPlayers`)**:
The authoritative list of players is stored in a `Y.Map` named `"players"`.

- **Heartbeat**: Every client runs a 5-second interval that updates their own entry's `lastSeen` timestamp in the Y.Map. This confirms they are still active.
- **Offline Detection**: The "Coordinator" (automatically determined as the oldest mod/player) monitors these timestamps. If a player hasn't updated their `lastSeen` in >15 seconds, the Coordinator marks them as `isConnected: false`.
- **Rejoin Logic**: When a user rejoins, their UUID (stored in localStorage) is used to find their existing entry in the map. Their status is immediately set to `isConnected: true`, and the heartbeat resumes.

**Ephemeral Awareness (`useYjsAwareness`)**:
Uses the standard `y-webrtc` awareness protocol to track connected ClientIDs. This is primarily used for debugging connection counts.

### Data Persistence

- **Y.js Data**: Persisted via `y-indexeddb`. The entire room state (players, queue, chat) is saved locally in the browser's IndexedDB. This allows the app to work offline and sync immediately upon reconnection.
- **Local Identity**: The user's UUID and Name are stored in `localStorage` to ensure they reclaim their identity across page reloads.

## Development Workflow

### Adding a New Feature

1. **State Definition**: Decide if the state needs to be shared. If so, identify which Y.js data type (Map, Array) it belongs to.
2. **Hook Implementation**: Add the logic to the relevant `useYjs*.ts` hook.
   - _Example_: To add a "Ready" status, update `useYjsPlayers` to add `isReady` boolean to the `Player` type and expose a toggle function.
3. **Component Integration**: Use the exposed function/state in your React components.

### Local Development

1. `npm install`
2. `npm run dev`

_Note: Since the app uses WebRTC, testing with multiple tabs in the same browser works perfectly as they will connect via local loopback._

## Testing Strategies

### 1. Offline & Reconnection

- Open two tabs.
- Join a session in both.
- Close one tab. Observe that the player is marked "Offline" after ~15 seconds in the other tab.
- Re-open the tab. Observe that the player immediately becomes "Online".

### 2. Mod Migration

- Join with 3 tabs.
- Close the Mod's tab.
- Verify that the "Mod" status is automatically transferred to the next oldest player.

### 3. Queue Logic

- Test multiple scenarios: Solo join, Partner join (with/without name), Match join.
- Verify that the Queue automatically transitions to "Current Session" when the active session is cleared.
