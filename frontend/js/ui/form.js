export function getExpenseFormData() {
  return {
    title: document.getElementById("expense-title").value,
    amount: parseFloat(document.getElementById("expense-amount").value) || 0,
    // department: document.getElementById("expense-dept").value,
    description: document.getElementById("expense-desc").value,
    tags: document.getElementById("expense-tags").value,
  };
}

export function clearExpenseForm() {
  document.getElementById("expense-title").value = "";
  document.getElementById("expense-amount").value = "";
  // document.getElementById("expense-dept").value = "";
  document.getElementById("expense-desc").value = "";
  document.getElementById("expense-tags").value = "";
}

export function populateExpenseForm(data) {
  document.getElementById("expense-title").value = data.title || "";
  document.getElementById("expense-amount").value = data.amount || "";
  // document.getElementById("expense-dept").value = data.department || "";
  document.getElementById("expense-desc").value = data.description || "";
  document.getElementById("expense-tags").value = data.tags || "";
}