import { exchangeRateStream } from "../communication/connect.js";
import { BudgetLocal, UserPreferenceLocal } from "../storage/local.js";
import { UserSession } from "../storage/session.js";
import { OrganizationStore } from "../models/organization.store.js";
import { CURRENCY } from "../utils/currency.js";
import { AppState } from "./state.js";

//Todo: add auto budget calculation feat based on prev expenses
//TODO: Improve overall logic... so that it got auto update on expense status change
class BudgetTracker {
  constructor() {
    this.budgetMap = new Map();
  }

  async initialize() {
    // Get org departments from session
    const session = UserSession.get();
    if (!session || !session.orgId) {
      console.warn("No session or orgId found, cannot initialize budget");
      return;
    }

    // Fetch departments from org
    const departments = await OrganizationStore.getDepartments(session.orgId);

    if (!departments || departments.length === 0) {
      console.warn("No departments found for organization");
      return;
    }

    // Get stored budget data from localStorage (for spent tracking)
    const storedBudgetData = BudgetLocal.get();

    // Build budget map from org departments
    const budgetData = {};
    departments.forEach((dept) => {
      // Use stored spent amount if exists, otherwise use org's spent amount
      const storedDept = storedBudgetData?.[dept.name];
      const spent = dept.spent ?? storedDept?.spent ?? 0;

      budgetData[dept.name] = {
        allocated: dept.budget,
        spent: spent,
        remaining: dept.budget - spent,
        currency: dept.currency || CURRENCY[0],
      };
    });

    // Save to localStorage and budgetMap
    BudgetLocal.set(budgetData);
    this.budgetMap = new Map(Object.entries(budgetData));

    console.log(
      "Budget initialized with org departments:",
      Array.from(this.budgetMap.keys()),
    );
  }

  async reloadBudgets() {
    // Reload budgets from org (useful when departments change)
    await this.initialize();
  }

  getBudget(department) {
    if (!this.budgetMap.has(department)) {
      console.warn(`Department '${department}' not found in budget map`);
      return null;
    }
    const userCurrency = UserPreferenceLocal.getCurrency();
    const budget = this.budgetMap.get(department);
    return userCurrency !== CURRENCY[0]
      ? {
          ...budget,
          allocated: exchangeRateStream.convert(
            budget.allocated,
            CURRENCY[0],
            userCurrency,
          ),
          spent: exchangeRateStream.convert(
            budget.spent,
            CURRENCY[0],
            userCurrency,
          ),
          remaining: exchangeRateStream.convert(
            budget.remaining,
            CURRENCY[0],
            userCurrency,
          ),
          currency: userCurrency,
        }
      : budget;
  }

  addExpense(amount) {
    const user = AppState.currentUser;
    const userCurrency = UserPreferenceLocal.getCurrency();
    if (!this.budgetMap.has(user.department)) {
      console.warn(`Department '${user.department}' not found in budget map`);
      return false;
    }

    const budget = this.budgetMap.get(user.department);
    const usdAmount =
      userCurrency !== CURRENCY[0]
        ? exchangeRateStream.convert(amount, userCurrency, CURRENCY[0])
        : amount;

    budget.spent += usdAmount;
    budget.remaining = budget.allocated - budget.spent;

    this.budgetMap.set(user.department, budget);
    BudgetLocal.set(Object.fromEntries(this.budgetMap));

    // Update org database
    this.syncSpentToOrg(user.department, usdAmount);

    console.log(
      `${user.department}: Spent ${amount}, Remaining: ${budget.remaining}`,
    );
    return true;
  }

  addExpenseToDepartment(department, amount) {
    const userCurrency = UserPreferenceLocal.getCurrency();
    if (!this.budgetMap.has(department)) {
      console.warn(`Department '${department}' not found in budget map`);
      return false;
    }
    const usdAmount =
      userCurrency !== CURRENCY[0]
        ? exchangeRateStream.convert(amount, userCurrency, CURRENCY[0])
        : amount;

    const budget = this.budgetMap.get(department);
    budget.spent += usdAmount;
    budget.remaining = budget.allocated - budget.spent;

    this.budgetMap.set(department, budget);
    BudgetLocal.set(Object.fromEntries(this.budgetMap));

    // Update org database
      this.syncSpentToOrg(department, usdAmount);

    console.log(
      `${department}: Spent ${amount}, Remaining: ${budget.remaining}`
    );
    return true;
  }

  removeExpense(department, amount) {
    const userCurrency = UserPreferenceLocal.getCurrency();
    if (!this.budgetMap.has(department)) {
      return false;
    }
    const usdAmount =
      userCurrency !== CURRENCY[0]
        ? exchangeRateStream.convert(amount, userCurrency, CURRENCY[0])
        : amount;

    const budget = this.budgetMap.get(department);
    budget.spent = Math.max(0, budget.spent - usdAmount);
    budget.remaining = budget.allocated - budget.spent;

    this.budgetMap.set(department, budget);
    BudgetLocal.set(Object.fromEntries(this.budgetMap));

    // Update org database (negative amount to subtract)
    this.syncSpentToOrg(department, -usdAmount);

    return true;
  }

  async syncSpentToOrg(departmentName, amountChange) {
    // Sync spent amount to org database
    try {
      const session = UserSession.get();
      if (!session || !session.orgId) return;

      await OrganizationStore.updateDepartmentSpent(
        session.orgId,
        departmentName,
        amountChange,
      );
    } catch (error) {
      console.error("Failed to sync budget to org:", error);
    }
  }

  getAllDepartments() {
    return Array.from(this.budgetMap.keys());
  }

  getAllBudgets() {
    const userCurrency = UserPreferenceLocal.getCurrency();
    const budgets = [];
    this.budgetMap.forEach((budget, department) => {
      const storedCurrency = budget.currency || CURRENCY[0];

      // Only convert if stored currency differs from user's currency
      const allocated =
        userCurrency !== storedCurrency
          ? exchangeRateStream.convert(
              budget.allocated,
              storedCurrency,
              userCurrency,
            )
          : budget.allocated;

      const spent =
        userCurrency !== storedCurrency
          ? exchangeRateStream.convert(
              budget.spent,
              storedCurrency,
              userCurrency,
            )
          : budget.spent;

      const remaining =
        userCurrency !== storedCurrency
          ? exchangeRateStream.convert(
              budget.remaining,
              storedCurrency,
              userCurrency,
            )
          : budget.remaining;

      budgets.push({
        department,
        allocated,
        spent,
        remaining,
        currency: userCurrency,
        percentUsed: ((budget.spent / budget.allocated) * 100).toFixed(1),
      });
    });
    return budgets;
  }
}

export const budgetTracker = new BudgetTracker();
