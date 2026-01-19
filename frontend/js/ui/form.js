export function getExpenseFormData() {
  return {
    title: document.getElementById("expense-title").value,
    amount: parseFloat(document.getElementById("expense-amount").value) || 0,
    // department: document.getElementById("expense-dept").value,
    description: document.getElementById("expense-desc").value,
    tags: document.getElementById("expense-tags").value,
  };
}

export function populateExpenseForm(data) {
  document.getElementById("expense-title").value = data.title || "";
  document.getElementById("expense-amount").value = data.amount || "";
  // document.getElementById("expense-dept").value = data.department || "";
  document.getElementById("expense-desc").value = data.description || "";
  document.getElementById("expense-tags").value = data.tags || "";
}

export function getAdminAddUserFormData() {
  return {
    name: document.getElementById("user-name").value,
    email: document.getElementById("user-email").value,
    password: document.getElementById("user-password").value,
    department: document.getElementById("user-department").value,
    managerId: document.getElementById("user-manager").value || null,
  };
}

export function populateAdminAddUserForm(data) {
  document.getElementById("user-name").value = data.name || "";
  document.getElementById("user-email").value = data.email || "";
  document.getElementById("user-password").value = data.password || "";
  document.getElementById("user-department").value = data.department || "";
  document.getElementById("user-manager").value = data.managerId || "";
}