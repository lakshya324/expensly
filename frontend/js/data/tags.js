import { TicketStore } from "../models/ticket.store";

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
    const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
    if (!this.tagRegex.test(normalizedTag)) {
      console.warn(
        `Invalid tag format: ${tag}. Tags must start with '#' and contain only alphanumeric characters and underscores.`
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
    const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
    if (!this.tagRegex.test(normalizedTag)) {
      console.warn(
        `Invalid tag format: ${tag}. Tags must start with '#' and contain only alphanumeric characters and underscores.`
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
    const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
    return expenses.filter(
      (expense) => expense.tags && expense.tags.includes(normalizedTag)
    );
  }

  // only for valid parse
  parseTagString(tagString) {
    return tagString
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .filter((tag) => this.tagRegex.test(tag));
  }
}

export const tagManager = new TagManager();
