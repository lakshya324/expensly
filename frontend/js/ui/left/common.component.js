import { budgetTracker } from "../../data/budget.js";
import { tagManager } from "../../data/tags.js";
import { UserPreferenceLocal } from "../../storage/local.js";
import { formatCurrency } from "../../utils/currency.js";

export async function renderBudgetGrid() {
  const currency = UserPreferenceLocal.getCurrency();
  const container = document.getElementById("budget-grid");
  if (!container) return;
  
  container.innerHTML = "";

  const budgets = budgetTracker.getAllBudgets();

  // Use DocumentFragment for batch DOM append
  const fragment = document.createDocumentFragment();
  
  budgets.forEach((budget) => {
    const item = document.createElement("div");
    item.className = "budget-item";
    item.innerHTML = `
      <div class="budget-header">
        <span class="budget-dept">${budget.department.toUpperCase()}</span>
        <span class="budget-amount">${formatCurrency(budget.remaining, currency)} / ${formatCurrency(budget.allocated, currency)}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-fill" style="width: ${budget.percentUsed}%"></div>
      </div>
    `;
    fragment.appendChild(item);
  });
  
  container.appendChild(fragment);
}

export function renderAvailableTags() {
  const container = document.getElementById("available-tags");
  const tags = tagManager.getAllTags();
  container.textContent = tags.join(", ");
}