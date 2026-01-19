import { LOCAL_KEYS } from "../config/env.config.js";

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