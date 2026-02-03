import { FormDraftSession } from "../../storage/session.js";
import { renderAvailableTags, renderBudgetGrid } from "./common.component.js";
import { getExpenseFormData, populateExpenseForm } from "./form.js";
import { handleReceiptFile } from "../../utils/receipt.js";
import { handleTicketFormSubmit } from "../../utils/ticket.js";
import { setupExpenseValidation, clearExpenseValidation } from "../../utils/expenseValidation.js";

export async function renderUserLeftPanel() {

  const form = document.getElementById("expense-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("receipt-file");
  const clearDraftBtn = document.getElementById("btn-clear-draft");

  // Setup validation
  setupExpenseValidation();

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
      clearExpenseValidation();
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
