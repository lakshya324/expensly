import { INDEXED_DB_CONFIG } from "../config/env.config";

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXED_DB_CONFIG.name, INDEXED_DB_CONFIG.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        console.log("✅ IndexedDB initialized");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        console.log(`📦 Upgrading DB from v${oldVersion} to v${INDEXED_DB_CONFIG.version}`);

        //* ORGANIZATIONS STORE
        if (!db.objectStoreNames.contains("organizations")) {
          const orgStore = db.createObjectStore("organizations", {
            keyPath: "id",
          });
          orgStore.createIndex("adminEmail", "adminEmail", { unique: true });
          console.log("Created: organizations store");
        }

        //* USERS STORE
        if (!db.objectStoreNames.contains("users")) {
          const userStore = db.createObjectStore("users", { keyPath: "id" });
          userStore.createIndex("email", "email", { unique: true });
          userStore.createIndex("orgId", "orgId", { unique: false });
          userStore.createIndex("department", "department", { unique: false });
          userStore.createIndex("managerId", "managerId", { unique: false });
          console.log("Created: users store");
        }

        //* TICKETS STORE
        if (!db.objectStoreNames.contains("tickets")) {
          const ticketStore = db.createObjectStore("tickets", {
            keyPath: "id",
          });
          ticketStore.createIndex("submittedBy", "submittedBy", {
            unique: false,
          });
          ticketStore.createIndex("orgId", "orgId", { unique: false });
          ticketStore.createIndex("department", "department", {
            unique: false,
          });
          ticketStore.createIndex("status", "status", { unique: false });
          ticketStore.createIndex("timestamp", "timestamp", { unique: false });
        //   ticketStore.createIndex("managerApproval.reviewedBy", "managerApproval.reviewedBy", { unique: false });
        //   ticketStore.createIndex("financeApproval.reviewedBy", "financeApproval.reviewedBy", {
        //     unique: false,
        //   });
        ticketStore.createIndex("org_deptartment", ["orgId", "department"], { unique: false });
          console.log("Created: tickets store");
        }

        //* OFFLINE QUEUE STORE
        if (!db.objectStoreNames.contains("offlineQueue")) {
          const queueStore = db.createObjectStore("offlineQueue", {
            keyPath: "queueId",
            autoIncrement: true,
          });
          queueStore.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Created: offlineQueue store");
        }

        //* RECEIPTS STORE (blob file storage)
        if (!db.objectStoreNames.contains("receipts")) {
          db.createObjectStore("receipts", { keyPath: "expenseId" });
          console.log("Created: receipts store");
        }

        console.log("✅ Database schema updated");
      };
    });

    return this.initPromise;
  }

  async getDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }
}

export const dbManager = new DatabaseManager();
