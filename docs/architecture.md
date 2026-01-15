# Architecture Overview

## Hybrid P2P Topology

MaiMaiMai employs a sophisticated **Hybrid Star/Mesh** topology over WebRTC (via PeerJS) to balance state consistency with network resilience.

### 1. The Beacon (Entry Point)

To solve the discovery problem without a central signaling database:

- The **Active Host** maintains a secondary Peer connection called the **Beacon**.
- The Beacon ID is deterministic: `mai-q-[CODE]` (e.g., `mai-q-ABCD`).
- New players connect to this Beacon to perform the initial handshake (`HELLO`).
- Once connected, the Host sends the joining player a `PEER_DISCOVERY` payload containing the specific Peer IDs of all other participants.

### 2. The Star (State Authority)

- The **Host** acts as the single source of truth (Authoritative Server).
- All `Actions` (Join Queue, Vote, Chat) are sent to the Host via the mesh network.
- The Host executes the `sessionUtils`, calculates the new state hash, and broadcasts `SYNC_STATE` to all connected peers.
- Clients blindly accept state updates if the incoming `version` is higher than their local version.

### 3. The Mesh (Resilience & Recovery)

- While the Host is the authority, every peer maintains direct connections to other peers in the swarm.
- **Mesh Recovery:** When the Host role is transferred, the "Beacon" must be destroyed and recreated by the new Host. To prevent network partitioning during this gap, the old Host (and other clients) aggressively establish direct connections to the New Host's permanent Peer ID.

---

## State Management

The application state (`GameState`) is an immutable object managed by a Reducer pattern.

- **Versioning:** The state includes a `version` number. This resolves conflict/race conditions by prioritizing the highest version number.
- **Hashing:** To optimize bandwidth, the host calculates a content hash of the state. `SYNC_STATE` messages are only broadcast if the hash changes.
- **Persistence:** The Host writes the state to `localStorage` on every update. This allows for session recovery if the Host refreshes their browser.

---

## Host Migration Mechanics

The system supports two types of host transitions:

### 1. Cooperative Transfer (Handoff)

This occurs when the Host explicitly selects a user to take over, or voluntarily leaves the session.

1. **Selection:** Host A selects Player B.
2. **Broadcast:** Host A broadcasts `CLAIM_HOST` payload identifying Player B.
3. **Grace Period:** Host A (now a client) enters a "monitoring grace period" (5 seconds) where it ignores heartbeat timeouts from B. This prevents the "Bounce Back" effect where A thinks B is dead before B has fully initialized.
4. **Beacon Swap:**
    - Host A destroys the Beacon `mai-q-[CODE]`.
    - Player B promotes themselves to Host locally and attempts to capture `mai-q-[CODE]`.
5. **Mesh Repair:** Host A actively connects to Player B's permanent ID to ensure the connection remains alive even after the Beacon link is severed.

### 2. Failure Recovery (Bully Algorithm)

If the Host disconnects unexpectedly (crash, network loss):

1. **Detection:** Clients detect the disconnection via heartbeat timeouts (6s) or socket closure.
2. **Election:** Clients locally sort the peer list by `joinedAt` timestamp.
3. **Promotion:** The oldest remaining peer promotes themselves to Host.
4. **Capture:** The new Host captures the Beacon ID and broadcasts their new status.
