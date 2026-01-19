import { LOCAL_KEYS } from "../config/env.config.js";
import { CURRENCY } from "../utils/currency.js";

export class UserPreferenceLocal {
  static set(preference) {
    localStorage.setItem(LOCAL_KEYS.userPreference, JSON.stringify(preference));
  }

  static get() {
    const info = localStorage.getItem(LOCAL_KEYS.userPreference);
    return info ? JSON.parse(info) : null;
  }

  static clear() {
    localStorage.removeItem(LOCAL_KEYS.userPreference);
  }
}

export class BudgetLocal {
  static set(budgetData) {
    localStorage.setItem(LOCAL_KEYS.budgetData, JSON.stringify(budgetData));
  }

  static get() {
    const data = localStorage.getItem(LOCAL_KEYS.budgetData);
    return data ? JSON.parse(data) : null;
  }

  static clear() {
    localStorage.removeItem(LOCAL_KEYS.budgetData);
  }
}