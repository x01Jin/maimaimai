/**
 * QueueManager - Handles queue operations for maimai matches
 * sanaol may ka match
 * credits to genezis the help is actually helpful
 */

export class QueueManager {
  constructor() {
    this.queue = [];
    this.currentMatch = null;
    this.eventListeners = {
      queueUpdated: [],
      matchStarted: [],
      matchRemoved: [],
    };
  }

  /**
   * Add a match to the queue
   * @param {Object} match - Match object with id, type, players, timestamp, status
   */
  addMatch(match) {
    // Validate match object
    if (!this.validateMatch(match)) {
      throw new Error("Invalid match object");
    }

    // If no current match, automatically set this match as current
    if (!this.currentMatch) {
      this.currentMatch = match;
      this.currentMatch.status = "playing";
      this.currentMatch.startedAt = new Date().toISOString();

      // Emit events for current match
      this.emit("matchStarted");
      this.emit("queueUpdated");
    } else {
      // Add to queue if there's already a current match
      this.queue.push(match);

      // Emit event
      this.emit("queueUpdated");
    }

    return match;
  }

  /**
   * Remove a match from the queue
   * @param {string} matchId - ID of the match to remove
   * @returns {Object|null} Removed match or null if not found
   */
  removeMatch(matchId) {
    const index = this.queue.findIndex((match) => match.id === matchId);
    if (index === -1) {
      return null;
    }

    const removedMatch = this.queue.splice(index, 1)[0];
    this.emit("queueUpdated");
    this.emit("matchRemoved");

    return removedMatch;
  }

  /**
   * Start the next match (move first in queue to current match)
   * @returns {Object|null} Started match or null if queue empty
   */
  startNextMatch() {
    if (this.queue.length === 0) {
      return null;
    }

    // Move first match to current
    this.currentMatch = this.queue.shift();

    // Update status
    this.currentMatch.status = "playing";
    this.currentMatch.startedAt = new Date().toISOString();

    // Emit events
    this.emit("matchStarted");
    this.emit("queueUpdated");

    return this.currentMatch;
  }

  /**
   * End the current match
   * @returns {Object|null} Ended match or null if no current match
   */
  endCurrentMatch() {
    if (!this.currentMatch) {
      return null;
    }

    const endedMatch = this.currentMatch;
    endedMatch.status = "completed";
    endedMatch.endedAt = new Date().toISOString();

    // Clear current match
    this.currentMatch = null;

    // Emit events
    this.emit("matchStarted"); // This will clear current match display
    this.emit("queueUpdated");

    return endedMatch;
  }

  /**
   * Cancel the current match and return it to the front of the queue
   * @returns {Object|null} Canceled match or null if no current match
   */
  cancelCurrentMatch() {
    if (!this.currentMatch) {
      return null;
    }

    const canceledMatch = this.currentMatch;
    canceledMatch.status = "canceled";
    canceledMatch.canceledAt = new Date().toISOString();

    // Return match to front of queue
    this.queue.unshift(canceledMatch);

    // Clear current match
    this.currentMatch = null;

    // Emit events
    this.emit("matchStarted"); // This will clear current match display
    this.emit("queueUpdated");

    return canceledMatch;
  }

  /**
   * Get the current match
   * @returns {Object|null} Current match or null
   */
  getCurrentMatch() {
    return this.currentMatch;
  }

  /**
   * Get the queue
   * @returns {Array} Array of matches in queue
   */
  getQueue() {
    return [...this.queue];
  }

  /**
   * Load queue from saved data
   * @param {Array} savedQueue - Previously saved queue data
   */
  loadQueue(savedQueue) {
    if (Array.isArray(savedQueue)) {
      this.queue = [...savedQueue];
      this.emit("queueUpdated");
    }
  }

  /**
   * Set the current match
   * @param {Object|null} match - Match object or null to clear current match
   */
  setCurrentMatch(match) {
    if (match === null) {
      this.currentMatch = null;
      this.emit("matchStarted");
      return;
    }

    // Validate match object
    if (!this.validateMatch(match)) {
      throw new Error("Invalid match object");
    }

    this.currentMatch = { ...match };
    this.emit("matchStarted");
  }

  /**
   * Clear all queue data
   */
  clearQueue() {
    this.queue = [];
    this.currentMatch = null;
    this.emit("queueUpdated");
    this.emit("matchStarted");
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getStats() {
    const totalMatches = this.queue.length + (this.currentMatch ? 1 : 0);
    const vsMatches =
      this.queue.filter((match) => match.type === "vs").length +
      (this.currentMatch && this.currentMatch.type === "vs" ? 1 : 0);
    const soloMatches =
      this.queue.filter((match) => match.type === "solo").length +
      (this.currentMatch && this.currentMatch.type === "solo" ? 1 : 0);

    return {
      totalMatches,
      vsMatches,
      soloMatches,
      queueLength: this.queue.length,
      hasCurrentMatch: !!this.currentMatch,
    };
  }

  /**
   * Validate match object structure
   * @param {Object} match - Match object to validate
   * @returns {boolean} True if valid
   */
  validateMatch(match) {
    if (!match || typeof match !== "object") {
      return false;
    }

    return (
      match.id &&
      match.type &&
      (match.type === "vs" || match.type === "solo") &&
      Array.isArray(match.players) &&
      match.players.length > 0 &&
      match.players.length <= 2 &&
      match.timestamp &&
      match.status
    );
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  removeEventListener(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback);
      if (index > -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Optional data to pass to listeners
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }

    // Also emit DOM events for compatibility
    const customEvent = new CustomEvent(event, { detail: data });
    document.dispatchEvent(customEvent);
  }

  /**
   * Get matches by type
   * @param {string} type - Match type ('vs' or 'solo')
   * @returns {Array} Filtered matches
   */
  getMatchesByType(type) {
    return this.queue.filter((match) => match.type === type);
  }

  /**
   * Move match to front of queue
   * @param {string} matchId - ID of match to prioritize
   * @returns {boolean} True if successful
   */
  prioritizeMatch(matchId) {
    const index = this.queue.findIndex((match) => match.id === matchId);
    if (index === -1 || index === 0) {
      return false;
    }

    const match = this.queue.splice(index, 1)[0];
    this.queue.unshift(match);

    this.emit("queueUpdated");
    return true;
  }

  /**
   * Get position of match in queue
   * @param {string} matchId - Match ID
   * @returns {number} Position (1-based) or -1 if not found
   */
  getMatchPosition(matchId) {
    const index = this.queue.findIndex((match) => match.id === matchId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Move match to new position in queue
   * @param {string} matchId - ID of match to move
   * @param {number} newPosition - New position (1-based)
   * @returns {boolean} True if successful
   */
  moveMatch(matchId, newPosition) {
    const currentIndex = this.queue.findIndex((match) => match.id === matchId);
    if (currentIndex === -1) {
      return false;
    }

    // Convert to 0-based index and validate
    const newIndex = Math.max(
      0,
      Math.min(this.queue.length - 1, newPosition - 1)
    );
    if (currentIndex === newIndex) {
      return false; // No change needed
    }

    // Remove from current position and insert at new position
    const match = this.queue.splice(currentIndex, 1)[0];
    this.queue.splice(newIndex, 0, match);

    this.emit("queueUpdated");
    return true;
  }

  /**
   * Update a match in the queue
   * @param {string} matchId - ID of match to update
   * @param {Object} updates - Updates to apply (type, players)
   * @returns {boolean} True if successful
   */
  updateMatch(matchId, updates) {
    // Find match in queue
    const matchIndex = this.queue.findIndex((match) => match.id === matchId);
    if (matchIndex === -1) {
      return false;
    }

    // Update match
    const match = this.queue[matchIndex];
    if (updates.type) {
      match.type = updates.type;
    }
    if (updates.players) {
      match.players = updates.players;
    }
    match.timestamp = new Date().toISOString();

    this.emit("queueUpdated");
    return true;
  }

  /**
   * Reorder queue based on array of match IDs
   * @param {Array} matchIds - Array of match IDs in desired order
   * @returns {boolean} True if successful
   */
  reorderQueue(matchIds) {
    if (!Array.isArray(matchIds) || matchIds.length !== this.queue.length) {
      return false;
    }

    const matchMap = new Map(this.queue.map((match) => [match.id, match]));
    const reorderedQueue = [];

    for (const matchId of matchIds) {
      if (matchMap.has(matchId)) {
        reorderedQueue.push(matchMap.get(matchId));
      } else {
        return false; // Invalid match ID
      }
    }

    this.queue = reorderedQueue;
    this.emit("queueUpdated");
    return true;
  }
}
