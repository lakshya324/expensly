import { dbManager } from "./database.js";

export class ReceiptStore {
  static async storeReceipt(expenseId, receiptBlob) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["receipts"], "readwrite");
      const store = transaction.objectStore("receipts");
      const request = store.put({ expenseId, blob: receiptBlob });

      request.onsuccess = () => {
        console.log(`Receipt stored for expense ${expenseId}`);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getReceipt(expenseId) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["receipts"], "readonly");
      const store = transaction.objectStore("receipts");
      const request = store.get(expenseId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
