import { AppState } from "../../data/state.js";

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
        <span class="user-dept-badge">${
        user.department
      }</span>
      </div>
      <div class="user-details">
        ${
          user.managerId
            ? `<span>Manager: ${user.managerId.substring(
                0,
                8
              )}...</span>`
            : '<span>No Manager</span>'
        }
      </div>
    </div>
  `
    )
    .join("");
}
