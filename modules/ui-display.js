/**
 * UI Display - Fast DOM updates for queue
 */
export class UIDisplay {
  constructor(queueManager) {
    this.qm = queueManager;
    this.elements = {
      current: document.getElementById("current-match"),
      queue: document.getElementById("queue-display"),
      addBtn: document.getElementById("add-match-btn"),
    };

    // Single event listener for all updates
    this.qm.onUpdate(() => this.render());
  }

  // single render method
  render() {
    this.renderCurrent();
    this.renderQueue();
  }

  // Render current match
  renderCurrent() {
    const el = this.elements.current;
    if (!el) return;

    const match = this.qm.getCurrentMatch();
    if (!match) {
      el.innerHTML = "";
      return;
    }

    const type = match.type === "vs" ? "VS Match" : "Solo Play";
    const badge = match.type === "vs" ? "users" : "user";

    el.innerHTML = `
      <div class="current-match-content">
        <div class="match-type-badge ${match.type} mb-3">
          <i class="fas fa-${badge} me-1"></i>${type}
        </div>
        <div class="current-players">
          ${
            match.type === "vs"
              ? `<div class="player-vs">
               <div class="player-1p"><span class="player-label">1P</span><span class="player-name">${this.escape(
                 match.players[0]
               )}</span></div>
               <div class="vs-divider"><i class="fas fa-vs"></i></div>
               <div class="player-2p"><span class="player-label">2P</span><span class="player-name">${this.escape(
                 match.players[1] || "TBD"
               )}</span></div>
             </div>`
              : `<div class="player-solo"><span class="player-name">${this.escape(
                  match.players[0]
                )}</span></div>`
          }
        </div>
        <div class="current-match-actions mt-3">
          <button class="btn btn-success btn-sm me-2" data-action="complete">
            <i class="fas fa-check me-1"></i>Complete
          </button>
          <button class="btn btn-warning btn-sm" data-action="cancel">
            <i class="fas fa-times me-1"></i>Cancel
          </button>
        </div>
      </div>
    `;

    // Add listeners
    el.querySelector('[data-action="complete"]')?.addEventListener(
      "click",
      () => {
        if (confirm("Mark as completed?")) {
          this.qm.endCurrentMatch();
          this.toast("Match completed!");
        }
      }
    );

    el.querySelector('[data-action="cancel"]')?.addEventListener(
      "click",
      () => {
        if (confirm("Cancel and return to queue?")) {
          this.qm.cancelCurrentMatch();
          this.toast("Match cancelled");
        }
      }
    );
  }

  // Render queue - ultra concise
  renderQueue() {
    const el = this.elements.queue;
    if (!el) return;

    const queue = this.qm.getQueue();
    if (!queue.length) {
      el.innerHTML = "";
      return;
    }

    el.innerHTML = queue
      .map((match, i) => {
        const pos = i + 1;
        const players =
          match.type === "vs"
            ? `${this.escape(match.players[0])} vs ${this.escape(
                match.players[1] || "TBD"
              )}`
            : `solo: ${this.escape(match.players[0])}`;

        return `
        <div class="queue-item ${match.type}" data-id="${match.id}">
          <div class="drag-handle" title="Drag to reorder">
            <i class="fas fa-grip-vertical"></i>
          </div>
          <div class="player-info-primary">${players}</div>
          <div class="queue-actions-new">
            <button class="btn btn-edit-compact" data-id="${
              match.id
            }" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            ${
              pos === 1
                ? `<button class="btn btn-start-compact" data-id="${match.id}" title="Start"><i class="fas fa-play"></i></button>`
                : ""
            }
            <button class="btn btn-remove-compact" data-id="${
              match.id
            }" title="Remove">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    // Single event delegation for start and remove actions
    el.onclick = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const id = btn.dataset.id;
      const match = queue.find((m) => m.id === id);

      if (btn.classList.contains("btn-start-compact")) {
        if (confirm(`Start: ${match.players.join(" vs ")}?`)) {
          this.qm.startNextMatch();
        }
      } else if (btn.classList.contains("btn-remove-compact")) {
        if (confirm(`Remove: ${match.players.join(" vs ")}?`)) {
          this.qm.removeMatch(id);
        }
      }
    };
  }

  // Utilities
  escape(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  toast(message) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast position-fixed";
      t.style.cssText =
        "top:20px;right:20px;z-index:9999;background:rgba(0,0,0,0.8);color:white;padding:12px 16px;border-radius:8px;font-size:14px;";
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 3000);
  }
}
