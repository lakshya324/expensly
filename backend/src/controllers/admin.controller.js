// Admin Controller

export class AdminController {
  // Edit user details
  static editUser(req, res, wss) {
    const userId = req.params.id;
    const updates = req.body;

    // Broadcast to all WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(
          JSON.stringify({
            type: "user_update",
            userId,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    console.log("Received user edit for:", userId, updates);
    return res.status(200).json({ message: "User edited successfully" });
  }

  // Disable/Enable user
  static toggleUserStatus(req, res, wss) {
    const userId = req.params.id;
    const { isDisabled } = req.body;

    // Broadcast to all WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(
          JSON.stringify({
            type: "user_disable",
            userId,
            isDisabled,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    console.log(`Received user ${isDisabled ? 'disable' : 'enable'} for:`, userId);
    return res.status(200).json({ 
      message: `User ${isDisabled ? 'disabled' : 'enabled'} successfully` 
    });
  }
}
