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

  static setCurrency(currency) {
    if (!CURRENCY.includes(currency)) {
      currency = CURRENCY[0]; // default
    }
    const pref = this.get() || {};
    pref.currency = currency;
    this.set(pref);
  }

  static getCurrency() {
    const pref = this.get();
    if (!pref || !CURRENCY.includes(pref.currency)) {
      this.setCurrency(CURRENCY[0]);
      return CURRENCY[0];
    }
    return pref.currency;
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
