import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  getThread,
  postMessage,
  editMessage,
  deleteMessage,
} from "../services/discussion.service.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IDiscussionMessageData } from "../types/discussion.types.js";
import {
  emitDiscussionMessage,
  emitDiscussionEdit,
  emitDiscussionDelete,
} from "../websocket/handlers/ticket.handler.js";

/**
 * DiscussionController — all methods proxy to the discussion service which
 * currently returns 501 Not Implemented. Wire real logic in the service
 * when the Expense Discussion feature is built.
 */
export default class DiscussionController {
  /** GET /api/users/expenses/:ticketId/discussion */
  static async getThread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const ticketId = req.params["ticketId"] as string;
      const page = parseInt((req.query["page"] as string) ?? "") || -1;
      const { data, total, page: actualPage, pageSize } = await getThread(
        org._id.toString(),
        ticketId,
        page,
      );
      const payload: ResponsePayload<{ data: IDiscussionMessageData[]; total: number; page: number; pageSize: number }> = {
        success: true,
        message: "Thread retrieved successfully",
        timestamp: new Date().toISOString(),
        data: { data, total, page: actualPage, pageSize },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/expenses/:ticketId/discussion */
  static async postMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const ticketId = req.params["ticketId"] as string;
      const { text } = req.body as { text?: string };
      const msg = await postMessage({
        ticketId,
        orgId: org._id.toString(),
        authorId: user._id.toString(),
        text: text ?? "",
      });
      emitDiscussionMessage(org._id.toString(), ticketId, msg, user._id.toString());
      const payload: ResponsePayload<IDiscussionMessageData> = {
        success: true,
        message: "Message posted",
        timestamp: new Date().toISOString(),
        data: msg,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/expenses/:ticketId/discussion/:messageId */
  static async editMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { messageId } = req.params as { messageId: string };
      const { text } = req.body as { text?: string };
      const msg = await editMessage(org._id.toString(), messageId, user._id.toString(), {
        text: text ?? "",
      });
      emitDiscussionEdit(org._id.toString(), req.params["ticketId"] as string, msg, user._id.toString());
      const payload: ResponsePayload<IDiscussionMessageData> = {
        success: true,
        message: "Message updated",
        timestamp: new Date().toISOString(),
        data: msg,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/users/expenses/:ticketId/discussion/:messageId */
  static async deleteMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { messageId } = req.params as { messageId: string };
      const ticketId = req.params["ticketId"] as string;
      await deleteMessage(org._id.toString(), messageId, user._id.toString(), user.role);
      emitDiscussionDelete(org._id.toString(), ticketId, messageId, user._id.toString());
      const payload: ResponsePayload = {
        success: true,
        message: "Message deleted",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
