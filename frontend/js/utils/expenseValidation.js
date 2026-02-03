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
  const tagsField = document.getElementById("expense-tags");

  // Title validation
  titleField.addEventListener("input", () => validateTitle());
  titleField.addEventListener("blur", () => validateTitle());

  // Amount validation
  amountField.addEventListener("input", () => validateAmount());
  amountField.addEventListener("blur", () => validateAmount());

  // Description validation
  descField.addEventListener("input", () => validateDescription());
  descField.addEventListener("blur", () => validateDescription());

  // Tags validation
  tagsField.addEventListener("input", () => validateTags());
  tagsField.addEventListener("blur", () => validateTags());
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

/**
 * Validate tags field (optional but format check if provided)
 */
export function validateTags() {
  const tagsField = document.getElementById("expense-tags");
  const errorElement = document.getElementById("expense-tags-error");
  const value = tagsField.value.trim();

  // Tags are optional
  if (!value) {
    clearFieldValidation(tagsField, errorElement);
    return true;
  }

  // Split by both comma and space, normalize tags
  const tags = value
    .split(/[,\s]+/) // Split by comma or space (one or more)
    .map(tag => tag.trim())
    .filter(tag => tag)
    .map(tag => tag.startsWith('#') ? tag : `#${tag}`); // Add # if missing
  
  // Check tag length (including the #)
  const tooLongTags = tags.filter(tag => tag.length > 30);
  if (tooLongTags.length > 0) {
    showError(tagsField, errorElement, "Each tag must not exceed 30 characters");
    return false;
  }

  // Check for invalid characters (only allow alphanumeric, underscore, and hyphen after #)
  const invalidTags = tags.filter(tag => !/^#[a-zA-Z0-9_-]+$/.test(tag));
  if (invalidTags.length > 0) {
    showError(tagsField, errorElement, "Tags can only contain letters, numbers, _ and -");
    return false;
  }

  // Check number of tags
  if (tags.length > 10) {
    showError(tagsField, errorElement, "Maximum 10 tags allowed");
    return false;
  }

  showSuccess(tagsField, errorElement);
  return true;
}

/**
 * Validate entire expense form
 */
export function validateExpenseForm() {
  const isTitleValid = validateTitle();
  const isAmountValid = validateAmount();
  const isDescValid = validateDescription();
  const isTagsValid = validateTags();

  return isTitleValid && isAmountValid && isDescValid && isTagsValid;
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
    { field: "expense-desc", error: "expense-desc-error" },
    { field: "expense-tags", error: "expense-tags-error" }
  ];

  fields.forEach(({ field, error }) => {
    const fieldElement = document.getElementById(field);
    const errorElement = document.getElementById(error);
    if (fieldElement && errorElement) {
      clearFieldValidation(fieldElement, errorElement);
    }
  });
}
