/**
 * Queue Manager - queue for maimai matches
 * Uses fastq-inspired patterns for maximum efficiency
 * i didnt know fastq existed until genezis mentioned it
 */
export class QueueManager {
  constructor(storage) {
    this.storage = storage;
    this.queue = [];
    this.currentMatch = null;
    this.listeners = new Set();

    // Auto-save on changes
    this.autoSave = this.debounce(() => {
      if (this.storage?.saveQueue) {
        this.storage.saveQueue(this.queue, this.currentMatch);
      }
    }, 500);
  }

  // Match validation
  validateMatch(match) {
    return (
      match?.id &&
      match?.type &&
      ["vs", "solo"].includes(match.type) &&
      Array.isArray(match.players) &&
      match.players.length > 0 &&
      match.players.length <= 2
    );
  }

  // Add match
  addMatch(match) {
    if (!this.validateMatch(match)) throw new Error("Invalid match");

    if (!this.currentMatch) {
      this.currentMatch = {
        ...match,
        status: "playing",
        startedAt: new Date().toISOString(),
      };
      this.emit("current");
    } else {
      this.queue.push(match);
    }

    this.emit("update");
    this.autoSave();
    return match;
  }

  // Remove match
  removeMatch(matchId) {
    const index = this.queue.findIndex((m) => m.id === matchId);
    if (index === -1) return null;

    const removed = this.queue.splice(index, 1)[0];
    this.emit("update");
    this.autoSave();
    return removed;
  }

  // Start next match
  startNextMatch() {
    if (!this.queue.length) return null;

    this.currentMatch = this.queue.shift();
    this.currentMatch.status = "playing";
    this.currentMatch.startedAt = new Date().toISOString();

    this.emit("current");
    this.emit("update");
    this.autoSave();
    return this.currentMatch;
  }

  // End current match
  endCurrentMatch() {
    if (!this.currentMatch) return null;

    const ended = this.currentMatch;
    ended.status = "completed";
    ended.endedAt = new Date().toISOString();

    this.currentMatch = null;
    this.emit("current");
    this.emit("update");
    this.autoSave();
    return ended;
  }

  // Cancel current match
  cancelCurrentMatch() {
    if (!this.currentMatch) return null;

    const canceled = this.currentMatch;
    canceled.status = "canceled";
    canceled.canceledAt = new Date().toISOString();

    this.queue.unshift(canceled);
    this.currentMatch = null;

    this.emit("current");
    this.emit("update");
    this.autoSave();
    return canceled;
  }

  // Simple getters
  getCurrentMatch() {
    return this.currentMatch;
  }
  getQueue() {
    return [...this.queue];
  }

  // Load from storage
  loadQueue(data) {
    if (data?.queue) this.queue = [...data.queue];
    if (data?.currentMatch) this.currentMatch = data.currentMatch;
    this.emit("update");
  }

  // Set current match directly
  setCurrentMatch(match) {
    this.currentMatch = match ? { ...match } : null;
    this.emit("current");
    this.autoSave();
  }

  // Clear everything
  clearQueue() {
    this.queue = [];
    this.currentMatch = null;
    this.emit("update");
    this.autoSave();
  }

  // Simple stats
  getStats() {
    const total = this.queue.length + (this.currentMatch ? 1 : 0);
    const vs = [...this.queue, this.currentMatch].filter(
      (m) => m?.type === "vs"
    ).length;
    return {
      totalMatches: total,
      vsMatches: vs,
      soloMatches: total - vs,
      queueLength: this.queue.length,
      hasCurrentMatch: !!this.currentMatch,
    };
  }

  // Update match in queue
  updateMatch(matchId, updates) {
    const match = this.queue.find((m) => m.id === matchId);
    if (!match) return false;

    Object.assign(match, updates, { timestamp: new Date().toISOString() });
    this.emit("update");
    this.autoSave();
    return true;
  }

  // Event system
  onUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(type) {
    this.listeners.forEach((cb) => {
      try {
        cb(type, this);
      } catch (e) {
        console.error(e);
      }
    });

    // DOM events for compatibility
    document.dispatchEvent(new CustomEvent(`queue-${type}`, { detail: this }));
  }

  // Debounce utility for auto-save
  debounce(fn, ms) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  }
}
