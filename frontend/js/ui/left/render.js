import { AppState } from "../../data/state.js";
import { setupAdminAddUserForm, setupExpenseForm } from "../../utils/forms.js";

export async function renderLeftPanelUI() {
  const adminPanel = document.getElementById("adminPanel");
  const expensePanel = document.getElementById("expensePanel");

  const isAdmin = AppState.currentUser?.isAdmin;
  if (isAdmin) {
    // Show admin panel
    adminPanel.style.display = "block";
    expensePanel.style.display = "none";

    setupAdminAddUserForm();
  } else {
    // Show expense submission panel
    adminPanel.style.display = "none";
    expensePanel.style.display = "block";

    await setupExpenseForm();
  }
}