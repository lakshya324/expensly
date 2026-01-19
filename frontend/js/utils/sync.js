import { OfflineQueue } from "../models/offlineQueue.store.js";
import { updateQueueBadge } from "../ui/header/queueBadge.component.js";
import { addTicketToIDB, submitTicketToServer } from "./ticket.js";

async function syncOfflineQueue() {
  try {
    const queue = await OfflineQueue.getAll();

    if (queue.length === 0) {
      console.log("No offline items to sync");
      return;
    }

    console.log(`Syncing ${queue.length} offline expenses...`);

    // submit each queued item
    for (const item of queue) {
      await submitTicketToServer(item.expense);
      await addTicketToIDB(item.expense, item.receiptBlob);
    }

    // clear queue after sync
    await OfflineQueue.clear();
    await updateQueueBadge();

    console.log("Offline sync complete");
    alert(`Successfully synced ${queue.length} offline expenses!`);
  } catch (error) {
    console.error("Offline sync failed:", error);
    alert("Failed to sync offline data. Will retry later.");
  }
}

export function setupOnlineOfflineHandlers() {
  window.addEventListener("online", async () => {
    console.log("Connection restored");
    alert("Connection restored! Syncing offline data...");
    await syncOfflineQueue();
  });

  window.addEventListener("offline", () => {
    console.log("Connection lost");
    alert("You are offline. Expenses will be queued for sync.");
  });

  // initial sync if online
  if (navigator.onLine) {
    syncOfflineQueue();
  }
}
