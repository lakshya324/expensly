import { API_BASE } from "./config/env.config.js";
import { AppState } from "./data/state.js";
import { UserStore } from "./models/user.store.js";
import { UserSession } from "./storage/session.js";
import { CURRENCY, getCurrencyApprovalThreshold, getCurrencySymbol } from "./utils/currency.js";
import { OrganizationStore } from "./models/organization.store.js";

// Track if we're in edit mode
let isEditMode = false;
let editingUserId = null;

/**
 * Setup the admin users page with all event handlers
 */
export async function setupAdminUsersPage() {
  const addUserForm = document.getElementById("add-user-form");
  const departmentSelect = document.getElementById("user-department");
  const managerSelect = document.getElementById("user-manager");
  const resetBtn = document.getElementById("form-reset-btn");

  // Populate department dropdown from session
  populateDepartmentDropdown();

  // Initial render
  await renderUsersTable();

  // Setup real-time validation
  setupValidation();

  // Reset button handler
  resetBtn.addEventListener("click", () => {
    resetForm();
  });

  // Dynamic manager dropdown based on dept
  departmentSelect.addEventListener("change", async () => {
    const selectedDept = departmentSelect.value;

    if (!selectedDept) {
      managerSelect.innerHTML =
        '<option value="">Select department first</option>';
      updateApprovalIndicator();
      return;
    }

    const departmentUsers = await UserStore.getUsersByDepartment(selectedDept);
    managerSelect.innerHTML =
      '<option value="">No Manager</option>' +
      departmentUsers
        .filter((u) => !isEditMode || u.id !== editingUserId) // Don't show self as manager when editing
        .map((u) => `<option value="${u.id}">${u.name}</option>`)
        .join("");
    
    updateApprovalIndicator();
  });

  // Update approval indicator when manager selection changes
  managerSelect.addEventListener("change", () => {
    updateApprovalIndicator();
  });

  // Add/Edit user form submission
  addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate all fields before submission
    if (!validateForm()) {
      return;
    }

    if (isEditMode) {
      await handleEditUser();
    } else {
      await handleAddUser();
    }
  });
}

/**
 * Update the approval indicator based on manager selection
 */
async function updateApprovalIndicator() {
  const indicator = document.getElementById("approval-indicator");
  const managerSelect = document.getElementById("user-manager");
  const selectedManagerId = managerSelect.value;

  if (!indicator) return;

  // Build threshold text for all currencies
  const currencyThresholds = CURRENCY.map(currency => {
    const threshold = getCurrencyApprovalThreshold(currency);
    const symbol = getCurrencySymbol(currency);
    return `<strong>${symbol}${threshold.toLocaleString()}</strong> (${currency})`;
  }).join(" or ");

  if (selectedManagerId) {
    // Manager is selected
    const selectedOption = managerSelect.options[managerSelect.selectedIndex];
    const managerName = selectedOption.text;
    
    indicator.innerHTML = `
      <div class="approval-info with-manager">
        <svg class="approval-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <div>
          <strong>${managerName}'s approval</strong> will be required for expenses exceeding ${currencyThresholds}
        </div>
      </div>
    `;
  } else {
    // No manager selected
    indicator.innerHTML = `
      <div class="approval-info auto-approve">
        <svg class="approval-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div>
          Manager approval required for expenses above ${currencyThresholds}, but will be <strong>auto-approved</strong> due to no assigned manager
        </div>
      </div>
    `;
  }
}

/**
 * Handle adding a new user
 */
async function handleAddUser() {
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
    resetForm();

    alert(`User ${newUser.name} created successfully!`);

    // Sync with backend
    await fetch(API_BASE + "/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    alert("Failed to create user: " + error.message);
  }
}

/**
 * Handle editing an existing user
 */
async function handleEditUser() {
  const passwordValue = document.getElementById("user-password").value;
  const updatedData = {
    id: editingUserId, // Include the user ID
    name: document.getElementById("user-name").value.trim(),
    email: document.getElementById("user-email").value.trim(),
    department: document.getElementById("user-department").value,
    managerId: document.getElementById("user-manager").value || null,
  };
  
  // Only include password if it was provided
  if (passwordValue && passwordValue.trim()) {
    updatedData.password = passwordValue;
  }

  try {
    await UserStore.updateUser(updatedData, editingUserId);

    // Update in AppState
    const userIndex = AppState.users.findIndex((u) => u.id === editingUserId);
    if (userIndex !== -1) {
      AppState.users[userIndex] = {
        ...AppState.users[userIndex],
        ...updatedData,
      };
    }

    await renderUsersTable();
    resetForm();

    alert("User updated successfully!");

    // Sync with backend
    await fetch(API_BASE + `/admin/users/${updatedData.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    alert("Failed to update user: " + error.message);
  }
}

/**
 * Reset the form to add mode
 */
function resetForm() {
  const form = document.getElementById("add-user-form");
  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const emailField = document.getElementById("user-email");
  const passwordField = document.getElementById("user-password");

  form.reset();
  isEditMode = false;
  editingUserId = null;

  formTitle.textContent = "Add New User";
  submitBtn.textContent = "Add User";
  emailField.disabled = false;
  passwordField.required = true;
  passwordField.placeholder = "Enter password";

  // Clear all validation states
  clearValidation();
  
  // Clear approval indicator
  const indicator = document.getElementById("approval-indicator");
  if (indicator) {
    indicator.innerHTML = "";
  }
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
        <tr data-user-id="${user.id}" ${user.isDisabled ? 'style="opacity: 0.6;"' : ''}>
          <td>
            <div class="user-name-cell">
              ${user.name}
              ${user.isAdmin ? '<span class="admin-badge">Admin</span>' : ""}
              ${user.isDisabled ? '<span class="disabled-badge">Disabled</span>' : ''}
            </div>
          </td>
          <td>${user.email}</td>
          <td><span class="dept-badge">${user.department}</span></td>
          <td>${managerName}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" data-user-id="${user.id}" ${user.isDisabled ? 'disabled' : ''}>Edit</button>
              <button class="btn-toggle-disable" data-user-id="${user.id}">${user.isDisabled ? 'Enable' : 'Disable'}</button>
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
      await loadUserForEdit(userId);
    });
  });

  // Toggle disable buttons
  const toggleDisableButtons = document.querySelectorAll(".btn-toggle-disable");
  toggleDisableButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");
      await toggleDisableUser(userId);
    });
  });
}

/**
 * Load user data into the form for editing
 */
async function loadUserForEdit(userId) {
  const user = await UserStore.getUserById(userId);
  if (!user) {
    alert("User not found");
    return;
  }

  // Set edit mode
  isEditMode = true;
  editingUserId = userId;

  // Update UI
  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const emailField = document.getElementById("user-email");
  const passwordField = document.getElementById("user-password");

  formTitle.textContent = "Edit User";
  submitBtn.textContent = "Update User";
  
  // Populate form
  document.getElementById("user-name").value = user.name;
  document.getElementById("user-email").value = user.email;
  emailField.disabled = true; // Email can't be changed
  
  // Make password optional when editing
  passwordField.required = false;
  passwordField.value = "";
  passwordField.placeholder = "Leave blank to keep current password";
  
  document.getElementById("user-department").value = user.department;

  // Populate manager dropdown
  const departmentUsers = await UserStore.getUsersByDepartment(user.department);
  const managerSelect = document.getElementById("user-manager");
  managerSelect.innerHTML =
    '<option value="">No Manager</option>' +
    departmentUsers
      .filter((u) => u.id !== user.id) // Don't show self as manager
      .map((u) => `<option value="${u.id}">${u.name}</option>`)
      .join("");
  managerSelect.value = user.managerId || "";

  // Update approval indicator
  updateApprovalIndicator();

  // Scroll to form
  document.querySelector(".user-mgmt-section").scrollIntoView({ behavior: "smooth" });
}

/**
 * Toggle disable/enable a user
 */
async function toggleDisableUser(userId) {
  const user = await UserStore.getUserById(userId);
  if (!user) {
    alert("User not found");
    return;
  }

  if (user.isAdmin) {
    alert("Cannot disable admin users");
    return;
  }

  const action = user.isDisabled ? "enable" : "disable";
  if (
    !confirm(
      `Are you sure you want to ${action} ${user.name}?`,
    )
  ) {
    return;
  }

  try {
    const updatedUser = await UserStore.toggleDisableUser(userId);

    // Update in AppState
    const userIndex = AppState.users.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      AppState.users[userIndex] = updatedUser;
    }

    await renderUsersTable();
    alert(`User ${action}d successfully!`);

    // Sync with backend 
    await fetch(API_BASE + `/admin/users/${userId}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDisabled: updatedUser.isDisabled }),
    });
  } catch (error) {
    console.error(`Failed to ${action} user:`, error);
    alert(`Failed to ${action} user: ` + error.message);
  }
}

/**
 * Setup real-time validation for form fields
 */
function setupValidation() {
  const nameField = document.getElementById("user-name");
  const emailField = document.getElementById("user-email");
  const passwordField = document.getElementById("user-password");
  const departmentField = document.getElementById("user-department");

  // Name validation
  nameField.addEventListener("input", () => validateName());
  nameField.addEventListener("blur", () => validateName());

  // Email validation
  emailField.addEventListener("input", () => validateEmail());
  emailField.addEventListener("blur", () => validateEmail());

  // Password validation
  passwordField.addEventListener("input", () => validatePassword());
  passwordField.addEventListener("blur", () => validatePassword());

  // Department validation
  departmentField.addEventListener("change", () => validateDepartment());
  departmentField.addEventListener("blur", () => validateDepartment());
}

/**
 * Validate name field
 */
function validateName() {
  const nameField = document.getElementById("user-name");
  const errorElement = document.getElementById("user-name-error");
  const value = nameField.value.trim();

  if (!value) {
    showError(nameField, errorElement, "Name is required");
    return false;
  }

  if (value.length < 2) {
    showError(nameField, errorElement, "Name must be at least 2 characters");
    return false;
  }

  if (value.length > 50) {
    showError(nameField, errorElement, "Name must not exceed 50 characters");
    return false;
  }

  if (!/^[a-zA-Z\s.'-]+$/.test(value)) {
    showError(nameField, errorElement, "Name can only contain letters, spaces, and . ' -");
    return false;
  }

  showSuccess(nameField, errorElement);
  return true;
}

/**
 * Validate email field
 */
function validateEmail() {
  const emailField = document.getElementById("user-email");
  const errorElement = document.getElementById("user-email-error");
  const value = emailField.value.trim();

  if (!value) {
    showError(emailField, errorElement, "Email is required");
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    showError(emailField, errorElement, "Please enter a valid email address");
    return false;
  }

  if (value.length > 100) {
    showError(emailField, errorElement, "Email must not exceed 100 characters");
    return false;
  }

  showSuccess(emailField, errorElement);
  return true;
}

/**
 * Validate password field
 */
function validatePassword() {
  const passwordField = document.getElementById("user-password");
  const errorElement = document.getElementById("user-password-error");
  const value = passwordField.value;

  // Skip validation if editing and password is optional
  if (isEditMode && !value) {
    clearFieldValidation(passwordField, errorElement);
    return true;
  }

  if (!value && !isEditMode) {
    showError(passwordField, errorElement, "Password is required");
    return false;
  }

  if (value && value.length < 6) {
    showError(passwordField, errorElement, "Password must be at least 6 characters");
    return false;
  }

  if (value && value.length > 50) {
    showError(passwordField, errorElement, "Password must not exceed 50 characters");
    return false;
  }

  if (value) {
    showSuccess(passwordField, errorElement);
  } else {
    clearFieldValidation(passwordField, errorElement);
  }
  return true;
}

/**
 * Validate department field
 */
function validateDepartment() {
  const departmentField = document.getElementById("user-department");
  const errorElement = document.getElementById("user-department-error");
  const value = departmentField.value;

  if (!value) {
    showError(departmentField, errorElement, "Please select a department");
    return false;
  }

  showSuccess(departmentField, errorElement);
  return true;
}

/**
 * Validate entire form
 */
function validateForm() {
  const isNameValid = validateName();
  const isEmailValid = validateEmail();
  const isPasswordValid = validatePassword();
  const isDepartmentValid = validateDepartment();

  return isNameValid && isEmailValid && isPasswordValid && isDepartmentValid;
}

/**
 * Show validation error
 */
function showError(field, errorElement, message) {
  field.classList.remove("valid");
  field.classList.add("invalid");
  errorElement.textContent = message;
}

/**
 * Show validation success
 */
function showSuccess(field, errorElement) {
  field.classList.remove("invalid");
  field.classList.add("valid");
  errorElement.textContent = "";
}

/**
 * Clear field validation state
 */
function clearFieldValidation(field, errorElement) {
  field.classList.remove("invalid", "valid");
  errorElement.textContent = "";
}

/**
 * Clear all validation states
 */
function clearValidation() {
  const fields = [
    { field: "user-name", error: "user-name-error" },
    { field: "user-email", error: "user-email-error" },
    { field: "user-password", error: "user-password-error" },
    { field: "user-department", error: "user-department-error" }
  ];

  fields.forEach(({ field, error }) => {
    const fieldElement = document.getElementById(field);
    const errorElement = document.getElementById(error);
    if (fieldElement && errorElement) {
      clearFieldValidation(fieldElement, errorElement);
    }
  });
}

/**
 * Populate department dropdown from session org data
 */
function populateDepartmentDropdown() {
  const departmentSelect = document.getElementById("user-department");
  const session = UserSession.get();
  
  if (!session || !session.orgDepartments) {
    console.warn("No departments found in session");
    return;
  }

  // Clear existing options except the first one
  departmentSelect.innerHTML = '<option value="">Select Department</option>';
  
  // Add departments from org
  session.orgDepartments.forEach(dept => {
    const option = document.createElement("option");
    option.value = dept.name;
    option.textContent = dept.name;
    departmentSelect.appendChild(option);
  });
  
  console.log("Department dropdown populated with:", session.orgDepartments.length, "departments");
}