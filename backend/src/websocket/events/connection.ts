import { Server } from "socket.io";
import { AuthSocket } from "../../types/types.js";

export default (io: Server) => async (socket: AuthSocket) => {
  const user = socket.user!; // Set by auth middleware

  //! Join Rooms

  // Joining Organization Room (if applicable) allows us to broadcast org-wide events
  if (user.orgId) await socket.join(user.orgId.toString());

  // Joining User Room allows us to send user-specific events (e.g. notifications)
  await socket.join(user._id.toString());
  console.log(
    `[Socket.IO] User ${user._id} connected (org: ${user.orgId ?? "n/a"}, socket: ${socket.id})`,
  );

  //! Ping / Pong
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });

  //! Disconnect
  // socket.io automatically removes the socket from all rooms on disconnect
  socket.on("disconnect", (reason) => {
    console.log(
      `[Socket.IO] User ${user._id} disconnected (reason: ${reason})`,
    );
  });

  socket.on("error", (err: Error) =>
    console.error("[Socket.IO] Socket error:", err.message),
  );
};
