import { AppState } from "../data/state.js";

export function handleReceiptFile(file) {
  AppState.currentReceiptFile = file;

  // local preview using URL.createObjectURL
  if (AppState.currentReceiptUrl) {
    URL.revokeObjectURL(AppState.currentReceiptUrl);
  }

  AppState.currentReceiptUrl = URL.createObjectURL(file);

  // Show preview
  const preview = document.getElementById("receipt-preview");
  preview.innerHTML = `
    <p>${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
    ${
      file.type.startsWith("image/")
        ? `<img src="${AppState.currentReceiptUrl}" alt="Receipt preview">`
        : ""
    }
  `;

  console.log("Receipt loaded:", file.name);
}