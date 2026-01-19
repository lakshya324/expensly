import { exchangeRateStream } from "../communication/connect";
import { DEPARTMENTS } from "../config/env.config";
import { BudgetLocal, UserPreferenceLocal } from "../storage/local";
import { CURRENCY } from "../utils/currency";
import { AppState } from "./state";

//Todo: add auto budget calculation feat based on prev expenses
//TODO: Improve overall logic... so that it got auto update on expense status change
class BudgetTracker {
  constructor() {
    this.budgetMap = new Map();
  }

  initialize() {
    const budgetData = BudgetLocal.get();
    
    if (!budgetData) {
      const defaultBudgets = {
        [DEPARTMENTS[0]]: {
          allocated: 50000,
          spent: 0,
          remaining: 50000,
          currency: CURRENCY[0],
        },
        [DEPARTMENTS[1]]: {
          allocated: 120000,
          spent: 0,
          remaining: 120000,
          currency: CURRENCY[0],
        },
        [DEPARTMENTS[2]]: {
          allocated: 75000,
          spent: 0,
          remaining: 75000,
          currency: CURRENCY[0],
        },
        [DEPARTMENTS[3]]: {
          allocated: 30000,
          spent: 0,
          remaining: 30000,
          currency: CURRENCY[0],
        },
        [DEPARTMENTS[4]]: {
          allocated: 40000,
          spent: 0,
          remaining: 40000,
          currency: CURRENCY[0],
        },
        [DEPARTMENTS[5]]: {
          allocated: 90000,
          spent: 0,
          remaining: 90000,
          currency: CURRENCY[0],
        },
      };
      BudgetLocal.set(defaultBudgets);
      this.budgetMap = new Map(Object.entries(defaultBudgets));
    } else {
      this.budgetMap = new Map(Object.entries(budgetData));
    }
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
            userCurrency
          ),
          spent: exchangeRateStream.convert(
            budget.spent,
            CURRENCY[0],
            userCurrency
          ),
          remaining: exchangeRateStream.convert(
            budget.remaining,
            CURRENCY[0],
            userCurrency
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
    budget.spent +=
      userCurrency !== CURRENCY[0]
        ? exchangeRateStream.convert(amount, userCurrency, CURRENCY[0])
        : amount;
    budget.remaining = budget.allocated - budget.spent;

    this.budgetMap.set(user.department, budget);
    BudgetLocal.set(Object.fromEntries(this.budgetMap));

    console.log(
      `${user.department}: Spent ${amount}, Remaining: ${budget.remaining}`
    );
    return true;
  }

  removeExpense(department, amount) {
    const userCurrency = UserPreferenceLocal.getCurrency();
    if (!this.budgetMap.has(department)) {
      return false;
    }
    const usdAmount = userCurrency !== CURRENCY[0]
      ? exchangeRateStream.convert(amount, userCurrency, CURRENCY[0])
      : amount;

    const budget = this.budgetMap.get(department);
    budget.spent = Math.max(0, budget.spent - usdAmount);
    budget.remaining = budget.allocated - budget.spent;

    this.budgetMap.set(department, budget);
    BudgetLocal.set(Object.fromEntries(this.budgetMap));
    return true;
  }

  getAllDepartments() {
    return Array.from(this.budgetMap.keys());
  }

  getAllBudgets() {
    const userCurrency = UserPreferenceLocal.getCurrency();
    const budgets = [];
    this.budgetMap.forEach((budget, department) => {
      budgets.push({
        department,
        allocated: userCurrency !== CURRENCY[0]
          ? exchangeRateStream.convert(budget.allocated, CURRENCY[0], userCurrency)
          : budget.allocated,
        spent: userCurrency !== CURRENCY[0]
          ? exchangeRateStream.convert(budget.spent, CURRENCY[0], userCurrency)
          : budget.spent,
        remaining: userCurrency !== CURRENCY[0]
          ? exchangeRateStream.convert(budget.remaining, CURRENCY[0], userCurrency)
          : budget.remaining,
        currency: userCurrency,
        percentUsed: ((budget.spent / budget.allocated) * 100).toFixed(1),
      });
    });
    return budgets;
  }
}

export const budgetTracker = new BudgetTracker();