import { AppState } from "../data/state.js";
import { renderAvailableTags, renderBudgetGrid } from "./user.left.js";

export async function renderLeftPanelUI() {
  const adminPanel = document.getElementById("adminPanel");
  const expensePanel = document.getElementById("expensePanel");

  const isAdmin = AppState.currentUser?.isAdmin;
  if (isAdmin) {
    // Show admin panel
    adminPanel.style.display = "block";
    expensePanel.style.display = "none";
  } else {
    // Show expense submission panel
    adminPanel.style.display = "none";
    expensePanel.style.display = "block";

    await renderBudgetGrid();
    renderAvailableTags();
  }
}

export function renderUsersListForAdmin() {
  const usersList = document.getElementById("usersList");

  if (AppState.users.length === 0) {
    usersList.innerHTML =
      '<p class="empty-state">No users yet. Add your first user above.</p>';
    return;
  }

  usersList.innerHTML = AppState.users
    .map(
      (user) => `
    <div class="user-card" data-user-id="${user.id}">
      <div class="user-info-row">
        <div class="user-main">
          <h4>${user.name}</h4>
          <p class="user-email">${user.email}</p>
        </div>
        <span class="user-dept-badge dept-${user.department.toLowerCase()}">${
        user.department
      }</span>
      </div>
      <div class="user-details">
        ${
          user.managerId
            ? `<span class="detail-item">Manager: ${user.managerId.substring(
                0,
                8
              )}...</span>`
            : '<span class="detail-item">No Manager</span>'
        }
      </div>
    </div>
  `
    )
    .join("");
}
