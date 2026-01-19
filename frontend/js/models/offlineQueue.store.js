import { dbManager } from "./database.js";

export class OfflineQueue {
  static async add(expense, receiptBlob = null) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      //TODO: make common transaction function
      const transaction = db.transaction(["offlineQueue"], "readwrite");
      const store = transaction.objectStore("offlineQueue");

      const queueItem = {
        expense,
        receiptBlob,
        timestamp: Date.now(),
      };

      const request = store.add(queueItem);

      request.onsuccess = () => {
        console.log("Added to offline sync queue");
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getAll() {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offlineQueue"], "readonly");
      const store = transaction.objectStore("offlineQueue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async clear() {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offlineQueue"], "readwrite");
      const store = transaction.objectStore("offlineQueue");
      const request = store.clear();

      request.onsuccess = () => {
        console.log("Offline queue cleared");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getCount() {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offlineQueue"], "readonly");
      const store = transaction.objectStore("offlineQueue");
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async remove(queueId) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["offlineQueue"], "readwrite");
      const store = transaction.objectStore("offlineQueue");
      const request = store.delete(queueId);

      request.onsuccess = () => {
        console.log("Item removed from queue:", queueId);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }
}