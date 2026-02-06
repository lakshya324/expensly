import { budgetTracker } from "../data/budget.js";
import { AppState } from "../data/state.js";
import { formatCurrency } from "./currency.js";

/**
 * Setup real-time validation for expense form fields
 */
export function setupExpenseValidation() {
  const titleField = document.getElementById("expense-title");
  const amountField = document.getElementById("expense-amount");
  const descField = document.getElementById("expense-desc");

  // Title validation
  titleField.addEventListener("input", () => validateTitle());
  titleField.addEventListener("blur", () => validateTitle());

  // Amount validation
  amountField.addEventListener("input", () => validateAmount());
  amountField.addEventListener("blur", () => validateAmount());

  // Description validation
  descField.addEventListener("input", () => validateDescription());
  descField.addEventListener("blur", () => validateDescription());

  // Tags validation is handled by TagInputComponent
}

/**
 * Validate title field
 */
export function validateTitle() {
  const titleField = document.getElementById("expense-title");
  const errorElement = document.getElementById("expense-title-error");
  const value = titleField.value.trim();

  if (!value) {
    showError(titleField, errorElement, "Title is required");
    return false;
  }

  if (value.length < 3) {
    showError(titleField, errorElement, "Title must be at least 3 characters");
    return false;
  }

  if (value.length > 100) {
    showError(titleField, errorElement, "Title must not exceed 100 characters");
    return false;
  }

  showSuccess(titleField, errorElement);
  return true;
}

/**
 * Validate amount field
 */
export function validateAmount() {
  const amountField = document.getElementById("expense-amount");
  const errorElement = document.getElementById("expense-amount-error");
  const value = amountField.value;

  if (!value) {
    showError(amountField, errorElement, "Amount is required");
    return false;
  }

  const amount = parseFloat(value);

  if (isNaN(amount)) {
    showError(amountField, errorElement, "Amount must be a valid number");
    return false;
  }

  if (amount <= 0) {
    showError(amountField, errorElement, "Amount must be greater than 0");
    return false;
  }

  // Check against remaining budget
  if (AppState.currentUser && AppState.currentUser.department) {
    const budget = budgetTracker.getBudget(AppState.currentUser.department);
    if (budget && amount > budget.remaining) {
      const formattedRemaining = formatCurrency(budget.remaining, budget.currency);
      showError(amountField, errorElement, `Amount cannot exceed remaining budget: ${formattedRemaining}`);
      return false;
    }
  } else if (amount > 1_000_000) {
    // Fallback to hard limit if no user/department context
    showError(amountField, errorElement, "Amount must not exceed 1,000,000");
    return false;
  }

  // Check decimal places
  const decimalPlaces = (value.split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    showError(amountField, errorElement, "Amount can have at most 2 decimal places");
    return false;
  }

  showSuccess(amountField, errorElement);
  return true;
}

/**
 * Validate description field
 */
export function validateDescription() {
  const descField = document.getElementById("expense-desc");
  const errorElement = document.getElementById("expense-desc-error");
  const value = descField.value.trim();

  if (!value) {
    showError(descField, errorElement, "Description is required");
    return false;
  }

  if (value.length < 10) {
    showError(descField, errorElement, "Description must be at least 10 characters");
    return false;
  }

  if (value.length > 500) {
    showError(descField, errorElement, "Description must not exceed 500 characters");
    return false;
  }

  showSuccess(descField, errorElement);
  return true;
}

// Note: validateTags removed - tags validation is now handled by TagInputComponent

/**
 * Validate entire expense form
 */
export function validateExpenseForm() {
  const isTitleValid = validateTitle();
  const isAmountValid = validateAmount();
  const isDescValid = validateDescription();
  // Tags validation handled by TagInputComponent

  return isTitleValid && isAmountValid && isDescValid;
}

/**
 * Show validation error
 */
function showError(field, errorElement, message) {
  field.classList.remove("valid");
  field.classList.add("invalid");
  errorElement.textContent = message;
}

/**
 * Show validation success
 */
function showSuccess(field, errorElement) {
  field.classList.remove("invalid");
  field.classList.add("valid");
  errorElement.textContent = "";
}

/**
 * Clear field validation state
 */
function clearFieldValidation(field, errorElement) {
  field.classList.remove("invalid", "valid");
  errorElement.textContent = "";
}

/**
 * Clear all validation states
 */
export function clearExpenseValidation() {
  const fields = [
    { field: "expense-title", error: "expense-title-error" },
    { field: "expense-amount", error: "expense-amount-error" },
    { field: "expense-desc", error: "expense-desc-error" }
  ];

  fields.forEach(({ field, error }) => {
    const fieldElement = document.getElementById(field);
    const errorElement = document.getElementById(error);
    if (fieldElement && errorElement) {
      clearFieldValidation(fieldElement, errorElement);
    }
  });
}
