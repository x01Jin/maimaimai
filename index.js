/**
 * maimaimai - Main Application
 * Mobile-only queue management for maimai arcade players
 */

import { QueueManager } from "./modules/queue-manager.js";
import { QueueStorage } from "./modules/queue-storage.js";
import { UIDisplay } from "./modules/ui-display.js";

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Initialize core systems
  const queueManager = new QueueManager();
  const queueStorage = new QueueStorage();
  const uiDisplay = new UIDisplay(queueManager, queueStorage);

  // Load persisted data
  const savedData = queueStorage.loadQueue();
  if (savedData) {
    // Load the queue array if it exists and has items
    if (savedData.queue && savedData.queue.length > 0) {
      queueManager.loadQueue(savedData.queue);
    }

    // Load the current match if it exists
    if (savedData.currentMatch) {
      queueManager.setCurrentMatch(savedData.currentMatch);
    }

    // Render the UI
    uiDisplay.renderQueue();
    uiDisplay.renderCurrentMatch();
  }

  // Set up event listeners
  setupEventListeners(queueManager, queueStorage, uiDisplay);

  // Initial render
  uiDisplay.renderCurrentMatch();
  uiDisplay.renderQueue();

  console.log("maimaimai initialized");
});

/**
 * Set up all event listeners for the application
 */
function setupEventListeners(queueManager, queueStorage, uiDisplay) {
  // Add match modal form submission
  const confirmAddBtn = document.getElementById("confirm-add-match");
  if (confirmAddBtn) {
    confirmAddBtn.addEventListener("click", () => {
      handleAddMatch(queueManager, queueStorage, uiDisplay);
    });
  }

  // Modal form validation
  setupFormValidation();

  // Queue management events
  document.addEventListener("queueUpdated", () => {
    uiDisplay.renderQueue();
    uiDisplay.renderCurrentMatch();
    queueStorage.saveQueue(
      queueManager.getQueue(),
      queueManager.getCurrentMatch()
    );
  });

  document.addEventListener("matchStarted", () => {
    uiDisplay.renderCurrentMatch();
    uiDisplay.renderQueue();
    queueStorage.saveQueue(
      queueManager.getQueue(),
      queueManager.getCurrentMatch()
    );
  });

  document.addEventListener("matchRemoved", () => {
    uiDisplay.renderCurrentMatch();
    uiDisplay.renderQueue();
    queueStorage.saveQueue(
      queueManager.getQueue(),
      queueManager.getCurrentMatch()
    );
  });
}

/**
 * Handle adding a new match to the queue
 */
function handleAddMatch(queueManager, queueStorage, uiDisplay) {
  const player1Name = document.getElementById("player1-name").value.trim();
  const player2Name = document.getElementById("player2-name").value.trim();

  // Validation
  if (!player1Name) {
    alert("Please enter at least Player 1 name");
    return;
  }

  // Automatically determine match type based on player count
  const matchType = player2Name ? "vs" : "solo";

  // Create match object
  const match = {
    id: Date.now().toString(),
    type: matchType,
    players: [player1Name, player2Name].filter((name) => name),
    timestamp: new Date().toISOString(),
    status: "waiting",
  };

  // Add to queue
  queueManager.addMatch(match);

  // Close modal and reset form
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("addMatchModal")
  );
  modal.hide();

  // Reset form
  document.getElementById("player1-name").value = "";
  document.getElementById("player2-name").value = "";

  console.log("Match added to queue:", match);
}

/**
 * Set up form validation for the add match modal
 */
function setupFormValidation() {
  const player1Input = document.getElementById("player1-name");
  const player2Input = document.getElementById("player2-name");
  const confirmBtn = document.getElementById("confirm-add-match");

  function validateForm() {
    const player1Name = player1Input.value.trim();

    // Player 1 is always required
    const isValid = !!player1Name;

    confirmBtn.disabled = !isValid;
  }

  if (player1Input && player2Input && confirmBtn) {
    player1Input.addEventListener("input", validateForm);
    player2Input.addEventListener("input", validateForm);

    // Initial validation
    validateForm();
  }
}
