/**
 * maimaimai index js
 * by jin
 *
 */
import { QueueManager } from "./modules/queue-manager.js";
import { QueueStorage } from "./modules/queue-storage.js";
import { UIDisplay } from "./modules/ui-display.js";
import { QueueFeatures } from "./modules/queue-features.js";

document.addEventListener("DOMContentLoaded", () => {
  // initialization
  const storage = new QueueStorage();
  const queueManager = new QueueManager(storage);
  const uiDisplay = new UIDisplay(queueManager);
  // ignore this shit. if it works, it works
  const queueFeatures = new QueueFeatures(queueManager, uiDisplay);
  window.queueManager = queueManager;

  // Load saved data
  const saved = storage.loadQueue();
  if (saved) {
    queueManager.loadQueue(saved);
  }

  console.log("maimaimai ready");
});

// form handling
document.addEventListener("click", (e) => {
  if (e.target.id === "confirm-add-match") {
    const p1 = document.getElementById("player1-name").value.trim();
    const p2 = document.getElementById("player2-name").value.trim();

    if (!p1) {
      alert("Please enter at least Player 1 name");
      return;
    }

    // Create and add match
    const match = {
      id: Date.now().toString(),
      type: p2 ? "vs" : "solo",
      players: [p1, p2].filter(Boolean),
      timestamp: new Date().toISOString(),
      status: "waiting",
    };

    window.queueManager?.addMatch(match);

    // Close modal and reset
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addMatchModal")
    );
    modal?.hide();
    document.getElementById("player1-name").value = "";
    document.getElementById("player2-name").value = "";
  }
});

// Simple form validation
document.addEventListener("input", (e) => {
  if (e.target.id === "player1-name" || e.target.id === "player2-name") {
    const p1 = document.getElementById("player1-name").value.trim();
    const confirmBtn = document.getElementById("confirm-add-match");
    if (confirmBtn) confirmBtn.disabled = !p1;
  }
});
