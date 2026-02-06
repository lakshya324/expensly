import { TicketStore } from "../models/ticket.store.js";

class TagManager {
  constructor() {
    this.tagSet = new Set();
    this.tagRegex = /^#[a-zA-Z0-9_]+$/;
  }

  async sync() {
    const allTickets = await TicketStore.getAllTickets();
    allTickets.forEach((ticket) => {
      if (ticket.tags && Array.isArray(ticket.tags)) {
        ticket.tags.forEach((tag) => this.addTag(tag));
      }
    });
  }

  addTag(tag) {
    const normalizedTag = this.normalizeTag(tag);
    if (!this.tagRegex.test(normalizedTag)) {
      console.warn(
        `Invalid tag format: ${tag}. Tags must start with '#' and contain only alphanumeric characters and underscores.`,
      );
      return false;
    }
    // const sizeBefore = this.tagSet.size;

    this.tagSet.add(normalizedTag);

    // if (this.tagSet.size > sizeBefore) {
    //   console.log(`New tag added: ${normalizedTag}`);
    //   return true;
    // } else {
    //   console.log(`Tag already exists: ${normalizedTag}`);
    //   return false;
    // }
    return true;
  }

  hasTag(tag) {
    const normalizedTag = this.normalizeTag(tag);
    if (!this.tagRegex.test(normalizedTag)) {
      console.warn(
        `Invalid tag format: ${tag}. Tags must start with '#' and contain only alphanumeric characters and underscores.`,
      );
      return false;
    }
    return this.tagSet.has(normalizedTag);
  }

  getAllTags() {
    return Array.from(this.tagSet);
  }

  clear() {
    this.tagSet.clear();
    console.log("All tags cleared");
  }

  // Todo: add tag filtering later
  filterExpensesByTag(expenses, tag) {
    const normalizedTag = this.normalizeTag(tag);
    return expenses.filter(
      (expense) => expense.tags && expense.tags.includes(normalizedTag),
    );
  }

  normalizeTag(tag) {
    if (!tag) return "";
    // Remove spaces and special characters except underscore
    let normalized = tag.replace(/[^a-zA-Z0-9_]/g, "");
    // Add # if not present
    if (!normalized.startsWith("#")) {
      normalized = "#" + normalized;
    }
    return normalized;
  }

  // only for valid parse
  parseTagString(tagString) {
    // Split by both comma and space, then clean up
    return tagString
      .split(/[,\s]+/) // Split by comma or space (one or more)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => this.normalizeTag(tag)) // Add # if missing and normalize
      .filter((tag) => this.tagRegex.test(tag));
  }
}

export const tagManager = new TagManager();
