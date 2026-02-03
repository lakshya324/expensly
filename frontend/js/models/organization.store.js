import { dbManager } from "./database.js";

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
        // Department management with default Finance department
        departments: [
          {
            id: "dept_" + crypto.randomUUID(),
            name: "Finance",
            budget: 50000,
            spent: 0,
            currency: "USD"
          }
        ],
        totalBudget: 50000
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

  static async getAllOrganizations() {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readonly");
      const store = transaction.objectStore("organizations");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Department Management Methods
  static async addDepartment(orgId, departmentData) {
    if (!orgId || !departmentData.name || !departmentData.budget) {
      throw new Error("Organization ID, department name and budget are required");
    }

    const org = await this.getOrganizationById(orgId);
    if (!org) throw new Error("Organization not found");

    // Check if department already exists
    if (org.departments && org.departments.some(d => d.name.toLowerCase() === departmentData.name.toLowerCase())) {
      throw new Error("Department already exists");
    }

    const newDepartment = {
      id: "dept_" + crypto.randomUUID(),
      name: departmentData.name,
      budget: parseFloat(departmentData.budget),
      spent: 0,
      currency: departmentData.currency || "USD"
    };

    // Initialize departments array if it doesn't exist
    if (!org.departments) {
      org.departments = [];
    }

    org.departments.push(newDepartment);
    org.totalBudget = (org.totalBudget || 0) + newDepartment.budget;

    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readwrite");
      const store = transaction.objectStore("organizations");
      const request = store.put(org);

      request.onsuccess = () => {
        console.log("Department added:", newDepartment.name);
        resolve(org);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getDepartments(orgId) {
    const org = await this.getOrganizationById(orgId);
    if (!org) throw new Error("Organization not found");
    
    // Return departments or default Finance if not initialized
    if (!org.departments || org.departments.length === 0) {
      return [{
        id: "dept_" + crypto.randomUUID(),
        name: "Finance",
        budget: 50000,
        spent: 0,
        currency: "USD"
      }];
    }
    
    return org.departments;
  }

  static async updateDepartmentBudget(orgId, departmentId, newBudget, resetSpent = false) {
    if (!orgId || !departmentId) {
      throw new Error("Organization ID and department ID are required");
    }

    const org = await this.getOrganizationById(orgId);
    if (!org) throw new Error("Organization not found");

    const dept = org.departments?.find(d => d.id === departmentId);
    if (!dept) throw new Error("Department not found");

    // Only update budget if newBudget is provided
    if (newBudget !== undefined && newBudget !== null) {
      const oldBudget = dept.budget;
      dept.budget = parseFloat(newBudget);
      // Update total budget
      org.totalBudget = (org.totalBudget || 0) - oldBudget + dept.budget;
    }
    
    if (resetSpent) {
      dept.spent = 0;
    }

    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readwrite");
      const store = transaction.objectStore("organizations");
      const request = store.put(org);

      request.onsuccess = () => {
        console.log("Department budget updated:", dept.name);
        resolve(org);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async resetDepartmentSpent(orgId, departmentId) {
    return this.updateDepartmentBudget(orgId, departmentId, null, true);
  }

  static async updateDepartmentSpent(orgId, departmentName, amount) {
    if (!orgId || !departmentName || amount === undefined) {
      throw new Error("Organization ID, department name and amount are required");
    }

    const org = await this.getOrganizationById(orgId);
    if (!org) throw new Error("Organization not found");

    const dept = org.departments?.find(d => d.name === departmentName);
    if (!dept) throw new Error("Department not found");

    dept.spent = (dept.spent || 0) + parseFloat(amount);

    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["organizations"], "readwrite");
      const store = transaction.objectStore("organizations");
      const request = store.put(org);

      request.onsuccess = () => resolve(org);
      request.onerror = () => reject(request.error);
    });
  }
}
