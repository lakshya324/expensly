/**
 * Discussion Service — STUB
 *
 * All methods return 501 Not Implemented until the Expense Discussion feature is built.
 * Type signatures are defined here so controllers can import them without changes later.
 */
import { createError } from "../utils/error.js";
import { IDiscussionMessageData } from "../types/discussion.types.js";

export interface PostMessageInput {
  ticketId: string;
  orgId: string;
  authorId: string;
  text: string;
}

export interface EditMessageInput {
  text: string;
}

export interface DiscussionThreadPage {
  data: IDiscussionMessageData[];
  total: number;
}

export const getThread = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ticketId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _page?: number,
): Promise<DiscussionThreadPage> => {
  throw createError("Expense Discussion is not yet implemented", 501, "NOT_IMPLEMENTED");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const postMessage = async (_input: PostMessageInput): Promise<IDiscussionMessageData> => {
  throw createError("Expense Discussion is not yet implemented", 501, "NOT_IMPLEMENTED");
};

export const editMessage = async (
  _orgId: string,
  _messageId: string,
  _authorId: string,
  _input: EditMessageInput,
): Promise<IDiscussionMessageData> => {
  throw createError("Expense Discussion is not yet implemented", 501, "NOT_IMPLEMENTED");
};

export const deleteMessage = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _messageId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _authorId: string,
): Promise<void> => {
  throw createError("Expense Discussion is not yet implemented", 501, "NOT_IMPLEMENTED");
};
