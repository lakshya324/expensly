import { exchangeRateStream } from "../../communication/connect.js";
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

  const userCurrency = UserPreferenceLocal.getCurrency();

  // Use DocumentFragment for batch DOM append
  const fragment = document.createDocumentFragment();
  
  budgets.forEach((budget) => {
    let remaining = budget.remaining;
    let allocated = budget.allocated;

    // If user's preferred currency is different, convert amounts
    if (budget.currency !== userCurrency) {
      remaining = exchangeRateStream.convert(budget.remaining, budget.currency, userCurrency);
      allocated = exchangeRateStream.convert(budget.allocated, budget.currency, userCurrency);
    }

    const item = document.createElement("div");
    item.className = `budget-item dept-${budget.department.toLowerCase()}`;
    item.innerHTML = `
      <div class="budget-header">
        <span class="budget-dept">${budget.department.toUpperCase()}</span>
        <span class="budget-amount">${formatCurrency(remaining, currency)} / ${formatCurrency(allocated, currency)}</span>
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