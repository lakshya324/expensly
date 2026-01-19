import { OfflineQueue } from "../../models/offlineQueue.store";

export async function updateQueueBadge() {
  const count = await OfflineQueue.getCount();
  document.getElementById('queue-count').textContent = count;
  
  const badge = document.getElementById('offline-badge');
  if (count > 0) {
    badge.style.display = 'flex';
  } else {
    // show for demo
    // todo: remove later
    badge.style.display = 'flex'; 
    // badge.style.display = 'none';
  }
}