import { Server } from "socket.io";
import { AuthSocket } from "../../types/types.js";
import { WS_EVENTS } from "../events.types.js";

export default (io: Server) => async (socket: AuthSocket) => {
  const user = socket.user!; // Set by auth middleware

  //! Join Rooms

  // Org-wide room — for org broadcasts
  if (user.orgId) await socket.join(user.orgId.toString());

  // Personal room — for user-specific events (disable, personal notifications)
  await socket.join(user._id.toString());

  // Dept room — for dept-specific broadcasts (if user has a dept)
  if (user.department) await socket.join(`dept:${user.department.toString()}`);

  console.log(
    `[Socket.IO] User ${user._id} connected (org: ${user.orgId ?? "n/a"}, dept: ${user.department ?? "n/a"}, socket: ${socket.id})`,
  );

  //! Ping / Pong
  socket.on(WS_EVENTS.PING, () => {
    socket.emit(WS_EVENTS.PONG, {
      event: WS_EVENTS.PONG,
      data: {},
      meta: { timestamp: new Date().toISOString(), orgId: user.orgId?.toString() ?? "" },
    });
  });

  //! Subscriptions — allow clients to subscribe/unsubscribe from other dept rooms
  socket.on("subscribe_dept", async (deptId: string) => {
    await socket.join(`dept:${deptId}`);
  });

  socket.on("unsubscribe_dept", async (deptId: string) => {
    await socket.leave(`dept:${deptId}`);
  });

  //! Disconnect
  socket.on("disconnect", (reason) => {
    console.log(
      `[Socket.IO] User ${user._id} disconnected (reason: ${reason})`,
    );
  });

  socket.on("error", (err: Error) =>
    console.error("[Socket.IO] Socket error:", err.message),
  );
};
