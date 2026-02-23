import { ExtendedError, Server } from "socket.io";
import { AuthSocket } from "../types/types.js";
import { verifyAccessToken } from "../services/auth.service.js";
import { User } from "../models/User.model.js";
import { isValidObjectId } from "mongoose";
import { Organization } from "../models/Organization.model.js";

/**
 * This function is used to authenticate the user. Verify the token and fetches the user from the database.
 * @access Works for organization, teacher and student.
 */
export default (io: Server) =>
  async (socket: AuthSocket, next: (err?: ExtendedError) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const { id } = verifyAccessToken(token);
      if (!id || !isValidObjectId(id)) {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      const user = await User.findById(id);
      if (!user) return next(new Error("Authentication error: User not found"));
      if (user.isDisabled)
        return next(
          new Error("Authentication error: User account is disabled"),
        );

      socket.user = user;

      if (user.orgId && user.role !== "super_admin") {
        const org = await Organization.findById(user.orgId);
        if (!org)
          return next(
            new Error("Authentication error: Organization not found"),
          );
        if (org.isDisabled)
          return next(
            new Error("Authentication error: Organization is disabled"),
          );

        socket.organization = org;
      }

      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  };
