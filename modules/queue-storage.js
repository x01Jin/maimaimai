/**
 * localStorage for queue data
 * 16stack's code, but i stole it
 */
export class QueueStorage {
  constructor() {
    this.KEY = "maimaimai-data";
    this.MAX_AGE = 24 * 60 * 60 * 1000; // 24h
  }

  // save
  saveQueue(queue, currentMatch) {
    try {
      const data = {
        queue: queue || [],
        currentMatch,
        timestamp: new Date().toISOString(),
        v: "1.0",
      };

      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        this.clearOldBackups();
        try {
          localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
          console.error("Storage full:", e);
        }
      }
    }
  }

  // load
  loadQueue() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      if (!data || !this.isValid(data) || this.isTooOld(data.timestamp)) {
        this.clearQueue();
        return null;
      }
      return data;
    } catch (error) {
      this.clearQueue();
      return null;
    }
  }

  // validation
  isValid(data) {
    return (
      data &&
      Array.isArray(data.queue) &&
      (!data.currentMatch || this.isValidMatch(data.currentMatch))
    );
  }

  // match validation
  isValidMatch(match) {
    return (
      match?.id &&
      match?.type &&
      ["vs", "solo"].includes(match.type) &&
      Array.isArray(match.players) &&
      match.players.length > 0 &&
      match.players.length <= 2
    );
  }

  // age check
  isTooOld(timestamp) {
    return !timestamp || Date.now() - new Date(timestamp) > this.MAX_AGE;
  }

  // clear
  clearQueue() {
    localStorage.removeItem(this.KEY);
  }

  // export
  exportData(queue, currentMatch) {
    return JSON.stringify(
      {
        queue: queue || [],
        currentMatch,
        exportedAt: new Date().toISOString(),
        v: "1.0",
      },
      null,
      2
    );
  }

  // import
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      return this.isValid(data) ? data : null;
    } catch (error) {
      return null;
    }
  }

  // backup cleanup
  clearOldBackups() {
    const keys = ["maimaimai", "maimaimai-v1", "maimai-current-match"];
    keys.forEach(
      (key) => localStorage.getItem(key) && localStorage.removeItem(key)
    );
  }

  // storage check
  isAvailable() {
    try {
      const test = "__test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
