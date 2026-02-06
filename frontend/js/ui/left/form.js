import { tagInputComponent } from "./tagInput.component.js";

export function getExpenseFormData() {
  return {
    title: document.getElementById("expense-title").value,
    amount: parseFloat(document.getElementById("expense-amount").value) || 0,
    // department: document.getElementById("expense-dept").value,
    description: document.getElementById("expense-desc").value,
    tags: tagInputComponent ? tagInputComponent.getTags() : [],
  };
}

export function clearExpenseForm() {
  document.getElementById("expense-form").reset();
  if (tagInputComponent) {
    tagInputComponent.clear();
  }
}

export function populateExpenseForm(data) {
  document.getElementById("expense-title").value = data.title || "";
  document.getElementById("expense-amount").value = data.amount || "";
  // document.getElementById("expense-dept").value = data.department || "";
  document.getElementById("expense-desc").value = data.description || "";
  if (tagInputComponent) {
    tagInputComponent.setTags(data.tags || []);
  }
}