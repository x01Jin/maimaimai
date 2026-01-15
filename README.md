# MaiMaiMai

A mobile-first, Peer-to-Peer (P2P) queue management tool designed specifically for **Maimai** arcade sessions.

Manage player rotations, coordinate with partners, and chat in real-time—all without a centralized server or account registration.

## Key Features

- **P2P Networking:** Powered by PeerJS/WebRTC. One user's browser acts as the session host.
- **Smart Queuing:**
  - **Solo:** Play alone (triggers a community vote for fairness).
  - **Match:** Join alone and pair automatically with others.
  - **Partner:** Join as a fixed duo with a friend.
- **Real-time Chat:** Communicate with everyone in the room.
- **Host Migration:** Seamlessly transfer hosting duties to another player to keep the room alive.
- **Persistence:** Remembers your identity and recent session codes using local storage.
- **No-Build Architecture:** Runs directly in the browser using ES Modules and Import Maps for maximum portability.

## Documentation

For detailed information please check **[Documentation Index](./docs/index.md)**

---

## Tech Stack

- **React 19**
- **PeerJS** (WebRTC for P2P)
- **Framer Motion** (Smooth UI animations)
- **Tailwind CSS** (Modern utility-first styling)
- **Lucide React** (Iconography)

## 🌐 Hosting

This application is designed to be hosted on **GitHub Pages**. Since it is entirely client-side and uses PeerJS for signaling, no backend infrastructure is required. It is a "serverless" experience in the truest sense.

---
*Created for the Maimai community. Stay tuned, stay playing!*
