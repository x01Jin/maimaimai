# Architecture Overview

## Multi-Service Peer P2P Topology

MaiMaiMai employs a **Multi-Service Peer Mesh** topology over WebRTC (via PeerJS) that provides redundancy and prevents service disruptions through distributed state management.

### 1. The Beacon (Entry Point)

To solve the discovery problem without a central signaling database:

- The **Mod** maintains a secondary Peer connection called the **Beacon**.
- The Beacon ID is deterministic: `mai-q-[CODE]` (e.g., `mai-q-ABCD`).
- New players connect to this Beacon to perform the initial handshake (`HELLO`).
- Once connected, a service peer sends the joining player a `PEER_DISCOVERY` payload containing the specific Peer IDs of all other participants.

### 2. Service Peers (Distributed Authority)

- **2-3 Service Peers** maintain the authoritative game state (Mod + 1-2 additional peers).
- The **Mod** (session creator) always acts as a service peer and manages administrative actions (kick, reorder).
- Additional service peers are selected based on connection quality (latency, jitter, packet loss).
- Service peers are dynamically updated without disruption as connection quality changes.
- All `Actions` can be sent to ANY service peer, which processes and broadcasts state updates.
- Service peers execute `sessionUtils`, calculate the new state hash, and broadcast `SYNC_STATE`.
- Clients accept state updates from service peers if the incoming `version` is higher.

### 3. The Mesh (Full Connectivity)

- Every peer maintains direct connections to all other peers in the swarm.
- This full mesh ensures that if one service peer becomes unavailable, others seamlessly continue service.
- Connection quality metrics are continuously measured via HEARTBEAT/PONG exchanges.

---

## State Management

The application state (`GameState`) is an immutable object managed by a Reducer pattern.

- **Versioning:** The state includes a `version` number and `servicePeers` array. This resolves conflict/race conditions by prioritizing the highest version number.
- **Hashing:** To optimize bandwidth, service peers calculate a content hash of the state. `SYNC_STATE` messages are only broadcast if the hash changes.
- **Persistence:** The Mod writes the state to `localStorage` on every update. This allows for session recovery if the Mod refreshes their browser.
- **Service Peer Tracking:** The `servicePeers` array tracks which peers are currently authoritative.

---

## Connection Quality Monitoring

To maintain optimal service peer selection, the system continuously monitors connection quality:

- **Latency Measurement:** HEARTBEAT messages include timestamps. Recipients respond with PONG containing the original timestamp.
- **Metrics Tracked:** Latency (avg), jitter (variance), packet loss (estimated).
- **Quality Score:** Computed from weighted combination of metrics (60% latency, 20% jitter, 20% packet loss).
- **Selection Algorithm:** Mod is always first service peer. Additional peers selected by best quality scores.
- **Dynamic Updates:** Service peer list updated every 5 seconds if significant quality improvements detected (>20% threshold).
- **Seamless Transitions:** Service peer changes occur without disrupting ongoing sessions.

---

## Mod Transfer

The Mod role can be voluntarily transferred for administrative control:

1. **Transfer:** Current Mod selects a connected player.
2. **Broadcast:** `TRANSFER_MOD` message sent to all peers.
3. **Update:** All peers update their local state to reflect new Mod.
4. **Service Peer Adjustment:** New Mod's quality check loop automatically recalculates service peer list.
