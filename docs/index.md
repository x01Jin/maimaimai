# MaiMaiMai Documentation

Welcome to the documentation for **MaiMaiMai**, a mobile-first, Peer-to-Peer (P2P) queue management tool designed for arcade rhythm gamers.

## Overview

MaiMaiMai allows a group of players at an arcade to manage their turn order digitally without needing a physical whiteboard or paper list. It uses a decentralized architecture with multiple service peers providing redundancy and resilience.

## Documentation Contents

* **[User Guide](./user-guide.md)**
  * Quick start
  * joining/creating sessions
  * UI walkthrough
  * common troubleshooting.
* **[Architecture Overview](./architecture.md)**
  * System design
  * P2P session model, data flow, and security considerations.
  * data flow
  * security considerations
* **[Developer Guide](./developer-guide.md)**
  * Setup
  * local development
  * testing
  * contribution guidelines.

---

## Key Features

* **Multi-Service Peer P2P:** Powered by PeerJS/WebRTC. 2-3 peers maintain authoritative state for redundancy and resilience.
* **Smart Queuing:**
  * **Solo:** Play alone (triggers a community vote for fairness, voting is skipped if ≤ 4 players).
  * **Match:** Join alone and pair automatically with others (triggers a community vote for fairness, voting is skipped if ≤ 4 players).
  * **Partner:** Join as a fixed duo with a friend.
* **Real-time Chat:** Communicate with everyone in the room with unread message tracking.
* **Dynamic Service Peer Selection:** Service peers automatically selected based on connection quality (latency, jitter, packet loss) to prevent disruptions.
* **Resilience:** Automatic Mod election based on seniority ensures the session continues if the host leaves.
* **Session Recovery:** Remembers your identity and allows hosts to recover active sessions from local storage.
* **Mod Role:** Session creator (Mod) can manage administrative tasks like reordering queue and transferring Mod role.
