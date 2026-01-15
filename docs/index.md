# MaiMaiMai Documentation

Welcome to the documentation for **MaiMaiMai**, a mobile-first, Peer-to-Peer (P2P) queue management tool designed for arcade rhythm gamers.

## Overview

MaiMaiMai allows a group of players at an arcade to manage their turn order digitally without needing a physical whiteboard or paper list. It uses a decentralized architecture where one user's device acts as the "Host" server for the session.

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

* **P2P Networking:** Powered by PeerJS/WebRTC. One user's browser acts as the session host.
* **Smart Queuing:**
  * **Solo:** Play alone (triggers a community vote for fairness, voting is skipped if ≤ 4 players).
  * **Match:** Join alone and pair automatically with others (triggers a community vote for fairness, voting is skipped if ≤ 4 players).
  * **Partner:** Join as a fixed duo with a friend.
* **Real-time Chat:** Communicate with everyone in the room.
* **Host Migration:** Seamlessly transfer hosting duties to another player to keep the room alive.
* **Persistence:** Remembers your identity and recent session codes using local storage.
