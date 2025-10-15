/**
 * Queue Features - Edit, Reorder functionality
 * now it's shorter and more efficient because fuck you
 */
export class QueueFeatures {
  constructor(queueManager, uiDisplay) {
    this.qm = queueManager;
    this.ui = uiDisplay;
    this.setupFeatures();
  }

  setupFeatures() {
    this.setupDragAndDrop();
    this.setupEditFunctionality();
  }

  setupDragAndDrop() {
    // Load SortableJS from CDN
    if (!window.Sortable) {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
      document.head.appendChild(script);
    }

    // Setup drag and drop when SortableJS is loaded
    const checkSortable = () => {
      if (window.Sortable) {
        this.initDragAndDrop();
      } else {
        setTimeout(checkSortable, 100);
      }
    };
    checkSortable();
  }

  initDragAndDrop() {
    const queueEl = document.getElementById("queue-display");
    if (!queueEl) return;

    this.sortable = new window.Sortable(queueEl, {
      handle: ".drag-handle",
      animation: 150,
      onEnd: (evt) => {
        const queue = this.qm.getQueue();
        const reordered = [...queue];
        const [moved] = reordered.splice(evt.oldIndex, 1);
        reordered.splice(evt.newIndex, 0, moved);

        this.qm.queue = reordered;
        this.qm.emit("update");
        this.qm.autoSave();
      },
    });
  }

  setupEditFunctionality() {
    // Listen for edit button clicks
    document.addEventListener("click", (e) => {
      if (e.target.closest(".btn-edit-compact")) {
        const btn = e.target.closest(".btn-edit-compact");
        const matchId = btn.dataset.id;
        const match = this.qm.getQueue().find((m) => m.id === matchId);
        if (match) this.showEditModal(match);
      }
    });
  }

  showEditModal(match) {
    // Create simple edit modal
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Match</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Player 1 Name *</label>
              <input type="text" class="form-control" id="edit-p1" value="${
                match.players[0] || ""
              }" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Player 2 Name</label>
              <input type="text" class="form-control" id="edit-p2" value="${
                match.players[1] || ""
              }" placeholder="Leave empty for solo" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="save-edit">Update</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle save
    modal.querySelector("#save-edit").addEventListener("click", () => {
      const p1 = modal.querySelector("#edit-p1").value.trim();
      const p2 = modal.querySelector("#edit-p2").value.trim();

      if (!p1) {
        alert("Please enter Player 1 name");
        return;
      }

      const type = p2 ? "vs" : "solo";
      const players = [p1, p2].filter(Boolean);

      this.qm.updateMatch(match.id, { type, players });
      bootstrap.Modal.getInstance(modal).hide();
      modal.remove();
    });

    // Show modal
    new bootstrap.Modal(modal).show();
  }
}
