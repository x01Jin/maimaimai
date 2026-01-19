# Architecture Overview

MaiMaiMai is built on a decentralized, peer-to-peer (P2P) architecture using **Y.js CRDTs with WebRTC mesh networking**. This eliminates the need for a central server, ensuring privacy, low latency, and automatic conflict resolution.

## Y.js CRDT Mesh Architecture

The system uses **Y.js** (Conflict-free Replicated Data Types) over **y-webrtc** for peer-to-peer synchronization. This approach automatically handles:

- **Conflict resolution**: Multiple users can edit simultaneously without conflicts
- **Offline support**: Changes sync when reconnected via y-indexeddb persistence
- **No single point of failure**: No host/client distinction, all peers are equal

### Key Components

#### 1. Y.js Document (`Y.Doc`)

The shared document contains all synchronized state:

```typescript
ydoc.getMap("players")     // Y.Map<Player> - Player list
ydoc.getArray("queue")     // Y.Array<QueueEntry> - Queue entries
ydoc.getArray("messages")  // Y.Array<ChatMessage> - Chat history
ydoc.getMap("session")     // Session metadata (current, finishApprovals, activeVote)
ydoc.getMap("mod")         // Moderator state (modId)
ydoc.getMap("meta")        // Room metadata (sessionName, createdAt)
```

#### 2. WebRTC Provider (`y-webrtc`)

Handles peer discovery and WebRTC data channel management:

- Connects to public signaling servers for peer discovery
- Establishes direct WebRTC connections between peers
- Uses ICE servers (STUN/TURN) for NAT traversal
- Max 20 connections per peer

#### 3. IndexedDB Persistence (`y-indexeddb`)

Provides indefinite local persistence:

- State survives browser refresh/restart
- Supports offline usage
- Syncs automatically when reconnected

---

## State Synchronization

All state changes are **CRDT operations** that automatically merge across peers.

### How It Works

1. **UI Action**: User clicks "Join Queue"
2. **CRDT Operation**: `queueArray.push([newEntry])`  
3. **Auto-Broadcast**: Y.js automatically syncs to all connected peers
4. **Conflict-Free**: If two peers add entries simultaneously, both appear

### No Version Numbers Needed

Unlike the previous reducer-based approach, Y.js CRDTs don't need version numbers or conflict resolution logic. The data structures themselves guarantee eventual consistency.

---

## Y.js Hooks Architecture

| Hook | State | Responsibility |
| `useYjsSession` | Y.Doc, Provider | Connection lifecycle, room management |
| `useYjsAwareness` | Awareness | Real-time presence/online status |
| `useYjsPlayers` | `Y.Map<Player>` | Player join/leave, custom players |
| `useYjsQueue` | `Y.Array<QueueEntry>` | Queue, current session, voting, auto-advance |
| `useYjsChat` | `Y.Array<ChatMessage>` | Messages, reactions |
| `useYjsMod` | `Y.Map` | Moderator state, transfer, election |

---

## Mod Management

Unlike the previous host-based system:

- **Mod is just a flag**: Stored in `Y.Map` as `modId`
- **Auto-election**: First player to join becomes mod
- **Transfer**: Any mod can transfer to another player
- **Failover**: If mod disconnects, next oldest connected player takes over

---

## Network Configuration

### ICE Servers

Multiple STUN servers for NAT traversal, with TURN relay fallback:

```typescript
// STUN for direct connections
{ urls: "stun:stun.l.google.com:19302" }

// TURN for relayed connections (CGNAT/mobile)
{ urls: "turn:openrelay.metered.ca:443?transport=tcp" }
```

### Signaling Servers

Public WebRTC signaling for peer discovery:

```typescript
signaling: [
  "wss://signaling.yjs.dev",
  "wss://y-webrtc-signaling-eu.herokuapp.com",
  "wss://y-webrtc-signaling-us.herokuapp.com"
]
```

---

## Data Persistence

### IndexedDB (y-indexeddb)

- Room data persisted indefinitely
- Key: `maimaimai-{ROOM_CODE}`
- Survives browser close/restart

### LocalStorage

- User identity (UUID, name)
- Recent session history
- Active session code for auto-rejoin

---

## Auto-Advance Logic

The system automatically manages the transition from the queue to the active session. This is handled by the **Moderator** client to ensure only one peer performs the operation:

1. **Requirements Check**: Each entry type has specific requirements:
   - `SOLO`: 1 player (always met once in queue).
   - `PARTNER`: 2 players (always met once in queue).
   - `MATCH`: 2 players (waits for another player to match).
2. **Merging**: When a player joins as `MATCH`, the system looks for an existing single-player `MATCH` entry in the queue to join.
3. **Transition**: If `currentSession` is empty and the front of the queue meets its requirements, the Mod peer automatically calls `popNextSession()`.

---

## Session Lifecycle

1. **Create Session**:
   - Generate 4-character room code
   - Create Y.Doc with that room
   - Connect WebRTC provider
   - First player becomes mod

2. **Join Session**:
   - Connect to existing room via code
   - Sync existing state via CRDT
   - Add self to players map

3. **Rejoin/Recover**:
   - IndexedDB has persisted state
   - Reconnect to same room
   - State auto-syncs

4. **Leave Session**:
   - Disconnect provider
   - Player removed (eventually by others)
   - Local state cleaned up
