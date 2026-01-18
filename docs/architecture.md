# Architecture Overview

MaiMaiMai is built on a decentralized, peer-to-peer (P2P) architecture that eliminates the need for a central server, ensuring privacy, low latency, and resilience against server outages.

## Multi-Service Peer P2P Topology

The system uses a **Multi-Service Peer Mesh** topology over WebRTC (via PeerJS). This hybrid approach combines the benefits of a full mesh (direct communication) with an authoritative distributed core (service peers).

### 1. The Beacon (Discovery)

Since there is no central database to list active sessions, MaiMaiMai uses a deterministic **Beacon** system:

- **ID Scheme:** The session creator (Mod) attempts to capture a secondary PeerJS ID: `mai-q-[CODE]` (e.g., `mai-q-ABCD`).
- **Handshake:** New players connect to this Beacon ID first.
- **Discovery:** Upon connection, a service peer sends a `PEER_DISCOVERY` message containing the full list of Peer IDs currently in the session.
- **Transition:** The joining player then establishes direct WebRTC data channels with all other peers and disconnects from the Beacon.
- **Conflict Handling:** Only the Mod captures the Beacon. If a Mod disconnects, the newly elected Mod takes over the Beacon. If an original host returns, they perform a **Beacon Check** (connecting to the Beacon as a client) to determine if they should resume hosting or join as a regular player, preventing WebSocket conflicts.

### 2. Service Peers (The Authoritative Core)

While every peer can talk to every other peer, only **Service Peers** are authorized to mutate the state and broadcast updates.

- **Selection:** The system maintains 3 Service Peers: the current Mod (mandatory) and up to 2 additional high-quality peers.
- **Redundancy:** If one service peer disconnects, the state remains safe and authoritative on the others. This prevents "state loss" if the Mod refreshes their browser.
- **Action Flow:** Clients send `ACTION` messages (e.g., `JOIN_QUEUE`) to any available service peer.
- **Verification:** Service peers execute the `sessionUtils` reducer, increment the state `version`, and broadcast the new state via `SYNC_STATE`.

### 3. Connection Quality & Stability Monitoring (QoS)

Service peers are not static. They are dynamically selected based on real-time network metrics measured via `HEARTBEAT` / `PONG` exchanges:

- **Latency:** Round-trip time (RTT).
- **Jitter:** Variance in latency over the last 10 samples (lower is better for stability).
- **Packet Loss:** Calculated using incrementing **sequence numbers** in heartbeats. Every heartbeat is tracked in a `pendingSequences` map. If a sequence is not acknowledged within 5 seconds, it is marked as lost.
- **Adaptive Heartbeat:** The interval dynamically scales between 3s and 10s. If jitter is low (<5ms), the interval increases to save battery and data. If instability is detected, it reverts to a faster rate for quick failure detection.
- **Quality Score:** A weighted formula: `Score = (LatencyScore * 0.6) + (JitterScore * 0.2) + (PacketLossScore * 0.2)`. A decay mechanism ensures scores recover once network stability returns.
- **Dynamic Promotion:** The Mod monitors these scores and updates the `servicePeers` list in the `GameState` if better candidates are found.

---

## State Synchronization Protocol

State is managed as a single immutable `GameState` object.

### Versioning & Conflict Resolution

- **Version Number:** Every state change increments the `version`. Clients only accept `SYNC_STATE` messages if the incoming `version` is strictly higher than their local version.
- **Smart Chat Merging:** To prevent chat history loss during state transitions or mod transfers, chat messages are merged and deduplicated across state updates. Instead of overwriting history, the local message list is combined with the incoming list, sorted by timestamp, and capped at `MAX_CHAT_HISTORY`.
- **Delta Patching:** `SYNC_STATE` messages include the `lastAction` that caused the update. If a peer is exactly one version behind, it applies the action locally instead of replacing the entire state, ensuring smooth, "zero-flicker" updates.
- **Hashing:** A deterministic hash of the state (`stateHash`) is calculated based on critical fields (queue, players, messages, etc.). `SYNC_STATE` is only broadcast if the content hash changes.
- **Data Capping:** Chat history is limited to 50 messages (`MAX_CHAT_HISTORY`) to keep the synchronization payload small and mobile-friendly.

### Resilience & Mobile Data Optimization

- **NAT Traversal:** The system uses multiple globally distributed STUN servers and dedicated TURN relays (TCP supported) to maximize connection success rates behind CGNAT and restrictive mobile firewalls.
- **Efficient Mod Transfer:** Moderator handoff is optimized to prevent network spikes. The full `GameState` is only transmitted via unicast to the new Moderator, while other peers receive a lightweight notification.
- **Action Buffering:** If a player loses connection to all service peers, their actions (chats, queue joins) are buffered locally. Once a connection to a service peer is re-established, the buffer is automatically flushed.
- **Robust Reconnection:** PeerJS `network-disconnected` events trigger an immediate automatic reconnection attempt to restore the session without user intervention.

### Persistence & Recovery

The current Mod automatically saves the `GameState` to `localStorage` on every update.

- **Smart Session Recovery (Host):** If the Mod's browser refreshes, they can use the "Resume Session" feature. The system creates a temporary peer to probe the Beacon:
  - If the Beacon is **Unresponsive**: The original Mod resumes the role, restoring state from `localStorage` and re-broadcasting.
  - If the Beacon is **Active**: It means another player was elected Mod while the host was gone. The original Mod automatically joins as a regular player instead of fighting for the Beacon ID.
- **Client Auto-Recovery:** All participants (not just the Mod) persist the active session code in `localStorage`. If the page is refreshed or the browser restarts, the application automatically attempts to rejoin the active session by reconnecting to the Beacon, ensuring seamless continuity.
- **Migrated Mod Recovery:** If a player is elected as Mod, they begin saving the state locally to provide future recovery if the session is left to them.

---

## P2P Message Protocol

| Message Type     | Direction         | Description                                                                                                 |
| :--------------- | :---------------- | :---------------------------------------------------------------------------------------------------------- |
| `HELLO`          | New -> Beacon     | Initial handshake from a joining player.                                                                    |
| `PEER_DISCOVERY` | Service -> New    | Provides the list of all active Peer IDs to the new player.                                                 |
| `SYNC_STATE`     | Service -> All    | Broadcasts the latest authoritative `GameState`.                                                            |
| `ACTION`         | Client -> Service | Forwards a user intent (e.g., `JOIN_QUEUE`) for processing.                                                 |
| `HEARTBEAT`      | All -> All        | Keep-alive with sequence number and timestamp.                                                              |
| `PONG`           | All -> All        | Response to heartbeat with original timestamp and sequence.                                                 |
| `TRANSFER_MOD`   | Mod -> All        | Signals handoff. Optimized: sends full state only to the target, others receive a lightweight notification. |
| `CLAIM_HOST`     | Elected -> All    | Broadcast during an election to claim the Mod role.                                                         |

---

## Mod Election Algorithm

If the current Mod disconnects unexpectedly, the mesh performs an automatic election to maintain the Beacon and authority:

1. **Detection:** All peers monitor the Mod's heartbeat. If no pulse is detected for `HOST_TIMEOUT_MS` (10s), an election is triggered.
2. **Seniority:** The candidate pool is filtered for online players. The player with the **earliest `joinedAt` timestamp** (the "oldest" player) is automatically elected.
3. **Promotion:** The winner promotes themselves to Mod, attempts to capture the session's Beacon ID, and broadcasts a `SYNC_STATE` with an authority bump (`version + 10`).
