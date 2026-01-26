import { API_BASE } from "../config/env.config.js";
import { AppState } from "../data/state.js";
import { UserStore } from "../models/user.store.js";
import { FormDraftSession } from "../storage/session.js";
import {
  getAdminAddUserFormData,
  getExpenseFormData,
  populateExpenseForm,
} from "../ui/left/form.js";
import { renderUsersListForAdmin } from "../ui/left/admin.component.js";
import { renderAvailableTags, renderBudgetGrid } from "../ui/left/user.component.js";
import { handleReceiptFile } from "./receipt.js";
import { handleTicketFormSubmit } from "./ticket.js";

export async function setupExpenseForm() {

  const form = document.getElementById("expense-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("receipt-file");
  const clearDraftBtn = document.getElementById("btn-clear-draft");

  // load draft if exists
  if (FormDraftSession.hasDraft()) {
    const draft = FormDraftSession.loadDraft();
    populateExpenseForm(draft);
    console.log("Draft loaded:", draft);
  }

  form.addEventListener("submit", handleTicketFormSubmit);

  // autosave draft (debounced)
  let draftTimeout;
  form.addEventListener("input", () => {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
      const formData = getExpenseFormData();
      if (
        formData.title ||
        formData.amount ||
        formData.description ||
        formData.tags
      ) {
        FormDraftSession.saveDraft(formData);
      }
    }, 500);
  });

  // clear draft
  clearDraftBtn.addEventListener("click", () => {
    if (confirm("Clear draft expense?")) {
      form.reset();
      FormDraftSession.clearDraft();
      AppState.currentReceiptFile = null;
      AppState.currentReceiptUrl = null;
      document.getElementById("receipt-preview").innerHTML = "";
      console.log("Draft cleared");
    }
  });

  // receipt drop zone
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      handleReceiptFile(file);
    }
  });

  await renderBudgetGrid();
  renderAvailableTags();
}

export async function setupAdminAddUserForm() {
  //Todo: add draft feature
  const addUserForm = document.getElementById("add-user-form");
  const departmentSelect = document.getElementById("user-department");
  const managerSelect = document.getElementById("user-manager");
  await renderUsersListForAdmin();

  // dynamic manager dropdown based on dept
  departmentSelect.addEventListener("change", async () => {
    const selectedDept = departmentSelect.value;

    if (!selectedDept) {
      managerSelect.innerHTML =
        '<option value="">Select department first</option>';
    }

    const departmentUsers = await UserStore.getUsersByDepartment(selectedDept);
    managerSelect.innerHTML =
      '<option value="">No Manager</option>' +
      departmentUsers
        .map((u) => `<option value="${u.id}">${u.name}</option>`)
        .join("");
  });

  addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userData = getAdminAddUserFormData();

    try {
      const newUser = await UserStore.createUser(userData);
      AppState.users.push(newUser);
      await renderUsersListForAdmin();
      addUserForm.reset();

      // Show success message
      alert(`User ${newUser.name} created successfully!`);

      await fetch(API_BASE + "/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
    } catch (error) {
      console.error("Failed to create user:", error);
      alert("Failed to create user: " + error.message);
    }
  });
}
