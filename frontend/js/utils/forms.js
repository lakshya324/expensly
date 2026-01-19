import { FormDraftSession } from "../storage/session";
import { getExpenseFormData } from "../ui/form";
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
      if (formData.title || formData.amount || formData.description || formData.tags) {
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