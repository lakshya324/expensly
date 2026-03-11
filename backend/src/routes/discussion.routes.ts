import { Router } from "express";
import DiscussionController from "../controllers/discussion.controller.js";
import { validate } from "../middleware/validate.js";
import {
  postMessageValidation,
  editMessageValidation,
} from "../validation/discussion.schema.js";

const router = Router({ mergeParams: true }); // ticketId comes from parent router

//! Discussion Routes [ALL Methods /api/users/expenses/:ticketId/discussion]
//! NOTE: All endpoints return 501 Not Implemented until Expense Discussion ships.

//* Get Thread [GET /api/users/expenses/:ticketId/discussion]
router.get("/", DiscussionController.getThread);

//* Post Message [POST /api/users/expenses/:ticketId/discussion]
router.post(
  "/",
  validate(postMessageValidation),
  DiscussionController.postMessage,
);

//* Edit Message [PATCH /api/users/expenses/:ticketId/discussion/:messageId]
router.patch(
  "/:messageId",
  validate(editMessageValidation),
  DiscussionController.editMessage,
);

//* Delete Message [DELETE /api/users/expenses/:ticketId/discussion/:messageId]
router.delete("/:messageId", DiscussionController.deleteMessage);

export default router;
