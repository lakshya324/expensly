import { SESSION_KEYS } from "../config/env.config";

export class UserSession {
  static set(userInfo) {
    sessionStorage.setItem(SESSION_KEYS.user, JSON.stringify(userInfo));
    console.log("user session set");
  }

  static get() {
    const info = sessionStorage.getItem(SESSION_KEYS.user);
    return info ? JSON.parse(info) : null;
  }

  static clear() {
    sessionStorage.removeItem(SESSION_KEYS.user);
    console.log("user session cleared");
  }

  static isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEYS.user) !== null;
  }
}

export class FormDraftSession {
  static saveDraft(formData) {
    sessionStorage.setItem(
      SESSION_KEYS.draft,
      JSON.stringify({
        ...formData,
        lastSaved: Date.now(),
      })
    );
    console.log("form draft saved");
  }

  static loadDraft() {
    const draft = sessionStorage.getItem(SESSION_KEYS.draft);
    return draft ? JSON.parse(draft) : null;
  }

  static clearDraft() {
    sessionStorage.removeItem(SESSION_KEYS.draft);
    console.log("form draft cleared");
  }

  static hasDraft() {
    return sessionStorage.getItem(SESSION_KEYS.draft) !== null;
  }
}