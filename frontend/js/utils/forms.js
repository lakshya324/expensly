import { API_BASE } from "../config/env.config";
import { AppState } from "../data/state";
import { UserStore } from "../models/user.store";
import { FormDraftSession } from "../storage/session";
import { getAdminAddUserFormData, getExpenseFormData } from "../ui/form";
import { renderUsersListForAdmin } from "../ui/left.render";
import { handleReceiptFile } from "./receipt";

export function setupExpenseForm() {
  const form = document.getElementById("expense-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("receipt-file");
  const clearDraftBtn = document.getElementById("btn-clear-draft");

  form.addEventListener("submit", handleFormSubmit);

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
}

export function setupAdminAddUserForm() {
  const addUserForm = document.getElementById("add-user-form");
  const departmentSelect = document.getElementById("user-department");
  const managerSelect = document.getElementById("user-manager");

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
      renderUsersListForAdmin();
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
