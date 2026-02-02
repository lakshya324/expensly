import { AppState } from "../../data/state.js";
import { renderAdminLeftPanel } from "./admin.component.js";
import { renderUserLeftPanel } from "./user.component.js";

export async function renderLeftPanelUI() {
  const adminPanel = document.getElementById("adminPanel");
  const expensePanel = document.getElementById("expensePanel");

  const isAdmin = AppState.currentUser?.isAdmin;
  if (isAdmin) {
    // Show admin panel
    adminPanel.style.display = "block";
    expensePanel.style.display = "none";

    await renderAdminLeftPanel();
  } else {
    // Show expense submission panel
    adminPanel.style.display = "none";
    expensePanel.style.display = "block";

    await renderUserLeftPanel();
  }
}