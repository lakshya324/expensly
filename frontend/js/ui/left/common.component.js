import { budgetTracker } from "../../data/budget.js";
import { tagManager } from "../../data/tags.js";
import { UserPreferenceLocal } from "../../storage/local.js";
import { getCurrencySymbol } from "../../utils/currency.js";

export async function renderBudgetGrid() {
  const currency = UserPreferenceLocal.getCurrency();
  const currencySymbol = getCurrencySymbol(currency);
  const container = document.getElementById("budget-grid");
  container.innerHTML = "";

  const budgets = budgetTracker.getAllBudgets();

  budgets.forEach((budget) => {
    const item = document.createElement("div");
    item.className = "budget-item";
    item.innerHTML = `
      <div class="budget-header">
        <span class="budget-dept">${budget.department}</span>
        <span class="budget-amount">${currencySymbol}${budget.remaining.toFixed(
          0
        )} / ${currencySymbol}${budget.allocated.toFixed(0)}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-fill" style="width: ${budget.percentUsed}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

export function renderAvailableTags() {
  const container = document.getElementById("available-tags");
  const tags = tagManager.getAllTags();
  container.textContent = tags.join(", ");
}