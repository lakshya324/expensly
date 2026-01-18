import { dbManager } from "./database";

export class OrganizationStore {
  static async createOrganization(orgData) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readwrite");
      const store = transaction.objectStore("organizations");

      const org = {
        id: "org_" + crypto.randomUUID(),
        name: orgData.name,
        adminEmail: orgData.adminEmail,
        adminPassword: orgData.adminPassword,
        createdAt: new Date().toISOString(),
      };

      const request = store.add(org);

      request.onsuccess = () => {
        console.log("Organization created:", org.name);
        resolve(org);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getOrganizationById(orgId) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readonly");
      const store = transaction.objectStore("organizations");
      const request = store.get(orgId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getOrganizationByAdminEmail(email) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readonly");
      const store = transaction.objectStore("organizations");
      const index = store.index("adminEmail");
      const request = index.get(email);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
