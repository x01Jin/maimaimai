/**
 * UIDisplay - Handles UI rendering and user interactions for maimai queue
 * Mobile-only responsive display management
 */

export class UIDisplay {
  constructor(queueManager, queueStorage) {
    this.queueManager = queueManager;
    this.queueStorage = queueStorage;
    this.elements = this.getElements();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Get DOM elements references
   * @returns {Object} Object containing element references
   */
  getElements() {
    return {
      currentMatch: document.getElementById("current-match"),
      queueDisplay: document.getElementById("queue-display"),
      addMatchBtn: document.getElementById("add-match-btn"),
      confirmAddMatch: document.getElementById("confirm-add-match"),
      player1Input: document.getElementById("player1-name"),
      player2Input: document.getElementById("player2-name"),
    };
  }

  /**
   * Set up UI event listeners
   */
  setupEventListeners() {
    // Queue manager events
    this.queueManager.addEventListener("queueUpdated", () => {
      this.renderQueue();
      this.renderCurrentMatch();
    });

    this.queueManager.addEventListener("matchStarted", () => {
      this.renderCurrentMatch();
    });

    this.queueManager.addEventListener("matchRemoved", () => {
      this.renderCurrentMatch();
    });

    // Button event listeners
    this.setupButtonListeners();
  }

  /**
   * Set up button event listeners
   */
  setupButtonListeners() {
    // Start match button
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-start-compact")) {
        const matchId = e.target.dataset.matchId;
        this.handleStartMatch(matchId);
      }
    });

    // Remove match button
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-remove-compact")) {
        const matchId = e.target.dataset.matchId;
        this.handleRemoveMatch(matchId);
      }
    });

    // Edit match button
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-edit-compact")) {
        const matchId = e.target.dataset.matchId;
        this.handleEditMatch(matchId);
      }
    });
  }

  /**
   * Render the current match display
   */
  renderCurrentMatch() {
    const currentMatch = this.queueManager.getCurrentMatch();
    const currentMatchEl = this.elements.currentMatch;

    if (!currentMatchEl) return;

    if (!currentMatch) {
      currentMatchEl.innerHTML = "";
      currentMatchEl.classList.remove("fade-in");
      return;
    }

    const matchHTML = this.generateCurrentMatchHTML(currentMatch);
    currentMatchEl.innerHTML = matchHTML;
    currentMatchEl.classList.add("fade-in");

    // Add event listeners for current match buttons
    this.addCurrentMatchListeners(currentMatch);
  }

  /**
   * Generate HTML for current match display
   * @param {Object} match - Current match object
   * @returns {string} HTML string
   */
  generateCurrentMatchHTML(match) {
    const matchTypeClass = match.type === "vs" ? "vs" : "solo";
    const matchTypeText = match.type === "vs" ? "VS Match" : "Solo Play";

    if (match.type === "vs") {
      return `
        <div class="current-match-content">
          <div class="match-type-badge ${matchTypeClass} mb-3">
            <i class="fas fa-users me-1"></i>
            ${matchTypeText}
          </div>
          <div class="current-players">
            <div class="player-vs">
              <div class="player-1p">
                <span class="player-label">1P</span>
                <span class="player-name">${this.escapeHtml(
                  match.players[0]
                )}</span>
              </div>
              <div class="vs-divider">
                <i class="fas fa-vs"></i>
              </div>
              <div class="player-2p">
                <span class="player-label">2P</span>
                <span class="player-name">${this.escapeHtml(
                  match.players[1] || "TBD"
                )}</span>
              </div>
            </div>
          </div>
          <div class="current-match-actions mt-3">
            <button class="btn btn-success btn-sm me-2" data-action="complete">
              <i class="fas fa-check me-1"></i>
              Complete
            </button>
            <button class="btn btn-warning btn-sm" data-action="cancel">
              <i class="fas fa-times me-1"></i>
              Cancel
            </button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="current-match-content">
          <div class="match-type-badge ${matchTypeClass} mb-3">
            <i class="fas fa-user me-1"></i>
            ${matchTypeText}
          </div>
          <div class="current-players">
            <div class="player-solo">
              <span class="player-name">${this.escapeHtml(
                match.players[0]
              )}</span>
            </div>
          </div>
          <div class="current-match-actions mt-3">
            <button class="btn btn-success btn-sm me-2" data-action="complete">
              <i class="fas fa-check me-1"></i>
              Complete
            </button>
            <button class="btn btn-warning btn-sm" data-action="cancel">
              <i class="fas fa-times me-1"></i>
              Cancel
            </button>
          </div>
        </div>
      `;
    }
  }

  /**
   * Render the queue display
   */
  renderQueue() {
    const queue = this.queueManager.getQueue();
    const queueDisplayEl = this.elements.queueDisplay;

    if (!queueDisplayEl) return;

    if (queue.length === 0) {
      queueDisplayEl.innerHTML = "";
      queueDisplayEl.classList.remove("fade-in");
      return;
    }

    const queueHTML = queue
      .map((match, index) => this.generateQueueItemHTML(match, index))
      .join("");

    queueDisplayEl.innerHTML = queueHTML;
    queueDisplayEl.classList.add("fade-in");

    // Add event listeners to queue items
    this.addQueueItemListeners();

    // Add drag and drop listeners
    this.addDragAndDropListeners();
  }

  /**
   * Generate HTML for a queue item (two-row layout)
   * @param {Object} match - Match object
   * @param {number} index - Position in queue
   * @returns {string} HTML string
   */
  generateQueueItemHTML(match, index) {
    const matchTypeClass = match.type === "vs" ? "vs" : "solo";
    const position = index + 1;

    // Generate player display based on match type
    let playerDisplay;
    if (match.type === "vs") {
      playerDisplay =
        match.players.length >= 2
          ? `${this.escapeHtml(match.players[0])} vs ${this.escapeHtml(
              match.players[1]
            )}`
          : `${this.escapeHtml(match.players[0])} vs TBD`;
    } else {
      playerDisplay = `solo: ${this.escapeHtml(match.players[0])}`;
    }

    return `
       <div class="queue-item ${matchTypeClass} fade-in" data-match-id="${
      match.id
    }" draggable="true">
         <div class="queue-item-row-1">
           <div class="player-info-primary">
             ${playerDisplay}
           </div>
         </div>
         <div class="queue-item-row-2">
           <div class="queue-actions-new">
             <button class="btn btn-edit-compact btn-queue-action" data-match-id="${
               match.id
             }" title="Edit Match">
               <i class="fas fa-edit"></i>
             </button>
             ${
               position === 1
                 ? `
               <button class="btn btn-start-compact btn-queue-action" data-match-id="${match.id}" title="Start Match">
                 <i class="fas fa-play"></i>
               </button>
             `
                 : ""
             }
             <button class="btn btn-remove-compact btn-queue-action" data-match-id="${
               match.id
             }" title="Remove Match">
               <i class="fas fa-trash"></i>
             </button>
           </div>
           <div class="drag-handle-new" title="Drag to reorder">
             <i class="fas fa-grip-vertical"></i>
           </div>
         </div>
       </div>
     `;
  }

  /**
   * Add event listeners for current match buttons
   * @param {Object} match - Current match object
   */
  addCurrentMatchListeners(match) {
    const currentMatchEl = this.elements.currentMatch;
    if (!currentMatchEl) return;

    // Complete match button
    const completeBtn = currentMatchEl.querySelector(
      '[data-action="complete"]'
    );
    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        this.handleCompleteMatch(match.id);
      });
    }

    // Cancel match button
    const cancelBtn = currentMatchEl.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.handleCancelMatch(match.id);
      });
    }
  }

  /**
   * Add event listeners for queue item buttons
   */
  addQueueItemListeners() {
    // Event delegation for better performance
    const queueDisplayEl = this.elements.queueDisplay;
    if (!queueDisplayEl) return;

    // Remove existing listeners to prevent duplicates
    queueDisplayEl.removeEventListener("click", this.handleQueueItemClick);
    queueDisplayEl.addEventListener(
      "click",
      this.handleQueueItemClick.bind(this)
    );
  }

  /**
   * Add drag and drop event listeners
   */
  addDragAndDropListeners() {
    const queueDisplayEl = this.elements.queueDisplay;
    if (!queueDisplayEl) return;

    // Drag start
    queueDisplayEl.addEventListener("dragstart", (e) => {
      const queueItem = e.target.closest(".queue-item");
      if (!queueItem) return;

      queueItem.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", queueItem.dataset.matchId);

      // Add visual feedback
      this.showDragPreview(queueItem);
    });

    // Drag end
    queueDisplayEl.addEventListener("dragend", (e) => {
      const queueItem = e.target.closest(".queue-item");
      if (!queueItem) return;

      queueItem.classList.remove("dragging");
      this.hideDragPreview();
    });

    // Drag over
    queueDisplayEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const queueItem = e.target.closest(".queue-item");
      if (!queueItem || queueItem.classList.contains("dragging")) return;

      // Show drop indicator
      this.showDropIndicator(e, queueItem);
    });

    // Drag leave
    queueDisplayEl.addEventListener("dragleave", (e) => {
      const queueItem = e.target.closest(".queue-item");
      if (!queueItem) return;

      // Hide drop indicator if leaving this item
      if (!e.relatedTarget || !queueItem.contains(e.relatedTarget)) {
        this.hideDropIndicator(queueItem);
      }
    });

    // Drop
    queueDisplayEl.addEventListener("drop", (e) => {
      e.preventDefault();

      const draggedMatchId = e.dataTransfer.getData("text/plain");
      const dropTarget = e.target.closest(".queue-item");

      if (!dropTarget || !draggedMatchId) return;

      this.hideDropIndicator(dropTarget);

      // Don't do anything if dropping on itself
      if (dropTarget.dataset.matchId === draggedMatchId) return;

      // Calculate new position based on drop location
      const rect = dropTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const newPosition =
        e.clientY <= midpoint
          ? this.getMatchPosition(dropTarget.dataset.matchId)
          : this.getMatchPosition(dropTarget.dataset.matchId) + 1;

      // Move the match in the queue
      if (this.queueManager.moveMatch(draggedMatchId, newPosition)) {
        this.showToast("Queue reordered");
      }
    });
  }

  /**
   * Show drag preview
   * @param {Element} queueItem - The item being dragged
   */
  showDragPreview(queueItem) {
    const preview = document.createElement("div");
    preview.className = "drag-preview";
    preview.innerHTML = queueItem.innerHTML;
    preview.style.cssText = `
      position: absolute;
      top: -1000px;
      opacity: 0.8;
      transform: rotate(5deg);
      z-index: 1000;
      pointer-events: none;
      width: ${queueItem.offsetWidth}px;
    `;
    document.body.appendChild(preview);
    this.dragPreview = preview;
  }

  /**
   * Hide drag preview
   */
  hideDragPreview() {
    if (this.dragPreview) {
      this.dragPreview.remove();
      this.dragPreview = null;
    }
  }

  /**
   * Show drop indicator
   * @param {Event} e - Drag event
   * @param {Element} queueItem - Target queue item
   */
  showDropIndicator(e, queueItem) {
    const rect = queueItem.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = e.clientY <= midpoint;

    queueItem.classList.remove("drop-above", "drop-below");
    queueItem.classList.add(isAbove ? "drop-above" : "drop-below");
  }

  /**
   * Hide drop indicator
   * @param {Element} queueItem - Target queue item
   */
  hideDropIndicator(queueItem) {
    queueItem.classList.remove("drop-above", "drop-below");
  }

  /**
   * Get position of match in queue
   * @param {string} matchId - Match ID
   * @returns {number} Position (1-based)
   */
  getMatchPosition(matchId) {
    return this.queueManager.getMatchPosition(matchId);
  }

  /**
   * Handle clicks on queue items
   * @param {Event} e - Click event
   */
  handleQueueItemClick(e) {
    const button = e.target.closest("button");
    if (!button) return;

    const matchId = button.dataset.matchId;
    if (!matchId) return;

    if (button.classList.contains("btn-start")) {
      this.handleStartMatch(matchId);
    } else if (button.classList.contains("btn-remove")) {
      this.handleRemoveMatch(matchId);
    } else if (button.classList.contains("btn-edit")) {
      this.handleEditMatch(matchId);
    }
  }

  /**
   * Handle start match
   * @param {string} matchId - Match ID to start
   */
  handleStartMatch(matchId) {
    const match = this.queueManager.getQueue().find((m) => m.id === matchId);
    if (!match) return;

    if (confirm(`Start match: ${match.players.join(" vs ")}?`)) {
      this.queueManager.startNextMatch();
    }
  }

  /**
   * Handle remove match
   * @param {string} matchId - Match ID to remove
   */
  handleRemoveMatch(matchId) {
    const match = this.queueManager.getQueue().find((m) => m.id === matchId);
    if (!match) return;

    if (confirm(`Remove match: ${match.players.join(" vs ")} from queue?`)) {
      this.queueManager.removeMatch(matchId);
    }
  }

  /**
   * Handle edit match
   * @param {string} matchId - Match ID to edit
   */
  handleEditMatch(matchId) {
    const match = this.queueManager.getQueue().find((m) => m.id === matchId);
    if (!match) return;

    this.showEditModal(match);
  }

  /**
   * Handle complete current match
   * @param {string} matchId - Match ID to complete
   */
  handleCompleteMatch(matchId) {
    const currentMatch = this.queueManager.getCurrentMatch();
    if (!currentMatch || currentMatch.id !== matchId) return;

    if (confirm("Mark this match as completed?")) {
      this.queueManager.endCurrentMatch();
      this.showToast("Match completed!");
    }
  }

  /**
   * Handle cancel current match
   * @param {string} matchId - Match ID to cancel
   */
  handleCancelMatch(matchId) {
    const currentMatch = this.queueManager.getCurrentMatch();
    if (!currentMatch || currentMatch.id !== matchId) return;

    if (confirm("Cancel this match and return to queue?")) {
      this.queueManager.cancelCurrentMatch();
      this.showToast("Match cancelled and returned to queue");
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   */
  showToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast position-fixed";
      toast.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.style.display = "none";
    }, 3000);
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update UI based on queue state
   */
  updateUI() {
    this.renderCurrentMatch();
    this.renderQueue();

    // Update FAB state
    this.updateFabState();
  }

  /**
   * Update FAB button state
   */
  updateFabState() {
    const fabBtn = this.elements.addMatchBtn;
    if (!fabBtn) return;

    // FAB is always enabled for mobile
    fabBtn.disabled = false;
  }

  /**
   * Show loading state
   * @param {boolean} show - Whether to show loading
   */
  showLoading(show) {
    // Simple loading indicator for mobile
    let loading = document.querySelector(".loading-overlay");
    if (show && !loading) {
      loading = document.createElement("div");
      loading.className = "loading-overlay";
      loading.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      loading.innerHTML = `
        <div style="color: white; font-size: 16px;">
          <i class="fas fa-spinner fa-spin me-2"></i>
          Loading...
        </div>
      `;
      document.body.appendChild(loading);
    } else if (!show && loading) {
      loading.remove();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.showToast(`Error: ${message}`);
    console.error(message);
  }

  /**
   * Show edit modal for a match
   * @param {Object} match - Match object to edit
   */
  showEditModal(match) {
    // Create or update edit modal
    let editModal = document.getElementById("editMatchModal");
    if (!editModal) {
      editModal = document.createElement("div");
      editModal.id = "editMatchModal";
      editModal.className = "modal fade";
      editModal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Match</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="edit-player1-name" class="form-label">Player 1 Name *</label>
                <input type="text" class="form-control" id="edit-player1-name" placeholder="y" required />
              </div>
              <div class="mb-3">
                <label for="edit-player2-name" class="form-label">Player 2 Name</label>
                <input type="text" class="form-control" id="edit-player2-name" placeholder="Enter second player name (leave empty for solo)" />
              </div>
              <div class="mb-3">
                <div class="form-text">
                  • Fill both player names for VS matches<br>
                  • Fill only Player 1 for solo matches
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="confirm-edit-match">Update Match</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(editModal);

      // Set up event listener for edit confirmation
      const confirmEditBtn = editModal.querySelector("#confirm-edit-match");
      confirmEditBtn.addEventListener("click", () => {
        this.handleEditConfirm(match.id);
      });
    }

    // Populate modal with current match data
    const player1Input = editModal.querySelector("#edit-player1-name");
    const player2Input = editModal.querySelector("#edit-player2-name");

    player1Input.value = match.players[0] || "";
    player2Input.value = match.players[1] || "";

    // Show modal
    const modal = new bootstrap.Modal(editModal);
    modal.show();

    // Store current match ID for reference
    editModal.dataset.currentMatchId = match.id;
  }

  /**
   * Handle edit confirmation
   * @param {string} matchId - Match ID being edited
   */
  handleEditConfirm(matchId) {
    const editModal = document.getElementById("editMatchModal");
    if (!editModal) return;

    const player1Name = editModal
      .querySelector("#edit-player1-name")
      .value.trim();
    const player2Name = editModal
      .querySelector("#edit-player2-name")
      .value.trim();

    // Validation
    if (!player1Name) {
      alert("Please enter at least Player 1 name");
      return;
    }

    // Auto-determine match type based on player inputs
    let matchType, players;

    if (player2Name && player2Name.trim()) {
      // Both players filled - VS match
      matchType = "vs";
      players = [player1Name, player2Name];
    } else {
      // Only player 1 filled - Solo match
      matchType = "solo";
      players = [player1Name];
    }

    // Update match
    if (this.queueManager.updateMatch(matchId, { type: matchType, players })) {
      // Close modal
      const modal = bootstrap.Modal.getInstance(editModal);
      modal.hide();
      this.showToast("Match updated successfully");
    } else {
      this.showToast("Failed to update match");
    }
  }
}
