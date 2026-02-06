import { tagManager } from "../../data/tags.js";
import { FormDraftSession } from "../../storage/session.js";

class TagInputComponent {
  constructor() {
    this.container = document.getElementById("tag-input-container");
    this.input = document.getElementById("expense-tags-input");
    this.tagList = document.getElementById("tag-list");
    this.autocomplete = document.getElementById("tag-autocomplete");
    this.errorElement = document.getElementById("expense-tags-error");
    this.selectedTags = [];
    this.maxTags = 5;

    this.init();
  }

  init() {
    // Handle Enter key to add tag
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.addTag(this.input.value.trim());
        this.input.value = "";
        this.hideAutocomplete();
      } else if (
        e.key === "Backspace" &&
        this.input.value === "" &&
        this.selectedTags.length > 0
      ) {
        // Remove last tag on backspace if input is empty
        this.removeTag(this.selectedTags.length - 1);
      }
    });

    // Show autocomplete while typing
    this.input.addEventListener("input", (e) => {
      this.showAutocomplete(e.target.value);
    });

    // Hide autocomplete when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.container.contains(e.target)) {
        this.hideAutocomplete();
        this.input.blur();
      }
    });

    // Focus input when clicking on container
    this.container.addEventListener("click", () => {
      this.input.focus();
    });
  }

  addTag(tag) {
    if (!tag) return;

    const normalized = tagManager.normalizeTag(tag);

    // Validation
    if (!normalized || normalized === "#") {
      return;
    }

    // Check max tags
    if (this.selectedTags.length >= this.maxTags) {
      this.showError(`Maximum ${this.maxTags} tags allowed`);
      return;
    }

    // Check duplicates
    if (this.selectedTags.includes(normalized)) {
      this.showError("Tag already added");
      return;
    }

    // Check if valid format
    const tagRegex = /^#[a-zA-Z0-9_]+$/;
    if (!tagRegex.test(normalized)) {
      this.showError(
        "Invalid tag format. Use only letters, numbers, and underscores",
      );
      return;
    }

    // Add tag
    this.selectedTags.push(normalized);
    this.renderTags();
    this.clearError();

    // Add to global tag manager
    // tagManager.addTag(normalized);

    FormDraftSession.saveDraft({
      tags: this.getTags(),
    });
  }

  removeTag(index) {
    this.selectedTags.splice(index, 1);
    this.renderTags();
    this.clearError();

    FormDraftSession.saveDraft({
      tags: this.getTags(),
    });
  }

  renderTags() {
    this.tagList.innerHTML = "";

    this.selectedTags.forEach((tag, index) => {
      const tagBox = document.createElement("span");
      tagBox.className = "tag-box";
      tagBox.innerHTML = `
        ${tag}
        <span class="tag-remove" data-index="${index}">&times;</span>
      `;

      // Add remove handler
      tagBox.querySelector(".tag-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeTag(index);
      });

      this.tagList.appendChild(tagBox);
    });

    // Dispatch change event for form draft saving
    this.input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  showAutocomplete(query) {
    if (!query) {
      this.hideAutocomplete();
      return;
    }

    const normalized = tagManager.normalizeTag(query);
    const allTags = tagManager.getAllTags();

    // Filter tags that match the query and are not already selected
    const filtered = allTags.filter(
      (tag) =>
        tag.toLowerCase().includes(normalized.toLowerCase()) &&
        !this.selectedTags.includes(tag),
    );

    if (filtered.length === 0) {
      this.hideAutocomplete();
      return;
    }

    // Show filtered tags
    this.autocomplete.innerHTML = "";
    filtered.slice(0, 10).forEach((tag) => {
      const item = document.createElement("div");
      item.className = "tag-autocomplete-item";
      item.textContent = tag;

      item.addEventListener("click", () => {
        this.addTag(tag);
        this.input.value = "";
        this.hideAutocomplete();
        this.input.focus();
      });

      this.autocomplete.appendChild(item);
    });

    this.autocomplete.style.display = "block";
  }

  hideAutocomplete() {
    this.autocomplete.style.display = "none";
  }

  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
    }

    // Clear error after 3 seconds
    setTimeout(() => this.clearError(), 3000);
  }

  clearError() {
    if (this.errorElement) {
      this.errorElement.textContent = "";
    }
  }

  // Get selected tags as array
  getTags() {
    return [...this.selectedTags];
  }

  // Set tags (for loading draft or editing)
  setTags(tags) {
    this.selectedTags = [];
    if (Array.isArray(tags)) {
      tags.forEach((tag) => this.addTag(tag));
    } else if (typeof tags === "string" && tags) {
      // Parse string tags (comma or space separated)
      const parsedTags = tagManager.parseTagString(tags);
      parsedTags.forEach((tag) => this.addTag(tag));
    }
  }

  // Clear all tags
  clear() {
    this.selectedTags = [];
    this.renderTags();
    this.input.value = "";
    this.hideAutocomplete();
    this.clearError();

    FormDraftSession.saveDraft({
      tags: this.getTags(),
    });
  }
}

export const tagInputComponent = new TagInputComponent();
