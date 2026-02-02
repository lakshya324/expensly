import { renderBudgetGrid } from "./common.component.js";

export async function renderAdminLeftPanel() {
  const adminPanel = document.getElementById("adminPanel");
  
  adminPanel.innerHTML = `
    <h2>Admin Panel</h2>
    
    <!-- Navigation to user management -->
    <div class="panel-section">
      <button class="btn-navigate" id="manageUsersBtn">
        Manage Users
      </button>
    </div>

    <!-- Department Budgets -->
    <div class="panel-section">
      <h3>Department Budgets</h3>
      <div class="budget-grid" id="budget-grid"></div>
    </div>
  `;

  // Render budget grid
  await renderBudgetGrid();

  // Add navigation handler
  document.getElementById("manageUsersBtn").addEventListener("click", () => {
    window.location.href = "admin-users.html";
  });
}