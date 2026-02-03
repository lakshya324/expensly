import { API_BASE } from "./config/env.config.js";
import { OrganizationStore } from "./models/organization.store.js";
import { UserSession } from "./storage/session.js";
import { UserPreferenceLocal } from "./storage/local.js";
import { exchangeRateStream } from "./communication/connect.js";
import { formatCurrency } from "./utils/currency.js";
import { dbManager } from "./models/database.js";

/**
 * Setup the admin departments page with all event handlers
 */
export async function setupDepartmentsPage() {
  const addDepartmentForm = document.getElementById("add-department-form");
  const resetBtn = document.getElementById("form-reset-btn");

  // Initial render
  await renderDepartmentsTable();

  // Reset button handler
  resetBtn.addEventListener("click", () => {
    resetForm();
  });

  // Add department form submission
  addDepartmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate all fields before submission
    if (!validateForm()) {
      return;
    }

    await handleAddDepartment();
  });
}

/**
 * Handle adding a new department
 */
async function handleAddDepartment() {
  const userCurrency = UserPreferenceLocal.getCurrency();
  const budgetInSelectedCurrency = parseFloat(document.getElementById("dept-budget").value);

  const departmentData = {
    name: document.getElementById("dept-name").value.trim(),
    budget: budgetInSelectedCurrency,
    currency: userCurrency
  };

  try {
    const user = UserSession.get();
    const updatedOrg = await OrganizationStore.addDepartment(user.orgId, departmentData);

    // Call dummy API endpoint
    try {
      await fetch(`${API_BASE}/api/admin/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          department: departmentData
        })
      });
    } catch (apiError) {
      console.log("API call failed (expected):", apiError.message);
    }

    // Update session with new org data
    const sessionData = UserSession.get();
    sessionData.orgDepartments = updatedOrg.departments;
    UserSession.set(sessionData);

    alert("✅ Department added successfully!");
    resetForm();
    await renderDepartmentsTable();
  } catch (error) {
    console.error("Error adding department:", error);
    alert(`❌ Failed to add department: ${error.message}`);
  }
}

/**
 * Handle resetting department spent amount
 */
async function handleResetSpent(departmentId, departmentName) {
  if (!confirm(`Are you sure you want to reset the spent amount for ${departmentName}?`)) {
    return;
  }

  try {
    const user = UserSession.get();
    const org = await OrganizationStore.getOrganizationById(user.orgId);
    
    // Find the department and reset spent
    const dept = org.departments.find(d => d.id === departmentId);
    if (!dept) {
      throw new Error("Department not found");
    }

    dept.spent = 0;

    // Update the organization
    const db = await dbManager.getDB();
    const transaction = db.transaction(["organizations"], "readwrite");
    const store = transaction.objectStore("organizations");
    await new Promise((resolve, reject) => {
      const request = store.put(org);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Call dummy API endpoint
    try {
      await fetch(`${API_BASE}/api/admin/departments/${departmentId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId
        })
      });
    } catch (apiError) {
      console.log("API call failed (expected):", apiError.message);
    }

    // Update session
    const sessionData = UserSession.get();
    sessionData.orgDepartments = org.departments;
    UserSession.set(sessionData);

    alert("✅ Department budget reset successfully!");
    await renderDepartmentsTable();
  } catch (error) {
    console.error("Error resetting department:", error);
    alert(`❌ Failed to reset department: ${error.message}`);
  }
}

/**
 * Render the departments table
 */
export async function renderDepartmentsTable() {
  const tableBody = document.getElementById("departmentsTableBody");
  
  try {
    const user = UserSession.get();
    const userCurrency = UserPreferenceLocal.getCurrency();
    const departments = await OrganizationStore.getDepartments(user.orgId);

    if (!departments || departments.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">No departments yet. Add your first department above.</td>
        </tr>
      `;
      updateBudgetSummary([], 0);
      return;
    }

    // Calculate totals
    const org = await OrganizationStore.getOrganizationById(user.orgId);
    const totalAllocated = departments.reduce((sum, d) => sum + (d.budget || 0), 0);
    const totalSpent = departments.reduce((sum, d) => sum + (d.spent || 0), 0);

    tableBody.innerHTML = departments
      .map((dept) => {
        const storedCurrency = dept.currency || "USD";
        
        // Convert from stored currency to user's currency
        const budget = userCurrency !== storedCurrency
          ? exchangeRateStream.convert(dept.budget || 0, storedCurrency, userCurrency)
          : (dept.budget || 0);
        
        const spent = userCurrency !== storedCurrency
          ? exchangeRateStream.convert(dept.spent || 0, storedCurrency, userCurrency)
          : (dept.spent || 0);
        
        const remaining = budget - spent;
        const usagePercent = budget > 0 ? ((spent / budget) * 100).toFixed(1) : 0;
        
        // Format with original currency in brackets if different
        const formatWithOriginal = (convertedAmount, originalAmount, currency) => {
          const convertedStr = formatCurrency(convertedAmount, userCurrency);
          if (userCurrency !== storedCurrency) {
            const originalStr = formatCurrency(originalAmount, storedCurrency);
            return `${convertedStr} <span style="color: #888; font-size: 11px;">(${originalStr})</span>`;
          }
          return convertedStr;
        };
        
        return `
          <tr>
            <td><strong>${dept.name}</strong></td>
            <td>${formatWithOriginal(budget, dept.budget || 0, storedCurrency)}</td>
            <td>${formatWithOriginal(spent, dept.spent || 0, storedCurrency)}</td>
            <td style="color: ${remaining < 0 ? 'red' : 'green'}">
              ${formatWithOriginal(remaining, (dept.budget || 0) - (dept.spent || 0), storedCurrency)}
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; background: ${usagePercent > 90 ? '#e74c3c' : usagePercent > 70 ? '#f39c12' : '#27ae60'}; width: ${Math.min(usagePercent, 100)}%;"></div>
                </div>
                <span style="min-width: 45px;">${usagePercent}%</span>
              </div>
            </td>
            <td>
              <button class="btn-reset" data-dept-id="${dept.id}" data-dept-name="${dept.name}" 
                style="padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Reset Spent
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Update budget summary
    updateBudgetSummary(departments, org.totalBudget || totalAllocated);

    // Add event listeners to reset buttons
    tableBody.querySelectorAll(".btn-reset").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const deptId = e.target.dataset.deptId;
        const deptName = e.target.dataset.deptName;
        handleResetSpent(deptId, deptName);
      });
    });
  } catch (error) {
    console.error("Error rendering departments:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="color: red;">
          Error loading departments: ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Update the budget summary section
 */
function updateBudgetSummary(departments, totalBudget) {
  const userCurrency = UserPreferenceLocal.getCurrency();
  
  // Convert totals from USD to user's currency
  const totalAllocated = departments.reduce((sum, d) => sum + (d.budget || 0), 0);
  const totalSpent = departments.reduce((sum, d) => sum + (d.spent || 0), 0);
  const totalRemaining = totalAllocated - totalSpent;

  const allocatedConverted = userCurrency !== "USD"
    ? exchangeRateStream.convert(totalAllocated, "USD", userCurrency)
    : totalAllocated;
  
  const spentConverted = userCurrency !== "USD"
    ? exchangeRateStream.convert(totalSpent, "USD", userCurrency)
    : totalSpent;
  
  const remainingConverted = userCurrency !== "USD"
    ? exchangeRateStream.convert(totalRemaining, "USD", userCurrency)
    : totalRemaining;

  document.getElementById("total-allocated").textContent = formatCurrency(allocatedConverted, userCurrency);
  document.getElementById("total-spent").textContent = formatCurrency(spentConverted, userCurrency);
  document.getElementById("total-remaining").textContent = formatCurrency(remainingConverted, userCurrency);
  document.getElementById("total-remaining").style.color = remainingConverted < 0 ? '#e74c3c' : '#27ae60';
}

/**
 * Validate the form fields
 */
function validateForm() {
  let isValid = true;

  // Reset errors
  document.getElementById("dept-name-error").textContent = "";
  document.getElementById("dept-budget-error").textContent = "";

  // Validate name
  const name = document.getElementById("dept-name").value.trim();
  if (!name) {
    document.getElementById("dept-name-error").textContent = "Department name is required";
    isValid = false;
  } else if (name.length < 2) {
    document.getElementById("dept-name-error").textContent = "Name must be at least 2 characters";
    isValid = false;
  }

  // Validate budget
  const budget = document.getElementById("dept-budget").value;
  if (!budget || budget < 0) {
    document.getElementById("dept-budget-error").textContent = "Budget must be a positive number";
    isValid = false;
  }

  return isValid;
}

/**
 * Reset the form to initial state
 */
function resetForm() {
  document.getElementById("add-department-form").reset();
  document.getElementById("dept-name-error").textContent = "";
  document.getElementById("dept-budget-error").textContent = "";
}

/**
 * Update status indicator LED
 */
export function updateStatusIndicator(elementId, status) {
  const indicator = document.getElementById(elementId);
  if (!indicator) return;

  const led = indicator.querySelector('.led');
  if (!led) return;

  // Remove all status classes
  led.classList.remove('connected', 'reconnecting', 'error');

  // Add appropriate class based on status
  switch (status) {
    case 'connected':
      led.classList.add('connected');
      break;
    case 'reconnecting':
      led.classList.add('reconnecting');
      break;
    case 'error':
      led.classList.add('error');
      break;
    default:
      break;
  }
}
