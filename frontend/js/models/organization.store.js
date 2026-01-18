import { dbManager } from "./database";

export class OrganizationStore {
  static async createOrganization(orgData) {
    if (!orgData.name || !orgData.adminEmail || !orgData.adminPassword) {
      throw new Error("Incomplete organization data");
    }

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
    if (!orgId) throw new Error("Organization ID is required");
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
    if (!email) throw new Error("Admin email is required");
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
