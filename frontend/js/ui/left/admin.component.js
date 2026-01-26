import { UserStore } from "../../models/user.store.js";

export async function renderUsersListForAdmin() {
  const usersList = document.getElementById("usersList");
  const users = await UserStore.getAllUsers();

  if (users.length === 0) {
    usersList.innerHTML =
      '<p class="empty-state">No users yet. Add your first user above.</p>';
    return;
  }

  const userMap = {};
  users.forEach(user => {
    userMap[user.id] = user.name;
  });

  usersList.innerHTML = users
    .map(
      (user) => {
        const managerName = user.managerId ? userMap[user.managerId] || 'Unknown' : null;
        
        return `
    <div class="user-card" data-user-id="${user.id}">
      <div class="user-info-row">
        <div class="user-main">
          <h4>${user.name}</h4>
          <p class="user-email">${user.email}</p>
        </div>
        <span class="user-dept-badge">${user.department}</span>
      </div>
      <div class="user-details">
        ${
          managerName
            ? `<span>Manager: <strong>${managerName}</strong></span>`
            : '<span>No Manager Assigned</span>'
        }
      </div>
    </div>
  `;
      }
    )
    .join("");
}
