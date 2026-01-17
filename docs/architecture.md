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
- **Conflict Handling:** Only the Mod captures the Beacon. If a Mod disconnects, the newly elected Mod takes over the Beacon.

### 2. Service Peers (The Authoritative Core)

While every peer can talk to every other peer, only **Service Peers** are authorized to mutate the state and broadcast updates.

- **Selection:** The system maintains 3 Service Peers: the current Mod (mandatory) and up to 2 additional high-quality peers.
- **Redundancy:** If one service peer disconnects, the state remains safe and authoritative on the others. This prevents "state loss" if the Mod refreshes their browser.
- **Action Flow:** Clients send `ACTION` messages (e.g., `JOIN_QUEUE`) to any available service peer.
- **Verification:** Service peers execute the `sessionUtils` reducer, increment the state `version`, and broadcast the new state via `SYNC_STATE`.

### 3. Connection Quality Monitoring (QoS)

Service peers are not static. They are dynamically selected based on real-time network metrics measured via `HEARTBEAT` / `PONG` exchanges:

- **Latency:** Round-trip time (RTT).
- **Jitter:** Variance in latency over the last 10 samples (lower is better for stability).
- **Packet Loss:** Estimated based on missed heartbeat cycles.
- **Quality Score:** A weighted formula: `Score = (LatencyScore * 0.6) + (JitterScore * 0.2) + (PacketLossScore * 0.2)`.
- **Dynamic Promotion:** The Mod monitors these scores and updates the `servicePeers` list in the `GameState` if better candidates are found.

---

## State Synchronization Protocol

State is managed as a single immutable `GameState` object.

### Versioning & Conflict Resolution

- **Version Number:** Every state change increments the `version`. Clients only accept `SYNC_STATE` messages if the incoming `version` is strictly higher than their local version.
- **Hashing:** A deterministic hash of the state (`stateHash`) is calculated. `SYNC_STATE` is only broadcast if the content hash changes, significantly reducing network traffic in idle states.
- **ID Stability:** Users are identified by a persistent `uuid`. If a user reconnects with a new Peer ID, the system performs a "deep swap" of the ID across the entire state (players list, queue, active votes).

### Persistence & Recovery

The current Mod automatically saves the `GameState` to `localStorage` on every update.

- **Session Recovery:** If the Mod's browser crashes, they can "Recover Session" using the same code. The state is restored from local storage and re-broadcast to the mesh.
- **Migrated Mod Recovery:** If a player is elected as Mod, they begin saving the state locally to provide future recovery.

---

## P2P Message Protocol

| Message Type | Direction | Description |
| :--- | :--- | :--- |
| `HELLO` | New -> Beacon | Initial handshake from a joining player. |
| `PEER_DISCOVERY` | Service -> New | Provides the list of all active Peer IDs to the new player. |
| `SYNC_STATE` | Service -> All | Broadcasts the latest authoritative `GameState`. |
| `ACTION` | Client -> Service | Forwards a user intent (e.g., `JOIN_QUEUE`) for processing. |
| `HEARTBEAT` | All -> All | Keep-alive and latency measurement probe (every 2s). |
| `PONG` | All -> All | Response to heartbeat with original timestamp. |
| `TRANSFER_MOD` | Mod -> All | Signals the handoff of the Mod role to a specific player. |
| `CLAIM_HOST` | Elected -> All | Broadcast during an election to claim the Mod role. |

---

## Mod Election Algorithm

If the current Mod disconnects unexpectedly, the mesh performs an automatic election to maintain the Beacon and authority:

1. **Detection:** All peers monitor the Mod's heartbeat. If no pulse is detected for `HOST_TIMEOUT_MS` (6s), an election is triggered.
2. **Seniority:** The candidate pool is filtered for online players. The player with the **earliest `joinedAt` timestamp** (the "oldest" player) is automatically elected.
3. **Promotion:** The winner promotes themselves to Mod, attempts to capture the session's Beacon ID, and broadcasts a `SYNC_STATE` with an authority bump (`version + 10`).
