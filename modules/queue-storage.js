/**
 * QueueStorage - Handles local storage persistence for maimai queue
 * misskonasiya
 * the mf(16stack) suggested this so i stole his code
 * not sorry blud
 * Kuro helped with some validation logic too
 */

export class QueueStorage {
  constructor() {
    this.STORAGE_KEY = "maimaimai-data";
    this.MAX_STORAGE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Save queue data to local storage
   * @param {Array} queue - Queue data to save
   * @param {Object} currentMatch - Current match data
   */
  saveQueue(queue, currentMatch = null) {
    try {
      const dataToSave = {
        queue: Array.isArray(queue) ? queue : [],
        currentMatch: currentMatch || null,
        timestamp: new Date().toISOString(),
        version: "1.0",
      };

      const serializedData = JSON.stringify(dataToSave);
      localStorage.setItem(this.STORAGE_KEY, serializedData);

      console.log("Queue data saved to localStorage");
    } catch (error) {
      console.error("Failed to save queue data:", error);

      // If storage is full, try to clear old data and retry
      if (error.name === "QuotaExceededError") {
        this.clearOldData();
        try {
          const dataToSave = {
            queue: Array.isArray(queue) ? queue : [],
            currentMatch: currentMatch || null,
            timestamp: new Date().toISOString(),
            version: "1.0",
          };
          const serializedData = JSON.stringify(dataToSave);
          localStorage.setItem(this.STORAGE_KEY, serializedData);
          console.log("Queue data saved after clearing old data");
        } catch (retryError) {
          console.error(
            "Failed to save even after clearing old data:",
            retryError
          );
        }
      }
    }
  }

  /**
   * Load queue data from local storage
   * @returns {Object|null} Loaded data or null if not found/invalid
   */
  loadQueue() {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (!savedData) {
        return null;
      }

      const parsedData = JSON.parse(savedData);

      // Validate data structure and age
      if (!this.validateSavedData(parsedData)) {
        console.log("Invalid or old saved data, starting fresh");
        this.clearQueue();
        return null;
      }

      // Check if data is too old
      if (this.isDataTooOld(parsedData.timestamp)) {
        console.log("Saved data is too old, clearing");
        this.clearQueue();
        return null;
      }

      console.log("Queue data loaded from localStorage");
      return {
        queue: parsedData.queue || [],
        currentMatch: parsedData.currentMatch || null,
      };
    } catch (error) {
      console.error("Failed to load queue data:", error);
      this.clearQueue();
      return null;
    }
  }

  /**
   * Clear all queue data from local storage
   */
  clearQueue() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log("Queue data cleared from localStorage");
    } catch (error) {
      console.error("Failed to clear queue data:", error);
    }
  }

  /**
   * Clear old/unused data from local storage
   */
  clearOldData() {
    try {
      // Clear any old storage keys that might be taking up space
      const keysToCheck = ["maimaimai", "maimaimai-v1", "maimai-current-match"];

      keysToCheck.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });

      console.log("Old storage data cleared");
    } catch (error) {
      console.error("Failed to clear old data:", error);
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage usage information
   */
  getStorageStats() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const dataSize = data ? new Blob([data]).size : 0;

      // Estimate total localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += new Blob([localStorage.getItem(key)]).size;
        }
      }

      return {
        queueDataSize: dataSize,
        totalStorageSize: totalSize,
        itemCount: localStorage.length,
        maxSize: 5 * 1024 * 1024, // 5MB typical limit
      };
    } catch (error) {
      console.error("Failed to get storage stats:", error);
      return {
        queueDataSize: 0,
        totalStorageSize: 0,
        itemCount: 0,
        maxSize: 5 * 1024 * 1024,
      };
    }
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} True if localStorage is available
   */
  isStorageAvailable() {
    try {
      const test = "__storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate saved data structure
   * Kuro's part
   * @param {Object} data - Data to validate
   * @returns {boolean} True if valid
   */
  validateSavedData(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    // Check required fields
    if (!Array.isArray(data.queue)) {
      return false;
    }

    // Validate queue items
    for (const match of data.queue) {
      if (!this.validateMatchStructure(match)) {
        return false;
      }
    }

    // Validate current match if present
    if (data.currentMatch && !this.validateMatchStructure(data.currentMatch)) {
      return false;
    }

    return true;
  }

  /**
   * Validate individual match structure
   * @param {Object} match - Match to validate
   * @returns {boolean} True if valid
   */
  validateMatchStructure(match) {
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
   * Check if saved data is too old
   * @param {string} timestamp - ISO timestamp string
   * @returns {boolean} True if too old
   */
  isDataTooOld(timestamp) {
    if (!timestamp) {
      return true;
    }

    try {
      const saveTime = new Date(timestamp).getTime();
      const now = new Date().getTime();
      return now - saveTime > this.MAX_STORAGE_AGE;
    } catch (error) {
      return true;
    }
  }

  /**
   * Export queue data as JSON string
   * @param {Array} queue - Queue data
   * @param {Object} currentMatch - Current match data
   * @returns {string} JSON string
   */
  exportData(queue, currentMatch = null) {
    const exportData = {
      queue: Array.isArray(queue) ? queue : [],
      currentMatch: currentMatch || null,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import queue data from JSON string
   * @param {string} jsonData - JSON string to import
   * @returns {Object|null} Imported data or null if invalid
   */
  importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData);

      if (!this.validateSavedData(importedData)) {
        throw new Error("Invalid import data structure");
      }

      return {
        queue: importedData.queue || [],
        currentMatch: importedData.currentMatch || null,
      };
    } catch (error) {
      console.error("Failed to import data:", error);
      return null;
    }
  }

  /**
   * Backup current data to timestamped key
   */
  createBackup() {
    try {
      const currentData = localStorage.getItem(this.STORAGE_KEY);
      if (currentData) {
        const backupKey = `${this.STORAGE_KEY}-backup-${Date.now()}`;
        localStorage.setItem(backupKey, currentData);
        console.log("Backup created:", backupKey);
      }
    } catch (error) {
      console.error("Failed to create backup:", error);
    }
  }

  /**
   * Clean up old backups (older than 7 days)
   */
  cleanupOldBackups() {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes(`${this.STORAGE_KEY}-backup-`)) {
          const timestamp = parseInt(key.split("-").pop());
          if (timestamp < sevenDaysAgo) {
            localStorage.removeItem(key);
            console.log("Removed old backup:", key);
          }
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old backups:", error);
    }
  }
}
