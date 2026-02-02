import { API_BASE } from "./config/env.config.js";
import { AppState } from "./data/state.js";
import { UserStore } from "./models/user.store.js";

/**
 * Setup the admin users page with all event handlers
 */
export async function setupAdminUsersPage() {
  const addUserForm = document.getElementById("add-user-form");
  const departmentSelect = document.getElementById("user-department");
  const managerSelect = document.getElementById("user-manager");

  // Initial render
  await renderUsersTable();

  // Dynamic manager dropdown based on dept
  departmentSelect.addEventListener("change", async () => {
    const selectedDept = departmentSelect.value;

    if (!selectedDept) {
      managerSelect.innerHTML =
        '<option value="">Select department first</option>';
      return;
    }

    const departmentUsers = await UserStore.getUsersByDepartment(selectedDept);
    managerSelect.innerHTML =
      '<option value="">No Manager</option>' +
      departmentUsers
        .map((u) => `<option value="${u.id}">${u.name}</option>`)
        .join("");
  });

  // Add user form submission
  addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userData = {
      name: document.getElementById("user-name").value.trim(),
      email: document.getElementById("user-email").value.trim(),
      password: document.getElementById("user-password").value,
      department: document.getElementById("user-department").value,
      managerId: document.getElementById("user-manager").value || null,
      isAdmin: false,
    };

    try {
      const newUser = await UserStore.createUser(userData);
      AppState.users.push(newUser);
      await renderUsersTable();
      addUserForm.reset();

      alert(`User ${newUser.name} created successfully!`);

      // Sync with backend
      await fetch(API_BASE + "/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
    } catch (error) {
      console.error("Failed to create user:", error);
      alert("Failed to create user: " + error.message);
    }
  });

  // Setup edit modal
  await setupEditUserModal();
}

/**
 * Render the users table with all users
 */
export async function renderUsersTable() {
  const tableBody = document.getElementById("usersTableBody");
  const users = await UserStore.getAllUsers();

  if (users.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No users yet. Add your first user above.</td></tr>';
    return;
  }

  // Create a map for quick manager lookup
  const userMap = {};
  users.forEach((user) => {
    userMap[user.id] = user.name;
  });

  tableBody.innerHTML = users
    .map((user) => {
      const managerName = user.managerId
        ? userMap[user.managerId] || "Unknown"
        : "-";

      return `
        <tr data-user-id="${user.id}">
          <td>
            <div class="user-name-cell">
              ${user.name}
              ${user.isAdmin ? '<span class="admin-badge">Admin</span>' : ""}
            </div>
          </td>
          <td>${user.email}</td>
          <td><span class="dept-badge">${user.department}</span></td>
          <td>${managerName}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" data-user-id="${user.id}">Edit</button>
              <button class="btn-delete" data-user-id="${user.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach event listeners to action buttons
  attachActionButtonListeners();
}

/**
 * Attach event listeners to edit and delete buttons
 */
function attachActionButtonListeners() {
  // Edit buttons
  const editButtons = document.querySelectorAll(".btn-edit");
  editButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");
      await openEditModal(userId);
    });
  });

  // Delete buttons
  const deleteButtons = document.querySelectorAll(".btn-delete");
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");
      await deleteUser(userId);
    });
  });
}

/**
 * Open edit modal for a specific user
 */
async function openEditModal(userId) {
  const user = await UserStore.getUserById(userId);
  if (!user) {
    alert("User not found");
    return;
  }

  // Populate form
  document.getElementById("edit-user-id").value = user.id;
  document.getElementById("edit-user-name").value = user.name;
  document.getElementById("edit-user-email").value = user.email;
  document.getElementById("edit-user-department").value = user.department;

  // Populate manager dropdown
  const departmentUsers = await UserStore.getUsersByDepartment(user.department);
  const editManagerSelect = document.getElementById("edit-user-manager");
  editManagerSelect.innerHTML =
    '<option value="">No Manager</option>' +
    departmentUsers
      .filter((u) => u.id !== user.id) // Don't show self as manager
      .map((u) => `<option value="${u.id}">${u.name}</option>`)
      .join("");
  editManagerSelect.value = user.managerId || "";

  // Show modal
  document.getElementById("editUserModal").style.display = "flex";
}

/**
 * Setup edit user modal handlers
 */
export async function setupEditUserModal() {
  const modal = document.getElementById("editUserModal");
  const editForm = document.getElementById("edit-user-form");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const editDepartmentSelect = document.getElementById("edit-user-department");
  const editManagerSelect = document.getElementById("edit-user-manager");

  // Dynamic manager dropdown when department changes
  editDepartmentSelect.addEventListener("change", async () => {
    const selectedDept = editDepartmentSelect.value;
    const currentUserId = document.getElementById("edit-user-id").value;

    if (!selectedDept) {
      editManagerSelect.innerHTML =
        '<option value="">Select department first</option>';
      return;
    }

    const departmentUsers = await UserStore.getUsersByDepartment(selectedDept);
    editManagerSelect.innerHTML =
      '<option value="">No Manager</option>' +
      departmentUsers
        .filter((u) => u.id !== currentUserId)
        .map((u) => `<option value="${u.id}">${u.name}</option>`)
        .join("");
  });

  // Cancel button
  cancelBtn.addEventListener("click", () => {
    modal.style.display = "none";
    editForm.reset();
  });

  // Close modal when clicking outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      editForm.reset();
    }
  });

  // Form submission
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = document.getElementById("edit-user-id").value;
    const updatedData = {
      name: document.getElementById("edit-user-name").value.trim(),
      email: document.getElementById("edit-user-email").value.trim(),
      department: document.getElementById("edit-user-department").value,
      managerId: document.getElementById("edit-user-manager").value || null,
    };

    try {
      await UserStore.updateUser(updatedData, userId);

      // Update in AppState
      const userIndex = AppState.users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        AppState.users[userIndex] = {
          ...AppState.users[userIndex],
          ...updatedData,
        };
      }

      await renderUsersTable();
      modal.style.display = "none";
      editForm.reset();

      //   alert("User updated successfully!");

      // Sync with backend
      await fetch(API_BASE + `/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      alert("Failed to update user: " + error.message);
    }
  });
}

/**
 * Delete a user
 */
async function deleteUser(userId) {
  const user = await UserStore.getUserById(userId);
  if (!user) {
    alert("User not found");
    return;
  }

  if (user.isAdmin) {
    alert("Cannot delete admin users");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
    )
  ) {
    return;
  }

  try {
    await UserStore.deleteUser(userId);

    // Remove from AppState
    AppState.users = AppState.users.filter((u) => u.id !== userId);

    await renderUsersTable();
    alert("User deleted successfully!");

    // Sync with backend
    await fetch(API_BASE + `/users/${userId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    alert("Failed to delete user: " + error.message);
  }
}
