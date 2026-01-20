import { DEPARTMENTS } from "../config/env.config.js";
import { UserSession } from "../storage/session.js";
import { hashPassword } from "../utils/encode.js";
import { dbManager } from "./database.js";

export class UserStore {
  static async createUser(userData) {
    if (
      !userData.email ||
      !userData.password ||
      !userData.name ||
      !userData.department
    ) {
      throw new Error("Incomplete user data");
    }
    if (!DEPARTMENTS.includes(userData.department)) {
      throw new Error("Invalid department");
    }
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user || !user.isAdmin) {
      throw new Error("Unauthorized to create user");
    }

    const hashedPassword = await hashPassword(userData.password);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readwrite");
      const store = transaction.objectStore("users");

      const newUser = {
        id: "user_" + crypto.randomUUID(),
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        department: userData.department,
        managerId: userData.managerId || null,
        orgId: user.orgId,
        createdAt: new Date().toISOString(),
      };

      const request = store.add(newUser);

      request.onsuccess = () => {
        console.log("User created:", newUser.email);
        resolve(newUser);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getUser() {
    const db = await dbManager.getDB();
    const userSession = await UserSession.get();
    if (!userSession) {
      throw new Error("No active user session");
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readonly");
      const store = transaction.objectStore("users");
      const request = store.get(userSession.userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getUserById(userId) {
    const db = await dbManager.getDB();
    const userSession = await UserSession.get();
    if (!userSession) {
      throw new Error("No active user session");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readonly");
      const store = transaction.objectStore("users");
      const request = store.get(userId);

      request.onsuccess = () => {
        const user = request.result;
        if (user && user.orgId === userSession.orgId) {
          resolve(user);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getUserByEmail(email) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readonly");
      const store = transaction.objectStore("users");
      const index = store.index("email");
      const request = index.get(email);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getUsersByDepartment(department) {
    if (!DEPARTMENTS.includes(department)) {
      throw new Error("Invalid department");
    }
    const allUsers = await this.getAllUsers();
    return allUsers.filter((user) => user.department === department);
  }

  static async getTeamByManager() {
    // Todo: add feat in future so that user can also see team
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("No active user session");
    }
    // const managerId = user.managerId || user.id;
    const managerId = user.id;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readonly");
      const store = transaction.objectStore("users");
      const index = store.index("managerId");
      const request = index.getAll(managerId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getAllUsers() {
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("No active user session");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["users"], "readonly");
      const store = transaction.objectStore("users");
      const index = store.index("orgId");
      const request = index.getAll(user.orgId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async updateUser(updates) {
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("No active user session");
    }
    const userId = user.userId;
    return new Promise(async (resolve, reject) => {
      const user = await this.getUserById(userId);
      if (!user) {
        reject(new Error("User not found"));
        return;
      }

      const transaction = db.transaction(["users"], "readwrite");
      const store = transaction.objectStore("users");
      const updatedUser = { ...user, ...updates };
      const request = store.put(updatedUser);

      request.onsuccess = () => {
        console.log("User updated:", userId);
        resolve(updatedUser);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
