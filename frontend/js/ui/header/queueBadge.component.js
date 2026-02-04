import { AppState } from "../../data/state.js";
import { OfflineQueue } from "../../models/offlineQueue.store.js";

export async function updateQueueBadge() {
  const count = await OfflineQueue.getCount();
  document.getElementById("queue-count").textContent = count;

  const badge = document.getElementById("offline-badge");
  if (count > 0) {
    badge.style.display = "flex";
  } else {
    // show for demo
    // todo: remove later (so that it hides when count is 0 not only for admin)
    badge.style.display = "flex";
    // badge.style.display = 'none';
    if (AppState.currentUser?.isAdmin) {
      badge.style.display = "none";
      return;
    }
  }
}
